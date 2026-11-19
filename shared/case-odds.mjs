export const CASE_ITEM_EXPONENT=2.1;
export const FREE_CASE_ODDS={coins2:.72,coins5:.19,coins:.91,items:.09};
export const SPECIAL_CASE_ODDS={dragon:.36,noobini:.64};
// One set of weights supplies both the displayed pool and server draws.
export function isFiftyFiftyCase(c) {
 if(!c||c.bonus)return false;
 const name=String(c.name||'').normalize('NFKC').toLocaleLowerCase('ru').replace(/кейс|case/g,'').replace(/[^a-zа-яё0-9]/g,'');
 return /^50(?:на|x|х)?50$/.test(name);
}
export function caseItemWeight(c,item){
 if(isFiftyFiftyCase(c))return Number(item.id)===55?SPECIAL_CASE_ODDS.dragon:Number(item.id)===95?SPECIAL_CASE_ODDS.noobini:0;
 return Math.pow(item.price,-CASE_ITEM_EXPONENT);
}
export function pickCaseItem(c,items,rng=Math.random){
 if(isFiftyFiftyCase(c)){const selectedId=rng()<SPECIAL_CASE_ODDS.dragon?55:95;return items.find(item=>Number(item.id)===selectedId)}
 let roll=rng()*items.reduce((sum,item)=>sum+caseItemWeight(c,item),0);
 for(const item of items){roll-=caseItemWeight(c,item);if(roll<0)return item}
 return items.at(-1);
}
export function activationCaseRewardPool(items){
 const sum=items.reduce((total,item)=>total+Math.pow(item.price,-CASE_ITEM_EXPONENT),0);
 return [{id:'token-2',name:'2 монеты',price:2,rewardKind:'coins',rewardWeight:FREE_CASE_ODDS.coins2},{id:'token-5',name:'5 монет',price:5,rewardKind:'coins',rewardWeight:FREE_CASE_ODDS.coins5}].concat(items.map(item=>Object.assign({},item,{rewardWeight:FREE_CASE_ODDS.items*Math.pow(item.price,-CASE_ITEM_EXPONENT)/sum})));
}

export const CASE_ODDS_TOTAL = 10_000;

export function validCaseRewardOdds(odds, items) {
 if (!odds || typeof odds !== 'object' || Array.isArray(odds) || !items.length) return false;
 const ids = new Set(items.map(item => String(item.id)));
 if (ids.size !== items.length || Object.keys(odds).length !== ids.size) return false;
 let total = 0;
 for (const id of ids) {
  if (!Object.hasOwn(odds, id)) return false;
  const value = odds[id];
  if (!Number.isInteger(value) || value < 0 || value > CASE_ODDS_TOTAL) return false;
  total += value;
 }
 return total === CASE_ODDS_TOTAL;
}

export function customCaseRewardPool(c, items) {
 if (!validCaseRewardOdds(c.rewardOdds, items)) return null;
 return items.map(item => ({...item, rewardWeight:c.rewardOdds[item.id]}));
}

export function drawCustomCaseReward(pool, rng) {
 let roll = rng() * CASE_ODDS_TOTAL;
 for (const reward of pool) {
  roll -= reward.rewardWeight;
  if (roll < 0) return reward;
 }
 return pool.findLast(reward => reward.rewardWeight > 0);
}
