import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fresh,account,execute,partnerClaimOpen,winterPromotion,view} from '../server/model.mjs';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import {liveDropOrigin} from '../client/live-drop-origin.mjs';
import vm from 'node:vm';
import seed from '../server/seed.json' with {type:'json'};
const owner='tg:1116312381',partner='tg:202';
function fixture(){const state=fresh(seed,owner);account(state,owner,'Owner');account(state,partner,'Partner');account(state,'tg:303','Player');execute(state,owner,seed,'admin-partner',{userId:partner,code:'FRIEND',pct:10,bonus:5});state.partners.FRIEND.pending=77.75;state.users[partner].balance=12;return state}

test('Sunday claim window uses Kyiv time with exact opening/closing boundaries and summer offset',()=>{
 for(const [date,open] of [
  ['2026-11-13T10:00:00Z',false],['2026-11-14T10:00:00Z',false],['2026-11-15T09:59:59.999Z',false],['2026-11-15T10:00:00Z',true],
  ['2026-11-15T19:59:59.999Z',true],['2026-11-15T20:00:00Z',false],['2026-11-16T10:00:00Z',false],
  ['2026-07-05T08:59:59.999Z',false],['2026-07-05T09:00:00Z',true],['2026-07-05T19:00:00Z',false]
 ])assert.equal(partnerClaimOpen(Date.parse(date)),open,date);
});

test('partner moves only their own pending balance inside the window; no payout queue or external transfer is created',()=>{
 const state=fixture(),closed=Date.parse('2026-11-11T12:00:00Z'),open=Date.parse('2026-11-15T10:00:00Z');
 assert.throws(()=>execute(state,partner,seed,'partner-claim',{amount:999999,now:open},closed),/воскресеньям/);
 assert.equal(state.partners.FRIEND.pending,77.75);assert.equal(state.users[partner].balance,12);
 assert.throws(()=>execute(state,'tg:303',seed,'partner-claim',{},open),/Партнёрский/);
 const result=execute(state,partner,seed,'partner-claim',{amount:999999,userId:owner},open);
 assert.equal(result.claimed,77.75);assert.equal(state.users[partner].balance,89.75);assert.equal(state.partners.FRIEND.pending,0);assert.equal(state.partners.FRIEND.paid,77.75);assert.equal(state.withdrawals.length,0);
 assert.throws(()=>execute(state,partner,seed,'partner-claim',{},open),/Нет средств/);
});

test('API repeat of a partner claim credits once and the ledger survives reload',async t=>{
 const db=localDatabase();t.after(()=>db.sqlite.close());db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
 const state=fixture();db.sqlite.prepare('INSERT INTO site_state(id,revision,data) VALUES(1,0,?)').run(JSON.stringify(state));
 t.mock.method(Date,'now',()=>Date.parse('2026-11-15T10:00:00Z'));
 const request=()=>handle(new Request('https://brainup.test/api/action',{method:'POST',headers:{Origin:'https://brainup.test','Content-Type':'application/json'},body:JSON.stringify({action:'partner-claim',requestId:'sunday-claim-retry',data:{}})}),db,{id:partner,name:'Partner'});
 const first=await (await request()).json(),again=await (await request()).json();assert.equal(first.user.balance,89.75);assert.equal(again.user.balance,89.75);assert.equal(again.result.claimed,77.75);
 const persisted=JSON.parse(db.sqlite.prepare('SELECT data FROM site_state WHERE id=1').get().data);assert.equal(persisted.partners.FRIEND.claims.length,1);
});

test('themed auto codes are shared and stable for two hours, change on the boundary, and cannot be impersonated by a partner',()=>{
 const state=fixture(),now=Date.parse('2026-11-11T10:30:00Z'),code=winterPromotion(now,state.config.autoPromoSeed),publicConfig=view(state,partner,seed,now).config;
 assert.equal(publicConfig.winterPromotion.code,code.code);assert.equal(publicConfig.autoPromoSeed,undefined);
 assert.match(code.code,/^BU-(UPGRADE|DRAGON|CANNELLONI|TRALALERO|BOMBADINO|CANDYSLAP|BRAINROT|TUNGTUNG|GARAMA|CAPPUCCINO|TRIPITROPI|SPAGHETTI)-[A-Z0-9]{4}$/);assert.ok(code.code.length<=20);
 assert.equal(winterPromotion(code.expiresAt-1,state.config.autoPromoSeed).code,code.code);assert.notEqual(winterPromotion(code.expiresAt,state.config.autoPromoSeed).code,code.code);
 assert.throws(()=>execute(state,partner,seed,'promo-create',{code:code.code,max:1,amount:1},now),/зарезервирован/);
 const expired=winterPromotion(now-7200000,state.config.autoPromoSeed).code;
 assert.throws(()=>execute(state,'tg:303',seed,'simulation-topup',{type:'stars',units:100,promo:expired},now),/истёк/);
 const topup=execute(state,'tg:303',seed,'simulation-topup',{type:'stars',units:100,promo:code.code},now).topup;assert.equal(topup.bonus,9);assert.equal(state.users['tg:303'].bound,'');
});

