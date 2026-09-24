import { Container, Graphics, Sprite, Texture, Text, type Application } from 'pixi.js';
import { loadAbilities } from '../editor/abilities/abilityStorage';
import { loadActiveMap } from '../editor/maps/mapStorage';
import type { MapDefinition } from '../editor/maps/types';
import type { AbilityDefinition, AbilityTarget, PeriodicDamageAbilityEffect, SlowAbilityEffect } from '../editor/abilities/types';
import { loadUnits } from '../editor/units/unitStorage';
import { loadUpgrades } from '../editor/upgrades/upgradeStorage';
import type { UpgradeCardDefinition } from '../editor/upgrades/types';
import type { UnitDefinition } from '../editor/units/types';
import type { TileKind } from './types';
import { getEnemySpawnY, getEnemySpeedScale } from './movementLogic';
import { getRuntimeSpawnBlock, getRuntimeUnit, getRuntimeWave, getWaveBlockStep } from './waveLogic';
import { createUnitLookup, getDamageAfterProtection } from './unitRuntime';
import { useGameStore } from '../store/gameStore';
import { generateUpgradeChoices } from './upgrades/upgradeGenerator';
import { applyAbilityRuntimeModifier } from './upgrades/upgradeCalculator';
import {
  earnsBossUpgradeReward,
  resolveWaveUpgradeReward,
  shouldShowUpgradeReward,
  type EnemyExitReason,
} from './upgrades/upgradeRewardLogic';
import { SpellEffects } from './effects/SpellEffects';
import { PeriodicDamageAura } from './effects/PeriodicDamageAura';
import { formatDamagePopup, resolveDamageHit } from './damageLogic';
import {
  advanceAreaEffect,
  collectNewAreaTargets,
  createActiveAreaEffect,
  getTargetsInArea,
  type ActiveAreaEffect,
  type AreaAbilityEffect,
} from './areaEffectLogic';
import {
  advancePeriodicDamage,
  createActivePeriodicDamage,
  resolvePeriodicDamageTick,
  shouldApplyPeriodicDamage,
  type ActivePeriodicDamage,
} from './periodicDamageLogic';

interface Enemy {
  root: Container;
  body: Graphics | Sprite;
  hpBar: Graphics;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  coinsOnDeath: number;
  damageProtection?: UnitDefinition['damageProtection'];
  frozenFor: number;
  slowPercent: number;
  isBoss: boolean;
  grantsUpgradeOnKill: boolean;
}

interface ActiveBattleAreaEffect extends ActiveAreaEffect<Enemy> {
  abilityId: TileKind;
}

interface ActiveBattlePeriodicDamage extends ActivePeriodicDamage<Enemy> {
  abilityId: TileKind;
  aura: PeriodicDamageAura;
}

interface ActiveDamagePopup {
  text: Text;
  remaining: number;
}

export class BattleScene extends Container {
  private readonly app: Application;
  private readonly battlefield = new Container();
  private readonly enemiesLayer = new Container();
  private readonly spellEffects = new SpellEffects();
  private readonly noticeLayer = new Container();
  private readonly bg = new Graphics();
  private backgroundSprite: Sprite | null = null;
  private backgroundImageWidth = 0;
  private backgroundImageHeight = 0;
  private readonly castle = new Container();
  private readonly enemies: Enemy[] = [];
  private readonly activeAreaEffects: ActiveBattleAreaEffect[] = [];
  private readonly activePeriodicDamages: ActiveBattlePeriodicDamage[] = [];
  private readonly activeDamagePopups: ActiveDamagePopup[] = [];
  private readonly stateUnsubscribe: () => void;
  private readonly unitsById: Map<string, UnitDefinition>;
  private readonly map: MapDefinition;
  private readonly abilitiesById: Map<TileKind, AbilityDefinition>;
  private readonly upgradeCards: UpgradeCardDefinition[];
  private layoutWidth = 0;
  private enemySpeedScale = 1;

