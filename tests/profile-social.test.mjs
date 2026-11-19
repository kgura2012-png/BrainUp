import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {fresh,account,execute,publicFeed} from '../server/model.mjs';
import {dropPlayerId,publicPlayerProfile,telegramReferralUrl} from '../server/player-profile.mjs';
import {handle} from '../server/service.mjs';
import {telegramWebhook} from '../server/telegram.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import seed from '../server/seed.json' with {type:'json'};
const owner='tg:1116312381',partner='tg:202',viewer='tg:303';
function fixture(){const s=fresh(seed,owner);for(const [id,name] of [[owner,'Owner'],[partner,'Partner'],[viewer,'Player']])account(s,id,name);execute(s,owner,seed,'admin-partner',{userId:partner,code:'FRIEND',pct:10,bonus:8});return s}
async function dbFixture(t){const DB=localDatabase();t.after(()=>DB.sqlite.close());DB.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));const state=fixture();DB.sqlite.prepare('INSERT INTO site_state(id,revision,data) VALUES(1,0,?)').run(JSON.stringify(state));return {DB,state}}
function request(action,data={}){return new Request('https://brainup.test/api/action',{method:'POST',headers:{Origin:'https://brainup.test','Content-Type':'application/json'},body:JSON.stringify({action,data,requestId:crypto.randomUUID()})})}

test('public profiles expose grouped inventory and game stats without private wallet, referral or moderation fields',()=>{
 const s=fixture(),u=s.users[partner];u.balance=999;u.inv=[{id:0,uid:1},{id:0,uid:2},{id:1,uid:3}];u.uid=4;u.telegramUsername='PrivateContact';u.promos={PRIVATE:{}};u.win=7;u.lose=2;
 const profile=publicPlayerProfile(s,seed,{userId:partner});assert.equal(profile.name,'Partner');assert.equal(profile.stats.inventoryCount,3);assert.equal(profile.items.find(item=>item.id===0).qty,2);assert.equal(profile.stats.wins,7);
 for(const key of ['balance','telegramUsername','promos','bound','receipts','admin'])assert.equal(profile[key],undefined);
 assert.equal(JSON.stringify(profile).includes('PrivateContact'),false);
});

test('new drops stay attached to the correct player after renames; ambiguous legacy names never pick a random player',()=>{
 const s=fixture();s.users[partner].balance=10000;execute(s,partner,seed,'case',{id:seed.cases[0].id,n:1},Date.now(),()=>0);const drop=s.drops[0];assert.equal(drop.userId,partner);
 s.users[partner].me='Renamed';assert.equal(publicPlayerProfile(s,seed,{dropId:drop.id}).id,partner);assert.equal(publicFeed(s,drop.ts+5000).drops[0].userId,partner);
 assert.equal(dropPlayerId(s,{user:'Player'}),viewer);s.users[partner].me='Player';assert.equal(dropPlayerId(s,{user:'Player'}),null);
});

test('public profile API is read-only, paginates inventory and denies banned viewers',async t=>{
 const {DB,state}=await dbFixture(t);state.users[partner].inv=seed.items.slice(0,55).map((item,index)=>({id:item.id,uid:index+1}));DB.sqlite.prepare('UPDATE site_state SET data=? WHERE id=1').run(JSON.stringify(state));
 const response=await handle(request('player-profile',{userId:partner,page:2}),DB,{id:viewer});assert.equal(response.status,200);const data=await response.json();assert.equal(data.result.profile.page,2);assert.equal(data.result.profile.items.length,7);assert.equal(DB.sqlite.prepare('SELECT revision FROM site_state WHERE id=1').get().revision,0);
 state.users[viewer].banned=true;DB.sqlite.prepare('UPDATE site_state SET data=? WHERE id=1').run(JSON.stringify(state));assert.equal((await handle(request('player-profile',{userId:partner}),DB,{id:viewer})).status,403);
});

test('partner link API uses the real bot username and does not expose another partner link',async t=>{
 const {DB}=await dbFixture(t);const options={getBotUsername:async()=> 'BrainUpOfficial_bot'};
 const response=await handle(request('referral-info'),DB,{id:partner},options),result=await response.json();assert.equal(result.result.url,'https://t.me/BrainUpOfficial_bot?start=ref_FRIEND');
 assert.equal((await handle(request('referral-info',{userId:partner}),DB,{id:viewer},options)).status,403);
 assert.throws(()=>telegramReferralUrl('bad/name','FRIEND'));assert.throws(()=>telegramReferralUrl('ValidBot','bad&code'));
});

