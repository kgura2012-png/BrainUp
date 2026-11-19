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

export function validateQuickPercentages(values){if(!Array.isArray(values)||values.length!==3)throw Error('Укажите три процента');const result=values.map(Number);if(result.some(x=>!Number.isFinite(x)||x<.01||x>80||Math.abs(x*100-Math.round(x*100))>1e-7))throw Error('Проценты: от 0,01 до 80, до двух знаков после запятой');return result;}
