// Codes entered for a top-up live only until that dialog is closed.
var closeBeforeTemporaryPromo=closeModal;
closeModal=function(){
 if(modal.classList.contains('on')&&['topup','free-queue-intro','topup-queue'].includes(modal.dataset.view)){
  TP.promo='';if(modal.dataset.view==='free-queue-intro')FREE_QUEUE_DRAFT=null;
 }
 return closeBeforeTemporaryPromo.apply(this,arguments);
};

var telegramPartnerLinks={},telegramPartnerLinkBusy=false;
async function loadTelegramPartnerLink(){
 var partner=myRef();if(!partner||partner.disabled||!NET.ready||telegramPartnerLinkBusy)return;
 var input=document.getElementById('bu-referral-telegram'),button=document.querySelector('[data-referral-telegram]');if(!input)return;
 if(telegramPartnerLinks[partner.code]){input.value=telegramPartnerLinks[partner.code];if(button){button.disabled=false;button.textContent='Скопировать'}return}
 telegramPartnerLinkBusy=true;if(button)button.disabled=true;
 try{var reply=await NET.request('referral-info',{});telegramPartnerLinks[reply.result.code]=reply.result.url;input=document.getElementById('bu-referral-telegram');if(input&&input.dataset.code===reply.result.code)input.value=reply.result.url;if(button)button.textContent='Скопировать'}catch(error){input.placeholder=error.message;if(button)button.textContent='Повторить'}finally{telegramPartnerLinkBusy=false;if(button)button.disabled=false}
}
var referralsBeforeTelegramLink=refPage;
refPage=function(){
 var html=referralsBeforeTelegramLink.apply(this,arguments),partner=myRef();if(!partner||partner.disabled)return html;
 var link='<section class="bu-rfc partner-telegram-link"><small>Реферальная ссылка Telegram</small><p>Пригласи друга в бота — код партнёра привяжется автоматически.</p><div class="bu-rfl"><input id="bu-referral-telegram" data-code="'+esc(partner.code)+'" readonly value="'+esc(telegramPartnerLinks[partner.code]||'')+'" placeholder="Загружаем ссылку…"><button type="button" class="bu-btn" data-referral-telegram>Скопировать</button></div></section>';
 setTimeout(loadTelegramPartnerLink,0);
 return html.replace('<div class="bu-rfc bu-rfcode">',link+'<div class="bu-rfc bu-rfcode">');
};
document.addEventListener('click',async function(event){if(!event.target.closest('[data-referral-telegram]'))return;await loadTelegramPartnerLink();var input=document.getElementById('bu-referral-telegram');if(input&&input.value)refCopy(input.id)});

var PUBLIC_PLAYER=null,publicPlayerRequest=0;
function publicPlayerPage(){
 var state=PUBLIC_PLAYER,profile=state&&state.profile;
 var start='<section class="public-player-page"><button type="button" class="bu-btn secondary public-profile-back" data-public-profile-back>← Мой профиль</button>';
 if(!profile)return start+'<div class="public-profile-empty" role="status">'+esc(state?.error||'Загружаем профиль игрока…')+'</div></section>';
 var stats=profile.stats,items=profile.items.map(function(entry){var item=I(entry.id);return '<article class="public-inventory-card" style="--tc:'+tier(entry.price)[0]+'">'+(item?'<img src="'+esc(av(item))+'" alt="" loading="lazy">':'<span class="public-item-placeholder">◇</span>')+'<b>'+esc(entry.name)+'</b><span>'+COIN+fmt(entry.price)+'</span>'+(entry.qty>1?'<small>×'+entry.qty+'</small>':'')+'</article>'}).join('');
 return start+'<header class="public-profile-heading"><img src="'+esc(ava(profile.name))+'" alt=""><div><small>Профиль игрока</small><h1>'+esc(profile.name)+'</h1></div></header><div class="public-profile-stats">'+stat('Предметов',stats.inventoryCount)+stat('Апгрейдов',stats.upgrades)+stat('Побед',stats.wins)+stat('Поражений',stats.losses)+'</div><section class="public-profile-inventory"><header><h2>Инвентарь</h2><span>'+COIN+fmt(stats.inventoryValue)+'</span></header><div class="public-inventory-grid">'+(items||'<p>Инвентарь пока пуст.</p>')+'</div></section>'+(profile.pages>1?'<nav class="public-profile-pagination" aria-label="Страницы инвентаря"><button class="bu-btn secondary" data-public-profile-page="'+(profile.page-1)+'"'+(profile.page<=1||state.loading?' disabled':'')+'>←</button><span>'+profile.page+' / '+profile.pages+'</span><button class="bu-btn secondary" data-public-profile-page="'+(profile.page+1)+'"'+(profile.page>=profile.pages||state.loading?' disabled':'')+'>→</button></nav>':'')+'</section>';
}
async function openPublicPlayer(query){
 if(NET.busy)return toast('Дождитесь завершения операции');
 var request=++publicPlayerRequest;
 if(modal.classList.contains('on'))closeModal();
 PUBLIC_PLAYER={query:query,profile:null,loading:true};U.ptab='main';showSec('profile');
 try{var reply=await NET.request('player-profile',query);if(request!==publicPlayerRequest||!PUBLIC_PLAYER)return;PUBLIC_PLAYER.profile=reply.result.profile;PUBLIC_PLAYER.loading=false;showSec('profile')}catch(error){if(request!==publicPlayerRequest||!PUBLIC_PLAYER)return;PUBLIC_PLAYER.error=error.message;PUBLIC_PLAYER.loading=false;showSec('profile')}
}
var profileBeforePublicPlayers=profilePage;
profilePage=function(){
 if(PUBLIC_PLAYER)return publicPlayerPage();
 var html=profileBeforePublicPlayers.apply(this,arguments);
 if(isOwner()&&U.ptab!=='ref'){
  var end=html.lastIndexOf('</div>');
  var adminEntry='<footer class="owner-profile-admin"><button type="button" class="bu-btn" data-owner-profile-admin>Админ-панель</button></footer>';
  html=end>=0?html.slice(0,end)+adminEntry+html.slice(end):html+adminEntry;
 }
 return html;
};
var ownProfileBeforePublicPlayers=profile;
profile=function(){PUBLIC_PLAYER=null;publicPlayerRequest++;return ownProfileBeforePublicPlayers.apply(this,arguments)};
var sectionBeforePublicPlayers=showSec;
showSec=function(section){if(section!=='profile'){PUBLIC_PLAYER=null;publicPlayerRequest++}return sectionBeforePublicPlayers.apply(this,arguments)};
document.addEventListener('click',function(event){if(event.target.closest('#bu-head .bu-hav,[data-sec="profile"]')){PUBLIC_PLAYER=null;publicPlayerRequest++}},true);
document.addEventListener('click',function(event){
 if(event.target.closest('[data-public-profile-back]')){profile();return}
 var page=event.target.closest('[data-public-profile-page]');if(page&&PUBLIC_PLAYER&&!page.disabled){openPublicPlayer({userId:PUBLIC_PLAYER.profile.id,page:Number(page.dataset.publicProfilePage)});return}
 if(event.target.closest('[data-owner-profile-admin]')&&isOwner())openAdmin();
});
