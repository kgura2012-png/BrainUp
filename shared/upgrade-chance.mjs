// The displayed probability and the authoritative roll share this policy.
export const MAX_UPGRADE_STAKE_RATIO = .8;
export const UPGRADE_PERCENT_SCALE = 50;
export const MAX_UPGRADE_CHANCE = MAX_UPGRADE_STAKE_RATIO * UPGRADE_PERCENT_SCALE;

export function upgradeSuccessChance(stake,price){
  if (!Number.isFinite(stake) || !Number.isFinite(price) || stake <= 0 || price <= 0) return null;
  const share = stake / price;
  if (share > MAX_UPGRADE_STAKE_RATIO + 1e-11) return null;
  return Math.min(MAX_UPGRADE_CHANCE, share * UPGRADE_PERCENT_SCALE);
}