  private castleY = 250;
  private battleHeight = 340;
  private spawnTimer = 0;
  private waveIndex = 0;
  private blockIndex = 0;
  private spawnedThisBlock = 0;
  private betweenWavesFor = 0;
  private autoShuffleMessageFor = 0;
  private autoShuffleText: Text | null = null;
  private resultOverlay: Container | null = null;
  private cleanupDone = false;
  private bossUpgradeRewardEarned = false;
  private pendingWaveAdvance = false;

  constructor(app: Application) {
    super();
    this.app = app;

    const units = loadUnits();
    this.unitsById = createUnitLookup(units);
    this.map = loadActiveMap();
    const abilities = loadAbilities();
    this.abilitiesById = new Map(abilities.map((ability) => [ability.id, ability]));
    this.upgradeCards = loadUpgrades();

    this.addChild(this.bg, this.battlefield, this.noticeLayer);
    this.battlefield.addChild(this.enemiesLayer, this.castle, this.spellEffects);

    useGameStore.getState().reset(
      this.map.endless.enabled ? 0 : this.map.waves.length,
      [...this.abilitiesById.keys()],
    );
    this.loadMapBackground();
    this.buildCastle();
    this.buildNotice();
    this.layout();

    this.stateUnsubscribe = useGameStore.subscribe((state) => {
      if (state.phase === 'victory' || state.phase === 'defeat') this.showResult(state.phase);
    });

    this.app.ticker.add(this.update);
  }

  destroy(options?: Parameters<Container['destroy']>[0]) {
    if (this.cleanupDone) return;
    this.cleanupDone = true;

    this.app.ticker?.remove(this.update);
    this.stateUnsubscribe();
    super.destroy(options);
  }

  private readonly update = (ticker: { deltaMS: number }) => {
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    const state = useGameStore.getState();

    if (this.autoShuffleMessageFor > 0) {
      this.autoShuffleMessageFor -= dt;
      if (this.autoShuffleMessageFor <= 0 && this.autoShuffleText) this.autoShuffleText.visible = false;
    }

    this.spellEffects.update(dt);
    this.updateDamagePopups(dt);

    if (state.phase !== 'playing') return;

    this.updateWave(dt);
    this.updateEnemies(dt);
    this.updateAreaEffects(dt);
    this.updatePeriodicDamages(dt);
  };

