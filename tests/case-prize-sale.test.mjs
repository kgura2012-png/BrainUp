import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCasePrizeSeller} from '../client/case-results.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import {handle} from '../server/service.mjs';
import {fresh,account} from '../server/model.mjs';
import seed from '../server/seed.json' with {type:'json'};

test('selling one case prize preserves another instance of the same brainrot and credits once',async()=>{
 const db=localDatabase();db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
 const state=fresh(seed,'owner'),user=account(state,'player','Player'),item=seed.items[0];user.balance=0;user.inv=[{uid:11,id:item.id},{uid:12,id:item.id}];
 db.sqlite.prepare('INSERT INTO site_state VALUES (1,0,?)').run(JSON.stringify(state));let inventory=user.inv,calls=0;
 const sell=createCasePrizeSeller({inventory:()=>inventory,request:async(action,data)=>{calls++;const response=await handle(new Request('https://brainup.test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,requestId:crypto.randomUUID(),data})}),db,{id:'player',name:'Player'});const reply=await response.json();assert.equal(reply.ok,true);return reply;},adopt:reply=>{inventory=reply.user.inv}});
 try{
  assert.equal(await sell(11),item.price);assert.deepEqual(inventory,[{uid:12,id:item.id}]);
  await assert.rejects(()=>sell(11),/уже использован или продан/);await assert.rejects(()=>sell(null));assert.equal(calls,1);
  const saved=JSON.parse(db.sqlite.prepare('SELECT data FROM site_state WHERE id=1').get().data);assert.equal(saved.users.player.balance,item.price);
 }finally{db.sqlite.close();}
});
test('a second click while the prize sale is pending cannot send another request',async()=>{
 let finish,calls=0;const inventory=[{uid:1,id:10}];const sell=createCasePrizeSeller({inventory:()=>inventory,request:()=>{calls++;return new Promise(resolve=>{finish=resolve})},adopt:()=>inventory.splice(0)});
 const first=sell(1);assert.equal(await sell(1),null);assert.equal(calls,1);finish({result:{total:10}});assert.equal(await first,10);assert.equal(inventory.length,0);
});
test('a failed sale leaves the prize available for a deliberate retry',async()=>{
 const inventory=[{uid:7,id:10}];let calls=0;const sell=createCasePrizeSeller({inventory:()=>inventory,request:async()=>{if(++calls===1)throw Error('Offline');return {result:{total:10}}},adopt:()=>inventory.splice(0)});
 await assert.rejects(()=>sell(7),/Offline/);assert.equal(inventory.length,1);assert.equal(await sell(7),10);assert.equal(calls,2);
});
