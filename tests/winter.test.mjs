import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,account,execute,view,winterPromotion} from '../server/model.mjs';
import seed from '../server/seed.json' with {type:'json'};
const now=Date.parse('2026-11-09T16:30:00Z');
function fixture(){const state=fresh(seed,'owner');state.config.autoPromoSeed=0;for(const id of ['owner','player','partner'])account(state,id,id);return state}
function approve(state,topup){execute(state,'owner',seed,'simulation-show',{id:topup.id},now+1);execute(state,'owner',seed,'simulation-review',{id:topup.id,status:'ok'},now+2)}
test('winter promotion rotates on exact two-hour boundary and is exposed with server time',()=>{
 const p=winterPromotion(now);assert.equal(p.bonus,9);assert.equal(p.expiresAt,Date.parse('2026-11-09T18:00:00Z'));assert.equal(winterPromotion(p.expiresAt-1).code,p.code);assert.notEqual(winterPromotion(p.expiresAt).code,p.code);
 const state=fixture();assert.deepEqual(view(state,'player',seed,now).config.winterPromotion,p);
});
test('winter bonus is calculated server-side, approved once and never creates a partner binding',()=>{
 const state=fixture();const topup=execute(state,'player',seed,'simulation-topup',{type:'stars',units:100,promo:winterPromotion(now).code,bonus:1000,total:999999},now).topup;
 assert.equal(topup.base,125);assert.equal(topup.bonus,9);assert.equal(topup.total,136.25);assert(!state.users.player.bound);assert.equal(state.users.player.balance,0);
 approve(state,topup);assert.equal(state.users.player.balance,136.25);assert.throws(()=>approve(state,topup));assert.equal(state.users.player.balance,136.25);
});
test('winter promo keeps referral attribution and customer bonus without a duplicate deposit commission',()=>{
 const state=fixture();execute(state,'owner',seed,'admin-partner',{userId:'partner',code:'FRIEND',pct:50,bonus:15},now);execute(state,'player',seed,'ref-bind',{code:'FRIEND'},now);
 const topup=execute(state,'player',seed,'simulation-topup',{type:'stars',units:100,promo:winterPromotion(now).code},now).topup;assert.equal(topup.bonus,15);assert.equal(topup.promo,'FRIEND');approve(state,topup);assert.equal(state.users.player.balance,143.75);assert.equal(state.partners.FRIEND.pending,0);assert.equal(state.partners.FRIEND.vol,125);
});
test('expired/fabricated auto codes are rejected with no mutation; items and gears also accept current code',()=>{
 const state=fixture();const promo=winterPromotion(now);
 for(const code of [winterPromotion(now-7200000).code,'SNOW-FAKE'])assert.throws(()=>execute(state,'player',seed,'simulation-topup',{type:'stars',units:100,promo:code},now),/истёк/);
 assert(!state.simulationTopups);assert(!state.users.player.bound);
 for(const [type,id] of [['items',1],['gears',19]]){const record=execute(state,'player',seed,'simulation-topup',{type,items:[{id,q:1}],promo:promo.code},now).topup;assert.equal(record.bonus,9);assert.equal(record.total,Math.round(record.base*1.09*100)/100)}
});
test('only owner can configure HTTPS music; unsafe URLs are rejected and track can be removed',()=>{
 const state=fixture();assert.throws(()=>execute(state,'player',seed,'admin-winter-music',{url:'https://audio.example/song.mp3'},now));
 for(const url of ['javascript:alert(1)','http://example.com/song.mp3','https://user:secret@example.com/song.mp3','bad'])assert.throws(()=>execute(state,'owner',seed,'admin-winter-music',{url},now));
 execute(state,'owner',seed,'admin-winter-music',{url:'https://audio.example/last-christmas.mp3'},now);assert.equal(view(state,'player',seed,now).config.winterMusicUrl,'https://audio.example/last-christmas.mp3');execute(state,'owner',seed,'admin-winter-music',{url:''},now);assert.equal(state.config.winterMusicUrl,'');
});

import fs from 'node:fs/promises';
import vm from 'node:vm';
test('winter interface initializes, filters by contents and previews the server promo without stacking',async()=>{
 const source=await fs.readFile(new URL('../client/winter.js',import.meta.url),'utf8');
 const nodes={'tp-ph':{}};const handlers={};const empty={classList:{add(){},toggle(){}},setAttribute(){},appendChild(){},style:{setProperty(){}}};
 const ctx=vm.createContext({
  document:{body:empty,documentElement:empty,hidden:false,querySelectorAll:()=>[],createElement:()=>({...empty}),addEventListener:(type,fn)=>{(handlers[type]||=[]).push(fn)}},
  window:{addEventListener(){}},Audio:class{constructor(){this.paused=true}addEventListener(){}getAttribute(){return this.src||null}pause(){}play(){this.paused=false;return Promise.resolve()}},
  localStorage:{getItem:()=>null,setItem(){}},setInterval(){},setTimeout(){},FUSE_BACKGROUND_IMAGE:'background',FUSE_MACHINE_IMAGE:'machine',SITE_TOKEN_IMAGE:'old',COIN:'',
  A:{cases:[{id:1,name:'Снежный',grp:'theme',drops:[1]}],refs:{FRIEND:{bonus:15}},winterPromotion:winterPromotion(Date.now())},TP:{clockOffset:0,promo:''},NET:{ready:false},U:{sec:'none'},
  cDrops:()=>[{name:'Dragon Cannelloni'}],cImg:()=>'',caseCard:c=>'<button>'+c.name+' items</button>',tpBonus:()=>0,tpPh:()=>{},tpPage:()=>'<label>Код партнёра</label>',
  simulationPromoCode:()=>ctx.TP.promo,boundCode:()=> 'FRIEND',cwRender(){},cwPlay(){},cwDone(){},settings(){},showSec(){},renderCases(){},paintFuse(){},hdr(){},fmt:String,esc:String,$:selector=>nodes[selector.slice(1)]||null,Date,console
 });
 vm.runInContext(source,ctx);ctx.winterSearch='dragon';assert.match(ctx.winterCatalog(),/Снежный/);ctx.winterSearch='нет-такого';assert.match(ctx.winterCatalog(),/По этому запросу кейсов нет/);
 ctx.TP.promo=ctx.A.winterPromotion.code;assert.equal(ctx.tpBonus(),15);ctx.tpPh();assert.match(nodes['tp-ph'].textContent,/15%/);ctx.A.refs.FRIEND.bonus=5;assert.equal(ctx.tpBonus(),9);
 ctx.A.winterPromotion.expiresAt=Date.now()-1000;ctx.tpPh();assert.match(nodes['tp-ph'].textContent,/истёк/);assert.equal(ctx.tpBonus(),0);
 assert.match(ctx.tpPage(),/Промокод или код партнёра/);assert.match(ctx.WINTER_TOKEN_IMAGE,/data:image\/svg/);
});
