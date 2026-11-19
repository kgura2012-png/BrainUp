import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fresh,account,execute} from '../server/model.mjs';
import seed from '../server/seed.json' with {type:'json'};

const source=await readFile(new URL('../client/referral-tabs.js',import.meta.url),'utf8');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function fixture(){
 const handlers={},nodes={},requests=[],messages=[];
 let partner={code:'FRIEND',pct:12,count:2,vol:150,pending:15,paid:3,list:[{k:'tg:3',name:'<img onerror="bad">',ts:1234567890000,vol:150,earned:15},{k:'tg:4',name:'Friend',ts:1234567900000,vol:0,earned:0}]};
 const state={balance:1000,promos:{}},catalog=[{id:1,name:'Case One',price:20},{id:2,name:'Case Two',price:45},{id:3,name:'Free',price:0,bonus:true}];
 let shown='',closed=0;
 const context=vm.createContext({S:state,A:{cases:catalog},U:{sec:'referrals',ptab:'main'},NET:{busy:false,request:async(action,data)=>{requests.push({action,data});return {result:{total:data.caseId?200:100}}},adopt(){}},
  myRef:()=>partner,refPage:()=>'<section>Partner application</section>',refWd:()=>'<div id="bu-rfwd">Existing claim</div>',
  telegramPartnerLinks:{FRIEND:'https://t.me/BrainUpBot?start=ref_FRIEND'},loadTelegramPartnerLink:async()=>{},
  showSec:section=>{context.U.sec=section;shown=context.refPage()},render(){},toast:m=>messages.push(m),
  document:{addEventListener:(type,handler)=>{handlers[type]=handler},getElementById:id=>nodes[id]||null},
  window:{confirm:()=>true,open(){}},navigator:{clipboard:{writeText:async()=>{}}},crypto,
  modal:{dataset:{}},openModal:html=>{shown=html},closeModal:()=>closed++,setTimeout(){},setInterval(){},
  esc:escape,fmt:String,r2:n=>Math.round(n*100)/100,COIN:'<i class="coin"></i>',cById:id=>catalog.find(c=>c.id===id),cImg:c=>'image-'+c.id});
 vm.runInContext(source,context);
 const button=dataset=>({dataset,disabled:false});
 const click=async data=>handlers.click({target:{closest:()=>button(data)},preventDefault(){},stopImmediatePropagation(){}});
 const input=(key,value)=>handlers.input({target:{dataset:{refField:key},value}});
 const submit=()=>handlers.submit({target:{id:'referral-promo-form',reportValidity:()=>true},preventDefault(){}});
 return {context,handlers,nodes,requests,messages,click,input,submit,state,catalog,get shown(){return shown},get closed(){return closed},setPartner:p=>{partner=p}};
}

test('four tabs render real partner data, keep Telegram links and retain the application for non-partners',()=>{
 const f=fixture(),c=f.context;let html=c.refPage();
 for(const title of ['Главная','Статистика','Пользователи','Промокоды'])assert(html.includes(title));
 assert.match(html,/https:\/\/t.me\/BrainUpBot\?start=ref_FRIEND/);assert.match(html,/Existing claim/);assert.doesNotMatch(html,/25%|RevShare|15:00|МОСК/);
 c.REFERRALS_UI.tab='stats';html=c.refPage();assert.match(html,/Регистрации/);assert.match(html,/>150 /);assert.match(html,/>18 /);assert.doesNotMatch(html,/251,25|53 127|Переходы|Сумма ставок/);
 f.setPartner(null);assert.match(c.refPage(),/Partner application/);f.setPartner({disabled:true});assert.match(c.refPage(),/Partner application/);
});

test('users tab escapes names and paginates without exposing other account data',async()=>{
 const f=fixture(),c=f.context;c.REFERRALS_UI.tab='users';let html=c.refPage();assert.match(html,/&lt;img onerror=&quot;bad&quot;&gt;/);assert.doesNotMatch(html,/<img onerror/);
 f.setPartner({code:'FRIEND',list:Array.from({length:35},(_,i)=>({name:'Player '+i,ts:i+1}))});
 html=c.refPage();assert.equal((html.match(/class="referral-user"/g)||[]).length,30);assert.match(html,/more-users/);
 await f.click({refAction:'more-users'});assert.equal((f.shown.match(/class="referral-user"/g)||[]).length,35);
});

