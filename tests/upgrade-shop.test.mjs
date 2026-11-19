import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {shopPurchasePrice} from '../shared/shop-price.mjs';
import {fresh,account,execute,simulationSlots} from '../server/model.mjs';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import seed from '../server/seed.json' with {type:'json'};

test('shop price adds seven percent and rounds to cents',()=>{
 assert.equal(shopPurchasePrice(1),1.07);assert.equal(shopPurchasePrice(14.32),15.32);assert.equal(shopPurchasePrice(100),107);
});
test('shop API ignores forged prices and lock flags, persists the purchase, and retries only once',async t=>{
 const db=localDatabase();t.after(()=>db.sqlite.close());db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
 const s=fresh(seed,'tg:1116312381'),u=account(s,'tg:42');u.balance=10;db.sqlite.prepare('INSERT INTO site_state VALUES (1,0,?)').run(JSON.stringify(s));
 async function req(action,data={},requestId=crypto.randomUUID()){const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,requestId})}),db,{id:u.id,name:'Player'});return {status:r.status,j:await r.json()}}
 const key=crypto.randomUUID(),first=await req('shop',{id:95,price:0,paid:0,sh:0},key);assert.equal(first.status,200);assert.equal(first.j.result.price,1.07);assert.equal(first.j.user.balance,8.93);assert.equal(first.j.user.inv.length,1);assert.equal(first.j.user.inv[0].sh,1);assert.equal(first.j.user.inv[0].paid,1.07);
 const again=await req('shop',{id:95,price:0,paid:0,sh:0},key);assert.equal(again.j.user.balance,8.93);assert.equal(again.j.user.inv.length,1);
 const reload=await req('state');assert.equal(reload.j.user.inv[0].sh,1);assert.equal(reload.j.user.balance,8.93);
 const fail=await req('shop',{id:55});assert.equal(fail.status,400);const after=await req('state');assert.equal(after.j.user.balance,8.93);assert.equal(after.j.user.inv.length,1);
 await req('sell',{ids:[first.j.user.inv[0].uid]});const sold=await req('state');assert.equal(sold.j.user.balance,9.93);
});
test('purchased items cannot be booked directly, but may be consumed by an upgrade',()=>{
 const s=fresh(seed,'owner'),u=account(s,'player');u.balance=10000;const g=seed.items.find(x=>x.name==='Garama and Madundung'),now=Date.parse('2026-11-18T12:00:00Z');
 const bought=execute(s,u.id,seed,'shop',{id:g.id},now).item,at=simulationSlots(s,now).slots[0].at;
 assert.throws(()=>execute(s,u.id,seed,'simulation-book',{at,nick:'Player_42',plan:[{uid:bought.uid,target:g.id,q:1}]},now),/недоступен/);assert.equal(u.inv[0].sh,1);
 const target=seed.items.find(x=>!x.hidden&&x.price>=g.price*2),r=execute(s,u.id,seed,'upgrade',{ids:[bought.uid],target:target.id},now,()=>0);assert.equal(r.win,true);assert.equal(u.inv.some(x=>x.uid===bought.uid),false);assert.equal(u.inv.at(-1).sh,undefined);
});
test('shop cards omit badges while purchased inventory also omits its lock',async()=>{
 const tabs={};for(const id of ['bu-tinv','bu-tshop'])tabs[id]={hidden:true,disabled:true,removeAttribute(){}};
 const c=vm.createContext({document:{getElementById:id=>tabs[id]},card:()=>'<button></button>',S:{inv:[{uid:1,id:95,sh:1}]},shopCard(){},esc:String,brainrotDisplayName:item=>item.name,brainrotMutationBadge:()=>'',tier:()=>['1,2,3'],av:()=>'/item.webp',COIN:'BU ',fmt:String,shopPrice:item=>shopPurchasePrice(item.price)});
 vm.runInContext(await readFile(new URL('../client/upgrade-shop.js',import.meta.url),'utf8'),c);
 assert.equal(tabs['bu-tshop'].hidden,false);assert.equal(tabs['bu-tshop'].disabled,false);assert.equal(tabs['bu-tshop'].textContent,'Магазин');assert.doesNotMatch(c.card({},'',1,''),/purchased-item-lock/);assert.doesNotMatch(c.card({},'',2,''),/purchased-item-lock/);
 const html=c.shopCard({id:95,price:1,name:'Noobini Pizzanini'});assert.match(html,/1.07/);assert.doesNotMatch(html,/[+-]7%|purchased-item-lock/);
});
