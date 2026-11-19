// Every section shares one scroll viewport; application chrome stays outside it.
function syncContentPane(){
 document.documentElement.classList.add('content-pane');
 document.body.classList.add('content-pane');
 var live=document.getElementById('bu-live'),compact=window.matchMedia('(max-width:992px)').matches;
 document.documentElement.style.setProperty('--content-live-height',compact&&live?Math.ceil(live.getBoundingClientRect().height)+'px':'0px');
}
var showSectionBeforeContentPane=showSec;
showSec=function(){var result=showSectionBeforeContentPane.apply(this,arguments);syncContentPane();var pane=document.querySelector('up-main');if(pane)pane.scrollTop=0;return result};
window.addEventListener('resize',syncContentPane,{passive:true});
if(typeof ResizeObserver==='function'){var contentChromeObserver=new ResizeObserver(syncContentPane);var contentFeed=document.getElementById('bu-live');if(contentFeed)contentChromeObserver.observe(contentFeed);var contentHeader=document.getElementById('bu-head');if(contentHeader)contentChromeObserver.observe(contentHeader)}
syncContentPane();

// Case audio is separate from general UI and game win sounds.
var soundBeforeCasePresentation=sfx;
sfx=function(type,n){
 if(type!=='ctick'&&type!=='cwin')return soundBeforeCasePresentation(type,n);
 if(!S.sound||document.hidden)return;
 try{
  var time=ac0();
  if(type==='ctick'){
   nz2(time,.014,2600,850,.018,3.2);
   wv(175,time,.026,'sine',.021,85,1000);
  }else{
   wv(125,time,.12,'sine',.045,65,900);
   [698.46,880,1046.5,1396.91].forEach(function(frequency,index){
    wv(frequency,time+.035+index*.065,.28,'triangle',.036,frequency,4500);
    wv(frequency*2,time+.035+index*.065,.16,'sine',.011,frequency*2,6500);
   });
  }
 }catch(error){}
};

