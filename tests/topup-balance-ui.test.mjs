import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
test('accepted topup retries its authoritative balance when a concurrent game action invalidates the first poll',async()=>{
 const html=await fs.readFile(new URL('../site.html',import.meta.url),'utf8'),a=html.indexOf('var topupPollBusy=false;'),b=html.indexOf('\nsetInterval(topupCountdown',a);let finishFirst,requests=0,paints=0;
 const accepted={id:'one',userId:'p',st:'ok',total:71.5};
 const context=vm.createContext({hosted:true,NET:{ready:true,busy:false,id:'p',actionEpoch:1},U:{busy:false},document:{hidden:false},modal:{dataset:{view:'topup-queue'},classList:{contains:()=>true}},A:{tops:[{id:'one',userId:'p',st:'new'}]},TP:{activeId:'one',lastStatus:'new'},S:{balance:18},fetch:()=>{requests++;return requests===1?new Promise(resolve=>finishFirst=resolve):Promise.resolve(Response.json({ok:true,now:Date.now(),balance:89.78,topups:[accepted]}))},Date,hdr:()=>{},render:()=>paints++,topupStatusDialog:record=>{context.TP.lastStatus=record.st},topupCountdown:()=>{}});
 vm.runInContext(html.slice(a,b),context);const first=context.pollTopupQueue();context.NET.actionEpoch=2;context.S.balance=18.28;finishFirst(Response.json({ok:true,now:Date.now(),balance:89.5,topups:[accepted]}));await first;
 assert.equal(context.S.balance,18.28);assert.equal(context.TP.lastStatus,'ok');assert.equal(context.TP.balanceNeedsRefresh,true);assert.equal(paints,0);
 await context.pollTopupQueue();assert.equal(requests,2);assert.equal(context.S.balance,89.78);assert.equal(context.TP.balanceNeedsRefresh,false);assert.equal(paints,1);
 await context.pollTopupQueue();assert.equal(requests,2);assert.equal(context.S.balance,89.78);
});
test('admin acceptance repaints the header after adopting the server balance',async()=>{
 const source=await fs.readFile(new URL('../client/simulation.js',import.meta.url),'utf8'),a=source.indexOf("document.addEventListener('click',async function(event){\n var button=event.target.closest('[data-simulation-show]"),b=source.indexOf('},true);',a)+9;assert(a>=0);let listener,header='0.00',adminPaints=0,action;
 const state={balance:0},button={disabled:false,dataset:{simulationAccept:'one'},hasAttribute:name=>name==='data-simulation-accept'};
 const context=vm.createContext({document:{addEventListener:(event,callback)=>listener=callback},isOwner:()=>true,NET:{busy:false,request:async(name)=>{action=name;return {user:{balance:71.5},result:{topup:{st:'ok'}}}},adopt:reply=>state.balance=reply.user.balance},render:()=>header=state.balance.toFixed(2),admin:()=>adminPaints++,toast:()=>{}});
 vm.runInContext(source.slice(a,b),context);await listener({target:{closest:()=>button},preventDefault(){},stopImmediatePropagation(){}});assert.equal(action,'simulation-review');assert.equal(header,'71.50');assert.equal(adminPaints,1);
});
test('shown reviewer appears in a separate card and remains visible after acceptance',async()=>{
 const source=await fs.readFile(new URL('../client/simulation.js',import.meta.url),'utf8'),a=source.indexOf('var statusBeforeFreeQueue='),b=source.indexOf('var bookingQueueBeforeFreeRequests=',a),card=source.slice(source.indexOf('function simulationReviewerCard(')).split('\n')[0];let output;
 const context=vm.createContext({topupStatusDialog:()=>{},TP:{},NET:{id:'p'},esc:String,fmt:String,modal:{dataset:{}},topupCountdown:()=>{},openModal:html=>output=html});vm.runInContext(card+'\n'+source.slice(a,b),context);
 const record={id:'one',number:1,simulation:true,free:true,st:'ready',reviewer:'Reviewer_1',total:125};context.topupStatusDialog(record);assert.match(output,/class="simulation-reviewer-card"/);assert.match(output,/<strong>Reviewer_1<\/strong>/);
 context.topupStatusDialog({...record,st:'ok'});assert.match(output,/class="simulation-reviewer-card"/);assert.match(output,/Начислено 125/);
});
