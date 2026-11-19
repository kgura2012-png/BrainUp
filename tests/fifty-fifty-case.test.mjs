import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,account,execute,weightedPick} from '../server/model.mjs';
import {isFiftyFiftyCase,pickCaseItem,caseItemWeight} from '../shared/case-odds.mjs';
import seed from '../server/seed.json' with {type:'json'};
function fixture(){const s=fresh(seed,'owner'),u=account(s,'player'),c=s.config.cases.find(c=>!c.bonus),low=seed.items.find(x=>x.id===95),high=seed.items.find(x=>x.id===55);u.balance=10000;c.name='50 на 50';c.price=10;c.drops=[low.id,high.id];return {s,u,c,low,high}}
test('only the named paid 50/50 case gets the fixed Dragon/Noobini odds',()=>{
 for(const name of ['50 на 50','50/50','50-50','Кейс 50 на 50','50 x 50'])assert.equal(isFiftyFiftyCase({name}),true);
 for(const name of ['Basic','Премиум 50','50 на 500'])assert.equal(isFiftyFiftyCase({name}),false);assert.equal(isFiftyFiftyCase({name:'50 на 50',bonus:1}),false);
});
test('the 36 percent boundary is exact and independent of item price, including five openings',()=>{
 const {s,u,c,low,high}=fixture(),rolls=[0,.359999999,.36,.75,.999999999];let i=0;
 const result=execute(s,u.id,seed,'case',{id:c.id,n:5},Date.now(),()=>rolls[i++]);assert.deepEqual(result.wins.map(x=>x.w.id),[high.id,high.id,low.id,low.id,low.id]);assert.equal(i,5);assert.equal(u.balance,9950);assert.equal(new Set(result.wins.map(x=>x.uid)).size,5);
 c.drops.reverse();assert.equal(execute(s,u.id,seed,'case',{id:c.id,n:1},Date.now(),()=>.3599).wins[0].w.id,high.id);
});
test('each draw is independent: repeated dragon rolls can repeatedly win the expensive item',()=>{
 const {s,u,c,high}=fixture();assert(execute(s,u.id,seed,'case',{id:c.id,n:5},Date.now(),()=>.1).wins.every(x=>x.w.id===high.id));
});
test('ordinary case odds make expensive items rarer without changing other modes',()=>{
 const c={name:'Basic'},items=[{id:1,price:10},{id:2,price:100}];assert.equal(weightedPick(items,()=>.988).id,2);assert.equal(pickCaseItem(c,items,()=>.988).id,1);assert.equal(caseItemWeight(c,items[0]),Math.pow(10,-2.1));assert.equal(caseItemWeight(c,items[1]),Math.pow(100,-2.1));
 const {s,u,c:live}=fixture();live.name='Basic';assert.equal(execute(s,u.id,seed,'case',{id:live.id,n:1},Date.now(),()=>.75).wins[0].w.id,95);
});
test('36/64 names each item independently of order and gives exact proportions over evenly spaced draws',()=>{
 const c={name:'50 на 50'},items=[{id:95,price:1},{id:55,price:1100}];let dragon=0;for(let i=0;i<10000;i++)if(pickCaseItem(c,items,()=>(i+.5)/10000).id===55)dragon++;assert.equal(dragon,3600);assert.equal(caseItemWeight(c,items[0]),.64);assert.equal(caseItemWeight(c,items[1]),.36);
});
test('a misconfigured 50/50 case cannot charge money or consume a free opening',()=>{
 const {s,u,c}=fixture();c.drops=c.drops.slice(0,1);u.fc[c.id]=1;const balance=u.balance;for(const free of [false,true])assert.throws(()=>execute(s,u.id,seed,'case',{id:c.id,n:1,free}),/ровно два/);assert.equal(u.balance,balance);assert.equal(u.fc[c.id],1);assert.equal(u.inv.length,0);
});
