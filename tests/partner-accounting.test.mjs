import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {fresh,account,execute,view} from '../server/model.mjs';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import realSeed from '../server/seed.json' with {type:'json'};
const seed={items:[{id:1,name:'Stake',price:100},{id:2,name:'Winner',price:200},{id:3,name:'Small',price:1}],cases:[{id:10,name:'Test',price:100,drops:[2]}]};
const now=Date.parse('2026-11-15T10:00:00Z');
function fixture(catalog=seed){const s=fresh(catalog,'owner');for(const id of ['owner','partner','player','other'])account(s,id,id);execute(s,'owner',catalog,'admin-partner',{userId:'partner',code:'FRIEND',pct:10,bonus:0},now);execute(s,'player',catalog,'ref-bind',{code:'FRIEND'},now);s.users.player.balance=1000;return s}
const run=(s,action,data={},rng=()=>0)=>execute(s,'player',seed,action,data,now,rng);
function item(s,id=1){const u=s.users.player,x={id,uid:u.uid++};u.inv.push(x);return x.uid}

test('100 stake and 200 prize deduct 10 at 10%; selling the prize does not charge twice',()=>{
 const s=fixture();s.partners.FRIEND.pending=5;run(s,'case',{id:10,n:1,payout:999999,pct:99});
 const p=s.partners.FRIEND;assert.equal(p.pending,-5);assert.equal(p.list[0].earned,-10);assert.equal(s.users.player.balance,900);
 assert.deepEqual(Object.fromEntries(['stake','payout','margin','pct','amount'].map(k=>[k,p.gameLedger[0][k]])),{stake:100,payout:200,margin:-100,pct:10,amount:-10});
 run(s,'sell-all');assert.equal(s.users.player.balance,1100);assert.equal(p.pending,-5);assert.equal(p.gameLedger.length,1);
 assert.throws(()=>execute(s,'partner',seed,'partner-claim',{},now),/Нет средств/);
 s.config.cases[0].drops=[3];run(s,'case',{id:10,n:1});assert.equal(p.pending,4.9);
 assert.equal(execute(s,'partner',seed,'partner-claim',{},now).claimed,4.9);assert.equal(p.pending,0);
});

test('recycling a break-even stake makes no commission; admin changes apply to new games only',()=>{
 const s=fixture();s.config.cases[0].drops=[1];
 for(let i=0;i<3;i++){run(s,'case',{id:10,n:1});run(s,'sell-all')}
 assert.equal(s.partners.FRIEND.pending,0);assert.equal(s.users.player.balance,1000);
 s.config.cases[0].drops=[2];run(s,'case',{id:10,n:1});
 execute(s,'owner',seed,'admin-partner-edit',{code:'FRIEND',pct:20,bonus:0},now);run(s,'case',{id:10,n:1});
 assert.equal(s.partners.FRIEND.pending,-30);assert.equal(s.partners.FRIEND.gameLedger[0].pct,20);assert.equal(s.partners.FRIEND.gameLedger[1].pct,10);
});

test('coin and item Dice and upgrade use the actual server result',()=>{
 const s=fixture(),rolls=[0,.3,.3,.3];run(s,'dice',{color:0,bet:{type:'coin',amt:100}},()=>rolls.shift());assert.equal(s.partners.FRIEND.pending,-10);
 const uid=item(s);run(s,'dice',{color:0,bet:{type:'item',uid}},()=>.3);assert.equal(s.partners.FRIEND.pending,0);
 run(s,'upgrade',{ids:[item(s)],target:2,coins:0},()=>0);assert.equal(s.partners.FRIEND.pending,-10);
 run(s,'upgrade',{ids:[item(s)],target:2,coins:0},()=>.99);assert.equal(s.partners.FRIEND.pending,0);
});

test('Mines count the reserved stake once, wait for settlement and include cash-out item plus change',()=>{
 const s=fixture();run(s,'mines-start',{ids:[item(s)],n:2});assert.equal(s.partners.FRIEND.gameLedger,undefined);
 const g=s.users.player.mine,safe=Array.from({length:25},(_,i)=>i).find(i=>!g.mines.includes(i));run(s,'mines-open',{i:safe});assert.equal(s.partners.FRIEND.gameLedger,undefined);
 run(s,'mines-cash');assert.equal(s.partners.FRIEND.pending,-.4);assert.equal(s.partners.FRIEND.gameLedger[0].payout,104);
 run(s,'mines-start',{ids:[item(s)],n:2});run(s,'mines-open',{i:s.users.player.mine.mines[0]});assert.equal(s.partners.FRIEND.pending,9.6);assert.equal(s.partners.FRIEND.gameLedger[0].payout,0);assert.equal(s.partners.FRIEND.gameLedger.length,2);
});

