import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {renderMutationMaterial,handleMutationMaterial} from '../server/mutation-materials.mjs';
import {MUTATION_TYPES} from '../shared/mutations.mjs';
import seed from '../server/seed.json' with {type:'json'};
import bases from '../assets/mutations/bases.json' with {type:'json'};

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
test('every mutation keeps the original model texture and uses a distinct reference material',()=>{
 const rendered=MUTATION_TYPES.map(type=>renderMutationMaterial(type.id,png));assert.equal(new Set(rendered).size,10);
 for(const svg of rendered){assert.match(svg,/viewBox="0 0 256 256"/);assert.equal(svg.split(png).length-1,1);assert.match(svg,/preserveAspectRatio="xMidYMid meet"/);assert(!svg.includes('<script'));assert(!svg.includes('https://'));assert.match(svg,/feComponentTransfer/)}
 assert.match(rendered[2],/linearGradient id="rainbow"/);assert.match(rendered[3],/patternTransform="rotate\(-28\)"/);assert.match(rendered[5],/fill="#fce9ff"/);assert(!rendered[6].includes('M124 0C85'));assert.match(rendered[6],/feComponentTransfer/);assert.match(rendered[8],/stroke="#ff282f"/);assert.match(rendered[9],/stroke="#ffffff"/);
 assert.throws(()=>renderMutationMaterial('bloodrot',png));assert.throws(()=>renderMutationMaterial('gold','https://untrusted.test/model.png'));
});
test('all 460 mutation entries have an available original model, including the 34 without wiki PNGs',async()=>{
 const files=await readdir(new URL('../assets/mutations/normal-images/',import.meta.url));assert.equal(files.length,46);
 const ids=new Set(bases.map(base=>base.id));for(const item of seed.items.filter(x=>x.mutation)){assert(ids.has(item.baseId));assert(files.includes(item.baseId+'.png'))}
 for(const file of files){const bytes=await readFile(new URL('../assets/mutations/normal-images/'+file,import.meta.url));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a')}
});
test('material route serves self-contained SVGs without network, authenticates neither nor mutates state',()=>{
 const manifest={123:{baseId:77,mutation:'rainbow',digest:'new-material'}},models={77:png},request=(path='123.svg',method='GET',headers={})=>new Request('https://site/assets/mutations/'+path,{method,headers});
 const previous=globalThis.fetch;globalThis.fetch=()=>assert.fail('art must not depend on remote source');try{
 const result=handleMutationMaterial(request(),manifest,models);assert.equal(result.status,200);assert.equal(result.headers.get('content-type'),'image/svg+xml; charset=utf-8');assert.equal(result.headers.get('etag'),'"new-material"');
 assert.equal(handleMutationMaterial(request('123.svg','HEAD'),manifest,models).status,200);assert.equal(handleMutationMaterial(request('123.svg','GET',{'If-None-Match':'"new-material"'}),manifest,models).status,304);
 assert.equal(handleMutationMaterial(request('123.svg','POST'),manifest,models).status,405);assert.equal(handleMutationMaterial(request('124.svg'),manifest,models).status,404);assert.equal(handleMutationMaterial(request('123.svg'),manifest,{}).status,404);assert.equal(handleMutationMaterial(request('123.svg?url=https://evil.test'),{},models).status,404);
 }finally{globalThis.fetch=previous}
});
test('browser no longer substitutes CSS recoloring and all shared image locations use the material URL',async()=>{
 const client=await readFile(new URL('../client/mutations.js',import.meta.url),'utf8'),css=await readFile(new URL('../client/black-theme.js',import.meta.url),'utf8');assert(!client.includes('#bu-mut-'));assert(!css.includes('#bu-mut-'));assert(client.includes('imageBeforeMutations(I(item.baseId))'));assert(css.includes('img[src*="/assets/mutations/"]{filter:none!important'));
});