  private updateWave(dt: number) {
    if (this.betweenWavesFor > 0) {
      this.betweenWavesFor -= dt;
      return;
    }

    const runtimeWave = getRuntimeWave(this.map, this.waveIndex);
    if (!runtimeWave) {
      useGameStore.getState().setPhase('victory');
      return;
    }

    const block = runtimeWave.wave.blocks[this.blockIndex];
    if (!block) {
      if (this.enemies.length > 0) return;
      this.completeWave();
      return;
    }

    const runtimeBlock = getRuntimeSpawnBlock(
      block,
      this.map.endless,
      runtimeWave.endlessCycle,
    );
    const nextBlock = runtimeWave.wave.blocks[this.blockIndex + 1];
    const step = getWaveBlockStep({
      spawnedUnits: this.spawnedThisBlock,
      blockCount: runtimeBlock.count,
      activeEnemies: this.enemies.length,
      hasNextBlock: Boolean(nextBlock),
      nextStartWhen: nextBlock?.startWhen,
    });

    if (step === 'spawn-unit') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const unit = this.getUnit(runtimeBlock.unitId);
        if (unit) {
          const runtimeUnit = getRuntimeUnit(unit, this.map.endless, runtimeWave.endlessCycle);
          this.spawnEnemy(runtimeUnit);
        }
        this.spawnedThisBlock += 1;
        this.spawnTimer = runtimeBlock.spawnEvery;
      }
      return;
    }

    if (step === 'wait-field-clear') return;

    if (step === 'advance-block') {
      this.blockIndex += 1;
      this.spawnedThisBlock = 0;
      this.spawnTimer = 0;
      return;
    }

    this.completeWave();
  }

  private completeWave() {
    const runtimeWave = getRuntimeWave(this.map, this.waveIndex);
    const nextWaveIndex = this.waveIndex + 1;
    const hasNextWave = Boolean(getRuntimeWave(this.map, nextWaveIndex));
    if (!runtimeWave || !hasNextWave) {
      this.bossUpgradeRewardEarned = false;
      this.pendingWaveAdvance = false;
      useGameStore.getState().setPhase('victory');
      return;
    }

    const effectiveReward = resolveWaveUpgradeReward(
      this.map.upgradeSettings,
      runtimeWave.wave.upgradeReward,
    );
    const shouldReward = shouldShowUpgradeReward(
      hasNextWave,
      this.bossUpgradeRewardEarned,
      effectiveReward.enabled,
    );
    const state = useGameStore.getState();
    if (shouldReward && state.boardBusy) return;

    this.bossUpgradeRewardEarned = false;

    if (shouldReward) {
      const choices = generateUpgradeChoices(
        this.upgradeCards,
        state.upgradeCounts,
        effectiveReward.cardCount,
      );
      if (choices.length > 0) {
        this.pendingWaveAdvance = true;
        state.openUpgradeSelection(choices);
        return;
      }
    }

    this.advanceToNextWave();
  }

  private advanceToNextWave() {
    this.pendingWaveAdvance = false;
    this.waveIndex += 1;
    this.blockIndex = 0;
    this.spawnedThisBlock = 0;
    this.spawnTimer = 0.3;
    this.betweenWavesFor = 2;
    useGameStore.getState().setWave(this.waveIndex + 1);
  }

  continueAfterUpgrade() {
    if (!this.pendingWaveAdvance || useGameStore.getState().phase !== 'playing') return;
    this.advanceToNextWave();
  }

  private getUnit(unitId: string): UnitDefinition | undefined {
    return this.unitsById.get(unitId);
  }

  private spawnEnemy(unit: UnitDefinition) {
    const isBoss = unit.isBoss;
    const { hp, speed, damage, coinsOnDeath, damageProtection } = unit;
    const root = new Container();
    const body = new Graphics();
    const hpBar = new Graphics();
    const radius = isBoss ? 31 : 20;

    body
      .circle(0, 0, radius)
      .fill({ color: isBoss ? 0x8b5cf6 : 0x8bc34a })
      .stroke({ color: isBoss ? 0xf5d0fe : 0x365314, width: isBoss ? 4 : 3 });
    root.addChild(body, hpBar);

    if (!unit.image?.src) {
      const eyeY = isBoss ? -6 : -4;
      const eyeX = isBoss ? 10 : 7;
      const eyeRadius = isBoss ? 3.5 : 2.5;
      const eyeLeft = new Graphics().circle(-eyeX, eyeY, eyeRadius).fill(0xffffff);
      const eyeRight = new Graphics().circle(eyeX, eyeY, eyeRadius).fill(0xffffff);
      root.addChild(eyeLeft, eyeRight);
    }

    if (isBoss) {
      const bossLabel = new Text({
        text: 'БОСС',
        style: { fill: 0xffe4f2, fontSize: 12, fontWeight: '900' },
      });
      bossLabel.anchor.set(0.5);
      bossLabel.y = -47;
      root.addChild(bossLabel);
    }

    root.x = isBoss
      ? this.app.screen.width / 2
      : 34 + Math.random() * Math.max(40, this.app.screen.width - 68);
    const visualBottomExtent = Math.max(radius, (isBoss ? 37 : 24) + 6);
    root.y = getEnemySpawnY(visualBottomExtent);

    this.enemiesLayer.addChild(root);
    const enemy: Enemy = {
      root,
      body,
      hpBar,
      hp,
      maxHp: hp,
      speed,
      damage,
      coinsOnDeath,
      damageProtection,
      frozenFor: 0,
      slowPercent: 0,
      isBoss,
      grantsUpgradeOnKill: unit.grantsUpgradeOnKill,
    };
    this.enemies.push(enemy);
    this.redrawEnemyHp(enemy);

    if (unit.image?.src) this.applyEnemyImage(enemy, unit.image.src, radius);
  }

  private applyEnemyImage(enemy: Enemy, src: string, radius: number) {
    const image = new Image();

    image.onload = () => {
      if (enemy.root.destroyed) return;

      const texture = Texture.from(image);
      const sprite = new Sprite(texture);
      const sourceSize = Math.max(image.naturalWidth, image.naturalHeight);
      const targetSize = radius * 2;

      sprite.anchor.set(0.5);
      if (sourceSize > 0) sprite.scale.set(targetSize / sourceSize);
      sprite.tint = enemy.frozenFor > 0 ? 0xaadfff : 0xffffff;

      enemy.root.addChildAt(sprite, 0);
      enemy.root.removeChild(enemy.body);
      enemy.body.destroy();
      enemy.body = sprite;
    };

    image.src = src;
  }

  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      enemy.frozenFor = Math.max(0, enemy.frozenFor - dt);
      if (enemy.frozenFor <= 0) enemy.slowPercent = 0;
      const speedMultiplier = enemy.frozenFor > 0 ? Math.max(0, 1 - enemy.slowPercent / 100) : 1;
      enemy.body.tint = enemy.frozenFor > 0 ? 0xaadfff : 0xffffff;
      enemy.root.y += enemy.speed * this.enemySpeedScale * speedMultiplier * dt;

      if (enemy.root.y >= this.castleY - 30) {
        useGameStore.getState().damageCastle(enemy.damage);
        this.removeEnemy(enemy, i, 'reached-base');
      }
    }
  }

  private damageEnemy(
    enemy: Enemy,
    amount: number,
    sourceId: string,
    critical = false,
    criticalMultiplier = 1,
  ) {
    const dealtDamage = getDamageAfterProtection(amount, sourceId, enemy.damageProtection);
    enemy.hp -= dealtDamage;
    this.showDamagePopup(enemy, dealtDamage, critical, criticalMultiplier);

    if (enemy.hp <= 0) {
      const index = this.enemies.indexOf(enemy);
      if (index >= 0) this.removeEnemy(enemy, index, 'killed');
      return;
    }
    this.redrawEnemyHp(enemy);
  }

  private showDamagePopup(enemy: Enemy, amount: number, critical: boolean, criticalMultiplier: number) {
    const text = new Text({
      text: formatDamagePopup(amount, critical, criticalMultiplier),
      style: {
        fill: critical ? 0xffd166 : 0xffffff,
        fontSize: critical ? 18 : 14,
        fontWeight: '900',
      },
    });
    text.anchor.set(0.5);
    text.position.set(enemy.root.x, enemy.root.y - (enemy.isBoss ? 52 : 34));
    this.noticeLayer.addChild(text);
    this.activeDamagePopups.push({ text, remaining: critical ? 1.05 : 0.85 });
  }

  private updateDamagePopups(dt: number) {
    for (let i = this.activeDamagePopups.length - 1; i >= 0; i -= 1) {
      const popup = this.activeDamagePopups[i];
      popup.remaining -= dt;
      popup.text.y -= (popup.remaining > 0.45 ? 38 : 22) * dt;
      popup.text.alpha = Math.max(0, Math.min(1, popup.remaining / 0.3));

      if (popup.remaining > 0) continue;
      this.activeDamagePopups.splice(i, 1);
      popup.text.destroy();
    }
  }

  private removeEnemy(enemy: Enemy, index: number, reason: EnemyExitReason) {
    for (let i = this.activePeriodicDamages.length - 1; i >= 0; i -= 1) {
      if (this.activePeriodicDamages[i].target === enemy) this.removePeriodicDamageAt(i);
    }

    this.enemies.splice(index, 1);
    enemy.root.destroy({ children: true });
    if (reason === 'killed') {
      useGameStore.getState().addKill(enemy.coinsOnDeath);
      if (earnsBossUpgradeReward(
        enemy.isBoss,
        this.map.upgradeSettings.rewardOnBossKill || enemy.grantsUpgradeOnKill,
        reason,
      )) {
        this.bossUpgradeRewardEarned = true;
      }
    }
  }

  private redrawEnemyHp(enemy: Enemy) {
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    const width = enemy.isBoss ? 60 : 36;
    const y = enemy.isBoss ? 37 : 24;
    enemy.hpBar.clear();
    enemy.hpBar.roundRect(-width / 2, y, width, 6, 2).fill({ color: 0x172033 });
    enemy.hpBar.roundRect(-width / 2, y, width * ratio, 6, 2).fill({ color: 0xff5b6e });
  }

  castSpell(kind: TileKind) {
    this.cast(kind);
  }

  handleBoardMatch(kind: TileKind, amount: number) {
    useGameStore.getState().handleMatch(kind, amount, (matchedKind) => this.cast(matchedKind, false));
  }

  notifyAutoShuffle() {
    this.showAutoShuffleMessage();
  }

  private cast(kind: TileKind, spendCharge = true) {
    const state = useGameStore.getState();
    const baseAbility = this.abilitiesById.get(kind);
    if (!baseAbility || baseAbility.effects.length === 0) return;
    const ability = applyAbilityRuntimeModifier(baseAbility, state.abilityModifiers[kind]);

    const resolvedEffects = ability.effects.map((effect) => ({
      effect,
      targets: this.resolveEnemyTargets(effect.target),
    }));

    const hasUsefulEffect = resolvedEffects.some(({ effect, targets }) => {
      if (effect.type === 'heal') {
        return effect.target.type === 'castle' && state.castleHp < state.castleMaxHp;
      }
      if (effect.target.type === 'castle') return true;
      if (effect.target.type === 'area-enemies') return true;
      return targets.length > 0;
    });

    if (state.phase !== 'playing' || !hasUsefulEffect || (spendCharge && !state.spendCharge(kind))) {
      return;
    }

    const lightningTargetPoints = resolvedEffects
      .flatMap(({ targets }) => targets.map((enemy) => ({ x: enemy.root.x, y: enemy.root.y })))
      .filter((point, index, points) => (
        points.findIndex((candidate) => candidate.x === point.x && candidate.y === point.y) === index
      ));

    const hasCastleTarget = ability.effects.some((effect) => effect.target.type === 'castle');
    const hasAreaEffect = ability.effects.some((effect) => (
      effect.target.type === 'area-enemies' && (
        effect.type === 'damage' || effect.type === 'periodic-damage' || effect.type === 'slow'
      )
    ));

    if (hasAreaEffect) this.clearAreaEffectsForAbility(kind);

    for (const { effect, targets } of resolvedEffects) {
      if (effect.target.type === 'area-enemies' && (
        effect.type === 'damage' || effect.type === 'periodic-damage' || effect.type === 'slow'
      )) {
        this.activateAreaEffect(kind, effect);
        continue;
      }

      if (effect.type === 'damage') {
        if (effect.target.type === 'castle') {
          const hit = resolveDamageHit(
            effect.amount,
            effect.criticalChancePercent,
            effect.criticalMultiplier,
          );
          state.damageCastle(hit.amount);
        } else {
          targets.forEach((enemy) => {
            if (this.enemies.includes(enemy)) {
              const hit = resolveDamageHit(
                effect.amount,
                effect.criticalChancePercent,
                effect.criticalMultiplier,
              );
              this.damageEnemy(
                enemy,
                hit.amount,
                effect.damageSourceId,
                hit.critical,
                hit.criticalMultiplier,
              );
            }
          });
        }
      } else if (effect.type === 'periodic-damage') {
        targets.forEach((enemy) => this.applyPeriodicDamage(enemy, effect, kind));
      } else if (effect.type === 'slow') {
        targets.forEach((enemy) => this.applySlowEffect(enemy, effect));
      } else if (effect.type === 'heal' && effect.target.type === 'castle') {
        state.healCastle(effect.amount);
      }
    }

    if (ability.visualEffect === 'none') return;

    if (ability.visualEffect === 'lightning') {
      const targetPoints = [...lightningTargetPoints];
      let source = { x: this.app.screen.width / 2, y: this.castleY - 18 };

      if (targetPoints.length === 0 && hasCastleTarget) {
        source = { x: this.app.screen.width / 2, y: 18 };
        targetPoints.push({ x: this.app.screen.width / 2, y: this.castleY - 18 });
      } else if (targetPoints.length === 0) {
        targetPoints.push({ x: this.app.screen.width / 2, y: this.battleHeight / 2 });
      }

      this.spellEffects.play('lightning', {
        source,
        targets: targetPoints,
      });
      return;
    }

    const areaTarget = ability.effects
      .map((effect) => effect.target)
      .find((target) => target.type === 'area-enemies');

    this.spellEffects.play(ability.visualEffect, {
      areaHeightPercent: ability.visualEffect === 'fire' && areaTarget?.type === 'area-enemies'
        ? areaTarget.areaHeightPercent
        : undefined,
    });
  }

  private activateAreaEffect(abilityId: TileKind, effect: AreaAbilityEffect) {
    const activeEffect: ActiveBattleAreaEffect = {
      ...createActiveAreaEffect<Enemy>(effect),
      abilityId,
    };
    this.applyAreaEffect(activeEffect);
    if (activeEffect.remaining > 0) this.activeAreaEffects.push(activeEffect);
  }

  private clearAreaEffectsForAbility(abilityId: TileKind) {
    for (let i = this.activeAreaEffects.length - 1; i >= 0; i -= 1) {
      if (this.activeAreaEffects[i].abilityId === abilityId) this.activeAreaEffects.splice(i, 1);
    }
  }

  private updateAreaEffects(dt: number) {
    for (let i = this.activeAreaEffects.length - 1; i >= 0; i -= 1) {
      const activeEffect = this.activeAreaEffects[i];
      this.applyAreaEffect(activeEffect);
      if (!advanceAreaEffect(activeEffect, dt)) this.activeAreaEffects.splice(i, 1);
    }
  }

  private applyAreaEffect(activeEffect: ActiveBattleAreaEffect) {
    const targets = collectNewAreaTargets(
      activeEffect,
      this.enemies,
      (enemy) => enemy.root.y,
      this.battleHeight,
    );

    for (const enemy of targets) {
      if (!this.enemies.includes(enemy)) continue;
      if (activeEffect.effect.type === 'damage') {
        const hit = resolveDamageHit(
          activeEffect.effect.amount,
          activeEffect.effect.criticalChancePercent,
          activeEffect.effect.criticalMultiplier,
        );
        this.damageEnemy(
          enemy,
          hit.amount,
          activeEffect.effect.damageSourceId,
          hit.critical,
          hit.criticalMultiplier,
        );
      } else if (activeEffect.effect.type === 'periodic-damage') {
        this.applyPeriodicDamage(enemy, activeEffect.effect, activeEffect.abilityId);
      } else {
        this.applySlowEffect(enemy, activeEffect.effect);
      }
    }
  }

  private applyPeriodicDamage(enemy: Enemy, effect: PeriodicDamageAbilityEffect, abilityId: TileKind) {
    if (!this.enemies.includes(enemy) || !shouldApplyPeriodicDamage(effect.chancePercent)) return;

    const aura = new PeriodicDamageAura(effect.visualColor, enemy.isBoss);
    enemy.root.addChild(aura);
    const activeEffect: ActiveBattlePeriodicDamage = {
      ...createActivePeriodicDamage(enemy, effect),
      abilityId,
      aura,
    };
    const existingIndex = this.activePeriodicDamages.findIndex((item) => (
      item.abilityId === abilityId && item.target === enemy
    ));

    if (existingIndex >= 0) {
      this.removePeriodicDamageAt(existingIndex);
    }
    this.activePeriodicDamages.push(activeEffect);
  }

  private updatePeriodicDamages(dt: number) {
    for (let i = this.activePeriodicDamages.length - 1; i >= 0; i -= 1) {
      const activeEffect = this.activePeriodicDamages[i];
      if (!this.enemies.includes(activeEffect.target)) {
        this.removePeriodicDamageAt(i);
        continue;
      }

      activeEffect.aura.update(dt);
      const ticks = advancePeriodicDamage(activeEffect, dt);
      for (let tick = 0; tick < ticks; tick += 1) {
        if (!this.enemies.includes(activeEffect.target)) break;
        const hit = resolvePeriodicDamageTick(activeEffect.effect);
        this.damageEnemy(
          activeEffect.target,
          hit.amount,
          'periodic-damage',
          hit.critical,
          hit.criticalMultiplier,
        );
      }

      if (activeEffect.remaining <= 0 || !this.enemies.includes(activeEffect.target)) {
        if (this.activePeriodicDamages[i] === activeEffect) this.removePeriodicDamageAt(i);
      }
    }
  }

  private removePeriodicDamageAt(index: number) {
    const activeEffect = this.activePeriodicDamages[index];
    if (!activeEffect) return;

    this.activePeriodicDamages.splice(index, 1);
    if (activeEffect.aura.parent) activeEffect.aura.parent.removeChild(activeEffect.aura);
    activeEffect.aura.destroy({ children: true });
  }

  private applySlowEffect(enemy: Enemy, effect: SlowAbilityEffect) {
    if (!this.enemies.includes(enemy)) return;
    enemy.frozenFor = Math.max(enemy.frozenFor, effect.duration);
    enemy.slowPercent = Math.max(enemy.slowPercent, effect.slowPercent);
  }

  private resolveEnemyTargets(target: AbilityTarget): Enemy[] {
    if (target.type === 'all-enemies') return [...this.enemies];
    if (target.type === 'area-enemies') {
      return getTargetsInArea(target, this.enemies, (enemy) => enemy.root.y, this.battleHeight);
    }
    if (target.type === 'castle') return [];

    const limit = Math.max(1, Math.floor(target.count ?? 1));
    if (target.type === 'random-enemies') return this.randomEnemies(limit);
    return this.closestEnemies(limit);
  }

  private randomEnemies(limit: number) {
    const pool = [...this.enemies];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, limit);
  }

  private closestEnemies(limit: number) {
    return [...this.enemies]
      .sort((a, b) => b.root.y - a.root.y)
      .slice(0, limit);
  }

  private loadMapBackground() {
    const src = this.map.background.image?.src;
    if (!src) return;

    const image = new Image();
    image.onload = () => {
      if (this.cleanupDone) return;

      this.backgroundImageWidth = image.naturalWidth;
      this.backgroundImageHeight = image.naturalHeight;
      const sprite = new Sprite(Texture.from(image));
      this.backgroundSprite = sprite;
      this.addChildAt(sprite, 1);
      this.layoutMapBackground();
    };
    image.src = src;
  }

  private layoutMapBackground() {
    const sprite = this.backgroundSprite;
    if (!sprite || this.backgroundImageWidth <= 0 || this.backgroundImageHeight <= 0) return;

    const width = Math.max(1, this.app.screen.width);
    const height = Math.max(1, this.app.screen.height);
    const imageRatio = this.backgroundImageWidth / this.backgroundImageHeight;
    const canvasRatio = width / height;
    const useWidth = this.map.background.fit === 'cover'
      ? imageRatio < canvasRatio
      : imageRatio > canvasRatio;

    const drawWidth = useWidth ? width : height * imageRatio;
    const drawHeight = useWidth ? width / imageRatio : height;

    sprite.width = drawWidth;
    sprite.height = drawHeight;
    sprite.position.set((width - drawWidth) / 2, (height - drawHeight) / 2);
  }

  private buildCastle() {
    const base = new Graphics()
      .roundRect(-38, -26, 76, 52, 12)
      .fill({ color: 0x64748b })
      .stroke({ color: 0xcbd5e1, width: 3 });
    const mage = new Text({ text: '🧙', style: { fontSize: 35 } });
    mage.anchor.set(0.5);
    mage.y = -35;
    this.castle.addChild(base, mage);
  }

  private buildNotice() {
    this.autoShuffleText = new Text({
      text: 'Нет ходов — поле перемешано бесплатно',
      style: { fill: 0xffffff, fontSize: 13, fontWeight: '600' },
    });
    this.autoShuffleText.anchor.set(0.5);
    this.autoShuffleText.visible = false;
    this.noticeLayer.addChild(this.autoShuffleText);
  }

  resize() {
    this.layout();
  }

  private readonly layout = () => {
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    const previousWidth = this.layoutWidth || width;
    const previousCastleY = this.castleY;
    const compact = width <= 600 || height <= 360;

    const backgroundColor = Number.parseInt(this.map.background.color.slice(1), 16);
    this.bg.clear().rect(0, 0, width, height).fill({
      color: Number.isFinite(backgroundColor) ? backgroundColor : 0x0b1020,
    });
    this.layoutMapBackground();

    this.battleHeight = Math.max(1, height);
    this.castleY = Math.max(82, height - 38);
    const enemyPathLength = Math.max(0, this.castleY - 30 - 62);
    this.enemySpeedScale = getEnemySpeedScale(enemyPathLength, compact);
    this.castle.position.set(width / 2, this.castleY);

    this.spellEffects.resize({
      x: 0,
      y: 0,
      width: Math.max(1, width),
      height: this.battleHeight,
    });

    if (this.autoShuffleText) this.autoShuffleText.position.set(width / 2, Math.max(18, height - 14));

    if (this.enemies.length > 0) {
      const laneTop = 18;
      const previousLaneEnd = Math.max(laneTop + 1, previousCastleY - 30);
      const nextLaneEnd = Math.max(laneTop + 1, this.castleY - 30);
      const widthScale = previousWidth > 0 ? width / previousWidth : 1;

      for (const enemy of this.enemies) {
        const sidePadding = enemy.isBoss ? 34 : 24;
        enemy.root.x = Math.min(width - sidePadding, Math.max(sidePadding, enemy.root.x * widthScale));
        if (enemy.root.y < 0) continue;

        const progress = Math.max(0, Math.min(1, (enemy.root.y - laneTop) / (previousLaneEnd - laneTop)));
        enemy.root.y = laneTop + progress * (nextLaneEnd - laneTop);
      }
    }

    if (this.resultOverlay) {
      const shade = this.resultOverlay.children[0];
      const card = this.resultOverlay.children[1];
      if (shade instanceof Graphics) {
        shade.clear().rect(0, 0, width, height).fill({ color: 0x020617, alpha: 0.72 });
      }
      if (card) card.position.set(width / 2, height / 2);
    }

    this.layoutWidth = width;
  };


  private showAutoShuffleMessage() {
    this.autoShuffleMessageFor = 1.8;
    if (this.autoShuffleText) this.autoShuffleText.visible = true;
  }

  private showResult(phase: 'victory' | 'defeat') {
    if (this.resultOverlay) return;

    const overlay = new Container();
    const shade = new Graphics()
      .rect(0, 0, this.app.screen.width, this.app.screen.height)
      .fill({ color: 0x020617, alpha: 0.72 });
    const panel = new Graphics()
      .roundRect(-145, -95, 290, 190, 22)
      .fill({ color: 0x111827 })
      .stroke({ color: phase === 'victory' ? 0x62d994 : 0xff6577, width: 3 });
    const title = new Text({
      text: phase === 'victory' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ',
      style: { fill: 0xffffff, fontSize: 30, fontWeight: '900' },
    });
    title.anchor.set(0.5);
    title.y = -32;

    const hint = new Text({
      text: 'Нажми, чтобы начать заново',
      style: { fill: 0xcbd5e1, fontSize: 15 },
    });
    hint.anchor.set(0.5);
    hint.y = 26;

    const card = new Container();
    card.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
    card.addChild(panel, title, hint);
    overlay.addChild(shade, card);
    overlay.eventMode = 'static';
    overlay.cursor = 'pointer';
    overlay.on('pointertap', () => this.restart());

    this.addChild(overlay);
    this.resultOverlay = overlay;
  }

  private restart() {
    this.resultOverlay?.destroy({ children: true });
    this.resultOverlay = null;

    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      this.enemies[i].root.destroy({ children: true });
    }
    this.enemies.length = 0;
    this.activeAreaEffects.length = 0;
    this.activePeriodicDamages.length = 0;
    for (const popup of this.activeDamagePopups) popup.text.destroy();
    this.activeDamagePopups.length = 0;
    this.spellEffects.clearEffects();

    this.waveIndex = 0;
    this.blockIndex = 0;
    this.spawnedThisBlock = 0;
    this.spawnTimer = 0;
    this.betweenWavesFor = 0;
    this.bossUpgradeRewardEarned = false;
    this.pendingWaveAdvance = false;
    useGameStore.getState().reset(
      this.map.endless.enabled ? 0 : this.map.waves.length,
      [...this.abilitiesById.keys()],
    );
  }
}
