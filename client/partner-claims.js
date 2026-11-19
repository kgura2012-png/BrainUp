REF_DAY=0;REF_FROM=12;REF_TO=22;REF_TZ='Europe/Kyiv';
refWd=function(partner){
 var clock=refClock(),canClaim=clock.open&&!partner.disabled&&Number(partner.pending)>0;
 return '<section class="partner-claim-card" id="bu-rfwd" data-open="'+(clock.open?'1':'0')+'"><div class="partner-balance-summary"><small>Предварительный баланс</small><div class="partner-balance-amount">'+COIN+'<span>'+fmt(r2(partner.pending||0))+'</span></div></div><p class="partner-claim-schedule">Перевод на баланс аккаунта — по воскресеньям с 12:00 до 22:00 по Киеву.</p><div class="partner-claim-countdown"><span>'+(clock.open?'До закрытия перевода:':'До открытия перевода:')+'</span><b id="bu-rfcd">'+refFmt(clock.left)+'</b></div><button type="button" class="partner-claim-button" data-partner-claim'+(canClaim?'':' disabled')+'>'+(clock.open?'Перевести на баланс':'Доступно в воскресенье, 12:00–22:00')+'</button></section>';
};
var partnerClaimBusy=false;
document.addEventListener('click',async function(event){
 var button=event.target.closest('[data-partner-claim]');if(!button||button.disabled||partnerClaimBusy)return;
 event.preventDefault();var claimSection=U.sec;partnerClaimBusy=true;button.disabled=true;
 try{var reply=await NET.request('partner-claim',{});NET.adopt(reply);render();showSec(claimSection==='referrals'?'referrals':'profile');toast('На баланс зачислено '+fmt(reply.result.claimed)+' BU')}catch(error){toast(error.message);var partner=myRef();if(partner){var card=document.getElementById('bu-rfwd');if(card){var template=document.createElement('template');template.innerHTML=refWd(partner);card.replaceWith(template.content.firstElementChild)}}}finally{partnerClaimBusy=false}
});
