import {MAX_UPGRADE_CHANCE,UPGRADE_PERCENT_SCALE} from '../shared/upgrade-chance.mjs';
export function playerIdentityLabel(player) {
  if (player.name) return player.name;
  if (player.username) return '@' + String(player.username).replace(/^@/, '');
  return 'Игрок';
}
export function resolvePlayerIdentity(players, value) {
  const input = String(value || '').trim().toLowerCase();
  const matches = players.filter(p => String(p.id).toLowerCase() === input ||
    (String(p.id).startsWith('tg:') && String(p.id).slice(3) === input) ||
    (p.username && String(p.username).toLowerCase().replace(/^@/, '') === input.replace(/^@/, '')));
  if(matches.length)return matches.length===1?matches[0]:null;
  const names=players.filter(p=>String(p.name||'').toLowerCase()===input);
  return names.length===1?names[0]:null;
}
export function nextDiceSelection(previous, result, inventory, balance, value) {
  if (!previous || !(result.mult > 0) || !(value > 0)) return null;
  if (previous.type === 'item' && result.itemId != null) {
    const next = inventory.find(item => item.id === result.itemId && item.uid !== previous.uid);
    if (next) return {type:'item',uid:next.uid};
  }
  return balance >= value ? {type:'coin',amt:value} : null;
}

export const DEFAULT_UPGRADE_PERCENTAGES = [15,25,35];
export const UPGRADE_PERCENTAGES_KEY = 'bu-upgrade-win-percentages-v2';

export function validateQuickPercentages(values){
  if (!Array.isArray(values) || values.length !== 3) throw Error('Укажите три процента');
  const result = values.map(Number);
  if (result.some(x => !Number.isFinite(x) || x < .01 || x > MAX_UPGRADE_CHANCE ||
      Math.abs(x * 100 - Math.round(x * 100)) > 1e-7)) {
    throw Error('Проценты: от 0,01 до ' + MAX_UPGRADE_CHANCE + ', до двух знаков после запятой');
  }
  return result;
}

export function loadQuickPercentages(storage){
  const saved = storage.getItem(UPGRADE_PERCENTAGES_KEY);
  if (saved !== null) return validateQuickPercentages(JSON.parse(saved));
  const previous = JSON.parse(storage.getItem('bu-upgrade-percentages') || 'null');
  if (!Array.isArray(previous)) return DEFAULT_UPGRADE_PERCENTAGES.slice();
  return validateQuickPercentages(previous.map(value => Math.max(.01, Math.round(Number(value) * UPGRADE_PERCENT_SCALE) / 100)));
}
