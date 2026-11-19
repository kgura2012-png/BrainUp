import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function fixture(){
 const calls=[],dialogs=[],messages=[],stored=new Map();let invoiceCallback,serverStatus='checkout';
 const button={disabled:false,isConnected:true,setAttribute(){},removeAttribute(){}};
 const tg={initData:'verified-by-server',openInvoice(url,cb){calls.push({invoice:url});invoiceCallback=cb}};
 const context=vm.createContext({TP:{tab:'stars',stars:50},S:{bound:''},COIN:'<i class=coin></i>',NET:{id:'tg:42',ready:true,busy:false,request:async()=>({balance:62.5}),adopt:()=>calls.push({refresh:true})},render(){},
  window:{Telegram:{WebApp:tg}},Telegram:{WebApp:tg},document:{hidden:false,querySelector:()=>button,addEventListener(){}},
  localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},
  crypto,AbortSignal,toast:t=>messages.push(t),openModal:h=>dialogs.push(h),setTimeout:fn=>{fn()},setInterval(){},
  esc:String,fmt:String,$:()=>null,simulationTopupTabs:()=>'<nav>Tabs</nav>',topupMethodClosed:()=>false,
  tpPage:()=>'<div>Other methods</div>',tpSum(){},submitTopupRequest:()=>calls.push({queue:true}),
  fetch:async(url,options)=>{calls.push({url,options});return Response.json(options?.method==='POST'?{ok:true,invoiceUrl:'https://t.me/$support'}:{ok:true,status:serverStatus,stars:50,creditedBU:62.5})}});
 const source=await readFile(new URL('../client/case-tools.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(source.indexOf('var creatingSupportPayment='),source.indexOf("window.addEventListener('focus',restoreSupportPayment)")),context);
 vm.runInContext(await readFile(new URL('../client/stars-donation.js',import.meta.url),'utf8'),context);
 return {context,calls,dialogs,messages,stored,button,callback:status=>invoiceCallback(status),status:value=>{serverStatus=value}};
}

test('Stars donation opens a Telegram invoice once and never enters the free queue',async()=>{
 const f=await fixture();assert.match(f.context.tpPage(),/Оплатить звёздами/);assert.match(f.context.tpPage(),/62.5/);
 assert.doesNotMatch(f.context.tpPage(),/tp-nk|tp-pr|simulation-credit-total|Расчёт без оплаты|Встать в очередь|Токенов на баланс/);
 await f.context.submitTopupRequest();await f.context.tpSend();
 assert.equal(f.calls.filter(c=>c.invoice).length,1);assert.equal(f.button.disabled,true);
 assert.equal(f.calls.filter(c=>c.queue).length,0);
 const post=f.calls.find(c=>c.options?.method==='POST');assert.equal(post.url,'/api/support');assert.equal(JSON.parse(post.options.body).stars,50);
 f.callback('cancelled');assert.equal(f.button.disabled,false);assert.equal(f.stored.size,0);assert.equal(f.dialogs.length,0);
 f.context.TP.tab='items';await f.context.submitTopupRequest();assert.equal(f.calls.filter(c=>c.queue).length,1);
});

test('client paid status alone cannot confirm a donation; only the server receipt can',async()=>{
 const f=await fixture();await f.context.submitTopupRequest();f.callback('paid');
 // Let the simulated receipt checks complete; Telegram has not delivered successful_payment yet.
 for(let i=0;i<80;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.dialogs.length,0);assert.equal(f.stored.size,1);
 f.status('paid');await f.context.pollSupportPayment('receipt-id',1);
 assert.equal(f.dialogs.length,1);assert.match(f.dialogs[0],/Начислено 62.5 BU/);assert.equal(f.calls.filter(c=>c.refresh).length,1);assert.equal(f.stored.size,0);
 await f.context.pollSupportPayment('receipt-id',1);assert.equal(f.dialogs.length,1);
});

test('invalid amounts and payment outside Telegram never create an invoice',async()=>{
 const f=await fixture();for(const amount of [0,-1,10001,1.5]){f.context.TP.stars=amount;await f.context.submitTopupRequest()}
 assert.equal(f.calls.length,0);f.context.TP.stars=50;f.context.window.Telegram.WebApp.initData='';await f.context.submitTopupRequest();assert.equal(f.calls.length,0);
});

test('the form accepts one Star, previews 1.25 BU and sends a one-Star invoice request',async()=>{
 const f=await fixture();f.context.TP.stars=1;const html=f.context.tpPage();assert.match(html,/min="1"/);assert.match(html,/max="10000"/);assert.match(html,/от 1 ⭐/);assert.match(html,/1.25/);
 await f.context.submitTopupRequest();const post=f.calls.find(c=>c.options?.method==='POST');assert.equal(JSON.parse(post.options.body).stars,1);assert.equal(f.calls.filter(c=>c.invoice).length,1);f.callback('cancelled');
});


test('reference form has two methods, optional code and a fixed 1.25 rate without explanatory banners',async()=>{
 const f=await fixture();f.context.TP.stars=100;const html=f.context.tpPage();
 assert.match(html,/Пополнение/);assert.match(html,/Звёзды/);assert.match(html,/Брейнроты/);assert.match(html,/Промокод или код друга/);assert.match(html,/id="stars-credit-amount">125/);
 assert.doesNotMatch(html,/Гиры|data-v="gears"|Промокод с главной|15%|presets/);
 f.context.TP.tab='gears';f.context.tpPage();assert.equal(f.context.TP.tab,'items');
});

test('a friend code is bound before creating the invoice; repeated clicks cannot create another request',async()=>{
 const f=await fixture();f.context.TP.promo=' friend ';let release;const gate=new Promise(resolve=>release=resolve);
 f.context.NET.request=async(action,data)=>{f.calls.push({action,data});await gate;return {}};
 const first=f.context.submitTopupRequest();await f.context.submitTopupRequest();assert.equal(f.calls.length,1);assert.equal(f.calls[0].action,'promo-redeem');assert.equal(f.calls[0].data.code,'FRIEND');assert(!f.calls.some(c=>c.invoice));
 release();await first;assert.equal(f.calls.filter(c=>c.invoice).length,1);assert.equal(JSON.parse(f.calls.find(c=>c.options?.method==='POST').options.body).stars,50);
 f.callback('cancelled');await f.context.submitTopupRequest();assert.equal(f.calls.filter(c=>c.action==='promo-redeem').length,1);f.callback('cancelled');
});

test('an invalid code stops payment and an already-bound friend code is not redeemed again',async()=>{
 const f=await fixture();f.context.TP.promo='BAD';f.context.NET.request=async()=>{throw Error('Код не найден')};await f.context.submitTopupRequest();assert(!f.calls.some(c=>c.invoice));assert.equal(f.messages.at(-1),'Код не найден');assert.equal(f.button.disabled,false);
 f.context.S.bound='BAD';await f.context.submitTopupRequest();assert.equal(f.calls.filter(c=>c.invoice).length,1);f.callback('cancelled');
});