test('existing sites persist their random promo seed on first state request',async t=>{
 const db=localDatabase();t.after(()=>db.sqlite.close());db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
 const state=fixture();delete state.config.autoPromoSeed;state.config.activationCasesV39=true;db.sqlite.prepare('INSERT INTO site_state(id,revision,data) VALUES(1,0,?)').run(JSON.stringify(state));
 const req=()=>handle(new Request('https://brainup.test/api/action'),db,{id:partner,name:'Partner'});
 const first=await (await req()).json(),second=await (await req()).json();assert.equal(first.config.winterPromotion.code,second.config.winterPromotion.code);
 const persisted=JSON.parse(db.sqlite.prepare('SELECT data FROM site_state WHERE id=1').get().data);assert.ok(Number.isSafeInteger(persisted.config.autoPromoSeed));
});

test('live cards preserve the recorded case name, link to its current case ID and never guess the source from a prize',()=>{
 const cases=[{id:1,name:'Renamed'}],drop={game:'case',caseId:1,caseName:'Нубини',itemId:50};
 assert.deepEqual(liveDropOrigin(drop,cases),{section:'cases',label:'Нубини',caseId:1,isCase:true});
 assert.deepEqual(liveDropOrigin({game:'case',itemId:50},cases),{section:'cases',label:'Кейс',caseId:null,isCase:true});
 assert.equal(liveDropOrigin({game:'upgrade'}).label,'Апгрейд');assert.equal(liveDropOrigin({game:'mines'}).section,'mines');
});

test('reference cards render the prize, BU price and a separate source face safely',async()=>{
 const source=await readFile(new URL('../client/live-drop-reference.js',import.meta.url),'utf8');
 const item={id:1,name:'Dragon <script>bad</script>',price:75},entry={id:10,name:'Renamed'};
 const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const ctx=vm.createContext({liveDropOrigin,feedCard(){},liveCard(){},renderDropFeed(){},feedSignature:'',
  document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){}},window:{matchMedia:()=>({matches:false})},
  A:{cases:[entry]},I:()=>item,cById:id=>id===10?entry:null,cImg:()=>'/case.webp',av:()=>'/item.webp',tier:()=>['1,2,3'],esc:escape,fmt:String,COIN:'<i class="coin" aria-label="BU"></i>',secIcon:()=>'<svg></svg>'});
 vm.runInContext(source,ctx);
 const html=ctx.feedCard({id:'drop-1',game:'case',caseId:10,caseName:'Original',itemId:1,price:75,qty:2,user:'Player <script>bad</script>'});
 assert.match(html,/type="button"/);assert.match(html,/live-prize-face/);assert.match(html,/live-source-face/);assert.match(html,/data-live-case="10"/);assert.match(html,/>Original</);assert.match(html,/aria-label="BU"/);assert.match(html,/×2/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/class="live-drop-user"/);assert.match(html,/Player &lt;script&gt;bad&lt;\/script&gt;/);
 Object.assign(item,{baseName:'Garama and Madundung',name:'Garama and Madundung · Diamond',mutation:'diamond'});
 const mutated=ctx.feedCard({itemId:1,price:75,user:'Hidden player'});assert.match(mutated,/class="n">Garama and Madundung<\/span>/);assert.match(mutated,/class="live-mutation-icon"/);assert.match(mutated,/src="\/assets\/mutation-icons\/diamond.png"/);assert.doesNotMatch(mutated,/>[^<]*Diamond/);assert.match(mutated,/class="live-drop-user"[^>]*>Hidden player<\/span>/);

});
