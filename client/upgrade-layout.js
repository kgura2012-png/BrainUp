function fitUpgradeChanceLabel(){
 if(U.busy||!lw||!skins||!root.dataset.labelChance)return;
 var side=skins.clientWidth,inset=side*.045;
 var scale=upgradeChanceLabelScale(Number(root.dataset.labelChance),side,lw.offsetWidth,lw.offsetHeight,inset);
 lw.style.setProperty('--chance-label-scale',String(scale));
}
var ringBeforeChanceLabel=ringUpdate;
ringUpdate=function(c){
 ringBeforeChanceLabel(c);if(U.busy)return;
 if(c==null){delete root.dataset.labelChance;return}
 root.dataset.labelChance=String(c);
 lw.textContent=c.toFixed(2)+'%';
 fitUpgradeChanceLabel();
};
if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitUpgradeChanceLabel).observe(root);
window.addEventListener('resize',fitUpgradeChanceLabel);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitUpgradeChanceLabel);
ringUpdate(chance());
