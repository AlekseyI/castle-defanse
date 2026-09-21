import { Container, Graphics, Text, type Application } from 'pixi.js';
import { WAVES } from './config';
import type { TileKind } from './types';
import { getEnemySpeedScale } from './movementLogic';
import { getWaveStep } from './waveLogic';
import { useGameStore } from '../store/gameStore';
import { SpellEffects } from './effects/SpellEffects';
import { FROST_DURATION } from './effects/FrostEffect';

interface Enemy {
  root: Container;
  body: Graphics;
  hpBar: Graphics;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  frozenFor: number;
  isBoss: boolean;
}

export class BattleScene extends Container {
  private readonly app: Application;
  private readonly battlefield = new Container();
  private readonly enemiesLayer = new Container();
  private readonly spellEffects = new SpellEffects();
  private readonly noticeLayer = new Container();
  private readonly bg = new Graphics();
  private readonly castle = new Container();
  private readonly enemies: Enemy[] = [];
  private readonly stateUnsubscribe: () => void;
  private layoutWidth = 0;
  private enemySpeedScale = 1;

  private castleY = 250;
  private battleHeight = 340;
  private spawnTimer = 0;
  private waveIndex = 0;
  private spawnedThisWave = 0;
  private bossSpawnedThisWave = false;
  private betweenWavesFor = 0;
  private autoShuffleMessageFor = 0;
  private autoShuffleText: Text | null = null;
  private resultOverlay: Container | null = null;
  private cleanupDone = false;

  constructor(app: Application) {
    super();
    this.app = app;

    this.addChild(this.bg, this.battlefield, this.noticeLayer);
    this.battlefield.addChild(this.enemiesLayer, this.castle, this.spellEffects);

    useGameStore.getState().reset(WAVES.length);
    this.buildCastle();
    this.buildNotice();
    this.layout();

    this.stateUnsubscribe = useGameStore.subscribe((state) => {
      if (state.phase !== 'playing') this.showResult(state.phase);
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

    if (state.phase !== 'playing') return;

    this.updateWave(dt);
    this.updateEnemies(dt);
  };

  private updateWave(dt: number) {
    if (this.betweenWavesFor > 0) {
      this.betweenWavesFor -= dt;
      return;
    }

    const wave = WAVES[this.waveIndex];
    if (!wave) return;

    const step = getWaveStep({
      spawnedEnemies: this.spawnedThisWave,
      enemyCount: wave.count,
      activeEnemies: this.enemies.length,
      bossSpawned: this.bossSpawnedThisWave,
    });

    if (step === 'spawn-enemy') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy(wave.hp, wave.speed, wave.damage);
        this.spawnedThisWave += 1;
        this.spawnTimer = wave.spawnEvery;
      }
      return;
    }

    if (step === 'wait-enemies') return;

    if (step === 'spawn-boss') {
      this.spawnEnemy(wave.boss.hp, wave.boss.speed, wave.boss.damage, true);
      this.bossSpawnedThisWave = true;
      return;
    }

    if (this.waveIndex >= WAVES.length - 1) {
      useGameStore.getState().setPhase('victory');
      return;
    }

    this.waveIndex += 1;
    this.spawnedThisWave = 0;
    this.bossSpawnedThisWave = false;
    this.spawnTimer = 0.3;
    this.betweenWavesFor = 2;
    useGameStore.getState().setWave(this.waveIndex + 1);
  }

