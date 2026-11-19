import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {handle,readTopups} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import seed from '../server/seed.json' with {type:'json'};
import {handleSupport} from '../server/support.mjs';
test('method closures persist independently, preserve legacy closure and block direct requests',async()=>{
 const db=localDatabase();try{
  db.sqlite.exec(await fs.readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
  const owner={id:'tg:1116312381'},player={id:'tg:42'};
  async function req(who,action='state',data={}){const response=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,requestId:crypto.randomUUID()})}),db,who);return {status:response.status,j:await response.json()}}
  const status=async()=>await (await readTopups(new Request('https://test/api/topups'),db,player)).json();
  await req(owner);await req(player);
  assert.equal((await req(player,'admin-topups-toggle',{type:'items',closed:true})).status,400);
  assert.equal((await req(owner,'admin-topups-toggle',{type:'other',closed:true})).status,400);
  await req(owner,'admin-topups-toggle',{type:'items',closed:true});
  let snapshot=await status();assert.equal(snapshot.topupsItemsClosed,true);assert.equal(snapshot.topupsStarsClosed,false);
  assert.equal((await req(player,'simulation-topup',{items:[]})).j.error,'Пополнения брейнротами временно закрыты');
  await req(owner,'admin-topups-toggle',{closed:true});
  await req(owner,'admin-topups-toggle',{type:'items',closed:false});
  snapshot=await status();assert.equal(snapshot.topupsClosed,false);assert.equal(snapshot.topupsItemsClosed,false);assert.equal(snapshot.topupsStarsClosed,true);
  assert.equal((await req(player,'virtual-topup',{type:'stars',units:25})).status,403);
  const blocked=await handleSupport(new Request('https://test/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),stars:25})}),{DB:db,TELEGRAM_BOT_TOKEN:'123:fake',TELEGRAM_WEBHOOK_SECRET:'secret'},player);
  assert.equal(blocked.status,403);assert.match((await blocked.json()).error,/временно закрыты/);
  const persisted=(await req(owner)).j.config;assert.equal(persisted.topupsStarsClosed,true);assert.equal(persisted.topupsItemsClosed,false);
 }finally{db.sqlite.close()}
});
test('only admin can close topups; status reports closure and server rejects new requests until reopening',async()=>{const db=localDatabase();try{db.sqlite.exec(await fs.readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));const owner={id:'tg:1116312381',name:'Owner'},player={id:'tg:1',name:'Player'};async function req(who,action='state',data={}){const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,requestId:crypto.randomUUID()})}),db,who);return {status:r.status,j:await r.json()}}await req(owner);await req(player);assert.equal((await req(player,'admin-topups-toggle',{closed:true})).status,400);assert.equal((await req(owner,'admin-topups-toggle',{closed:true})).status,200);const status=await readTopups(new Request('https://test/api/topups'),db,player);assert.equal((await status.json()).topupsClosed,true);const blocked=await req(player,'simulation-topup',{items:[{id:seed.items[0].id,q:1}]});assert.equal(blocked.status,400);assert.equal(blocked.j.error,'Пополнения брейнротами временно закрыты');assert.equal((await req(owner,'admin-topups-toggle',{closed:false})).status,200);assert.equal((await req(player,'simulation-topup',{items:[{id:seed.items[0].id,q:1}]})).status,200)}finally{db.sqlite.close()}});
