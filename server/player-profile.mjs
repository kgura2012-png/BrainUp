import {withCatalogPrice} from '../shared/catalog-prices.mjs';
export function dropPlayerId(state,drop){
 if(drop?.userId&&state.users[drop.userId])return drop.userId;
 if(!drop?.user)return null;
 const matches=Object.values(state.users).filter(user=>user.me===drop.user);
 return matches.length===1?matches[0].id:null;
}
export function publicPlayerProfile(state,seed,query={}){
 let id=String(query.userId||'');
 if(!id&&query.dropId){const drop=(state.drops||[]).find(drop=>drop.id===query.dropId)||(state.topDrop?.id===query.dropId?state.topDrop:null);id=dropPlayerId(state,drop)||''}
 const user=state.users[id];
 if(!user||user.banned)throw Error('Профиль игрока недоступен');
 const catalog=new Map([...seed.items,...(state.config.custom||[])].map(item=>[item.id,withCatalogPrice(item,state.config.itemPrices)])),grouped=new Map();
 let totalValue=0;
 for(const entry of user.inv){const item=catalog.get(entry.id);if(!item)continue;totalValue+=item.price;const group=grouped.get(item.id)||{id:item.id,name:item.name,price:item.price,qty:0};group.qty++;grouped.set(item.id,group)}
 const inventory=[...grouped.values()].sort((a,b)=>b.price-a.price||a.name.localeCompare(b.name));
 const pages=Math.max(1,Math.ceil(inventory.length/48)),page=Math.max(1,Math.min(pages,Math.floor(Number(query.page)||1)));
 return {id:user.id,name:user.me,stats:{inventoryCount:user.inv.length,inventoryValue:Math.round(totalValue*100)/100,wins:user.win||0,losses:user.lose||0,upgrades:user.upg||0},items:inventory.slice((page-1)*48,page*48),page,pages};
}

export function telegramReferralUrl(username,code){
 if(!/^[A-Za-z0-9_]{5,32}$/.test(username||'')||!/^[A-Z0-9_-]{3,20}$/.test(code||''))throw Error('Реферальная ссылка недоступна');
 return 'https://t.me/'+username+'?start=ref_'+code;
}
