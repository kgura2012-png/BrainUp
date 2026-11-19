import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {completeDemoUpgrade} from '../client/upgrade-sync.mjs';
import {fresh,account,execute} from '../server/model.mjs';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import seed from '../server/seed.json' with {type:'json'};
function fixture(){const s=fresh(seed,'tg:1116312381');const u=account(s,'tg:1116312381','Demo');u.inv=[{uid:1,id:seed.items[0].id},{uid:2,id:seed.items[1].id},{uid:3,id:seed.items[0].id}];u.uid=4;const value=seed.items[0].price+seed.items[1].price;const target=seed.items.find(x=>x.price>value);return {s,u,target,data:{ids:[1,2],coins:0,target:target.id}}}
for(const win of [true,false])test('upgrade '+(win?'win removes inputs and adds one prize':'loss removes inputs and adds nothing'),()=>{const {s,u,target,data}=fixture();const result=execute(s,u.id,seed,'upgrade',data,Date.now(),()=>win?0:.999999);assert.equal(result.win,win);assert.deepEqual(u.inv.filter(x=>x.uid===1||x.uid===2),[]);assert.equal(u.inv.some(x=>x.uid===3),true);assert.equal(u.inv.length,win?2:1);if(win)assert.equal(u.inv.find(x=>x.uid===4).id,target.id);assert.equal(u.upg,1);assert.equal(u.win,win?1:0);assert.equal(u.lose,win?0:1)});
test('inventory applies before presentation; animation errors still clear the selection',async()=>{const calls=[];const result={ok:true,user:{inv:[]},result:{win:false}};await completeDemoUpgrade({request:async()=>result,adopt:j=>{assert.equal(j,result);calls.push('adopt')},animate:async()=>{calls.push('animate');throw Error('renderer failed')},reset:()=>calls.push('reset'),refresh:async()=>assert.fail('unneeded refresh'),onAnimationError:()=>calls.push('animation-error')});assert.deepEqual(calls,['adopt','animate','animation-error','reset'])});
test('backgrounding cancels suspended animation and releases selection',async()=>{const visibility=new EventTarget();visibility.hidden=false;let aborted=false,resets=0;await completeDemoUpgrade({request:async()=>({}),adopt:()=>{},animate:async(j,signal)=>{signal.addEventListener('abort',()=>aborted=true);visibility.hidden=true;visibility.dispatchEvent(new Event('visibilitychange'));await new Promise(()=>{})},reset:()=>resets++,visibility});assert.equal(aborted,true);assert.equal(resets,1)});
test('stuck animation has a deadline',async()=>{let resets=0;await completeDemoUpgrade({request:async()=>({}),adopt:()=>{},animate:()=>new Promise(()=>{}),reset:()=>resets++,maxAnimationMs:10});assert.equal(resets,1)});
test('uncertain network result refreshes authoritative inventory',async()=>{const state={inv:[1,2]};await assert.rejects(()=>completeDemoUpgrade({request:async()=>{throw Error('network')},adopt:()=>assert.fail('no response'),animate:()=>assert.fail('no animation'),refresh:async()=>state.inv=[],reset:()=>state.selection=[]}),/network/);assert.deepEqual(state,{inv:[],selection:[]})});
test('persisted upgrade survives reload and repeated request without double settlement',async()=>{const db=localDatabase();db.sqlite.exec(await fs.readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));const {s,u,target,data}=fixture();db.sqlite.prepare('INSERT INTO site_state (id,revision,data) VALUES (1,0,?)').run(JSON.stringify(s));const identity={id:u.id,name:'Demo'};async function req(action,requestId='demo-upgrade-request'){const r=await handle(new Request('https://brainup.test/api/action',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://brainup.test'},body:JSON.stringify({action,requestId,data})}),db,identity);assert.equal(r.status,200);return r.json()};const first=await req('upgrade');assert.equal(first.demo,true);assert.equal(first.user.inv.some(x=>[1,2].includes(x.uid)),false);assert.equal(first.user.inv.length,first.result.win?2:1);const again=await req('upgrade');assert.deepEqual(again.user.inv,first.user.inv);assert.equal(again.result.roll,first.result.roll);const reload=await req('state','demo-reload-request');assert.deepEqual(reload.user.inv,first.user.inv);assert.equal(reload.user.upg,1);db.sqlite.close()});
test('demo rejects real topups, withdrawals and external trade configuration',async()=>{const db=localDatabase();for(const action of ['topup','withdraw','partner-withdraw','admin-topup','admin-withdraw','admin-trade']){const r=await handle(new Request('https://brainup.test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,requestId:crypto.randomUUID(),data:{}})}),db,{id:'tg:1116312381'});assert.equal(r.status,403);assert.equal((await r.json()).demo,true)}db.sqlite.close()});

for(const fast of [false,true])test('hosted slow upgrade finishes every phase when case skip is '+fast,async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const html=await fs.readFile(new URL('../site.html',import.meta.url),'utf8');
 const start=html.indexOf('  upgrade=async function(){'),end=html.indexOf('\n  cwGo=',start);
 assert(start>0&&end>start);
 const classes={add(){},remove(){}},button={dataset:{},setAttribute(){},removeAttribute(){}},visibility=new EventTarget();visibility.hidden=false;visibility.querySelector=()=>button;
 let adopted=false,finished=false,resets=0,rendered=0;
 const ctx=vm.createContext({U:{target:42,bal:5,sel:{1:true},busy:false},NET:{busy:false},S:{fast},document:visibility,completeDemoUpgrade,AbortController,Math,
  chance:()=>50,bet:()=>10,I:()=>({id:42,price:20,name:'Meowl'}),selItems:()=>[{uid:1}],ctlUpdate(){},Q3:s=>s,toast:message=>assert.fail(message),
  requestAction:async()=>({result:{win:true,chance:10,roll:97},user:{inv:[{uid:2,id:42}]}}),adopt:()=>{adopted=true},fxClean(){resets++},render(){rendered++},
  anim:async(d,win,roll,{signal})=>{assert.equal(roll,97);assert.equal(d.chance,10);for(const ms of [1500,180,2900,1100]){await new Promise(resolve=>setTimeout(resolve,ms));assert.equal(signal.aborted,false)}finished=true}
 });
 vm.runInContext(html.slice(start,end),ctx);
 const pending=ctx.upgrade();
 const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve()};
 await flush();assert.equal(adopted,true);assert.equal(ctx.U.busy,true);
 t.mock.timers.tick(1500);await flush();t.mock.timers.tick(180);await flush();t.mock.timers.tick(1420);await flush();
 // The old case fast-mode timeout cleared the UI at this point.
 assert.equal(ctx.U.busy,true);assert.equal(finished,false);assert.equal(resets,0);assert.equal(rendered,0);
 t.mock.timers.tick(1480);await flush();assert.equal(ctx.U.busy,true);assert.equal(resets,0);
 t.mock.timers.tick(1100);await pending;
 assert.equal(finished,true);assert.equal(ctx.U.busy,false);assert.equal(resets,1);assert.equal(rendered,1);assert.equal(ctx.S.fast,fast);assert.equal(ctx.U.target,null);
});
