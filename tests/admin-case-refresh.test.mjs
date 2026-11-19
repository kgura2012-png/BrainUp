import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

test('case selection survives background refresh, including an already pending request', async () => {
 const html=await fs.readFile(new URL('../site.html',import.meta.url),'utf8');
 const start=html.indexOf('function adminRefreshWouldDiscardInput(){');
 const end=html.indexOf('},10000);',start)+'},10000);'.length;
 let tick,reply,requests=0;
 const selected=new Set(Array.from({length:80},(_,i)=>i));
 const context=vm.createContext({
  hosted:true,NET:{ready:true,admin:true,busy:false,act:(_action,_data,callback)=>{requests++;reply=callback}},
  U:{atab:'cases',busy:false},document:{hidden:false,activeElement:null},
  ad:{classList:{contains:()=>true},contains:()=>false},
  modal:{classList:{contains:()=>false}},setInterval:callback=>{tick=callback},
  admin:()=>selected.clear()
 });
 vm.runInContext(html.slice(start,end),context);
 for(let i=0;i<6;i++)tick();
 assert.equal(requests,0);
 assert.equal(selected.size,80);
 context.U.atab='tops';tick();
 assert.equal(requests,1);
 context.U.atab='cases';reply();
 assert.equal(selected.size,80);
 context.U.atab='tops';tick();reply();
 assert.equal(selected.size,0);
});
