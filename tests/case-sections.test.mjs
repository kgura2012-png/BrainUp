import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {caseSectionList,caseSectionFor} from '../shared/case-sections.mjs';
import {fresh,account,execute} from '../server/model.mjs';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import seed from '../server/seed.json' with {type:'json'};
const owner='tg:1116312381',viewer='tg:42';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function fixture(){const s=fresh(seed,owner);account(s,owner,'Owner');account(s,viewer,'Player');return s}
const run=(s,action,data={},who=owner)=>execute(s,who,seed,action,data);

test('default sections preserve legacy groups and arbitrary existing categories remain visible in Other',()=>{
 const sections=caseSectionList();for(const name of ['Тематические кейсы','Бесплатные кейсы','All-In','Партнеры'])assert(sections.some(section=>section.name===name));
 assert.equal(caseSectionFor({grp:'theme'},sections),'theme');assert.equal(caseSectionFor({bonus:1,grp:'bonus'},sections),'free');assert.equal(caseSectionFor({grp:'old-unknown'},sections),'other');
 assert.equal(caseSectionFor({grp:'theme',sectionId:'partners'},sections),'partners');assert.equal(caseSectionList({caseSections:[]})[0].id,'other');
});

test('only owner can manage sections; names are normalized, deduplicated and bounded',()=>{
 const s=fixture();assert.throws(()=>run(s,'admin-case-section-save',{name:'My group'},viewer),/владельцу/);
 const made=run(s,'admin-case-section-save',{name:'  Зимние   кейсы  '}).section;assert.equal(made.name,'Зимние кейсы');assert.match(made.id,/^section-/);
 assert.throws(()=>run(s,'admin-case-section-save',{name:'ЗИМНИЕ КЕЙСЫ'}),/уже есть/);assert.throws(()=>run(s,'admin-case-section-save',{name:'x'.repeat(61)}));assert.throws(()=>run(s,'admin-case-section-save',{name:'\u0000bad'}));
 run(s,'admin-case-section-save',{id:made.id,name:'Новый сезон'});assert.equal(caseSectionList(s.config).find(x=>x.id===made.id).name,'Новый сезон');
 for(const [action,data] of [['admin-case-section',{caseId:seed.cases[0].id,sectionId:made.id}],['admin-case-section-delete',{id:made.id}],['admin-case-section-order',{ids:caseSectionList(s.config).map(x=>x.id)}]])assert.throws(()=>run(s,action,data,viewer),/владельцу/);
});

test('creating, editing and moving cases validates the selected section without changing price or bonus conditions',()=>{
 const s=fixture(),section=run(s,'admin-case-section-save',{name:'All-new'}).section;
 const made=run(s,'admin-case-create',{name:'New grouped case',price:25,image,drops:[0],sectionId:section.id});
 const c=s.config.cases.find(c=>c.id===made.caseId);assert.equal(c.sectionId,section.id);assert.equal(c.price,25);
 run(s,'admin-case-edit',{id:c.id,name:c.name,price:30,drops:[0,1],sectionId:'partners'});assert.equal(c.sectionId,'partners');assert.equal(c.price,30);
 const bonus=s.config.cases.find(c=>c.bonusKey==='sub'),before=JSON.stringify(bonus);run(s,'admin-case-section',{caseId:bonus.id,sectionId:section.id});assert.equal(bonus.bonus,1);assert.equal(bonus.bonusKey,'sub');assert.equal(bonus.price,JSON.parse(before).price);
 assert.throws(()=>run(s,'admin-case-section',{caseId:c.id,sectionId:'missing'}),/Раздел не найден/);
 assert.throws(()=>run(s,'admin-case-create',{name:'Bad section',price:25,image,drops:[0],sectionId:'missing'}),/Раздел не найден/);
});

test('reordering validates a full permutation; deleting a section moves cases and keeps the fallback',()=>{
 const s=fixture(),c=s.config.cases.find(c=>c.grp==='theme'),before=JSON.stringify(c);
 const ids=caseSectionList(s.config).map(x=>x.id).reverse();run(s,'admin-case-section-order',{ids});assert.deepEqual(caseSectionList(s.config).map(x=>x.id),ids);
 assert.throws(()=>run(s,'admin-case-section-order',{ids:ids.slice(1)}));assert.throws(()=>run(s,'admin-case-section-order',{ids:ids.map(()=>ids[0])}));
 run(s,'admin-case-section-delete',{id:'theme'});assert.equal(c.sectionId,'other');assert.equal(c.name,JSON.parse(before).name);assert.deepEqual(c.drops,JSON.parse(before).drops);assert.equal(c.price,JSON.parse(before).price);
 assert(!caseSectionList(s.config).some(x=>x.id==='theme'));assert.throws(()=>run(s,'admin-case-section-delete',{id:'other'}));
});

