import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {readCatalogArtwork,handleCatalogArtwork,handleRefreshedMutationMaterial} from '../server/catalog-artwork.mjs';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import manifest from '../assets/catalog-artwork/manifest.json' with {type:'json'};
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',image='data:image/png;base64,'+png,bytes=Buffer.from(png,'base64');
const digest=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
const entry={url:'https://wikiassets.net/model.png',mime:'image/png',digest,bytes:bytes.length};

test('only pinned catalog sources are fetched, verified and cached durably',async()=>{
 const cache=new Map();let reads=0;const env={BUCKET:{get:async k=>cache.has(k)?{body:cache.get(k)}:null,put:async(k,v)=>cache.set(k,v)}};
 const fetcher=async url=>{reads++;assert.equal(url,entry.url);return new Response(bytes)};
 assert.deepEqual(Buffer.from(await readCatalogArtwork(entry,env,fetcher)),bytes);assert.equal(reads,1);
 assert.deepEqual(Buffer.from(await readCatalogArtwork(entry,env,()=>assert.fail('cached'))),bytes);
 await assert.rejects(()=>readCatalogArtwork({...entry,url:'http://wikiassets.net/model.png'},{}));
 await assert.rejects(()=>readCatalogArtwork({...entry,url:'https://evil.test/model.png'},{}));
 await assert.rejects(()=>readCatalogArtwork(entry,{},async()=>new Response('<svg><script/>')));
 await assert.rejects(()=>readCatalogArtwork({...entry,digest:'bad'}, {},fetcher));
});
test('catalog routes ignore URL parameters, support HEAD and conditional requests, and fail without caching errors',async()=>{
 const req=(id='1.png',method='GET',headers={})=>new Request('https://test/assets/catalog/'+id,{method,headers});let calls=0;
 const fetcher=async()=>{calls++;return new Response(bytes)};
 const r=await handleCatalogArtwork(req('1.png?url=https://evil.test'),{},{1:entry},fetcher);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);
 const h=await handleCatalogArtwork(req('1.png','HEAD'),{},{1:entry},fetcher);assert.equal(h.headers.get('content-length'),String(bytes.length));assert.equal(await h.text(),'');
 const c=await handleCatalogArtwork(req('1.png','GET',{'If-None-Match':'"'+digest+'"'}),{},{1:entry},fetcher);assert.equal(c.status,304);assert.equal(calls,2);
 assert.equal((await handleCatalogArtwork(req('2.png'),{},{1:entry},fetcher)).status,404);
 assert.equal((await handleCatalogArtwork(req('1.png','POST'),{},{1:entry},fetcher)).status,405);
 const fail=await handleCatalogArtwork(req(),{},{1:entry},async()=>new Response('no',{status:402}));assert.equal(fail.status,503);assert.equal(fail.headers.get('cache-control'),'no-store');
});
test('original mutation sources are bounded, validated and reused through cache',async()=>{
 const original={...entry,originalSource:true,digest:'source-revision',bytes:undefined};assert.deepEqual(Buffer.from(await readCatalogArtwork(original,{},async()=>new Response(bytes))),bytes);
 await assert.rejects(()=>readCatalogArtwork(original,{},async()=>new Response(bytes,{headers:{'Content-Length':'8000001'}})));
 const materials={21:{baseId:1,mutation:'gold',digest:'material-revision'}};
 const r=await handleRefreshedMutationMaterial(new Request('https://test/assets/mutations/21.svg'),{},materials,{1:image},{1:entry},async()=>new Response(bytes));assert.equal(r.status,200);assert.match(await r.text(),new RegExp(png.slice(0,20)));
});
test('catalog covers the new named images and pins all original mutation URLs',()=>{
 for(const id of [19,88,95,99])assert(manifest[id]);assert.equal(manifest[19].file,'wave-rider.webp');assert(manifest[99].width>=700);
 assert.equal(Object.values(manifest).filter(e=>e.originalSource).length,427);
 for(const e of Object.values(manifest)){assert.match(e.digest,/^[a-f0-9]{64}$/);if(e.url)assert.equal(new URL(e.url).protocol,'https:');assert(!('localPath' in e))}
});
test('owner PNG replacements persist for normal and mutation items; retries, reset and access checks hold',async t=>{
 const db=localDatabase();t.after(()=>db.sqlite.close());db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
 const owner={id:'tg:1116312381',name:'Owner'},player={id:'tg:9',name:'Player'};
 async function req(who,action='state',data={},requestId=crypto.randomUUID()){const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://test'},body:JSON.stringify({action,data,requestId})}),db,who);return {status:r.status,j:await r.json()}}
 await req(owner);await req(player);
 assert.equal((await req(player,'admin-item-image',{id:95,image})).status,400);
 assert.equal((await req(owner,'admin-item-image',{id:95,image:'data:image/png;base64,AAAA'})).status,400);
 assert.equal((await req(owner,'admin-item-image',{id:99999999,image})).status,400);
 for(const id of [95,2000193]){const key=crypto.randomUUID();assert.equal((await req(owner,'admin-item-image',{id,image},key)).status,200);assert.equal((await req(owner,'admin-item-image',{id,image},key)).status,200);assert.equal((await req(player)).j.config.imgs[id],image)}
 await req(owner,'admin-item-image',{id:95,image:null});const state=(await req(owner)).j;assert.equal(state.config.imgs[95],undefined);assert.equal(state.config.imgs[2000193],image);
});
test('image overrides beat refreshed assets; unavailable mutation originals fall back to the fresh base material',async()=>{
 let onError;const items={1:{id:1},2:{id:2,baseId:1,mutation:'gold'}};
 const c=vm.createContext({A:{imgs:{}},av:item=>'old:'+item.id,I:id=>items[id],CATALOG_ARTWORK:{1:{ext:'webp',digest:'base'},2:{ext:'png',digest:'mutation'}},document:{addEventListener:(name,cb)=>onError=cb}});
 vm.runInContext(await readFile(new URL('../client/catalog-artwork.js',import.meta.url),'utf8'),c);assert.equal(c.av(items[1]),'/assets/catalog/1.webp?v=base');c.A.imgs[1]=image;c.imageBeforeCatalogRefresh=item=>c.A.imgs[item.id]||'old:'+item.id;assert.equal(c.av(items[1]),image);
 const img={tagName:'IMG',dataset:{},getAttribute:()=>'/assets/catalog/2.png?v=mutation'};onError({target:img});assert.equal(img.src,'/assets/mutations/2.svg?v=base');
});

test('every packaged replacement matches its manifest and is delivered locally without upstream access',async()=>{
 const local=Object.values(manifest).filter(e=>e.file);assert.equal(local.length,121);
 for(const e of local){const b=await readFile(new URL('../assets/catalog-artwork/'+e.file,import.meta.url));assert.equal(b.length,e.bytes);assert.equal(Buffer.from(await crypto.subtle.digest('SHA-256',b)).toString('hex'),e.digest);const r=await readCatalogArtwork({...e,data:b.toString('base64')},{},()=>assert.fail('packaged artwork must not fetch'));assert.equal(r.byteLength,e.bytes)}
});

test('the production browser uses only packaged sources and never waits on unavailable upstream originals',async()=>{
 const html=await readFile(new URL('../site.html',import.meta.url),'utf8');const line=html.split('\n').find(line=>line.startsWith('var CATALOG_ARTWORK='));assert(line);const c=vm.createContext({});vm.runInContext(line,c);assert.equal(Object.keys(c.CATALOG_ARTWORK).length,121);assert.equal(c.CATALOG_ARTWORK[62],undefined);assert.equal(c.CATALOG_ARTWORK[2000193],undefined);assert(c.CATALOG_ARTWORK[6]);
 const r=await handleRefreshedMutationMaterial(new Request('https://test/assets/mutations/21.svg'),{},{21:{baseId:62,mutation:'gold',digest:'local-material'}},{62:image},{62:manifest[62]},()=>assert.fail('unavailable original must not delay local rendering'));assert.equal(r.status,200);assert.match(await r.text(),/data:image\/png;base64/);
});
