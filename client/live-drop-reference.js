// A drop shows the prize at rest and its original source on hover or focus.
feedCard=function(drop){
 var item=I(drop.itemId);if(!item)return '';
 var origin=liveDropOrigin(drop,A.cases||[]),sourceCase=origin.caseId!=null?cById(origin.caseId):null,qty=Math.max(1,Math.floor(drop.qty||1)),displayName=item.baseName||(item.mutation&&I(item.baseId)?.name)||item.name.split(' · ')[0],badge=item.mutation?'<span class="live-mutation-icon" aria-label="Мутация: '+esc(item.mutation)+'"><img src="/assets/mutation-icons/'+encodeURIComponent(item.mutation)+'.png" alt="" loading="lazy"></span>':'';
 var icon=sourceCase?'<img src="'+esc(cImg(sourceCase))+'" alt="" loading="lazy">':secIcon(origin.section==='upgrade'?'M12 19V5M5 12l7-7 7 7':origin.section==='mines'?'M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3z':origin.section==='dice'?'M5 3h14v18H5zM8 8h.01M16 16h.01':'M3 8l9-5 9 5v12H3zM3 8l9 5 9-5');
 return '<button type="button" class="bu-ld live-reference-card" data-drop="'+esc(drop.id||'')+'" data-live-section="'+esc(origin.section)+'"'+(origin.caseId!=null?' data-live-case="'+origin.caseId+'"':'')+' style="--tc:'+tier(item.price)[0]+'" data-player-id="'+esc(drop.userId||'')+'" aria-label="'+esc('Профиль игрока '+(drop.user||'')+'. '+displayName+', '+fmt(drop.price)+' BU')+'"><span class="live-prize-face"><span class="im"><img src="'+esc(av(item))+'" alt="" loading="lazy"></span><span class="tx"><span class="n">'+esc(displayName)+(qty>1?' ×'+qty:'')+'</span><span class="p">'+COIN+fmt(drop.price)+'</span><span class="live-drop-user" title="'+esc(drop.user||'Игрок')+'">'+esc(drop.user||'Игрок')+'</span></span></span><span class="live-source-face" aria-hidden="true"><span class="live-source-icon'+(origin.isCase?' is-case':'')+'">'+icon+'</span><span class="live-source-copy">'+(origin.isCase?'<small>Кейс</small>':'')+'<b>'+esc(origin.label)+'</b></span></span>'+badge+'</button>';
};
liveCard=feedCard;
var feedBeforeSourceCards=renderDropFeed;
renderDropFeed=function(){
 var feed=document.getElementById('bu-ll'),previous=new Set(feed?Array.from(feed.querySelectorAll('[data-drop]')).map(function(card){return card.dataset.drop}):[]);
 var result=feedBeforeSourceCards.apply(this,arguments);
 if(previous.size&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelectorAll('#bu-ll [data-drop]').forEach(function(card){if(!previous.has(card.dataset.drop)&&card.animate)card.animate([{opacity:0,transform:'translateY(-18px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,easing:'ease-out'})})}
 return result;
};
document.addEventListener('click',function(event){
 var card=event.target.closest(':is(#bu-live,#cw-live-drops) .live-reference-card');if(!card)return;
 if(U.busy||caseBusy)return;
 if(CW.el&&CW.el.classList.contains('on'))cwClose();
 openPublicPlayer({userId:card.dataset.playerId||'',dropId:card.dataset.drop||''});
});
feedSignature='';renderDropFeed();