test('promo draft survives tab switches, case selection uses the catalog, and preview blocks insufficient balance',async()=>{
 const f=fixture(),c=f.context;c.REFERRALS_UI.tab='promos';
 f.input('amount','12.5');f.input('max','4');f.input('code','TEST');assert.equal(c.referralPromoCost(),50);
 await f.click({refTab:'stats'});await f.click({refTab:'promos'});assert.match(f.shown,/value="12.5"/);assert.match(f.shown,/value="TEST"/);
 await f.click({refPromoType:'case'});assert.equal(c.referralPromoCost(),0);c.referralOpenCasePicker();assert.match(f.shown,/Case One/);assert.doesNotMatch(f.shown,/data-ref-case="3"/);
 await f.click({refCase:'2'});assert.equal(c.referralPromoCost(),180);assert.equal(f.closed,1);assert.match(f.shown,/Case Two/);
 f.state.balance=179;const submitNode={disabled:false};f.nodes['referral-promo-submit']=submitNode;c.referralUpdatePromoCost();assert.equal(submitNode.disabled,true);await f.submit();assert.equal(f.requests.length,0);
});

test('creating a promo sends its real configuration; automatic codes avoid the reserved auto-promo prefixes',async()=>{
 const f=fixture(),c=f.context;f.input('amount','10');f.input('max','10');await f.submit();
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].action,'promo-create');assert.match(f.requests[0].data.code,/^PROMO-[A-F0-9]{12}$/);assert.equal(f.requests[0].data.amount,10);assert.equal(f.requests[0].data.max,10);assert.equal(f.requests[0].data.caseId,null);
 await f.click({refPromoType:'case'});c.REFERRALS_UI.caseId=1;f.input('code','casepromo');await f.submit();assert.equal(f.requests[1].data.code,'CASEPROMO');assert.equal(f.requests[1].data.caseId,1);assert.equal(f.requests[1].data.amount,0);
 f.input('code','BU-DRAGON');await f.submit();assert.equal(f.requests.length,2);
});

test('failed requests preserve the draft; busy submission cannot duplicate a debit; deleting checks ownership',async()=>{
 const f=fixture(),c=f.context;f.input('code','KEEP');let reject;
 c.NET.request=async()=>new Promise((resolve,fail)=>{reject=fail});const pending=f.submit();await f.submit();assert.equal(c.REFERRALS_UI.busy,true);reject(Error('Connection failed'));await pending;assert.equal(c.REFERRALS_UI.busy,false);assert.equal(c.REFERRALS_UI.code,'KEEP');
 c.NET.request=async(action,data)=>{f.requests.push({action,data});return {result:{}}};f.state.promos.OTHER={owner:'SOMEONE'};await f.click({refAction:'delete-promo',code:'OTHER'});assert.equal(f.requests.length,0);
 f.state.promos.MINE={owner:'FRIEND'};await f.click({refAction:'delete-promo',code:'MINE'});assert.equal(f.requests[0].action,'promo-delete');assert.equal(f.requests[0].data.code,'MINE');
});

test('keyboard navigation follows the accessible tab list',()=>{
 const f=fixture();let focused=false;f.nodes['referral-tab-stats']={focus:()=>{focused=true}};
 f.handlers.keydown({target:{closest:()=>({dataset:{refTab:'main'}})},key:'ArrowRight',preventDefault(){}});
 assert.equal(f.context.REFERRALS_UI.tab,'stats');assert.equal(focused,true);assert.match(f.shown,/role="tabpanel" aria-labelledby="referral-tab-stats"/);
});

test('existing server reserves and refunds only the unused free promo activations',()=>{
 const s=fresh(seed,'owner');account(s,'owner','Owner');account(s,'partner','Partner').balance=100;account(s,'friend','Friend');
 execute(s,'owner',seed,'admin-partner',{userId:'partner',code:'FRIEND',pct:10,bonus:0});
 execute(s,'partner',seed,'promo-create',{code:'GIFT',max:4,amount:10});assert.equal(s.users.partner.balance,60);
 execute(s,'friend',seed,'promo-redeem',{code:'GIFT'});assert.equal(s.users.friend.balance,10);
 execute(s,'partner',seed,'promo-delete',{code:'GIFT'});assert.equal(s.users.partner.balance,90);assert.equal(s.promos.GIFT.reserved,0);
 assert.throws(()=>execute(s,'partner',seed,'promo-delete',{code:'GIFT'}));
});
