// Odds shown in the catalog use the same weights as authoritative case draws.
var dropsBeforeCaseDistribution=cDrops;
cDrops=function(c){
 var items=dropsBeforeCaseDistribution(c);
 if(!c)return items;
 var configured=c.rewardOdds&&customCaseRewardPool(c,items);
 if(configured)return configured;
 return c.bonus&&['sub','nick'].includes(c.bonusKey)?items:items.map(function(item){
  return Object.assign({},item,{rewardWeight:caseItemWeight(c,item)});
 });
};
// The idle strip is a visual catalog sample, never the source of a winning result.
function freeCasePreviewItems(items,count){
 var coins=items.filter(function(item){return item.rewardKind==='coins'}),prizes=items.filter(function(item){return item.rewardKind!=='coins'}),result=[];
 if(!prizes.length)return items.slice();var prize=0,coin=0;
 for(var i=0;i<count;i++){var useCoin=coins.length&&i%4===0;result.push(useCoin?coins[coin++%coins.length]:prizes[prize++%prizes.length])}
 return result;
}
var renderBeforeCaseDistribution=cwRender;
cwRender=function(){
 var result=renderBeforeCaseDistribution.apply(this,arguments),c=cById(CW.id),box=document.getElementById('cw-box');if(!c||!box)return result;
 var pool=cDrops(c),bonus=c.bonus&&['sub','nick'].includes(c.bonusKey),idle=box.querySelector('.cw-idle'),heading=box.querySelector('.cw-ph');
 if(bonus&&idle){var preview=freeCasePreviewItems(pool,Math.max(16,pool.length*2));idle.innerHTML=preview.concat(preview).map(riHtml).join('')}
 box.querySelectorAll('.case-distribution-note').forEach(function(node){node.remove()});
 if(heading&&bonus){
  var note='Монеты — 91% · предметы — 9%';
  if(c.rewardOdds&&validCaseRewardOdds(c.rewardOdds,pool)){
   var coinWeight=pool.reduce(function(total,item){return total+(item.rewardKind==='coins'?c.rewardOdds[item.id]:0)},0);
   var percent=new Intl.NumberFormat('ru',{maximumFractionDigits:2});
   note='Монеты — '+percent.format(coinWeight/100)+'% · предметы — '+percent.format((CASE_ODDS_TOTAL-coinWeight)/100)+'%';
  }
  heading.insertAdjacentHTML('afterend','<p class="case-distribution-note">'+note+'</p>');
 }
 return result;
};
// Filler cards remain varied during the spin; the winning slot is untouched.
var playBeforeCaseDistribution=cwPlay;
cwPlay=function(c,items,wins){var args=Array.from(arguments);if(c&&c.bonus&&['sub','nick'].includes(c.bonusKey)&&Array.isArray(items))args[1]=items.map(function(item){return Object.assign({},item,{rewardWeight:1})});return playBeforeCaseDistribution.apply(this,args)};