  private spawnEnemy(hp: number, speed: number, damage: number, isBoss = false) {
    const root = new Container();
    const body = new Graphics();
    const hpBar = new Graphics();
    const radius = isBoss ? 31 : 20;
    const eyeY = isBoss ? -6 : -4;
    const eyeX = isBoss ? 10 : 7;
    const eyeRadius = isBoss ? 3.5 : 2.5;
    const eyeLeft = new Graphics().circle(-eyeX, eyeY, eyeRadius).fill(0xffffff);
    const eyeRight = new Graphics().circle(eyeX, eyeY, eyeRadius).fill(0xffffff);

    body
      .circle(0, 0, radius)
      .fill({ color: isBoss ? 0x8b5cf6 : 0x8bc34a })
      .stroke({ color: isBoss ? 0xf5d0fe : 0x365314, width: isBoss ? 4 : 3 });
    root.addChild(body, eyeLeft, eyeRight, hpBar);

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
    const spawnMaxY = Math.max(62, Math.min(86, this.castleY - 70));
    root.y = isBoss ? Math.min(82, spawnMaxY) : 62 + Math.random() * Math.max(0, spawnMaxY - 62);

    this.enemiesLayer.addChild(root);
    const enemy: Enemy = { root, body, hpBar, hp, maxHp: hp, speed, damage, frozenFor: 0, isBoss };
    this.enemies.push(enemy);
    this.redrawEnemyHp(enemy);
  }

  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      enemy.frozenFor = Math.max(0, enemy.frozenFor - dt);
      const speedMultiplier = enemy.frozenFor > 0 ? 0.18 : 1;
      enemy.body.tint = enemy.frozenFor > 0 ? 0xaadfff : 0xffffff;
      enemy.root.y += enemy.speed * this.enemySpeedScale * speedMultiplier * dt;

      if (enemy.root.y >= this.castleY - 30) {
        useGameStore.getState().damageCastle(enemy.damage);
        this.removeEnemy(enemy, i, false);
      }
    }
  }

  private damageEnemy(enemy: Enemy, amount: number) {
    enemy.hp -= amount;
    if (enemy.hp <= 0) {
      const index = this.enemies.indexOf(enemy);
      if (index >= 0) this.removeEnemy(enemy, index, true);
      return;
    }
    this.redrawEnemyHp(enemy);
  }

  private removeEnemy(enemy: Enemy, index: number, killed: boolean) {
    this.enemies.splice(index, 1);
    enemy.root.destroy({ children: true });
    if (killed) useGameStore.getState().addKill();
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
    const needsEnemy = kind === 'fire' || kind === 'ice' || kind === 'lightning';
    const hasUsefulTarget = needsEnemy ? this.enemies.length > 0 : state.castleHp < state.castleMaxHp;

    // Do not consume a charge if the spell cannot have any effect.
    if (state.phase !== 'playing' || !hasUsefulTarget || (spendCharge && !state.spendCharge(kind))) {
      return;
    }

    switch (kind) {
      case 'fire': {
        const targets = this.closestEnemies(4);
        targets.forEach((enemy) => this.damageEnemy(enemy, 55));
        this.spellEffects.play('fire');
        break;
      }
      case 'ice': {
        this.enemies.forEach((enemy) => {
          enemy.frozenFor = Math.max(enemy.frozenFor, FROST_DURATION);
        });
        this.spellEffects.play('ice');
        break;
      }
      case 'lightning': {
        const targets = this.closestEnemies(3);
        const targetPoints = targets.map((enemy) => ({ x: enemy.root.x, y: enemy.root.y }));
        this.spellEffects.play('lightning', {
          source: { x: this.app.screen.width / 2, y: this.castleY - 18 },
          targets: targetPoints,
        });
        targets.forEach((enemy) => this.damageEnemy(enemy, 80));
        break;
      }
      case 'shield': {
        state.healCastle(22);
        this.spellEffects.play('shield');
        break;
      }
    }
  }

  private closestEnemies(limit: number) {
    return [...this.enemies]
      .sort((a, b) => b.root.y - a.root.y)
      .slice(0, limit);
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

    this.bg.clear().rect(0, 0, width, height).fill({ color: 0x0b1020 });

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
        const progress = Math.max(0, Math.min(1, (enemy.root.y - laneTop) / (previousLaneEnd - laneTop)));
        const sidePadding = enemy.isBoss ? 34 : 24;
        enemy.root.x = Math.min(width - sidePadding, Math.max(sidePadding, enemy.root.x * widthScale));
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
    this.spellEffects.clearEffects();

    this.waveIndex = 0;
    this.spawnedThisWave = 0;
    this.bossSpawnedThisWave = false;
    this.spawnTimer = 0;
    this.betweenWavesFor = 0;
    useGameStore.getState().reset(WAVES.length);
  }
}