test('sections and case assignment persist across API reloads; retries do not duplicate sections and legacy saves retain assignment',async()=>{
 const db=localDatabase();try{
  db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));db.sqlite.prepare('INSERT INTO site_state(id,revision,data) VALUES(1,0,?)').run(JSON.stringify(fixture()));
  const req=async(who,action='state',data={},requestId=crypto.randomUUID())=>{const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,requestId})}),db,{id:who});return {status:r.status,json:await r.json()}};
  const key=crypto.randomUUID(),first=await req(owner,'admin-case-section-save',{name:'Мой раздел'},key),retry=await req(owner,'admin-case-section-save',{name:'Мой раздел'},key);assert.equal(first.status,200);assert.equal(retry.json.result.section.id,first.json.result.section.id);
  const sectionId=first.json.result.section.id,caseId=seed.cases[0].id;assert.equal((await req(owner,'admin-case-section',{caseId,sectionId})).status,200);
  const state=(await req(viewer)).json;assert.equal(state.config.caseSections.filter(x=>x.id===sectionId).length,1);assert.equal(state.config.cases.find(x=>x.id===caseId).sectionId,sectionId);
  const cases=structuredClone(state.config.cases);delete cases.find(x=>x.id===caseId).sectionId;
  assert.equal((await req(owner,'admin-catalog',{catalog:{custom:[],cases}})).status,200);assert.equal((await req(viewer)).json.config.cases.find(x=>x.id===caseId).sectionId,sectionId);
 }finally{db.sqlite.close()}
});

async function uiFixture(){
 const handlers={},nodes={'a-cname':{value:'Draft name'},'a-cprice':{value:'75'},'a-csection':{value:'theme'},'a-cprev':{style:{}}},check={value:'1',checked:true};
 const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const c=vm.createContext({A:{cases:[{id:1,name:'Theme item',grp:'theme',drops:[0]},{id:2,name:'Custom item',sectionId:'custom',drops:[0]},{id:3,name:'Free',bonus:1,bonusKey:'sub',drops:[0]},{id:4,name:'Legacy',grp:'unknown',drops:[0]}],caseSections:[{id:'custom',name:'<Summer>'},{id:'free',name:'Бесплатные кейсы'},{id:'theme',name:'Тематические кейсы'},{id:'other',name:'Другие кейсы'}]},
  casesAdminHtml:()=>'<input id="a-cfile"><button data-a="cdel" data-id="1">Delete</button>',caseEditor(){},isOwner:()=>true,cById:id=>c.A.cases.find(x=>x.id===id),esc,
  winterSearch:'',winterCatalog(){},casesPage(){},winterHero:()=>'<header>Promo</header>',caseCard:x=>'<article>'+x.name+'</article>',cImg:()=>'',cDrops:()=>[],
  document:{addEventListener(type,handler){(handlers[type]||=[]).push(handler)},getElementById:id=>nodes[id]||null,querySelectorAll:selector=>selector==='.a-cd:checked'?(check.checked?[check]:[]):selector==='.a-cd'?[check]:[]},adm:{cimg:image},
  admin(){c.adm.cimg=null;nodes['a-cname'].value='';nodes['a-cprice'].value='';check.checked=false},renderCases(){},NET:{},U:{}});
 const shared=(await readFile(new URL('../shared/case-sections.mjs',import.meta.url),'utf8')).replace(/^export /gm,'');vm.runInContext(shared+'\n'+await readFile(new URL('../client/case-sections.js',import.meta.url),'utf8'),c);return {c,nodes,check,handlers};
}

test('public catalog renders custom sections in order, escapes names and keeps free cards and legacy cases exactly once',async()=>{
 const {c}=await uiFixture(),html=c.casesPage();assert.match(html,/&lt;Summer&gt;/);assert(!html.includes('<Summer>'));assert(html.indexOf('Custom item')<html.indexOf('Кейс за подписку'));
 for(const name of ['Custom item','Theme item','Legacy','Кейс за подписку'])assert.equal(html.split(name).length-1,1);
 assert.match(html,/data-ca="open" data-id="3"/);assert.match(c.casesAdminHtml(),/id="a-csection"/);assert.match(c.casesAdminHtml(),/data-case-section-for="1"/);
});

