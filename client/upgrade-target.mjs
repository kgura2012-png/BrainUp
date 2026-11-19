// Quick choices never silently increase the requested target value.
export function selectUpgradeTarget(items,wantedPrice,preferredId=null){
 if(!Number.isFinite(wantedPrice)||wantedPrice<=0)return null;
 const ceiling=Math.floor(wantedPrice*100+1e-7)/100;let best=null;
 for(const item of items){
  if(item.hidden||!Number.isFinite(item.price)||item.price<=0||item.price>ceiling+1e-9)continue;
  if(!best||item.price>best.price+1e-9||(Math.abs(item.price-best.price)<1e-9&&item.id===preferredId))best=item;
 }
 return best;
}
