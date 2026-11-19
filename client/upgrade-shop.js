shopCard=function(item){
 return '<button type="button" class="bu-card polished-brainrot-card sh" data-id="'+item.id+'" data-uid="0" style="--tc:'+tier(item.price)[0]+'"><img src="'+esc(av(item))+'" alt=""><span class="brainrot-card-details"><span class="brainrot-name">'+esc(brainrotDisplayName(item))+'</span><span class="brainrot-price">'+COIN+fmt(shopPrice(item))+'</span></span>'+brainrotMutationBadge(item)+'<span class="h">Купить</span></button>';
};
var inventoryShopTab=document.getElementById('bu-tinv'),purchaseShopTab=document.getElementById('bu-tshop');
if(inventoryShopTab){inventoryShopTab.textContent='Инвентарь';inventoryShopTab.title='Инвентарь'}
if(purchaseShopTab){purchaseShopTab.hidden=false;purchaseShopTab.disabled=false;purchaseShopTab.removeAttribute('aria-hidden');purchaseShopTab.tabIndex=0;purchaseShopTab.textContent='Магазин';purchaseShopTab.title='Магазин · наценка +7%'}