test('editing sections preserves an unsaved case name, price, selected drops and uploaded image',async()=>{
 const {c,nodes,check}=await uiFixture(),draft=c.caseSectionsDraft();c.caseSectionsRefresh(draft);assert.equal(nodes['a-cname'].value,'Draft name');assert.equal(nodes['a-cprice'].value,'75');assert.equal(c.adm.cimg,image);assert.equal(nodes['a-cprev'].src,image);assert.equal(check.checked,true);
});

test('case selectors expose every section and a separate custom-name choice',async()=>{
 const {c,handlers}=await uiFixture(),html=c.casesAdminHtml();
 assert.match(html,/<select[^>]+data-case-section-choice/);assert.match(html,/<option value="Тематические кейсы">/);assert.match(html,/<option value="">＋ Новый раздел/);assert(!html.includes('<datalist'));assert.match(html,/data-case-section-assign="1"/);
 const inputField={value:'Другие кейсы',hidden:true,focus(){this.focused=true}},select={value:'Тематические кейсы',matches:s=>s==='[data-case-section-choice]',closest:()=>({querySelector:()=>inputField})};
 await handlers.change[0]({target:select});assert.equal(inputField.value,'Тематические кейсы');assert.equal(inputField.hidden,true);select.value='';await handlers.change[0]({target:select});assert.equal(inputField.value,'');assert.equal(inputField.hidden,false);assert.equal(inputField.focused,true);
 let clicked=0,prevented=0;const input={id:'case-section-new-name',closest:()=>({querySelector:()=>({click(){clicked++}})})};
 const event={key:'Enter',target:input,preventDefault(){prevented++}};handlers.keydown[0](event);assert.equal(clicked,1);assert.equal(prevented,1);
 handlers.keydown[0]({...event,isComposing:true});assert.equal(clicked,1);
});

test('typed section names create or reuse sections while creating, editing and assigning cases',()=>{
 const s=fixture(),made=run(s,'admin-case-create',{name:'Typed category case',price:25,image,drops:[0],sectionName:'  Авторские   кейсы  '}),c=s.config.cases.find(c=>c.id===made.caseId);
 const section=caseSectionList(s.config).find(x=>x.name==='Авторские кейсы');assert(section);assert.equal(c.sectionId,section.id);
 const count=caseSectionList(s.config).length;
 run(s,'admin-case-section',{caseId:seed.cases[0].id,sectionName:'АВТОРСКИЕ КЕЙСЫ'});assert.equal(s.config.cases[0].sectionId,section.id);assert.equal(caseSectionList(s.config).length,count);
 run(s,'admin-case-edit',{id:c.id,name:c.name,price:30,drops:[0],sectionName:'Раздел из редактора'});assert.equal(caseSectionList(s.config).find(x=>x.id===c.sectionId).name,'Раздел из редактора');
 const before=JSON.stringify(s.config);for(const sectionName of ['', 'x'.repeat(61),'bad\u0000name'])assert.throws(()=>run(s,'admin-case-section',{caseId:c.id,sectionName}));assert.equal(JSON.stringify(s.config),before);
 assert.throws(()=>run(s,'admin-case-section',{caseId:c.id,sectionName:'Forbidden'},viewer),/владельцу/);
});

test('a new section typed into case creation persists across reload and retries without duplicates',async()=>{
 const db=localDatabase();try{
  db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));db.sqlite.prepare('INSERT INTO site_state(id,revision,data) VALUES(1,0,?)').run(JSON.stringify(fixture()));
  const req=async(action,data={},requestId=crypto.randomUUID())=>{const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,requestId})}),db,{id:owner});assert.equal(r.status,200);return r.json()};
  const data={name:'Fresh typed case',price:20,image,drops:[0],sectionName:'Мои новые кейсы'},key=crypto.randomUUID();
  const first=await req('admin-case-create',data,key),retry=await req('admin-case-create',data,key),reload=await req('state');assert.equal(retry.result.caseId,first.result.caseId);
  const matches=reload.config.caseSections.filter(x=>x.name===data.sectionName);assert.equal(matches.length,1);assert.equal(reload.config.cases.find(x=>x.id===first.result.caseId).sectionId,matches[0].id);
 }finally{db.sqlite.close()}
});
