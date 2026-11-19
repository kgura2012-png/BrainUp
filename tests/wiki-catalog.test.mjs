import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import seed from '../server/seed.json' with {type:'json'};
import artwork from '../assets/catalog-artwork/manifest.json' with {type:'json'};
import items from '../assets/brainrots/wiki-expansion/items.json' with {type:'json'};
import {fresh,account,execute} from '../server/model.mjs';
import {withCatalogPrice} from '../shared/catalog-prices.mjs';

test('wiki expansion keeps stable IDs and has two cheap Common, twenty Secret and two OG entries',async()=>{
 assert.equal(items.length,24);assert(seed.items.length>=119);
 assert.equal(new Set(seed.items.map(x=>x.id)).size,seed.items.length);
 assert.equal(new Set(seed.items.map(x=>x.name)).size,seed.items.length);
 assert.deepEqual(items.filter(x=>x.rarity==='Common').map(x=>x.price),[1,2]);
 assert.equal(items.filter(x=>x.rarity==='Secret').length,20);assert.equal(items.filter(x=>x.rarity==='OG').length,2);
 assert.equal(seed.items.find(x=>x.id===0).name,'Lavaka');assert.equal(seed.items.find(x=>x.id===55).price,1100);assert.equal(seed.items.find(x=>x.id===78).price,50000);
 for(const entry of items){
  assert(entry.id>=95&&entry.id<1000);assert(Number.isFinite(entry.price)&&entry.price>0);
  assert.deepEqual(seed.items.find(x=>x.id===entry.id),{id:entry.id,name:entry.name,price:entry.price,rarity:entry.rarity,...(entry.hidden?{hidden:true}:{})});
  assert.match(entry.source,/^https:\/\/stealabrainrot\.fandom\.com\/wiki\//);
  const bytes=await readFile(new URL('../assets/brainrots/wiki-expansion/'+entry.imageFile,import.meta.url));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 }
});

test('built browser catalog matches server IDs and prices, and every added item uses locally packaged refreshed artwork',async()=>{
 const html=await readFile(new URL('../site.html',import.meta.url),'utf8');
 const base=html.split('/* catalog-base:start */')[1]?.split('/* catalog-base:end */')[0];assert(base);
 const art=html.split('/* wiki-catalog-art:start */')[1]?.split('/* wiki-catalog-art:end */')[0];assert(art);
 const context=vm.createContext({IMG:{},withCatalogPrice});vm.runInContext(base+'\n'+art,context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.BASE)),seed.items);
 const build=html.slice(html.indexOf('var C=[],MAP={};'),html.indexOf('function I(id)'));
 context.A={custom:[]};context.rewardCache=null;vm.runInContext(build+'\nbuild();',context);
 assert.equal(context.C.length,seed.items.filter(item=>!item.hidden).length);assert(!context.C.some(item=>item.name==='Spyder Elephant'));
 assert.equal(context.MAP[118].name,'Spyder Elephant');
 for(const item of items){const entry=artwork[item.id];assert(entry.file);assert.equal(context.IMG[item.name],'/assets/catalog/'+item.id+'.webp?v='+entry.digest.slice(0,16));const actual=await readFile(new URL('../assets/catalog-artwork/'+entry.file,import.meta.url));assert.equal(actual.length,entry.bytes)}
});

test('requested prices are authoritative and retired Spyder Elephant cannot be requested or won again',()=>{
 const expected={'Money Money Puggy':30,'Los 67':24,'Los Combinasionas':22,'Esok Sekolah':18,'67':12,'Nuclearo Dinossauro':16,'La Grande Combinasion':10,'Chicleteira Bicicleteira':8,'Los Spyderinis':9,'Headless Horseman':200000};
 for(const [name,price] of Object.entries(expected))assert.equal(seed.items.find(item=>item.name===name).price,price);
 const s=fresh(seed,'owner');account(s,'owner','Owner');const player=account(s,'player','Player');player.balance=100;player.inv=[{id:0,uid:1},{id:118,uid:2}];player.uid=3;
 const retired=seed.items.find(item=>item.name==='Spyder Elephant');assert.equal(retired.hidden,true);
 for(const [action,data] of [['shop',{id:retired.id}],['upgrade',{ids:[1],coins:0,target:retired.id}],['simulation-topup',{type:'items',items:[{id:retired.id,q:1}]}]])assert.throws(()=>execute(s,'player',seed,action,data),/Предмет не найден/);
 assert.equal(s.users.player.balance,100);assert.equal(s.users.player.inv.length,2);
 s.config.cases.push({id:200006,name:'Retired fixture',price:1,drops:[118,95]});
 const result=execute(s,'player',seed,'case',{id:200006,n:1});assert.equal(result.wins[0].w.id,95);
 // Removing a catalog listing preserves an already owned item and lets its owner sell it.
 const sold=execute(s,'player',seed,'sell',{ids:[2]});assert.equal(sold.total,60000);assert(!s.users.player.inv.some(item=>item.id===118));
});

test('new catalog items use server prices in free applications and can be kept as inventory without changing existing IDs',()=>{
 const s=fresh(seed,'owner');account(s,'owner','Owner');account(s,'player','Player');
 const cheap=items.find(x=>x.price===1),secret=items.find(x=>x.name==='Fragrama and Chocrama');
 const request=execute(s,'player',seed,'simulation-topup',{type:'items',items:[{id:cheap.id,q:2,price:999999},{id:secret.id,q:1,price:999999}],total:999999}).topup;
 assert.equal(request.base,952);assert.equal(s.users.player.balance,0);
 execute(s,'owner',seed,'simulation-show',{id:request.id});execute(s,'owner',seed,'simulation-review',{id:request.id,status:'ok'});assert.equal(s.users.player.balance,952);
 assert.throws(()=>execute(s,'owner',seed,'simulation-review',{id:request.id,status:'ok'}));assert.equal(s.users.player.balance,952);
 // A case configured with a new catalog ID resolves to that item in the inventory.
 s.config.cases.push({id:200005,name:'Wiki fixture',price:10,drops:[secret.id]});
 execute(s,'player',seed,'case',{id:200005,n:1});assert(s.users.player.inv.some(x=>x.id===secret.id));
});
