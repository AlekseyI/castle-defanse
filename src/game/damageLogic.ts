export interface DamageHit {
  amount: number;
  critical: boolean;
  criticalMultiplier: number;
}

export function resolveDamageHit(
  amount: number,
  criticalChancePercent: number,
  criticalMultiplier: number,
  randomValue = Math.random(),
): DamageHit {
  const chance = Math.max(0, Math.min(100, criticalChancePercent));
  const multiplier = Math.max(1, criticalMultiplier);
  const critical = chance >= 100 || (chance > 0 && randomValue < chance / 100);

  return {
    amount: amount * (critical ? multiplier : 1),
    critical,
    criticalMultiplier: critical ? multiplier : 1,
  };
}

export function formatDamageAmount(amount: number): string {
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatDamagePopup(hitAmount: number, critical: boolean, criticalMultiplier: number): string {
  const damage = formatDamageAmount(hitAmount);
  if (!critical) return damage;
  return `${damage} ×${formatDamageAmount(criticalMultiplier)}`;
}

export interface CastleAttackAdvance {
  attacks: number;
  nextAttackIn: number;
}

export function advanceCastleAttack(
  nextAttackIn: number,
  deltaSeconds: number,
  intervalSeconds = 1,
  attackSpeedMultiplier = 1,
): CastleAttackAdvance {
  const interval = Math.max(Number.EPSILON, intervalSeconds);
  const speedMultiplier = Math.max(0, attackSpeedMultiplier);
  let remaining = Math.max(0, nextAttackIn) - Math.max(0, deltaSeconds) * speedMultiplier;

  if (remaining > 0) {
    return { attacks: 0, nextAttackIn: remaining };
  }

  const attacks = 1 + Math.floor(-remaining / interval);
  remaining += attacks * interval;
  return { attacks, nextAttackIn: remaining };
}
