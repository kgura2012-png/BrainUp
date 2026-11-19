import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {selectUpgradeTarget} from '../client/upgrade-target.mjs';import seed from '../server/seed.json' with {type:'json'};
test('×8 chooses the exact price when available and otherwise the nearest lower price, never ×10',()=>{
 const exact={id:8,price:800},lower={id:7,price:750},ten={id:10,price:1000};assert.equal(selectUpgradeTarget([ten,exact,lower],800),exact);assert.equal(selectUpgradeTarget([lower,ten],800),lower);assert.equal(selectUpgradeTarget([ten],800),null);assert.equal(selectUpgradeTarget([lower,ten],NaN),null);
});
test('currency rounding preserves exact decimal ×8 prices and never rounds a percentage target up',()=>{
 const exact={id:1,price:56.24};assert.equal(selectUpgradeTarget([exact,{id:2,price:56.25}],7.03*8),exact);assert.equal(selectUpgradeTarget([{id:1,price:180.01},{id:2,price:180.02}],100*100/55.55).price,180.01);
});
test('real catalog quick choices respect the requested multiplier and include closer mutation targets',()=>{
 for(const stake of [1,5,7,19,35,61,100,1000]){const items=seed.items.filter(item=>!item.hidden&&item.price+1e-9>=stake/.8),target=selectUpgradeTarget(items,stake*8);assert(target);assert(target.price<=stake*8+1e-9);assert(!items.some(item=>item.price>target.price&&item.price<=stake*8))}
 const mutation={id:2000001,baseId:1,mutation:'gold',price:800};assert.equal(selectUpgradeTarget([{id:2,price:750},{id:3,price:1000},mutation],800),mutation);
});
async function fixture(items){
 const source=await readFile(new URL('../client/mutations.js',import.meta.url),'utf8'),a=source.indexOf('pick=function(want){'),b=source.indexOf('\nvar targetCardBeforeMutations',a),messages=[],c=vm.createContext({pick(){},selectUpgradeTarget,targetListBeforeMutations:()=>items,UPGRADE_MUTATIONS:{},U:{target:10,pg:{t:3}},PAGE:2,render(){},toast:value=>messages.push(value),bet:()=>100,fmt:value=>String(value),tList:()=>items.filter(item=>!item.mutation||c.UPGRADE_MUTATIONS[item.baseId]===item.id)});vm.runInContext(source.slice(a,b),c);return {c,messages};
}
test('the real picker selects a matching mutation and scrolls to its page',async()=>{
 const mutation={id:2000001,baseId:1,mutation:'gold',price:800},items=[{id:2,price:600},{id:3,price:750},mutation,{id:10,price:1000}],f=await fixture(items);f.c.pick(800);assert.equal(f.c.U.target,mutation.id);assert.equal(f.c.UPGRADE_MUTATIONS[1],mutation.id);assert.equal(f.c.U.pg.t,2);assert.deepEqual(f.messages,[]);
});
test('the real picker reports a lower available multiplier and clears stale ×10 if filters leave no valid target',async()=>{
 const f=await fixture([{id:7,price:750},{id:10,price:1000}]);f.c.pick(800);assert.equal(f.c.U.target,7);assert.match(f.messages[0],/×7.5/);const missing=await fixture([{id:10,price:1000}]);missing.c.pick(800);assert.equal(missing.c.U.target,null);assert.equal(missing.c.U.pg.t,1);assert.match(missing.messages[0],/Измени фильтры/);
});
test('the shipped ×10 button routes the third multiplier to ten times the stake',async()=>{
 const html=await readFile(new URL('../site.html',import.meta.url),'utf8'),a=html.indexOf("else if(z){if(z.disabled)return;"),b=html.indexOf('\nelse if(c)',a);assert(a>=0&&b>a);const buttons=[{},{},{}];let requested;const c=vm.createContext({z:buttons[2],U:{},bet:()=>100,pick:value=>requested=value,openUpgradeSettings(){},quickPercentages:[30,50,70]});buttons[2].parentNode={querySelectorAll:()=>buttons};vm.runInContext('(function(){if(false){}'+html.slice(a,b)+'})()',c);assert.equal(requested,1000);assert.match(html, /\[2,4,10\]\[i\]/);
});
