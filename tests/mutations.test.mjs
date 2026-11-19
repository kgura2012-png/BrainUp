import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
import seed from '../server/seed.json' with {type:'json'};
import bases from '../assets/mutations/bases.json' with {type:'json'};
import art from '../assets/mutations/art.json' with {type:'json'};
import {MUTATION_TYPES,mutationPrice,mutationItemId,expandMutationCatalog} from '../shared/mutations.mjs';
import {fresh,account,execute} from '../server/model.mjs';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';

test('all 46 families use the same ten exact screenshot ratios, with stable unique IDs',()=>{
 assert.equal(bases.length,46);assert.equal(MUTATION_TYPES.length,10);
 assert.deepEqual(MUTATION_TYPES.map(x=>x.id),['gold','diamond','rainbow','candy','lava','galaxy','yin-yang','radioactive','cursed','divine']);
 for(const type of MUTATION_TYPES)assert.equal(mutationPrice(17640,type.id),type.referencePrice);
 const normal=seed.items.filter(x=>!x.mutation),variants=seed.items.filter(x=>x.mutation);
 assert.equal(variants.length,460);assert.deepEqual(variants,expandMutationCatalog(normal,bases));
 assert.equal(new Set(seed.items.map(x=>x.id)).size,seed.items.length);
 for(const item of variants){const base=normal.find(x=>x.id===item.baseId);assert(!base.hidden);assert.equal(item.price,mutationPrice(base.price,item.mutation));assert.equal(item.id,mutationItemId(base.id,item.mutation))}
 assert.equal(seed.items.find(x=>x.id===117).price,200000);assert(!variants.some(x=>x.baseId===118));
 assert.throws(()=>mutationPrice(100,'bloodrot'));assert.equal(mutationPrice(200000,'gold'),205668.93);
});

test('available mutation images are PNGs; icons contain exactly the supplied types',async()=>{
 assert.equal(art.length,460);const found=art.filter(x=>!x.missing);assert.equal(found.length,426);
 for(const entry of found){assert.match(entry.imageSource,/^https:\/\/static\.wikia\.nocookie\.net\//);const bytes=await readFile(new URL('../assets/mutations/'+entry.imageFile,import.meta.url));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a')}
 assert.deepEqual((await readdir(new URL('../assets/mutations/icons/',import.meta.url))).sort(),['default',...MUTATION_TYPES.map(x=>x.id)].map(x=>x+'.png').sort());
});

test('mutation IDs work in owner cases, inventory and sale with server prices',()=>{
 const owner='tg:1116312381',player='tg:42',s=fresh(seed,owner);account(s,owner,'Owner');const u=account(s,player,'Player');u.balance=100;
 const item=seed.items.find(x=>x.mutation==='divine');
 const data={name:'Mutations',price:10,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',drops:[item.id]};
 assert.throws(()=>execute(s,player,seed,'admin-case-create',data),/владельцу/);
 const made=execute(s,owner,seed,'admin-case-create',data);const result=execute(s,player,seed,'case',{id:made.caseId,n:1});assert.equal(result.wins[0].w.id,item.id);
 const inv=u.inv.find(x=>x.id===item.id);assert(inv);const sold=execute(s,player,seed,'sell',{ids:[inv.uid],price:999999});assert.equal(sold.total,item.price);assert.equal(u.balance,Math.round((90+item.price)*100)/100);
});

test('won mutated upgrade remains the same item after an API reload',async()=>{
 const db=localDatabase();try{
 const who='tg:1116312381',s=fresh(seed,who),u=account(s,who,'Owner'),target=seed.items.find(x=>x.mutation==='rainbow'&&x.price>10);u.inv=[{id:95,uid:1}];u.uid=2;
 const result=execute(s,who,seed,'upgrade',{ids:[1],coins:0,target:target.id,targetPrice:1},Date.now(),()=>0);assert(result.win);assert.equal(u.inv[0].id,target.id);
 db.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));db.sqlite.prepare('INSERT INTO site_state(id,revision,data) VALUES(1,0,?)').run(JSON.stringify(s));
 const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'state',requestId:crypto.randomUUID(),data:{}})}),db,{id:who});assert.equal(r.status,200);assert.equal((await r.json()).user.inv[0].id,target.id);
 }finally{db.sqlite.close()}
});

