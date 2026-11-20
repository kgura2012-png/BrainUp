import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {playCaseOpening} from '../client/case-opening.mjs';
import {withCaseReel} from '../scripts/case-reel-markup.mjs';

function node(){const classes=new Set(),properties={};return {dataset:{},classList:{add:(...names)=>names.forEach(x=>classes.add(x)),remove:(...names)=>names.forEach(x=>classes.delete(x)),contains:x=>classes.has(x)},style:{setProperty:(k,v)=>properties[k]=v,removeProperty:k=>delete properties[k]},setAttribute(){},appendChild(){},before(){},getBoundingClientRect:()=>({width:260,height:240}),remove(){},cloneNode:()=>node(),querySelector:()=>node()}}
for(const fast of [false,true])test('chest shakes, lights up and opens in order in '+(fast?'fast':'normal')+' mode',async()=>{
 const stage=node(),phases=[],times=[];assert(await playCaseOpening({stage,fast,onPhase:phase=>phases.push(phase),wait:async duration=>{times.push(duration);assert(stage.classList.contains('case-chest-intro'));assert.equal(stage.dataset.openingPhase,phases.at(-1))}}));
 assert.deepEqual(phases,['shake','flash']);assert.equal(times.reduce((a,b)=>a+b,0),fast?340:1240);assert(!stage.classList.contains('case-chest-intro'));assert.equal(stage.dataset.openingPhase,undefined);
});
test('reduced motion skips movement; backgrounding skips remaining phases',async()=>{
 const phases=[];assert(await playCaseOpening({stage:node(),reduced:true,wait:()=>assert.fail('no delay'),onPhase:x=>phases.push(x)}));assert.deepEqual(phases,[]);
 let hidden=false;assert(await playCaseOpening({stage:node(),skip:()=>hidden,wait:async()=>hidden=true,onPhase:x=>phases.push(x)}));assert.deepEqual(phases,['shake']);
});
test('stale opening stops before showing a different case and always cleans up',async()=>{
 const stage=node(),phases=[];let current=true;assert.equal(await playCaseOpening({stage,isCurrent:()=>current,wait:async()=>current=false,onPhase:x=>phases.push(x)}),false);assert.deepEqual(phases,['shake']);assert.equal(stage.dataset.openingPhase,undefined);assert(!stage.classList.contains('case-chest-intro'));
});
test('reels start only after the intro, using the exact already-settled prizes; renderer failure still releases them',async()=>{
 const source=await readFile(new URL('../client/case-presentation.js',import.meta.url),'utf8'),start=source.indexOf('var playBeforeInlineCaseResults='),end=source.indexOf('\ncwDone=function',start),wins=[{uid:777,w:{id:95,price:1}}];
 for(const fail of [false,true]){
  const scene=node(),stage=node(),reels=node(),events=[];reels.closest=()=>scene;let finish;
  const nodes={'cw-reels':reels,'cw-stage':stage,'cw-ctl':node(),'cw-res':node()},context=vm.createContext({CW:{tok:4},S:{fast:false},window:{matchMedia:()=>({matches:false})},document:{getElementById:id=>nodes[id],createElement:()=>node()},sfx(){},console:{warn(){}},cwPlay:(c,d,result)=>{events.push('reels');assert.equal(result,wins);assert(scene.classList.contains('spinning'))},playCaseOpening:async()=>{events.push('intro');await new Promise(resolve=>finish=resolve);if(fail)throw Error('animation unavailable');return true}});
  vm.runInContext(source.slice(start,end),context);const playing=context.cwPlay({id:1},[],wins);assert.deepEqual(events,['intro']);assert(!scene.classList.contains('spinning'));finish();await playing;assert.deepEqual(events,['intro','reels']);assert(!scene.classList.contains('case-opening'));
 }
});
test('mutation picker retains the native close cross and no longer creates a second minus button',async()=>{
 const source=await readFile(new URL('../client/mutations.js',import.meta.url),'utf8');assert(!source.includes('data-mutation-close'));assert(!source.includes('class="mutation-picker-close"'));assert.match(source,/openModal\(/);
});
test('opening preserves the idle image box and animates the wrapper rather than absolutely positioning the image',async()=>{
 const source=await readFile(new URL('../client/case-presentation.js',import.meta.url),'utf8'),css=await readFile(new URL('../client/winter.css',import.meta.url),'utf8');
 assert.match(source,/bounds=image\.getBoundingClientRect\(\)/);assert.match(source,/setProperty\('--case-chest-width',bounds\.width\+'px'\)/);assert.match(source,/setProperty\('--case-chest-height',bounds\.height\+'px'\)/);assert.match(source,/image\.before\(anchor\);anchor\.appendChild\(image\)/);assert.match(source,/if\(image\)anchor\.before\(image\)/);
 const imageRule=css.match(/\.case-chest-anchor \.cw-case\{([^}]+)\}/)?.[1];assert(imageRule);assert.match(imageRule,/position:static!important/);assert.match(imageRule,/grid-area:1\/1!important/);assert(!imageRule.includes('left:50%'));assert(!imageRule.includes('top:50%'));assert.match(css,/\[data-opening-phase="shake"\] \.case-chest-anchor\{animation:case-chest-rattle/);assert(!css.includes('case-chest-lid-panel'));assert(!source.includes('cloneNode(false)'));
});

test('the compiled reel passes every catalog card before landing on the exact server prize',async()=>{
 const html=await readFile(new URL('../site.html',import.meta.url),'utf8');
 const compiled=await withCaseReel(html);
 assert.equal(await withCaseReel(compiled),compiled);
 const start=compiled.indexOf('function buildFullCaseReel('),end=compiled.indexOf('var originalCwGo=cwGo;',start);
 assert.ok(start>=0&&end>start);
 const context=vm.createContext({
  cwPlay(){},riHtml:item=>'<div class="cw-ri" data-id="'+item.id+'"><img src="/'+item.id+'.webp"></div>'
 });
 vm.runInContext(compiled.slice(start,end),context);
 const padding=10;
 for(const size of [1,2,44,192,2000]){
  const items=Array.from({length:size},(_,id)=>({id,rewardWeight:id===0?1:0}));
  if(size===2)items[0].id='token-2';
  const prize={...items.at(-1),serverInstance:true};
  const {cards,winner}=context.buildFullCaseReel(items,prize,padding,()=>.25);
  assert.ok(winner>=padding+items.length);
  assert.deepEqual(new Set(Array.from(cards.slice(padding,winner),item=>item.id)),new Set(items.map(item=>item.id)));
  assert.equal(cards[winner],prize);
  assert.ok(cards.length>winner+padding);
  const markup=context.renderFullCaseReel({cards,winner},padding);
  assert.equal((markup.match(/data-case-winner/g)||[]).length,1);
  assert.match(markup,/data-case-winner="true"[^>]*><img decoding="async" loading="eager"/);
 }
});
