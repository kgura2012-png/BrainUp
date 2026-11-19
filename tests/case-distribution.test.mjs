import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import {caseItemWeight,isFiftyFiftyCase} from '../shared/case-odds.mjs';import {fresh,account} from '../server/model.mjs';import {handle} from '../server/service.mjs';import {localDatabase} from '../server/sqlite-adapter.mjs';import seed from '../server/seed.json' with {type:'json'};
const source=await readFile(new URL('../client/case-distribution.js',import.meta.url),'utf8');
function fixture(){let note='',played;const idle={innerHTML:''},items=[{id:'coin-2',rewardKind:'coins',rewardWeight:.7},{id:'coin-5',rewardKind:'coins',rewardWeight:.2},{id:1,price:7,rewardWeight:.06},{id:2,price:9,rewardWeight:.04}];const box={querySelector:s=>s==='.cw-idle'?idle:{insertAdjacentHTML:(_p,value)=>note=value},querySelectorAll:()=>[]};const c=vm.createContext({caseItemWeight,isFiftyFiftyCase,cDrops:()=>items,cwRender(){},cwPlay(){played=Array.from(arguments);return 42},cById:()=>({bonus:1,bonusKey:'sub'}),CW:{id:200001},document:{getElementById:()=>box},riHtml:item=>'<i data-prize="'+item.id+'"></i>'});vm.runInContext(source,c);return {c,items,idle,get note(){return note},get played(){return played}}}
test('the free preview always mixes both coin buckets and every available brainrot, preserving real weights',()=>{
 const f=fixture(),before=JSON.stringify(f.items);f.c.cwRender();for(const item of f.items)assert(f.idle.innerHTML.includes('data-prize="'+item.id+'"'));assert.match(f.note,/91%.*9%/);assert.equal(JSON.stringify(f.items),before);assert(f.c.freeCasePreviewItems(f.items,16).filter(x=>x.rewardKind!=='coins').length>0);
});
test('paid case visuals carry the authoritative weights, including fixed Dragon/Noobini odds',()=>{
 const f=fixture();f.c.dropsBeforeCaseDistribution=()=>[{id:55,price:1100},{id:95,price:1}];let pool=f.c.cDrops({name:'50 на 50'});assert.deepEqual(Array.from(pool,x=>x.rewardWeight),[.36,.64]);pool=f.c.cDrops({name:'Normal'});assert.deepEqual(Array.from(pool,x=>x.rewardWeight),[Math.pow(1100,-2.1),1]);
});
test('the existing special case receives its requested contents once, preserving its price and image',async t=>{
 const db=localDatabase();t.after(()=>db.sqlite.close());db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));const owner={id:'tg:1116312381',name:'Owner'},state=fresh(seed,owner.id);account(state,owner.id);state.config.cases.push({id:999001,name:'50 на 50',price:550,drops:[0,117],img:'kept-art'});db.sqlite.prepare('INSERT INTO site_state(id,revision,data) VALUES(1,0,?)').run(JSON.stringify(state));
 for(let i=0;i<2;i++){const r=await handle(new Request('https://test/api/action'),db,owner),reply=await r.json();assert.equal(r.status,200);const special=reply.config.cases.find(c=>c.id===999001);assert.deepEqual(special.drops,[55,95]);assert.equal(special.price,550);assert.equal(special.img,'kept-art');assert.equal(reply.config.cases.filter(c=>c.id===999001).length,1)}
 assert.equal(JSON.parse(db.sqlite.prepare('SELECT data FROM site_state').get().data).config.caseOddsV146,true);
});

test('free spin filler varies the items without replacing the server result or its probabilities',()=>{
 const f=fixture(),wins=[{w:{rewardKind:'coins',price:2},uid:null}],before=JSON.stringify(f.items);assert.equal(f.c.cwPlay({bonus:1,bonusKey:'sub'},f.items,wins),42);assert.equal(f.played[2],wins);assert.notEqual(f.played[1],f.items);assert(f.played[1].every(item=>item.rewardWeight===1));assert.equal(JSON.stringify(f.items),before);f.c.cwPlay({name:'Ordinary'},f.items,wins);assert.equal(f.played[1],f.items);
});
