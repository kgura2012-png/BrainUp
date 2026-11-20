import test from 'node:test';import assert from 'node:assert/strict';import {targetUpgradeChance} from '../client/target-chances.mjs';
test('target probabilities follow combined item and token stake and stay below 50 percent',()=>{assert.equal(targetUpgradeChance(25,100),12.5);assert.equal(targetUpgradeChance(25+15,100),20);assert.equal(targetUpgradeChance(80,100),40);assert.equal(targetUpgradeChance(81,100),null);assert.equal(targetUpgradeChance(0,100),null);assert.equal(targetUpgradeChance(5,50000),.005);assert.equal(targetUpgradeChance(NaN,100),null)});

test('saved quick percentages are converted once and use the new win-chance scale',async()=>{
 const {loadQuickPercentages,UPGRADE_PERCENTAGES_KEY}=await import('../client/session-tools.mjs');
 const values=new Map([['bu-upgrade-percentages','[30,50,70]']]);
 const storage={getItem:key=>values.get(key)??null};
 assert.deepEqual(loadQuickPercentages(storage),[15,25,35]);
 values.set(UPGRADE_PERCENTAGES_KEY,'[7,18,32]');
 assert.deepEqual(loadQuickPercentages(storage),[7,18,32]);
});