// Each strip keeps its server-selected winning instance and its own sell button.
var playBeforeInlineCaseResults=cwPlay;
var caseOpeningSerial=0;
function caseOpeningDelay(duration){
 return new Promise(function(resolve){
  if(document.hidden)return resolve();
  var timer=setTimeout(finish,duration);
  function finish(){clearTimeout(timer);document.removeEventListener('visibilitychange',hidden);resolve()}
  function hidden(){if(document.hidden)finish()}
  document.addEventListener('visibilitychange',hidden);
 });
}
cwPlay=async function(){
 var args=arguments,context=this,reels=document.getElementById('cw-reels'),stage=document.getElementById('cw-stage'),scene=reels&&reels.closest('.winter-case-scene'),serial=++caseOpeningSerial,token=CW.tok;
 if(reels)reels.classList.remove('case-result-reels');
 if(!scene||!stage)return playBeforeInlineCaseResults.apply(context,args);
 scene.classList.remove('spinning','settled');scene.classList.add('case-opening');
 var ctl=document.getElementById('cw-ctl'),res=document.getElementById('cw-res'),image=stage.querySelector('.cw-case'),anchor=document.createElement('div'),flash=document.createElement('div');
 if(ctl)ctl.classList.add('off');if(res)res.innerHTML='';
 anchor.className='case-chest-anchor';
 // Retain the idle image's measured box; no absolute 50% placement or image transform.
 if(image){var bounds=image.getBoundingClientRect();anchor.style.setProperty('--case-chest-width',bounds.width+'px');anchor.style.setProperty('--case-chest-height',bounds.height+'px');image.before(anchor);anchor.appendChild(image)}else stage.appendChild(anchor);
 flash.className='case-chest-flash';flash.setAttribute('aria-hidden','true');if(image)flash.style.setProperty('--case-flash-image','url('+JSON.stringify(image.currentSrc||image.src)+')');anchor.appendChild(flash);
 var current=function(){return serial===caseOpeningSerial&&token===CW.tok};
 var finished=false;
 try{finished=await playCaseOpening({stage:stage,fast:S.fast,reduced:window.matchMedia('(prefers-reduced-motion: reduce)').matches,wait:caseOpeningDelay,isCurrent:current,skip:function(){return document.hidden},onPhase:function(phase){if(phase==='flash')sfx('whoosh')}})}
 catch(error){finished=current();console.warn('Case opening intro unavailable')}
 finally{if(image)anchor.before(image);anchor.remove();scene.classList.remove('case-opening')}
 if(!finished||!current())return;
 scene.classList.add('spinning');return playBeforeInlineCaseResults.apply(context,args);
};
cwDone=function(c,wins,total){
 CW.busy=0;caseBusy=false;
 var reels=document.getElementById('cw-reels'),res=document.getElementById('cw-res'),ctl=document.getElementById('cw-ctl');
 if(!reels||!res)return;
 if(wins.length&&CW.dropSoundToken!==CW.tok){CW.dropSoundToken=CW.tok;sfx('cwin')}
 var scene=reels.closest('.winter-case-scene');if(scene)scene.classList.add('settled','spinning');
 // Visibility settlement can happen before the animation reaches its last frame.
 var rows=Array.from(reels.querySelectorAll('.cw-reel'));
 wins.forEach(function(prize,index){
  var reel=rows[index];if(!reel)return;
  var strip=reel.querySelector('.cw-strip'),winner=strip&&(strip.querySelector('.win')||strip.children[44]);
  if(winner){Array.from(strip.children).forEach(function(card){card.style.setProperty('--case-focus',card===winner?'1':'0')});winner.classList.add('win');strip.style.transform='translate3d('+(reel.clientWidth/2-winner.offsetLeft-winner.offsetWidth/2)+'px,0,0)'}
  reel.classList.add('done');
  var row=reel.closest('.case-reel-result');if(!row){row=document.createElement('div');row.className='case-reel-result';reel.before(row);row.appendChild(reel)}
  var old=row.querySelector('.case-drop-actions');if(old)old.remove();
  var actions=document.createElement('div');actions.className='case-drop-actions';
  if(prize.w.rewardKind==='coins')actions.innerHTML='<span class="case-drop-credited" role="status">Начислено '+COIN+fmt(prize.coins||prize.w.price)+'</span>';
  else{var owned=S.inv.some(function(item){return item.uid===prize.uid});actions.innerHTML='<button type="button" class="case-drop-sell" data-case-sell-item="'+Number(prize.uid)+'"'+(owned?'':' disabled')+'>'+(owned?'Продать <span>'+COIN+fmt(prize.w.price)+'</span>':'В инвентаре нет')+'</button>'}
  row.appendChild(actions);
 });
 reels.classList.add('case-result-reels');
 // No duplicate prize grid: the framed winners above are the results.
 res.innerHTML='<div class="cw-btns case-result-controls">'+caseBulkSellMarkup()+'<button class="cw-again" data-cw="again">Открыть ещё</button><button class="cw-keep" data-cw="keep">'+(wins.every(function(prize){return prize.w.rewardKind==='coins'})?'Готово':'Оставить в инвентаре')+'</button></div>';
 if(ctl){ctl.classList.remove('off');ctl.style.display='none'}
};
var sellCasePrize=createCasePrizeSeller({inventory:function(){return S.inv},request:function(action,data){return NET.request(action,data)},adopt:function(reply){NET.adopt(reply)}});
var caseSaleBusy=false;
function caseSaleItems(){
 var prizeIds=new Set((CW.last||[]).filter(function(prize){return prize.w.rewardKind!=='coins'}).map(function(prize){return prize.uid}));
 return bxAll().filter(function(item){return prizeIds.has(item.uid)});
}
function caseBulkSellMarkup(){var items=caseSaleItems();return items.length?'<button type="button" class="case-sell-all" data-case-sell-all>Продать весь дроп · '+items.length+' · '+COIN+fmt(bxSellSum(items))+'</button>':''}
function syncCaseSaleButtons(){
 var items=caseSaleItems(),owned=new Set(S.inv.map(function(item){return item.uid}));
 document.querySelectorAll('[data-case-sell-item]').forEach(function(button){var available=owned.has(Number(button.dataset.caseSellItem));button.disabled=caseSaleBusy||!available;if(!available&&!button.classList.contains('sold')){button.classList.add('sold');button.textContent='✓ В инвентаре нет'}});
 document.querySelectorAll('[data-case-sell-all]').forEach(function(button){button.disabled=caseSaleBusy||!items.length;button.innerHTML=items.length?'Продать весь дроп · '+items.length+' · '+COIN+fmt(bxSellSum(items)):'✓ Весь дроп продан';});
}
document.addEventListener('click',async function(event){
 var button=event.target.closest('[data-case-sell-item],[data-case-sell-all]');if(!button||button.disabled)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(caseSaleBusy||CW.busy||U.busy||NET.busy||!NET.ready)return toast('Дождитесь завершения текущего действия');
 var bulk=button.hasAttribute('data-case-sell-all'),ids=bulk?caseSaleItems().map(function(item){return item.uid}):[Number(button.dataset.caseSellItem)];
 if(!ids.length||ids.some(function(uid){return !(CW.last||[]).some(function(prize){return prize.uid===uid&&prize.w.rewardKind!=='coins'})}))return;
 caseSaleBusy=true;button.setAttribute('aria-busy','true');syncCaseSaleButtons();
 try{var amount=bulk?await sellCasePrize.sellMany(ids):await sellCasePrize(ids[0]);if(amount===null)return;CW.last=(CW.last||[]).filter(function(prize){return !ids.includes(prize.uid)});document.querySelectorAll('[data-case-sell-item]').forEach(function(itemButton){if(ids.includes(Number(itemButton.dataset.caseSellItem))){itemButton.classList.add('sold');itemButton.textContent='✓ Продано'}});render();toast('Продано за '+fmt(amount)+' BU')}
 catch(error){toast(error.message)}
 finally{caseSaleBusy=false;button.removeAttribute('aria-busy');syncCaseSaleButtons()}
},true);
