import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fresh,account,execute} from '../server/model.mjs';
import seed from '../server/seed.json' with {type:'json'};
const now=1000;
function fixture(){const s=fresh(seed,'owner');for(const id of ['owner','p','partner'])account(s,id,id);execute(s,'owner',seed,'admin-partner',{userId:'partner',code:'FRIEND',pct:50,bonus:10});return s}
test('simulated Stars use 1.25, apply admin bonus, wait for review and never create a real invoice',()=>{
 const s=fixture(),data={type:'stars',units:100,promo:'FRIEND',total:999999,bonus:900,rate:500};
 const t=execute(s,'p',seed,'simulation-topup',data,now).topup;assert.equal(t.base,125);assert.equal(t.bonus,10);assert.equal(t.total,137.5);assert.equal(t.stars,100);assert.equal(t.type,'stars');assert.equal(t.free,true);assert.equal(t.simulation,true);assert.equal(t.st,'new');assert.equal(s.users.p.balance,0);assert.equal(s.partners.FRIEND.pending,0);assert(!t.invoiceUrl);assert.equal(s.topups.length,0);
 execute(s,'owner',seed,'simulation-show',{id:t.id},now+1);execute(s,'owner',seed,'simulation-review',{id:t.id,status:'ok'},now+2);assert.equal(s.users.p.balance,137.5);assert.equal(s.partners.FRIEND.pending,0);assert.equal(s.partners.FRIEND.vol,125);
 assert.throws(()=>execute(s,'owner',seed,'simulation-review',{id:t.id,status:'ok'},now+3));assert.equal(s.users.p.balance,137.5);
});
test('Stars method validates quantities independently of item availability and requires re-entering the promo for the current bonus',()=>{
 const s=fixture();for(const units of [0,24,25.5,10001,Infinity,NaN])assert.throws(()=>execute(s,'p',seed,'simulation-topup',{type:'stars',units},now));
 assert.equal(s.users.p.balance,0);assert.equal(s.simulationTopups,undefined);s.config.topupsItemsClosed=true;
 const first=execute(s,'p',seed,'simulation-topup',{type:'stars',units:200,promo:'FRIEND'},now).topup;assert.equal(first.total,275);
 execute(s,'owner',seed,'admin-partner-edit',{code:'FRIEND',pct:50,bonus:20});const second=execute(s,'p',seed,'simulation-topup',{type:'stars',units:200,promo:'FRIEND'},now+1).topup;assert.equal(second.total,300);assert.equal(first.total,275);
 s.config.topupsStarsClosed=true;assert.throws(()=>execute(s,'p',seed,'simulation-topup',{type:'stars',units:100},now+2),/Stars временно закрыты/);
});
test('final Stars form previews tokens and promo bonus and sends only the free queue action',async()=>{
 const source=await fs.readFile(new URL('../client/simulation.js',import.meta.url),'utf8'),nodes={'simulation-credit-total':{},'tp-sum':{},'tp-ph':{}},requests=[];
 const context=vm.createContext({profilePage:()=>'',tpPage:()=>'',tpSum:()=>{},TP:{tab:'stars',stars:100,promo:'FRIEND',sel:{}},A:{refs:{FRIEND:{bonus:10}}},NET:{busy:false,request:async(action,data)=>{requests.push({action,data});return {result:{topup:{id:'free-stars',number:1,total:137.5,free:true,simulation:true,st:'new',position:1}}}},adopt:()=>{}},topupMethodClosed:()=>false,topupMethodLabel:type=>({stars:'Stars',items:'Брейнроты',gears:'Гиры'}[type]),boundCode:()=>'',refNorm:code=>code.trim().toUpperCase(),r2:n=>Math.round(n*100)/100,render:()=>{},fmt:String,esc:String,COIN:'<i class="coin"></i>',$:id=>nodes[id.slice(1)],tpTotal:()=>context.tpBase()*(1+context.tpBonus()/100),tpBase:()=>context.TP.stars*1.25,topupStatusDialog:()=>{},topupCountdown:()=>{},modal:{dataset:{}},openModal:()=>{},toast:message=>assert.fail(message),refWd:()=>{},wdDragons:()=>{},wdOpts:()=>{},wdPick:()=>{},bxWd:()=>{},bxWdGo:()=>{},bxWdGo_o:()=>{},queueHtml:()=>{},tqAdminHtml:()=>{},wqAdminHtml:()=>{},showSec:()=>{},setInterval:()=>{},document:{addEventListener(){}},startSupportPayment:()=>assert.fail('must not open a real payment'),fetch:()=>assert.fail('must not call payment APIs')});
 vm.runInContext(source,context);const page=context.tpPage();assert.match(page,/simulation-credit-total/);assert.match(page,/137.5/);assert.match(page,/PROMO/);assert.match(page,/data-v="gears"/);assert.match(page,/Звёзды не списываются/);assert(!page.includes('Создать счёт'));
 context.tpSum();assert.equal(nodes['simulation-credit-total'].textContent,'137.5');assert.match(nodes['tp-ph'].textContent,/10%/);context.TP.stars=200;context.tpSum();assert.equal(nodes['simulation-credit-total'].textContent,'275');
 await context.submitTopupRequest();assert.equal(requests.length,1);assert.equal(requests[0].action,'simulation-topup');assert.equal(requests[0].data.type,'stars');assert.equal(requests[0].data.units,200);assert.equal(requests[0].data.promo,'FRIEND');
 context.TP.promo='';context.tpSum();assert.equal(nodes['simulation-credit-total'].textContent,'250');
});
