import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {completeDemoUpgrade} from '../client/upgrade-sync.mjs';
import {fresh,account,execute,view} from '../server/model.mjs';
import seed from '../server/seed.json' with {type:'json'};
const html=await fs.readFile(new URL('../site.html',import.meta.url),'utf8');
const binding=html.match(/hv\('\.bu-app \.up-button-upgrade',.*?\);/)[0];
for(const win of [false,true])test('real upgrade button calls the current server handler on '+(win?'win':'loss'),async()=>{
 const state=fresh(seed,'demo'),u=account(state,'demo','Demo');
 const candy=seed.items.find(x=>x.name==='Candy Slap');
 const target=seed.items.find(x=>x.price>candy.price*2);
 u.inv=[{uid:101,id:candy.id},{uid:102,id:candy.id},{uid:103,id:candy.id}];u.uid=104;
 let legacyCalls=0,serverCalls=0,pending,clientInventory=structuredClone(u.inv);
 const button=new EventTarget();
 const context=vm.createContext({hv:(selector,fn)=>button.addEventListener('click',fn),upgrade:()=>legacyCalls++});
 // Use the registration extracted from the actual shipped HTML, before replacing upgrade.
 vm.runInContext(binding,context);
 context.serverHandler=()=>pending=completeDemoUpgrade({
   request:async()=>{serverCalls++;const result=execute(state,u.id,seed,'upgrade',{ids:[102],coins:0,target:target.id},Date.now(),()=>win?0:.999999);return {...view(state,u.id,seed),result}},
   adopt:j=>clientInventory=structuredClone(j.user.inv),
   animate:async()=>{throw Error('animation unavailable')},reset:()=>{},refresh:async()=>{}
 });
 vm.runInContext('upgrade=serverHandler',context);
 button.dispatchEvent(new Event('click'));
 assert.equal(legacyCalls,0,'button must not call the captured browser-only implementation');
 assert.equal(serverCalls,1,'one click must make exactly one server request');
 await pending;
 assert.equal(clientInventory.some(x=>x.uid===102),false);
 assert.deepEqual(clientInventory.filter(x=>x.id===candy.id).map(x=>x.uid),[101,103]);
 assert.equal(clientInventory.length,win?3:2);
 if(win)assert.equal(clientInventory.find(x=>x.uid===104).id,target.id);
});
