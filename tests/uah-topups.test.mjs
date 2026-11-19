import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fresh,account,execute,view} from '../server/model.mjs';
import {handle,readTopups} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import {UAH_TOPUP_AMOUNTS} from '../server/uah-topups.mjs';
import seed from '../server/seed.json' with {type:'json'};
const now=Date.parse('2026-11-16T14:00:00Z'),card='4000000000000002';
function fixture(){const s=fresh(seed,'owner');for(const id of ['owner','player','other','partner'])account(s,id,id);execute(s,'owner',seed,'uah-card-save',{card},now);return s}
const act=(s,id,action,data={})=>execute(s,id,seed,action,data,now);
test('round UAH examples use the server-owned 1.25 rate',()=>{
 for(const amount of UAH_TOPUP_AMOUNTS){const s=fixture(),r=act(s,'player','uah-topup',{amount,total:999999,rate:999}).topup;assert.equal(r.total,amount*1.25);assert.equal(r.rate,1.25);assert.equal(r.st,'new');assert.equal(s.users.player.balance,0);assert(!('card' in r));}
 for(const amount of [0,-10,0.5,1.001,1000001,'10',NaN,Infinity]){const s=fixture();assert.throws(()=>act(s,'player','uah-topup',{amount}));assert.equal(s.uahTopups,undefined)}
});
test('a card is private until the owner reveals it, and is pinned to that request',()=>{
 const s=fixture(),r=act(s,'player','uah-topup',{amount:20}).topup;
 assert(!JSON.stringify(view(s,'player',seed,now)).includes(card));assert(!JSON.stringify(view(s,'other',seed,now)).includes(card));assert.equal(view(s,'owner',seed,now).config.uahCard,card);
 assert.throws(()=>act(s,'player','uah-show-card',{id:r.id}),/владельцу/);assert.throws(()=>act(s,'other','uah-paid',{id:r.id}),/не найдена/);assert.throws(()=>act(s,'player','uah-paid',{id:r.id}),/реквизитов/);
 act(s,'owner','uah-show-card',{id:r.id});assert.equal(view(s,'player',seed,now).config.uahTopups[0].card,card);assert(!JSON.stringify(view(s,'other',seed,now)).includes(card));
 act(s,'owner','uah-card-save',{card:'4444444444444444'});assert.equal(view(s,'player',seed,now).config.uahTopups[0].card,card);
});
test('claiming payment does not credit; the owner verifies it and can credit only once',()=>{
 const s=fixture();act(s,'owner','admin-partner',{userId:'partner',code:'FRIEND',pct:10,bonus:0});const r=act(s,'player','uah-topup',{amount:100,promo:'friend'}).topup;
 assert.throws(()=>act(s,'player','uah-topup',{amount:10}),/активная/);assert.throws(()=>act(s,'owner','uah-review',{id:r.id,status:'ok'}),/отметки/);
 act(s,'owner','uah-show-card',{id:r.id});act(s,'player','uah-paid',{id:r.id});assert.equal(s.users.player.balance,0);assert.throws(()=>act(s,'player','uah-cancel',{id:r.id}),/проверку/);
 assert.throws(()=>act(s,'player','uah-review',{id:r.id,status:'ok'}),/владельцу/);act(s,'owner','uah-review',{id:r.id,status:'ok'});assert.equal(s.users.player.balance,125);assert.equal(s.partners.FRIEND.vol,125);assert.equal(s.partners.FRIEND.pending,0);
 assert.throws(()=>act(s,'owner','uah-review',{id:r.id,status:'ok'}),/обработана/);assert.equal(s.users.player.balance,125);
});
test('closure, unset card, cancellation, expiry and rejection never credit a wallet',()=>{
 const s=fixture();act(s,'owner','uah-card-save',{card:''});assert.throws(()=>act(s,'player','uah-topup',{amount:10}),/не настроено/);act(s,'owner','uah-card-save',{card});
 act(s,'owner','admin-topups-toggle',{type:'uah',closed:true});assert.throws(()=>act(s,'player','uah-topup',{amount:10}),/закрыты/);assert(!s.config.topupsItemsClosed);act(s,'owner','admin-topups-toggle',{type:'uah',closed:false});
 let r=act(s,'player','uah-topup',{amount:10}).topup;act(s,'player','uah-cancel',{id:r.id});assert.equal(s.users.player.balance,0);
 r=act(s,'player','uah-topup',{amount:10}).topup;act(s,'owner','uah-review',{id:r.id,status:'no'});assert.equal(s.users.player.balance,0);
 r=act(s,'player','uah-topup',{amount:10}).topup;assert.throws(()=>execute(s,'owner',seed,'uah-show-card',{id:r.id},now+1800001),/истекла/);assert.equal(view(s,'player',seed,now+1800001).config.uahTopups.at(-1).st,'expired');
 for(const value of ['1234','4000<script>0000','4000000000000002CVV'])assert.throws(()=>act(s,'owner','uah-card-save',{card:value}));
});
test('API retries persist one UAH credit and the user status endpoint never leaks another card',async t=>{
 const db=localDatabase();t.after(()=>db.sqlite.close());db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
 const owner={id:'tg:1116312381',name:'Owner'},player={id:'tg:42',name:'Player'},other={id:'tg:43',name:'Other'};
 async function req(who,action='state',data={},requestId=crypto.randomUUID()){const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://test'},body:JSON.stringify({action,data,requestId})}),db,who);return {status:r.status,j:await r.json()}}
 for(const who of [owner,player,other])await req(who);await req(owner,'uah-card-save',{card});const createId=crypto.randomUUID();let result=await req(player,'uah-topup',{amount:50},createId);const id=result.j.result.topup.id;await req(player,'uah-topup',{amount:50},createId);
 await req(owner,'uah-show-card',{id});await req(player,'uah-paid',{id});const approvalId=crypto.randomUUID();await req(owner,'uah-review',{id,status:'ok'},approvalId);await req(owner,'uah-review',{id,status:'ok'},approvalId);
 assert.equal((await req(player)).j.user.balance,62.5);assert.equal((await req(owner)).j.config.uahTopups.length,1);assert.equal((await req(owner,'uah-review',{id,status:'ok'})).status,400);
 const own=await (await readTopups(new Request('https://test/api/topups'),db,player)).json(),foreign=await (await readTopups(new Request('https://test/api/topups'),db,other)).json();assert.equal(own.uahTopups[0].card,card);assert.equal(foreign.uahTopups.length,0);assert(!JSON.stringify(foreign).includes(card));
});
test('admin item credit and enable controls persist and govern the actual application amount',()=>{
 const s=fixture(),item=seed.items.find(x=>x.price>=65&&!x.hidden&&!x.mutation);act(s,'owner','admin-topup-settings',{updates:[{id:item.id,on:true,credit:77.25}]});
 let r=act(s,'player','simulation-topup',{items:[{id:item.id,q:2}],nick:'Player'}).topup;assert.equal(r.base,154.5);
 act(s,'owner','admin-topup-settings',{updates:[{id:item.id,on:false}]});assert.throws(()=>act(s,'player','simulation-topup',{items:[{id:item.id,q:1}]}),/отключён/);
 assert.throws(()=>act(s,'player','admin-topup-settings',{updates:[{id:item.id,on:true}]}),/владельцу/);act(s,'owner','admin-counters',{kind:'online',value:123});assert.equal(view(s,'player',seed,now).user.online,123);
});

test('admin can create a case from the full expanded catalog rather than hitting the obsolete 500-item limit',()=>{
 const s=fixture(),drops=seed.items.filter(item=>!item.hidden).map(item=>item.id);assert(drops.length>500);
 const made=act(s,'owner','admin-case-create',{name:'Expanded catalog',price:100,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',drops});assert.equal(s.config.cases.find(c=>c.id===made.caseId).drops.length,drops.length);
});


test('custom UAH values and kopecks are accepted and credited tokens round to cents',()=>{for(const [amount,total] of [[1,1.25],[15,18.75],[10.5,13.13],[1.01,1.26],[10001,12501.25]]){const s=fixture(),r=act(s,'player','uah-topup',{amount}).topup;assert.equal(r.amount,amount);assert.equal(r.total,total);assert.equal(r.notifyOwner,true)}});