test('Telegram referral deep link binds the verified visitor once and survives reopening the bot',async t=>{
 const {DB}=await dbFixture(t),calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({method:String(url).split('/').at(-1),body:JSON.parse(options.body)});return Response.json({ok:true,result:{}})});
 const env={DB,TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_WEBHOOK_SECRET:'test-secret'};
 const update={update_id:55,message:{text:'/start ref_FRIEND',from:{id:404,first_name:'Visitor'},chat:{type:'private',id:404}}};
 const webhook=()=>telegramWebhook(new Request('https://brainup.test/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'test-secret','Content-Type':'application/json'},body:JSON.stringify(update)}),env);
 assert.equal((await webhook()).status,200);assert.equal((await webhook()).status,200);
 const state=JSON.parse(DB.sqlite.prepare('SELECT data FROM site_state WHERE id=1').get().data);assert.equal(state.users['tg:404'].bound,'FRIEND');assert.equal(state.partners.FRIEND.count,1);assert.ok(calls.some(call=>call.method==='sendMessage'&&call.body.text.includes('Приглашение партнёра сохранено')));
});

test('clearing an entered partner code removes its top-up bonus but preserves referral attribution',()=>{
 const s=fixture();execute(s,viewer,seed,'ref-bind',{code:'FRIEND'});
 const withPromo=execute(s,viewer,seed,'simulation-topup',{type:'stars',units:100,promo:'FRIEND'}).topup;
 const withoutPromo=execute(s,viewer,seed,'simulation-topup',{type:'stars',units:100,promo:''}).topup;
 assert.equal(withPromo.bonus,8);assert.equal(withoutPromo.bonus,0);assert.equal(withoutPromo.promo,'FRIEND');assert.equal(s.users[viewer].bound,'FRIEND');
});

test('closing top-up dialogs clears every entered promo; only the owner gets the profile admin entry',async()=>{
 let closed=0,allowed=true;
 const context=vm.createContext({closeModal:()=>closed++,modal:{classList:{contains:()=>true},dataset:{view:'topup'}},TP:{promo:'BU-DRAGON-ABCD'},FREE_QUEUE_DRAFT:{promo:'BU-DRAGON-ABCD'},
  document:{addEventListener(){},getElementById:()=>null,querySelector:()=>null},refPage:()=>'<div></div>',myRef:()=>null,NET:{ready:false},setTimeout(){},profilePage:()=>'<div class="brain-profile">Content</div>',profile(){},showSec(){},U:{ptab:'main'},isOwner:()=>allowed});
 vm.runInContext(await readFile(new URL('../client/profile-social.js',import.meta.url),'utf8'),context);
 for(const view of ['topup','free-queue-intro','topup-queue']){context.modal.dataset.view=view;context.TP.promo='FRIEND';context.closeModal();assert.equal(context.TP.promo,'')}
 assert.equal(closed,3);assert.equal(context.FREE_QUEUE_DRAFT,null);
 assert.match(context.profilePage(),/data-owner-profile-admin/);allowed=false;assert.doesNotMatch(context.profilePage(),/data-owner-profile-admin/);
});

test('a single click or mobile tap on a live drop opens its player rather than the game source',async()=>{
 const handlers={},opened=[];
 const context=vm.createContext({feedCard(){},liveCard(){},renderDropFeed(){},feedSignature:'',
  document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener:(type,fn)=>{handlers[type]=fn}},window:{matchMedia:()=>({matches:true})},U:{busy:false},caseBusy:false,CW:{el:null},openPublicPlayer:query=>opened.push(query)});
 vm.runInContext(await readFile(new URL('../client/live-drop-reference.js',import.meta.url),'utf8'),context);
 handlers.click({target:{closest:()=>({dataset:{playerId:partner,drop:'drop-id',liveSection:'upgrade'}})}});
 assert.equal(opened.length,1);assert.equal(opened[0].userId,partner);assert.equal(opened[0].dropId,'drop-id');
});
