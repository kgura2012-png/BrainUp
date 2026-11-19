var ADMIN_PRICE_DRAFTS={},ADMIN_PRICE_BUSY=false;
var itemsBeforePriceEditor=itemsHtml;
itemsHtml=function(){
 var html=itemsBeforePriceEditor.apply(this,arguments),item=I(ADMIN_IMAGE_ITEM);if(!item)return html;
 var value=Object.prototype.hasOwnProperty.call(ADMIN_PRICE_DRAFTS,item.id)?ADMIN_PRICE_DRAFTS[item.id]:item.price;
 var controls='<div class="admin-item-pricing"><strong>Цена предмета</strong><label for="admin-item-price">Цена каталога · BU<input id="admin-item-price" type="text" inputmode="decimal" autocomplete="off" value="'+esc(value)+'"></label><p>Магазин, апгрейд, кейсы и стоимость инвентаря используют эту цену. Цены мутаций пересчитываются автоматически. Отдельно заданная цена мутации сохраняется.</p><div class="r"><button type="button" data-admin-item-price-save>Сохранить цену</button><button type="button" data-admin-item-price-reset>Вернуть базовую цену</button></div></div>';
 return html.replace('<label>Новый PNG',controls+'<label>Новый PNG');
};
var refreshGuardBeforePrices=adminRefreshWouldDiscardInput;
adminRefreshWouldDiscardInput=function(){return ADMIN_PRICE_BUSY||Object.keys(ADMIN_PRICE_DRAFTS).length>0||refreshGuardBeforePrices()};
document.addEventListener('input',function(event){if(event.target.id==='admin-item-price')ADMIN_PRICE_DRAFTS[ADMIN_IMAGE_ITEM]=event.target.value});
document.addEventListener('click',async function(event){
 var button=event.target.closest('[data-admin-item-price-save],[data-admin-item-price-reset]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();
 if(!isOwner()||NET.busy||ADMIN_PRICE_BUSY||button.disabled)return;
 var id=ADMIN_IMAGE_ITEM,reset=button.hasAttribute('data-admin-item-price-reset'),price=reset?null:readCasePrice(document.getElementById('admin-item-price').value);
 if(!reset&&(!Number.isFinite(price)||price<.01))return toast('Введите цену от 0,01 до 1 000 000 000 BU, до двух знаков после запятой');
 ADMIN_PRICE_BUSY=true;button.disabled=true;
 try{var reply=await NET.request('admin-item-price',{id:id,price:price});NET.adopt(reply);delete ADMIN_PRICE_DRAFTS[id];render();admin();toast(reset?'Базовая цена восстановлена':'Цена сохранена')}
 catch(error){toast(error.message);button.disabled=false}finally{ADMIN_PRICE_BUSY=false}
},true);
