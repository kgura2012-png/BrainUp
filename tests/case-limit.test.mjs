import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fresh,account,execute} from '../server/model.mjs';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import seed from '../server/seed.json' with {type:'json'};
function fixture(){const s=fresh(seed,'tg:1116312381'),u=account(s,'tg:42','Player');u.balance=10000;const c=s.config.cases.find(c=>!c.bonus&&c.price>0);return {s,u,c}}
test('five openings cost exactly five case prices and award five distinct inventory entries',()=>{
 const {s,u,c}=fixture(),balance=u.balance,result=execute(s,u.id,seed,'case',{id:c.id,n:5},Date.now(),()=>0);assert.equal(result.wins.length,5);assert.equal(u.inv.length,5);assert.equal(new Set(u.inv.map(x=>x.uid)).size,5);assert.equal(u.balance,Math.round((balance-c.price*5)*100)/100);assert.equal(u.casesOpened,5);
});
test('invalid quantities and insufficient balance do not debit or award anything',()=>{
 const {s,u,c}=fixture();for(const n of [0,6,7,-1,5.5])assert.throws(()=>execute(s,u.id,seed,'case',{id:c.id,n}),/1 до 5/);assert.equal(u.balance,10000);assert.equal(u.inv.length,0);u.balance=0;assert.throws(()=>execute(s,u.id,seed,'case',{id:c.id,n:5}),/Недостаточно/);assert.equal(u.balance,0);assert.equal(u.inv.length,0);
});
test('a free opening remains one opening even if five is submitted',()=>{
 const {s,u,c}=fixture(),balance=u.balance;u.fc[c.id]=1;const result=execute(s,u.id,seed,'case',{id:c.id,n:5,free:true});assert.equal(result.wins.length,1);assert.equal(u.inv.length,1);assert.equal(u.fc[c.id],0);assert.equal(u.balance,balance);
});
test('five-case API settlement persists after reload and an identical retry cannot duplicate awards',async()=>{
 const db=localDatabase();try{
  const {s,u,c}=fixture();db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));db.sqlite.prepare('INSERT INTO site_state(id,revision,data) VALUES(1,0,?)').run(JSON.stringify(s));
  const req=async(action,data,requestId)=>{const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,requestId})}),db,{id:u.id});assert.equal(r.status,200);return r.json()};
  const key=crypto.randomUUID(),first=await req('case',{id:c.id,n:5},key),again=await req('case',{id:c.id,n:5},key),reload=await req('state',{},crypto.randomUUID());assert.equal(first.result.wins.length,5);assert.equal(first.user.inv.length,5);assert.deepEqual(again.user.inv,first.user.inv);assert.deepEqual(reload.user.inv,first.user.inv);assert.equal(reload.user.balance,first.user.balance);assert.equal(reload.user.casesOpened,5);
 }finally{db.sqlite.close()}
});
