import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {handle} from '../server/service.mjs';
import {notifySimulationTopupCreated} from '../server/telegram.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import seed from '../server/seed.json' with {type:'json'};
async function fixture(run){const db=localDatabase();try{db.sqlite.exec(await fs.readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));const owner={id:'tg:1116312381'},player={id:'tg:42',name:'Player'};const request=async(who,action='state',data={},id=crypto.randomUUID(),options={})=>{const response=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,requestId:id})}),db,who,options);return {status:response.status,body:await response.json()}};await request(owner);await request(player);await run({db,owner,player,request})}finally{db.sqlite.close()}}
test('notification is scheduled only after the free request commits, once for concurrent retries',()=>fixture(async f=>{
 const notifications=[],id=crypto.randomUUID(),data={type:'items',items:[{id:seed.items[0].id,q:2}]};
 const options={onSimulationTopupCreated:record=>{const state=JSON.parse(f.db.sqlite.prepare('SELECT data FROM site_state WHERE id=1').get().data);assert(state.simulationTopups.some(x=>x.id===record.id));notifications.push(record)}};
 const replies=await Promise.all([f.request(f.player,'simulation-topup',data,id,options),f.request(f.player,'simulation-topup',data,id,options)]);assert(replies.every(x=>x.status===200));assert.equal(notifications.length,1);assert.equal(notifications[0].items[0].q,2);assert.equal(replies[0].body.user.balance,0);
 const topupId=notifications[0].id;await f.request(f.owner,'simulation-show',{id:topupId},crypto.randomUUID(),options);await f.request(f.owner,'simulation-review',{id:topupId,status:'ok'},crypto.randomUUID(),options);assert.equal(notifications.length,1);
 await f.request(f.player,'simulation-topup',{type:'items',items:[]},crypto.randomUUID(),options);assert.equal(notifications.length,1);
 await f.request(f.player,'simulation-topup',{type:'stars',units:100},crypto.randomUUID(),options);assert.equal(notifications.length,2);
}));
test('Telegram message goes only to the owner and describes a free request without trade or payment instructions',async()=>{
 const original=globalThis.fetch,calls=[];try{globalThis.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body),signal:options.signal});return Response.json({ok:true,result:{message_id:7}})};
  const record={id:'one',number:9,simulation:true,free:true,st:'new',type:'items',user:'Player',base:65,bonus:10,total:71.5,items:[{n:'Cash or Card',q:1}],chat_id:123};
  const sent=await notifySimulationTopupCreated({TELEGRAM_BOT_TOKEN:'123:fake'},record);assert.equal(sent.message_id,7);assert.equal(calls[0].body.chat_id,1116312381);assert.match(calls[0].body.text,/Бесплатная заявка №9/);assert.match(calls[0].body.text,/Cash or Card ×1/);assert.match(calls[0].body.text,/71.5/);assert.match(calls[0].body.text,/Передача предметов и оплата не требуются/);assert(calls[0].signal);
  await notifySimulationTopupCreated({TELEGRAM_BOT_TOKEN:'123:fake'},{...record,type:'stars',stars:100,items:[]});assert.match(calls[1].body.text,/расчёт без оплаты/);
  for(const invalid of [{...record,simulation:false},{...record,free:false},{...record,st:'ok'}])assert.equal(await notifySimulationTopupCreated({TELEGRAM_BOT_TOKEN:'123:fake'},invalid),null);assert.equal(calls.length,2);
  globalThis.fetch=async()=>Response.json({ok:false,description:'Forbidden'},{status:403});await assert.rejects(()=>notifySimulationTopupCreated({TELEGRAM_BOT_TOKEN:'123:fake'},record),/notification failed/);
 }finally{globalThis.fetch=original}
});
test('a failed notification never rolls back a saved free request or breaks its response',()=>fixture(async f=>{
 const data={type:'stars',units:25};for(const notify of [()=>{throw Error('unavailable')},()=>Promise.reject(Error('unavailable'))]){const response=await f.request(f.player,'simulation-topup',data,crypto.randomUUID(),{onSimulationTopupCreated:notify});assert.equal(response.status,200);assert.equal(response.body.result.topup.st,'new');}
 assert.equal((await f.request(f.owner)).body.config.simulationTopups.length,2);assert.equal((await f.request(f.player)).body.user.balance,0);
}));
