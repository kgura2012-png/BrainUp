// The form previews the existing server-owned Stars rate; codes use the existing redemption action.
function topupReferenceTabs(){return '<div class="tp-tabs topup-reference-tabs" role="group" aria-label="Способ пополнения">'+[['stars','Звёзды'],['items','Брейнроты']].map(function(tab){return '<button type="button" data-tp2="tab" data-v="'+tab[0]+'" class="'+(TP.tab===tab[0]?'on':'')+'" aria-pressed="'+(TP.tab===tab[0])+'">'+tab[1]+(topupMethodClosed(tab[0])?'<small>Временно закрыто</small>':'')+'</button>'}).join('')+'</div>'}
simulationTopupTabs=topupReferenceTabs;
function starsCreditPreview(value){var amount=Number(value);return Number.isSafeInteger(amount)&&amount>=1&&amount<=10000?amount*125/100:0}
var pageBeforeStarsDonation=tpPage;
tpPage=function(){
 if(TP.tab==='gears'){TP.tab='items';TP.sel={}}
 if(TP.tab!=='stars'||topupMethodClosed('stars'))return pageBeforeStarsDonation.apply(this,arguments).replace('class="tp-wrap"','class="tp-wrap topup-reference"').replace(/(<h3 class="bu-mt">)[^<]*(<\/h3>)/,'$1Пополнение$2');
 var amount=Number.isSafeInteger(Number(TP.stars))?Number(TP.stars):1;
 return '<div class="tp-wrap topup-reference stars-payment-form"><h3 class="bu-mt">Пополнение</h3>'+topupReferenceTabs()
  +'<label class="topup-field-label" for="tp-st">Сколько звёзд</label><input id="tp-st" type="number" inputmode="numeric" min="1" max="10000" step="1" autocomplete="off" value="'+esc(amount)+'">'
  +'<label class="topup-field-label" for="topup-code">Промокод или код друга</label><input id="topup-code" type="text" maxlength="20" autocomplete="off" placeholder="Введи код" value="'+esc(TP.promo||'')+'">'
  +'<div class="topup-receive"><span>Получишь</span><div>'+COIN+'<strong id="stars-credit-amount">'+fmt(starsCreditPreview(amount))+'</strong></div></div>'
  +'<button type="button" class="bu-btn bx-go stars-create-invoice" data-tp2="stars">Оплатить звёздами</button><p class="topup-rate">1 ⭐ = 1,25 BU · от 1 ⭐</p></div>';
};
var sumBeforeStarsDonation=tpSum;
tpSum=function(){if(TP.tab!=='stars')return sumBeforeStarsDonation.apply(this,arguments);var credit=$('#stars-credit-amount');if(credit)credit.textContent=fmt(starsCreditPreview(TP.stars))};
document.addEventListener('input',function(event){if(event.target.id==='topup-code')TP.promo=event.target.value});
var submitBeforeStarsDonation=submitTopupRequest,preparingStarsInvoice=false,appliedTopupCodes=new Set();
submitTopupRequest=async function(){
 if(TP.tab!=='stars')return submitBeforeStarsDonation.apply(this,arguments);
 if(preparingStarsInvoice||creatingSupportPayment)return;
 if(NET.busy||!NET.ready)return toast('Дождись завершения текущего действия');
 if(topupMethodClosed('stars'))return toast('Пополнения Stars временно закрыты');
 var amount=Number(TP.stars);if(!Number.isSafeInteger(amount)||amount<1||amount>10000)return toast('Укажите целое число от 1 до 10 000 Stars');
 var code=String(TP.promo||'').trim().toUpperCase(),key=NET.id+'|'+code,button=document.querySelector('[data-tp2="stars"]'),fields=['#tp-st','#topup-code'].map(function(id){return $(id)}).filter(Boolean);
 preparingStarsInvoice=true;if(button)button.disabled=true;fields.forEach(function(input){input.disabled=true});
 try{
  if(code&&String(S.bound||'').toUpperCase()!==code&&!appliedTopupCodes.has(key)){var reply=await NET.request('promo-redeem',{code:code});NET.adopt(reply);appliedTopupCodes.add(key);render()}
  return await startSupportPayment();
 }catch(error){toast(error.message)}finally{preparingStarsInvoice=false;fields.forEach(function(input){input.disabled=false});if(button)button.disabled=creatingSupportPayment}
};
tpSend=submitTopupRequest;
setInterval(restoreSupportPayment,30000);
