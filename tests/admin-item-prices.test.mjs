import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {fresh,account,execute,view} from '../server/model.mjs';import {publicPlayerProfile} from '../server/player-profile.mjs';import {withCatalogPrice} from '../shared/catalog-prices.mjs';import {handle} from '../server/service.mjs';import {localDatabase} from '../server/sqlite-adapter.mjs';import seed from '../server/seed.json' with {type:'json'};
test('only the owner can set a valid cent price or reset it, without changing the seed',()=>{
 const s=fresh(seed,'owner'),u=account(s,'player');account(s,'owner');u.balance=10;const original=seed.items.find(item=>item.id===95).price;
 assert.throws(()=>execute(s,u.id,seed,'admin-item-price',{id:95,price:2}),/владельцу/);
 for(const price of [0,-1,1.234,Infinity,NaN,'2',1e9+1])assert.throws(()=>execute(s,'owner',seed,'admin-item-price',{id:95,price}));
 execute(s,'owner',seed,'admin-item-price',{id:95,price:2.5});assert.equal(view(s,u.id,seed).config.itemPrices[95],2.5);assert.equal(seed.items.find(item=>item.id===95).price,original);
 const purchase=execute(s,u.id,seed,'shop',{id:95});assert.equal(purchase.price,2.68);assert.equal(publicPlayerProfile(s,seed,{userId:u.id}).stats.inventoryValue,2.5);
 execute(s,'owner',seed,'admin-item-price',{id:95,price:null});assert.equal(s.config.itemPrices[95],undefined);assert.equal(publicPlayerProfile(s,seed,{userId:u.id}).items[0].price,original);assert.equal(u.inv[0].paid,2.68);
});
test('updated prices persist through API reloads, catalog saves and upgrade valuation',async t=>{
 const db=localDatabase();t.after(()=>db.sqlite.close());db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
 const owner={id:'tg:1116312381',name:'Owner'},player={id:'tg:42',name:'Player'};
 async function req(who,action='state',data={}){const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,requestId:crypto.randomUUID()})}),db,who);return {status:r.status,j:await r.json()}}
 await req(owner);await req(player);const set=await req(owner,'admin-item-price',{id:95,price:2});assert.equal(set.status,200);assert.equal((await req(player)).j.config.itemPrices[95],2);
 const config=set.j.config;await req(owner,'admin-catalog',{catalog:{custom:config.custom,cases:config.cases,imgs:config.imgs,tpc:config.tpc,nid:config.nid,cnid:config.cnid}});assert.equal((await req(player)).j.config.itemPrices[95],2);
 const s=fresh(seed,'owner'),u=account(s,'player');account(s,'owner');execute(s,'owner',seed,'admin-item-price',{id:95,price:2});u.inv=[{uid:1,id:95}];u.uid=2;
 const r=execute(s,u.id,seed,'upgrade',{ids:[1],target:0},1000,()=>.3);assert.equal(r.chance,40);assert.equal(r.win,true);
});
test('the browser catalog applies the same override without mutating base items',async()=>{
 const html=await readFile(new URL('../site.html',import.meta.url),'utf8'),a=html.indexOf('function build(){'),b=html.indexOf('\nfunction I(',a),base=[{id:95,price:1}];
 const c=vm.createContext({withCatalogPrice,rewardCache:null,C:[],MAP:{},BASE:base,A:{custom:[],itemPrices:{95:2.5}}});vm.runInContext(html.slice(a,b),c);c.build();assert.equal(c.C[0].price,2.5);assert.equal(c.MAP[95].price,2.5);assert.equal(base[0].price,1);
});
test('item editor survives legacy section wrapping and lists current prices in ascending order',async()=>{
 const source=await readFile(new URL('../client/admin-item-art.js',import.meta.url),'utf8');
 const base=[{id:1,name:'Expensive',price:100},{id:2,name:'Cheap',price:1}],custom=[{id:3,name:'Custom',price:3}],prices={1:2};
 const c=vm.createContext({BASE:base,A:{custom,itemPrices:prices},I:id=>[...base,...custom].find(item=>item.id===id)&&withCatalogPrice([...base,...custom].find(item=>item.id===id),prices),fmt:String,esc:String,av:()=>'/item.png',itemsHtml:()=>'<h4>Items (add with an image)</h4><input id="a-iname"><h4>Replace image of any item</h4><select id="a-iov"></select>',adminRefreshWouldDiscardInput:()=>false,document:{addEventListener(){}}});
 vm.runInContext(source,c);c.ADMIN_IMAGE_ITEM=1;const html=c.itemsHtml();
 assert.equal(c.ADMIN_IMAGE_ITEM,1);assert(html.indexOf('Cheap — 1 BU')<html.indexOf('Expensive — 2 BU'));assert(html.indexOf('Expensive — 2 BU')<html.indexOf('Custom — 3 BU'));assert.match(html,/value="1" selected/);
 assert(!html.includes('id="a-iov"'));assert.match(html,/id="a-iname"/);assert.equal(html.match(/<h4>/g).length,2);
 const sections=html.split('<h4>').filter(Boolean);assert.equal(sections.length,2);assert.match(sections[0],/Редактировать предмет<\/h4><div class="admin-item-art">/);assert.match(sections[0],/<\/div><\/div>$/);assert.equal(base[0].price,100);
});
test('changing a base price recalculates all its mutation prices across purchases and profiles',()=>{
 const s=fresh(seed,'owner'),u=account(s,'player');account(s,'owner');u.balance=10000;
 for(const name of ['Fragrama and Chocrama','La Fuse Machine']){
  const base=seed.items.find(item=>item.name===name),variants=seed.items.filter(item=>item.baseId===base.id);assert.equal(variants.length,10);
  execute(s,'owner',seed,'admin-item-price',{id:base.id,price:250});
  for(const variant of variants){const effective=withCatalogPrice(variant,s.config.itemPrices);assert.equal(effective.price,Math.round(25000*([18140,19140,28550,30150,32440,31890,32080,30490,29250,28930][variants.indexOf(variant)])/17640)/100)}
  const gold=variants.find(item=>item.mutation==='gold'),expected=withCatalogPrice(gold,s.config.itemPrices).price,purchase=execute(s,'player',seed,'shop',{id:gold.id});assert.equal(purchase.price,Math.round(expected*107+1e-9)/100);
  assert.equal(publicPlayerProfile(s,seed,{userId:'player'}).items.find(item=>item.id===gold.id).price,expected);
  execute(s,'owner',seed,'admin-item-price',{id:gold.id,price:600});execute(s,'owner',seed,'admin-item-price',{id:base.id,price:200});assert.equal(withCatalogPrice(gold,s.config.itemPrices).price,600);
  execute(s,'owner',seed,'admin-item-price',{id:gold.id,price:null});assert.equal(withCatalogPrice(gold,s.config.itemPrices).price,205.67);
  execute(s,'owner',seed,'admin-item-price',{id:base.id,price:null});assert.equal(withCatalogPrice(gold,s.config.itemPrices).price,gold.price);
 }
});
