import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fresh,account,execute,simulationSlots} from '../server/model.mjs';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import seed from '../server/seed.json' with {type:'json'};
const now=Date.parse('2026-11-04T12:00:00Z');
function fixture(){const s=fresh(seed,'owner');for(const id of ['owner','partner','p','q'])account(s,id,id);execute(s,'owner',seed,'admin-partner',{userId:'partner',code:'FRIEND',pct:50,bonus:10},now);return s}
function approve(s,record){execute(s,'owner',seed,'simulation-show',{id:record.id},now);return execute(s,'owner',seed,'simulation-review',{id:record.id,status:'ok'},now).topup}
test('free credits use server prices and track referral volume without booking a second game commission',()=>{
 const s=fixture();s.config.custom.push({id:99999,name:'Cash or Card',price:70});
 const pending=execute(s,'p',seed,'simulation-topup',{items:[{id:99999,q:1,v:99999}],promo:'friend',total:99999},now).topup;assert.equal(pending.st,'new');assert.equal(s.users.p.balance,0);assert.equal(s.partners.FRIEND.pending,0);const r=approve(s,pending);
 assert.equal(r.free,true);assert.equal(r.simulation,true);assert.equal(r.base,70);assert.equal(r.total,77);assert.equal(r.commission,0);assert.equal(s.users.p.balance,77);
 assert.equal(s.partners.FRIEND.pending,0);assert.equal(s.partners.FRIEND.vol,70);assert.equal(s.partners.FRIEND.list[0].earned,0);assert.equal(s.partners.FRIEND.list[0].vol,70);
 assert.equal(s.topups.length,0);assert(!('recipient' in r));
 execute(s,'owner',seed,'admin-partner-edit',{code:'FRIEND',pct:25,bonus:0},now);
 approve(s,execute(s,'p',seed,'simulation-topup',{items:[{id:99999,q:1}]},now).topup);assert.equal(s.partners.FRIEND.pending,0);
 execute(s,'owner',seed,'admin-partner-edit',{code:'FRIEND',disable:true},now);
 approve(s,execute(s,'p',seed,'simulation-topup',{items:[{id:99999,q:1}]},now).topup);assert.equal(s.partners.FRIEND.pending,0);
 assert.throws(()=>execute(s,'partner',seed,'simulation-topup',{items:[{id:99999,q:1}],promo:'FRIEND'},now));
});
test('the gear tab accepts exactly its catalogue items at server prices',()=>{
 const s=fixture(),ids=[19,20,22,24,53,56],items=ids.map(id=>({id,q:1,v:99999}));
 assert.throws(()=>execute(s,'p',seed,'simulation-topup',{type:'items',items},now),/Предмет недоступен/);
 assert.throws(()=>execute(s,'p',seed,'simulation-topup',{type:'gears',items:[{id:1,q:1}]},now),/Предмет недоступен/);
 const {topup}=execute(s,'p',seed,'simulation-topup',{type:'gears',items},now);
 assert.equal(topup.type,'gears');
 assert.deepEqual(topup.items.map(x=>x.id),ids);
 assert.equal(approve(s,topup).total,seed.items.filter(x=>ids.includes(x.id)).reduce((sum,x)=>sum+x.price,0));
 s.config.topupsGearsClosed=true;
 assert.throws(()=>execute(s,'p',seed,'simulation-topup',{type:'gears',items},now),/гирами временно закрыты/);
});
test('Sunday schedule has 96 five-minute slots in Kyiv, handles DST and moves to next week after closing',()=>{
 const s=fixture(),result=simulationSlots(s,now);assert.equal(result.date,'2026-11-08');assert.equal(result.slots.length,96);assert.equal(result.slots[0].time,'12:00');assert.equal(result.slots.at(-1).time,'19:55');assert.equal(result.slots[0].at,Date.parse('2026-11-08T10:00:00Z'));
 assert.equal(result.slots[1].at-result.slots[0].at,300000);
 assert.equal(simulationSlots(s,Date.parse('2026-07-01T12:00:00Z')).slots[0].at,Date.parse('2026-07-05T09:00:00Z'));
 assert.equal(simulationSlots(s,Date.parse('2026-11-08T18:00:00Z')).date,'2026-11-15');
 assert.equal(simulationSlots(s,Date.parse('2026-11-08T10:00:00Z')).slots[0].time,'12:05');
});
test('booking is internal only, requires a nickname, excludes taken slots, validates quantities and only permits Garama or Cannelloni',()=>{
 const s=fixture(),g=seed.items.find(x=>x.name==='Garama and Madundung'),dragon=seed.items.find(x=>x.id===55),hydra=seed.items.find(x=>/hydra/i.test(x.name)),at=simulationSlots(s,now).slots[11].at;
 for(const id of ['p','q']){s.users[id].inv=[{uid:1,id:dragon.id}];s.users[id].uid=2;}
 const before=JSON.stringify(s.users.p),data={at,nick:'Player_42',plan:[{uid:1,target:g.id,q:4}]};
 assert.throws(()=>execute(s,'p',seed,'simulation-book',{...data,nick:''},now));
 assert.throws(()=>execute(s,'p',seed,'simulation-book',{...data,plan:[{uid:1,target:g.id,q:5}]},now));
 if(hydra)assert.throws(()=>execute(s,'p',seed,'simulation-book',{...data,plan:[{uid:1,target:hydra.id}]},now));
 const booking=execute(s,'p',seed,'simulation-book',data,now).booking;assert.equal(booking.time,'12:55');assert.equal(booking.nick,'Player_42');assert.equal(booking.change,Math.round((dragon.price-4*g.price)*100)/100);assert.equal(JSON.stringify(s.users.p),before);assert.equal(s.withdrawals.length,0);
 assert(!simulationSlots(s,now).slots.some(x=>x.at===at));assert.throws(()=>execute(s,'q',seed,'simulation-book',data,now));assert.throws(()=>execute(s,'p',seed,'simulation-book',{...data,at:at+300000},now));
 assert.equal(execute(s,'q',seed,'simulation-book',{...data,at:at+300000,plan:[{uid:1,target:dragon.id}]},now).booking.change,0);
});
test('API retries cannot double-credit a free topup or partner and Stars/manual transfer routes cannot credit this ledger',async()=>{
 const db=localDatabase();try{
  db.sqlite.exec(await fs.readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));const owner={id:'tg:1116312381'},p={id:'tg:42'},partner={id:'tg:43'};
  async function req(who,action='state',data={},requestId=crypto.randomUUID()){const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,requestId})}),db,who);return {status:r.status,j:await r.json()}}
  for(const who of [owner,p,partner])await req(who);await req(owner,'admin-partner',{userId:partner.id,code:'FRIEND',pct:50});
  const id=crypto.randomUUID(),item=seed.items[0],data={items:[{id:item.id,q:2}],promo:'FRIEND'};const created=await req(p,'simulation-topup',data,id);await req(p,'simulation-topup',data,id);assert.equal((await req(p)).j.user.balance,0);const tid=created.j.result.topup.id;await req(owner,'simulation-show',{id:tid});const decision=crypto.randomUUID();await req(owner,'simulation-review',{id:tid,status:'ok'},decision);await req(owner,'simulation-review',{id:tid,status:'ok'},decision);assert.equal((await req(owner,'simulation-review',{id:tid,status:'ok'})).status,400);
  const state=(await req(partner)).j;assert.equal(state.config.refs.FRIEND.pending,0);assert.equal(state.config.simulationTopups.length,0);assert.equal((await req(p)).j.user.balance,item.price*2);assert.equal((await req(owner)).j.config.simulationTopups.length,1);
  for(const action of ['virtual-topup','virtual-withdraw','admin-recipient','admin-topup-show','admin-virtual-request','partner-withdraw'])assert.equal((await req(owner,action,{})).status,403);
 }finally{db.sqlite.close()}
});
test('final item form submits a free action without transfer instructions and opens its waiting queue',async()=>{
 const source=await fs.readFile(new URL('../client/simulation.js',import.meta.url),'utf8');let called,output;const c=vm.createContext({profilePage:()=>'',tpPage:()=>'',tpSum:()=>{},TP:{tab:'items',promo:'FRIEND',sel:{7:1}},NET:{busy:false,request:async(action,data)=>{called={action,data};return {result:{topup:{id:'free-test',number:1,total:70,free:true,simulation:true,st:'new',position:1}}}},adopt:()=>{}},topupMethodClosed:()=>false,boundCode:()=>'',render:()=>{},fmt:String,esc:String,topupStatusDialog:()=>{},topupCountdown:()=>{},modal:{dataset:{}},openModal:html=>output=html,toast:message=>assert.fail(message),refWd:()=>{},wdDragons:()=>{},wdOpts:()=>{},wdPick:()=>{},bxWd:()=>{},bxWdGo:()=>{},bxWdGo_o:()=>{},queueHtml:()=>{},tqAdminHtml:()=>{},wqAdminHtml:()=>{},showSec:()=>{},setInterval:()=>{},document:{addEventListener(){}}});
 vm.runInContext(source,c);await c.submitTopupRequest();assert.equal(called.action,'simulation-topup');assert.equal(called.data.promo,'FRIEND');assert(!('nick' in called.data));assert.match(output,/Очередь на начисление/);assert.match(output,/Передавать предметы кому-либо не нужно/);
});
