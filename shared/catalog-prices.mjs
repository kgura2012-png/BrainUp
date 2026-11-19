import {mutationPrice} from './mutations.mjs';
export function withCatalogPrice(item,prices={}){
 const valid=price=>Number.isFinite(price)&&price>=.01&&price<=1e9;
 const price=prices?.[item.id];
 if(valid(price))return Object.assign({},item,{price});
 const basePrice=item.mutation&&prices?.[item.baseId];
 return valid(basePrice)?Object.assign({},item,{price:mutationPrice(basePrice,item.mutation)}):item;
}