test('Fuse includes extra items and awards a later boss trophy only once',()=>{
 const s=fixture(),rolls=[0,0,0,.99];run(s,'fuse',{ids:Array.from({length:4},()=>item(s))},()=>rolls.shift()??.99);
 const p=s.partners.FRIEND,entry=p.gameLedger[0];assert.equal(entry.stake,400);assert.equal(entry.payout,400);assert.equal(entry.amount,0);
 s.users.player.fuseBoss={id:'boss',claimed:false,hits:8,trophyId:2};run(s,'fuse-hit',{id:'boss'});assert.equal(p.gameLedger.length,1);run(s,'fuse-hit',{id:'boss'});assert.equal(p.pending,-20);assert.equal(p.gameLedger[0].payout,200);assert.throws(()=>run(s,'fuse-hit',{id:'boss'}));
});

test('fractional commissions round symmetrically; disabled and unrelated players cannot affect the balance',()=>{
 const s=fixture();s.config.cases[0].price=100.05;s.config.cases[0].drops=[1];run(s,'case',{id:10,n:1});assert.equal(s.partners.FRIEND.pending,.01);
 s.config.cases[0].price=99.95;run(s,'case',{id:10,n:1});assert.equal(s.partners.FRIEND.pending,0);
 const n=s.partners.FRIEND.gameLedger.length;s.partners.FRIEND.disabled=true;run(s,'case',{id:10,n:1});assert.equal(s.partners.FRIEND.gameLedger.length,n);
 s.partners.FRIEND.disabled=false;s.users.other.balance=1000;execute(s,'other',seed,'case',{id:10,n:1},now,()=>0);assert.equal(s.partners.FRIEND.gameLedger.length,n);
 assert.equal(view(s,'other',seed,now).config.refs.FRIEND.gameLedger,undefined);assert.equal(view(s,'partner',seed,now).config.refs.FRIEND.gameLedger.length,n);
});

test('a retried game API request writes one partner adjustment and preserves it on reload',async t=>{
 const db=localDatabase();t.after(()=>db.sqlite.close());db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
 const s=fixture(realSeed);s.config.custom.push({id:9000000,name:'Guaranteed',price:200});s.config.cases.push({id:9000000,name:'Test',price:100,drops:[9000000]});
 db.sqlite.prepare('INSERT INTO site_state(id,revision,data) VALUES(1,0,?)').run(JSON.stringify(s));
 const req=()=>handle(new Request('https://test/api/action',{method:'POST',headers:{Origin:'https://test','Content-Type':'application/json'},body:JSON.stringify({action:'case',requestId:'game-partner-retry',data:{id:9000000,n:1}})}),db,{id:'player',name:'player'});
 assert.equal((await req()).status,200);assert.equal((await req()).status,200);
 const stored=JSON.parse(db.sqlite.prepare('SELECT data FROM site_state').get().data);assert.equal(stored.partners.FRIEND.pending,-10);assert.equal(stored.partners.FRIEND.gameLedger.length,1);assert.equal(stored.users.player.inv.length,1);
});

test('negative balances and audited admin entries render with a minus and escape player text',async()=>{
 const esc=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;');
 const c=vm.createContext({fmt:String,r2:n=>n,esc,isOwner:()=>true,refWd:()=>'<section><div class="partner-balance-amount">-10</div><button>Перевести на баланс</button></section>',refsAdminHtml:()=>'<input placeholder="Partner % of top-ups">',A:{refs:{FRIEND:{code:'FRIEND',pending:-10,pct:10,gameLedger:[{user:'<script>',game:'case',at:now,stake:100,payout:200,pct:10,amount:-10}]}}}});
 vm.runInContext(await readFile(new URL('../client/partner-accounting.js',import.meta.url),'utf8'),c);
 assert.match(c.refWd({pending:-10}),/negative/);assert.match(c.refWd({pending:-10}),/Минус учтётся/);
 const html=c.refsAdminHtml();assert.match(html,/>-10 BU/);assert.match(html,/>-10<\/td>/);assert.doesNotMatch(html,/\+-|<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/Процент от результата игр/);
});


test('settling a legacy Rocket alongside a case does not contaminate the case commission',()=>{
 const s=fixture();s.users.player.rocket={value:500,start:now-100000,crash:1,auto:0};run(s,'case',{id:10,n:1});
 const entry=s.partners.FRIEND.gameLedger[0];assert.equal(entry.stake,100);assert.equal(entry.payout,200);assert.equal(entry.amount,-10);
});
