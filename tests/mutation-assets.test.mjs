import test from 'node:test';
import assert from 'node:assert/strict';
import {handleMutationAsset} from '../server/mutation-assets.mjs';
const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);
const manifest={123:{url:'https://static.wikia.nocookie.net/stealabr/images/a/ab/Gold.png',digest:'fixture',bytes:24}};
const req=(path='123.png',method='GET',headers={})=>new Request('https://test/assets/mutations/'+path,{method,headers});
test('image route rejects unknown IDs and methods, supports HEAD and ETag without fetching',async()=>{
 const old=globalThis.fetch;globalThis.fetch=()=>assert.fail('unexpected source fetch');try{
 assert.equal((await handleMutationAsset(req('999.png'),{},manifest)).status,404);assert.equal((await handleMutationAsset(req('123.png','POST'),{},manifest)).status,405);
 const head=await handleMutationAsset(req('123.png','HEAD'),{},manifest);assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'24');assert.equal((await head.arrayBuffer()).byteLength,0);
 assert.equal((await handleMutationAsset(req('123.png','GET',{'If-None-Match':'"fixture"'}),{},manifest)).status,304);
 }finally{globalThis.fetch=old}
});
test('verified source image is cached in R2 and subsequent reads use the cache',async()=>{
 const old=globalThis.fetch;let fetches=0,stored;globalThis.fetch=async url=>{fetches++;assert.equal(url,manifest[123].url);return new Response(bytes,{headers:{'content-type':'image/png'}})};
 const env={BUCKET:{get:async key=>stored?{size:24,body:stored}:null,put:async(key,body,options)=>{assert.equal(key,'mutation-art/fixture.png');assert.equal(options.httpMetadata.contentType,'image/png');stored=body}}};try{
 for(let i=0;i<2;i++){const result=await handleMutationAsset(req(),env,manifest);assert.equal(result.status,200);assert.deepEqual(new Uint8Array(await result.arrayBuffer()),bytes)}assert.equal(fetches,1);
 }finally{globalThis.fetch=old}
});
test('untrusted hosts and non-PNG upstream content cannot be served',async()=>{
 const old=globalThis.fetch;let fetches=0;globalThis.fetch=async()=>{fetches++;return new Response('<html>no image</html>',{headers:{'content-type':'text/html'}})};try{
 assert.equal((await handleMutationAsset(req(),{}, {123:{...manifest[123],url:'https://evil.example/a.png'}})).status,503);assert.equal(fetches,0);
 const result=await handleMutationAsset(req(),{},manifest);assert.equal(result.status,503);assert.equal(result.headers.get('cache-control'),'no-store');
 globalThis.fetch=async()=>new Response(new Uint8Array(24),{headers:{'content-type':'image/png'}});assert.equal((await handleMutationAsset(req(),{},manifest)).status,503);
 }finally{globalThis.fetch=old}
});