async function ui(){
 const handlers={},context=vm.createContext({MUTATION_BASES:bases,MUTATION_ART:Object.fromEntries(art.filter(x=>!x.missing).map(x=>[x.id,'digest'])),I:id=>seed.items.find(x=>x.id===id),av:item=>'base-'+item.id+'.png',tList:()=>seed.items.filter(x=>!x.hidden),upgradeTargetCard:item=>'<button>'+item.name+'</button>',render(){},admin(){},casesAdminHtml:()=>'<div class="bu-cklist"></div>',caseEditor(){},bet:()=>0,targetUpgradeChance:(b,p)=>b/p>.8?null:b/p*100,esc:String,fmt:String,COIN:'BU ',PAGE:20,U:{target:0,pg:{t:1}},NET:{},modal:{dataset:{}},openModal:html=>context.opened=html,closeModal:()=>context.closed=true,toast:()=>{},isOwner:()=>true,document:{addEventListener:(type,fn)=>{(handlers[type]??=[]).push(fn)},getElementById:()=>null,querySelectorAll:()=>[]}});
 vm.runInContext((await readFile(new URL('../shared/mutations.mjs',import.meta.url),'utf8')).replace(/^export /gm,'')+'\n'+await readFile(new URL('../client/mutations.js',import.meta.url),'utf8'),context);return {context,handlers};
}
test('upgrade uses one card per base; its icon changes only that family mutation',async()=>{
 const {context:c,handlers}=await ui(),normalCount=seed.items.filter(x=>!x.hidden&&!x.mutation).length;
 assert.equal(c.tList().length,normalCount);assert(c.tList().every(x=>!x.mutation));
 const base=IBase=>seed.items.find(x=>x.id===IBase),first=bases[0],card=c.upgradeTargetCard(base(first.id));assert.match(card,/class="mutation-selector"/);assert.match(card,/default\.png/);assert(!card.includes('class="mutation-open"'));
 const dispatch=item=>handlers.click[0]({target:{closest:()=>({disabled:false,dataset:{mutationPick:String(item.id)}})},preventDefault(){},stopImmediatePropagation(){}});
 c.showMutationPicker(first.id);assert.equal((c.opened.match(/data-mutation-pick=/g)||[]).length,11);assert(!c.opened.includes('Bloodrot'));assert(c.opened.includes('×'+(mutationPrice(base(first.id).price,'gold')/base(first.id).price).toLocaleString('ru-RU',{maximumFractionDigits:6})));
 const chosen=seed.items.find(x=>x.baseId===first.id&&x.mutation==='divine');dispatch(chosen);
 assert.equal(c.U.target,chosen.id);assert.equal(c.UPGRADE_MUTATIONS[first.id],chosen.id);assert(c.closed);assert.equal(c.tList().length,normalCount);assert(!c.tList().some(x=>x.id===first.id));assert.equal(c.tList().filter(x=>x.baseId===first.id).length,1);assert.match(c.upgradeTargetCard(chosen),/divine\.png/);
 const second=seed.items.find(x=>x.baseId===bases[1].id&&x.mutation==='gold');dispatch(second);assert(c.tList().some(x=>x.id===chosen.id));assert(c.tList().some(x=>x.id===second.id));assert.equal(c.tList().length,normalCount);
 dispatch(base(first.id));assert.equal(c.UPGRADE_MUTATIONS[first.id],undefined);assert(c.tList().some(x=>x.id===first.id));assert(c.tList().some(x=>x.id===second.id));assert.equal(c.tList().length,normalCount);
 let removed=false;c.document.getElementById=id=>id==='upgrade-mutation-filter'?{remove(){removed=true}}:null;c.mountUpgradeMutationFilter();assert(removed);
});
test('admin filtering preserves selected hidden rows and counts all selections',async()=>{
 const {context:c}=await ui(),normal=seed.items.find(x=>!x.mutation),variant=seed.items.find(x=>x.mutation==='gold');let label;
 const rows=[normal,variant].map(item=>({value:String(item.id),checked:true,hidden:false,closest(){return {classList:{toggle:(_,value)=>this.hidden=value}}}}));
 const toolbar={dataset:{mutationScope:'create'},nextElementSibling:{querySelectorAll:()=>rows},querySelector:selector=>selector.includes('filter')?{value:'gold'}:selector.includes('search')?{value:''}:{set textContent(value){label=value}}};
 c.filterAdminMutations(toolbar);assert(rows[0].hidden);assert(!rows[1].hidden);assert(rows.every(x=>x.checked));assert.equal(label,'Показано: 1 · выбрано: 2');
});
test('combined target and card renderers produce one clickable mutation icon with no duplicate badge or plus',async()=>{
 const {context:c}=await ui();c.card=(item,cls,uid)=>'<button class="bu-card '+cls+'" data-id="'+item.id+'" data-uid="'+uid+'"><img src="'+c.av(item)+'"><span class="n">'+item.name+'</span><span class="p">'+item.price+'</span></button>';c.tpCard=()=>'<div class="tp-it"></div>';c.riHtml=()=>'<div class="cw-ri"></div>';c.cwCtl=()=>{};c.cwRender=()=>{};c.targetCardBeforeMutations=item=>c.card(item,'',0);
 vm.runInContext(await readFile(new URL('../client/site-polish.js',import.meta.url),'utf8'),c);
 const item=seed.items.find(x=>x.mutation==='gold'),html=c.upgradeTargetCard(item);assert.equal((html.match(/class="mutation-selector"/g)||[]).length,1);assert(!html.includes('brainrot-mutation-badge'));assert(!html.includes('class="mutation-open"'));assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/gold\.png/);
 const owned=c.card(item,'',42);assert(owned.includes('brainrot-mutation-badge'));assert.match(owned,/data-uid="42"/);
});
test('mutation multiplier text reflects the displayed item and base prices',async()=>{
 const {context:c}=await ui(),family=bases[0],original=seed.items.find(item=>item.id===family.id),gold=seed.items.find(item=>item.baseId===family.id&&item.mutation==='gold');
 c.I=id=>{const item=seed.items.find(item=>item.id===id);return item?.id===original.id?{...item,price:250}:item?.id===gold.id?{...item,price:1200}:item};
 c.showMutationPicker(family.id);assert.match(c.opened,/<strong>BU 1200<\/strong><small>×4,8<\/small>/);assert.equal(c.mutationFactorText('default',c.I(original.id),c.I(original.id)),'×1');
});
