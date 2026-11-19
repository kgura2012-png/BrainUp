import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,readdir} from 'node:fs/promises';
import {handleOriginalMutation} from '../server/mutation-materials.mjs';
import art from '../assets/mutations/art.json' with {type:'json'};

const source=await readFile(new URL('../client/site-polish.js',import.meta.url),'utf8');
function fixture(){
 const handlers={},button={disabled:false},control={innerHTML:'',classList:{add(){}},querySelector:()=>null},scene={before(){},after(){}},c={id:1,price:20},ctx=vm.createContext({
  CW:{id:1,n:1,busy:false},S:{fast:false,balance:10},I:id=>({id,name:'Elefanto Frigo'}),cById:()=>c,r2:x=>Math.round(x*100)/100,esc:String,mutationDefinition:()=>({name:'Divine'}),mutationIcon:key=>'/icons/'+key+'.png',
  card:(item,cls,uid)=>'<button class="bu-card '+cls+'" data-id="'+item.id+'" data-uid="'+uid+'"><span class="p">'+item.price+'</span><img><span class="n">'+item.name+'</span></button>',tpCard:item=>'<div class="tp-it" data-id="'+item.id+'"><b>'+item.name+'</b></div>',riHtml:item=>'<div class="cw-ri"><span>'+item.name+'</span><b>'+item.price+'</b></div>',
  isFiftyFiftyCase:()=>false,cwCtl(){},cwRender(){},render(){},save(){ctx.saved=(ctx.saved||0)+1},usfx(){},
  document:{getElementById:id=>id==='cw-open'?button:id==='cw-ctl'?control:null,querySelector:selector=>selector==='.winter-case-scene'?scene:null,querySelectorAll:()=>[],addEventListener:(type,fn)=>handlers[type]=fn}
 });vm.runInContext(source,ctx);return {ctx,handlers,button,control,c};
}
test('mutation cards retain stable IDs and prices while separating the base name from the corner icon',()=>{
 const {ctx:c}=fixture(),item={id:2000001,baseId:1,baseName:'Elefanto Frigo',name:'Elefanto Frigo · Divine',price:22140.31,mutation:'divine'};
 const html=c.card(item,'s',77,'Выбрать');assert.match(html,/data-id="2000001"/);assert.match(html,/data-uid="77"/);assert.match(html,/22140.31/);assert.match(html,/<span class="brainrot-name">Elefanto Frigo<\/span>/);assert(!html.includes('Frigo · Divine'));assert.match(html,/brainrot-mutation-badge/);assert.match(html,/aria-label="Мутация: Divine"/);assert.equal(item.name,'Elefanto Frigo · Divine');assert(html.indexOf('<img>')<html.indexOf('brainrot-card-details'));assert(html.indexOf('brainrot-name')<html.indexOf('brainrot-price'));
 assert.match(c.riHtml(item),/<span>Elefanto Frigo<\/span>/);assert.match(c.tpCard(item),/<b>Elefanto Frigo<\/b>/);
});
test('reference controls select x1 through x5, preserve a free opening button and disable insufficient balance',()=>{
 const {ctx:c,control,button}=fixture();const html=c.caseReferenceControls({id:1},'<button data-cw="free">Free</button>');for(const n of [1,2,3,4,5])assert(html.includes('data-n="'+n+'"'));assert(!html.includes('data-n="6"'));for(const label of ['Медленно','Пропустить','data-cw="free"'])assert(html.includes(label));
 c.cwRender();assert(control.innerHTML.includes('case-quantity-segment'));assert.equal(button.disabled,true);c.S.balance=100;c.cwCtl();assert.equal(button.disabled,false);c.CW.busy=true;c.cwCtl();assert.equal(button.disabled,true);
});
test('speed selection saves preference without changing quantity or running while a case is opening',()=>{
 const {ctx:c,handlers}=fixture(),event={target:{closest:()=>({dataset:{v:'1'}})},preventDefault(){},stopImmediatePropagation(){}};handlers.click(event);assert.equal(c.S.fast,true);assert.equal(c.CW.n,1);assert.equal(c.saved,1);c.CW.busy=true;c.S.fast=false;handlers.click(event);assert.equal(c.S.fast,false);assert.equal(c.saved,1);
});
test('original mutation models are local WebP assets for only the four requested types',async()=>{
 const selected=art.filter(x=>!x.missing&&['radioactive','yin-yang','cursed','divine'].includes(x.mutation));assert.equal(selected.length,171);assert.equal((await readdir(new URL('../assets/mutations/original-webp/',import.meta.url))).length,171);
 for(const item of selected){const bytes=await readFile(new URL('../assets/mutations/original-webp/'+item.id+'.webp',import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP')}
 const bytes=await readFile(new URL('../assets/mutations/original-webp/'+selected[0].id+'.webp',import.meta.url)),assets={1:{data:bytes.toString('base64'),digest:'original'}};
 const req=(method='GET',headers={})=>new Request('https://site/assets/mutations/1.webp',{method,headers});const result=handleOriginalMutation(req(),assets);assert.equal(result.headers.get('content-type'),'image/webp');assert.deepEqual(Buffer.from(await result.arrayBuffer()),bytes);assert.equal(handleOriginalMutation(req('HEAD'),assets).status,200);assert.equal(handleOriginalMutation(req('POST'),assets).status,405);assert.equal(handleOriginalMutation(req('GET',{'if-none-match':'"original"'}),assets).status,304);assert.equal(handleOriginalMutation(req(),{}).status,404);
});
test('music is removed, chest stays intact and the local Montserrat Bold and fallback Nunito faces are present',async()=>{
 const winter=await readFile(new URL('../client/winter.js',import.meta.url),'utf8'),opening=await readFile(new URL('../client/case-presentation.js',import.meta.url),'utf8'),css=await readFile(new URL('../client/site-polish.css',import.meta.url),'utf8');assert(!winter.includes('winterAudio'));assert(!winter.includes('applyWinterMusic'));assert(!opening.includes('case-chest-lid'));assert(!opening.includes('cloneNode'));assert.match(css,/case-focus-ring/);assert.match(css,/display:none!important/);assert.match(css,/font-family:"Montserrat","Nunito"/);
 assert.equal((await readFile(new URL('../assets/fonts/montserrat/montserrat-700.woff',import.meta.url))).subarray(0,4).toString(),'wOFF');
 for(const weight of [700,900]){const bytes=await readFile(new URL('../assets/fonts/nunito/nunito-'+weight+'.woff',import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'wOFF')}
});
test('profile cards preserve selection and prices with base names and mutation icons',()=>{
 const {ctx:c}=fixture(),item={id:2000001,baseId:1,baseName:'Elefanto Frigo',name:'Elefanto Frigo · Divine',price:250,mutation:'divine'};
 c.bxAll=()=>[{uid:77,it:item},{uid:78,it:{id:2,name:'Candy Slap',price:7}}];c.PROFILE={limit:48};c.BX={sel:{77:1}};c.tier=()=>['120,180,70'];c.av=()=>'/item.webp';c.COIN='BU ';c.fmt=String;
 const html=c.profileInventoryHtml();assert.match(html,/profile-item polished-profile-card selected/);assert.match(html,/data-profile-item="77"/);assert.match(html,/brainrot-name">Elefanto Frigo<\/b>/);assert.match(html,/brainrot-price">BU 250/);assert.match(html,/brainrot-mutation-badge/);assert(!html.includes('Frigo · Divine'));assert.equal(item.name,'Elefanto Frigo · Divine');
 assert(html.indexOf('data-profile-item="77"')<html.indexOf('data-profile-item="78"'));c.PROFILE.limit=1;assert(!c.profileInventoryHtml().includes('data-profile-item="78"'));c.bxAll=()=>[];assert.match(c.profileInventoryHtml(),/data-profile-action="cases"/);
});
