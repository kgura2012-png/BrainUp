import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fresh,account,execute} from '../server/model.mjs';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import {createCasePrizeSeller} from '../client/case-results.mjs';
import seed from '../server/seed.json' with {type:'json'};

test('sell all credits every owned instance beyond the ordinary 100-item limit, at server prices',()=>{
 const s=fresh(seed,'owner'),u=account(s,'player');u.balance=1;
 const base=seed.items.find(x=>!x.hidden&&!x.mutation),mutation=seed.items.find(x=>x.mutation),hidden=seed.items.find(x=>x.hidden);
 u.inv=Array.from({length:250},(_,i)=>({uid:i+1,id:base.id}));u.inv.push({uid:251,id:mutation.id},{uid:252,id:base.id,sh:1,paid:base.price/2},{uid:253,id:hidden.id});
 const result=execute(s,u.id,seed,'sell-all',{total:999999,ids:[1]});assert.equal(result.count,253);assert.equal(result.total,Math.round((base.price*250+mutation.price+base.price/2+hidden.price)*100)/100);assert.equal(u.inv.length,0);assert.equal(u.balance,Math.round((1+result.total)*100)/100);
 assert.deepEqual(execute(s,u.id,seed,'sell-all'),{total:0,count:0});
});
test('sell-all retry credits once and persists after an API reload',async()=>{
 const db=localDatabase();try{
  db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));const s=fresh(seed,'owner'),u=account(s,'player');u.inv=[{uid:1,id:seed.items[0].id},{uid:2,id:seed.items[0].id}];u.balance=0;db.sqlite.prepare('INSERT INTO site_state VALUES (1,0,?)').run(JSON.stringify(s));
  const req=async(action,key)=>{const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data:{},requestId:key})}),db,{id:'player'});assert.equal(r.status,200);return r.json()};
  const key=crypto.randomUUID(),first=await req('sell-all',key),retry=await req('sell-all',key),reload=await req('state',crypto.randomUUID());assert.equal(first.result.count,2);assert.equal(retry.user.balance,first.user.balance);assert.deepEqual(reload.user.inv,[]);assert.equal(reload.user.balance,2*seed.items[0].price);
 }finally{db.sqlite.close()}
});
test('case bulk sale targets only remaining owned drop UIDs, preserving identical pre-existing items',async()=>{
 const s=fresh(seed,'owner'),u=account(s,'player');u.inv=[{uid:1,id:0},{uid:2,id:0},{uid:3,id:0}];u.balance=0;let calls=0;
 const sell=createCasePrizeSeller({inventory:()=>u.inv,request:async(action,data)=>{calls++;return {result:execute(s,u.id,seed,action,data),user:{inv:u.inv}}},adopt(){}});
 assert.equal(await sell(2),seed.items[0].price);assert.equal(await sell.sellMany([3]),seed.items[0].price);assert.deepEqual(u.inv,[{uid:1,id:0}]);assert.equal(calls,2);assert.equal(u.balance,2*seed.items[0].price);
});
test('overlapping bulk and individual clicks cannot submit a second sale, and a failed batch remains retryable',async()=>{
 let finish,calls=0;const inv=[{uid:1,id:0},{uid:2,id:0}];const sell=createCasePrizeSeller({inventory:()=>inv,request:()=>{calls++;return new Promise(resolve=>finish=resolve)},adopt:()=>inv.splice(0)});
 const pending=sell.sellMany([1,2]);assert.equal(await sell(1),null);assert.equal(await sell.sellMany([1,2]),null);assert.equal(calls,1);finish({result:{total:10}});assert.equal(await pending,10);
 let failed=true;const retry=createCasePrizeSeller({inventory:()=>[{uid:4,id:0},{uid:5,id:0}],request:async()=>{if(failed)throw Error('Offline');return {result:{total:20}}},adopt(){}});await assert.rejects(()=>retry.sellMany([4,5]),/Offline/);failed=false;assert.equal(await retry.sellMany([4,5]),20);
});
test('case sale scope excludes automatic coin rewards, sold prizes and unrelated inventory copies',async()=>{
 const source=await readFile(new URL('../client/case-presentation.js',import.meta.url),'utf8'),start=source.indexOf('function caseSaleItems()'),end=source.indexOf('\ndocument.addEventListener',start);
 const items=[{uid:1,it:{price:10}},{uid:2,it:{price:20}},{uid:3,it:{price:30}}],ctx=vm.createContext({CW:{last:[{uid:2,w:{}},{uid:4,w:{}},{uid:3,w:{rewardKind:'coins'}}]},bxAll:()=>items,COIN:'BU ',fmt:String,bxSellSum:a=>a.reduce((sum,x)=>sum+x.it.price,0)});vm.runInContext(source.slice(start,end),ctx);
 assert.deepEqual(Array.from(ctx.caseSaleItems(),x=>x.uid),[2]);assert.match(ctx.caseBulkSellMarkup(),/Продать весь дроп · 1 · BU 20/);ctx.CW.last=[];assert.equal(ctx.caseBulkSellMarkup(),'');
});
test('inventory sell-all button submits once, clears selected stakes after success, and recovers after failure',async()=>{
 const handlers={},button={disabled:false,setAttribute(){},removeAttribute(){}},profile='<div class="profile-actions"></div>',inventory='<div class="bx-bar"></div>';let finish,calls=0,failed=false;
 const ctx=vm.createContext({S:{inv:[{uid:1,id:0},{uid:2,id:0}]},U:{sec:'profile',busy:false,sel:{1:true},bal:4},CW:{busy:false},BX:{sel:{1:true}},NET:{ready:true,busy:false,request:()=>{calls++;return new Promise((resolve,reject)=>finish=()=>failed?reject(Error('Offline')):resolve({result:{count:2,total:20},user:{inv:[]}}))},adopt:r=>{ctx.S.inv=r.user.inv}},profilePage:()=>profile,bxInvPage:()=>inventory,bxInvFill(){},fmt:String,render(){},showSec(){},toast(){},document:{querySelectorAll:()=>[button],addEventListener:(type,fn)=>handlers[type]=fn}});
 vm.runInContext(await readFile(new URL('../client/bulk-sales.js',import.meta.url),'utf8'),ctx);assert.match(ctx.profilePage(),/data-inventory-sell-all/);assert.match(ctx.bxInvPage(),/data-inventory-sell-all/);
 const event={target:{closest:()=>button},preventDefault(){},stopImmediatePropagation(){}};
 const first=handlers.click(event);await handlers.click(event);assert.equal(calls,1);assert.equal(button.disabled,true);finish();await first;assert.equal(ctx.S.inv.length,0);assert.equal(Object.keys(ctx.BX.sel).length,0);assert.equal(Object.keys(ctx.U.sel).length,0);assert.equal(ctx.U.bal,0);assert.equal(button.disabled,true);
 ctx.S.inv=[{uid:3,id:0}];ctx.syncInventorySellAll();failed=true;const failure=handlers.click(event);finish();await failure;assert.equal(ctx.S.inv.length,1);assert.equal(button.disabled,false);
});
