import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,account,execute} from '../server/model.mjs';
import {buildUpgradeBouncePath,upgradePathBounds} from '../client/upgrade-motion.mjs';
import {caseItemWeight,isFiftyFiftyCase} from '../shared/case-odds.mjs';
import seed from '../server/seed.json' with {type:'json'};

test('each upgrade uses one independent draw and returns that exact roll for the animation',()=>{
 for(const multiplier of [4,8,10]){
  const s=fresh(seed,'owner'),u=account(s,'player');s.config.custom.push({id:999001,name:'Stake',price:100},{id:999002,name:'Target',price:100*multiplier});
  for(const draw of [0,.02,.099999,.1,.7,.999999,.02,.02,.7,.7]){
   u.inv=[{uid:1,id:999001}];let calls=0;
   const result=execute(s,'player',seed,'upgrade',{ids:[1],target:999002},1000,()=>{calls++;return draw});
   assert.equal(calls,1);assert.equal(result.win,draw*100<result.chance);assert.equal(result.roll,100-draw*100);
   const path=buildUpgradeBouncePath(result.roll),end=path.at(-1),position=(end[0]-end[1]+100)/2;
   assert.ok(Math.abs(position-upgradePathBounds(result.roll).roll)<1e-7);
  }
 }
});
test('every existing seeded case has a lower or equal expected payout under the modest new weights',()=>{
 let lowered=0;
 for(const c of seed.cases.filter(c=>!c.bonus)){
  const items=c.drops.map(id=>seed.items.find(item=>item.id===id)).filter(Boolean);if(!items.length)continue;
  const old=item=>isFiftyFiftyCase(c)?item.id===55?.4:item.id===95?.6:0:Math.pow(item.price,-2);
  const average=weight=>items.reduce((sum,item)=>sum+item.price*weight(item),0)/items.reduce((sum,item)=>sum+weight(item),0);
  const before=average(old),after=average(item=>caseItemWeight(c,item));
  assert.ok(after<=before+1e-7,c.name);if(after<before-1e-7)lowered++;
 }
 assert.ok(lowered>0);
});
