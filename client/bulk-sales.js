var inventorySaleBusy=false;
function inventorySellAllMarkup(){return '<button type="button" class="bu-btn inventory-sell-all" data-inventory-sell-all'+(!S.inv.length||U.busy||inventorySaleBusy?' disabled':'')+'>Продать всё · '+S.inv.length+'</button>'}
var profileBeforeSellAll=profilePage;
profilePage=function(){return profileBeforeSellAll.apply(this,arguments).replace('<div class="profile-actions">','<div class="profile-actions">'+inventorySellAllMarkup())};
var inventoryPageBeforeSellAll=bxInvPage;
bxInvPage=function(){return inventoryPageBeforeSellAll.apply(this,arguments).replace('<div class="bx-bar">','<div class="bx-bar">'+inventorySellAllMarkup())};
function syncInventorySellAll(){document.querySelectorAll('[data-inventory-sell-all]').forEach(function(button){button.disabled=!S.inv.length||U.busy||inventorySaleBusy||NET.busy;button.textContent='Продать всё · '+S.inv.length})}
var inventoryFillBeforeSellAll=bxInvFill;
bxInvFill=function(){var result=inventoryFillBeforeSellAll.apply(this,arguments);syncInventorySellAll();return result};
document.addEventListener('click',async function(event){
 var button=event.target.closest('[data-inventory-sell-all]');if(!button||button.disabled)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(inventorySaleBusy||U.busy||CW.busy||NET.busy||!NET.ready)return toast('Дождитесь завершения текущего действия');
 if(!S.inv.length)return;inventorySaleBusy=true;syncInventorySellAll();button.setAttribute('aria-busy','true');
 try{var reply=await NET.request('sell-all',{});NET.adopt(reply);BX.sel={};U.sel={};U.bal=0;render();if(U.sec==='profile')showSec('profile');else if(U.sec==='inventory')bxRefresh(true);if(typeof syncCaseSaleButtons==='function')syncCaseSaleButtons();toast('Продано '+reply.result.count+' предметов за '+fmt(reply.result.total)+' BU')}
 catch(error){toast(error.message)}
 finally{inventorySaleBusy=false;button.removeAttribute('aria-busy');syncInventorySellAll()}
},true);
