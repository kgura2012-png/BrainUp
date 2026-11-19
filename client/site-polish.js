function brainrotDisplayName(item){return item.mutation?(item.baseName||I(item.baseId)?.name||item.name.split(' · ')[0]):item.name}
function brainrotMutationBadge(item){
 if(!item.mutation)return '';
 var type=mutationDefinition(item.mutation);return '<span class="brainrot-mutation-badge" title="'+esc(type?type.name:item.mutation)+'" aria-label="Мутация: '+esc(type?type.name:item.mutation)+'"><img src="'+mutationIcon(item.mutation)+'" alt=""></span>';
}
var cardBeforeSitePolish=card;
card=function(item,cls,uid,hint){
 var display=item.mutation?Object.assign({},item,{name:brainrotDisplayName(item)}):item;
 var html=cardBeforeSitePolish(display,cls,uid,hint),price='',name='';
 // Keep both labels in one bottom block, outside legacy absolute-position rules.
 html=html.replace(/<span class="p">[\s\S]*?<\/span>/,function(value){price=value.replace('class="p"','class="brainrot-price"');return ''}).replace(/<span class="n">[\s\S]*?<\/span>/,function(value){name=value.replace('class="n"','class="brainrot-name"');return ''});
 return html.replace('class="bu-card ','class="bu-card polished-brainrot-card ').replace('</button>','<span class="brainrot-card-details">'+name+price+'</span>'+((typeof UPGRADE_CARD_RENDERING!=='undefined'&&UPGRADE_CARD_RENDERING)?'':brainrotMutationBadge(item))+'</button>');
};
profileInventoryHtml=function(){
 var items=bxAll().sort(function(a,b){return b.it.price-a.it.price});
 return items.length?items.slice(0,PROFILE.limit).map(function(entry){
  var item=entry.it,color=tier(item.price)[0],name=brainrotDisplayName(item);
  return '<button type="button" class="profile-item polished-profile-card'+(BX.sel[entry.uid]?' selected':'')+'" data-profile-item="'+entry.uid+'" style="--tc:'+color+';--item-accent:rgb('+color+')"><img src="'+esc(av(item))+'" alt="'+esc(name)+'" loading="lazy"><span class="brainrot-card-details"><b class="brainrot-name">'+esc(name)+'</b><span class="brainrot-price">'+COIN+fmt(item.price)+'</span></span>'+brainrotMutationBadge(item)+'</button>';
 }).join(''):'<div class="profile-empty"><p>В инвентаре пока нет брейнротов</p><button class="bu-btn" data-profile-action="cases">Открыть кейсы</button></div>';
};
var topupCardBeforeSitePolish=tpCard;
tpCard=function(item){var display=item.mutation?Object.assign({},item,{name:brainrotDisplayName(item)}):item;var html=topupCardBeforeSitePolish(display);if(html.includes('data-topup-mutation-open'))return html;return html.replace('class="tp-it','class="tp-it polished-topup-card').replace('</div>',brainrotMutationBadge(item)+'</div>')};
var reelItemBeforeSitePolish=riHtml;
riHtml=function(item){var display=item.mutation?Object.assign({},item,{name:brainrotDisplayName(item)}):item;return reelItemBeforeSitePolish(display).replace('class="cw-ri"','class="cw-ri polished-reel-card"').replace('</div>',brainrotMutationBadge(item)+'</div>')};
function polishCaseContents(){
 document.querySelectorAll('.cw-pz').forEach(function(card){var src=card.querySelector('img')?.getAttribute('src')||'',id=src.match(/^\/assets\/mutations\/(\d+)\./)?.[1],item=id&&I(Number(id));if(!item?.mutation)return;var name=card.querySelector('b');if(name)name.textContent=brainrotDisplayName(item);if(!card.querySelector('.brainrot-mutation-badge'))card.insertAdjacentHTML('beforeend',brainrotMutationBadge(item));card.classList.add('polished-case-card')});
}
function caseSpeedIcon(fast){return fast?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m3 5 6 5-6 5zm8 0 6 5-6 5z" fill="currentColor"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h10M5 17h10M6 3c0 4 2 4 4 7-2 3-4 3-4 7m8-14c0 4-2 4-4 7 2 3 4 3 4 7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'}
function caseReferenceControls(c,freeButton){
 return '<div class="case-quantity-segment" role="group" aria-label="Количество кейсов">'+[1,2,3,4,5].map(function(n){return '<button type="button" data-cw="qty" data-n="'+n+'"'+(CW.n===n?' class="on"':'')+'>x'+n+'</button>'}).join('')+'</div><div class="case-speed-segment" role="group" aria-label="Скорость открытия"><button type="button" data-cw="spd" data-v="0"'+(!S.fast?' class="on"':'')+'>'+caseSpeedIcon(false)+'Медленно</button><button type="button" data-cw="spd" data-v="1"'+(S.fast?' class="on"':'')+'>'+caseSpeedIcon(true)+'Пропустить</button></div><button type="button" class="cw-open" id="cw-open" data-cw="open"></button>'+(freeButton||'');
}
var caseControlBeforeSitePolish=cwCtl;
cwCtl=function(){
 CW.n=Math.max(1,Math.min(5,Math.floor(Number(CW.n)||1)));
 var result=caseControlBeforeSitePolish.apply(this,arguments),c=cById(CW.id),button=document.getElementById('cw-open');
 if(button&&c&&!c.bonus)button.disabled=!!CW.busy||r2(c.price*CW.n)>S.balance;
 document.querySelectorAll('#cw-ctl [data-cw="qty"],#cw-ctl [data-cw="spd"]').forEach(function(button){button.setAttribute('aria-pressed',String(button.classList.contains('on')))});
 return result;
};
var caseRenderBeforeSitePolish=cwRender;
cwRender=function(){
 var result=caseRenderBeforeSitePolish.apply(this,arguments),c=cById(CW.id),control=document.getElementById('cw-ctl'),scene=document.querySelector('.winter-case-scene'),title=document.querySelector('#cw-box .cw-title');
 if(c&&control&&!c.bonus){var free=control.querySelector('[data-cw="free"]');control.innerHTML=caseReferenceControls(c,free?free.outerHTML:'');control.classList.add('case-reference-controls');cwCtl()}
 if(scene&&title)scene.before(title);if(scene&&control)scene.after(control);polishCaseContents();return result;
};
document.addEventListener('click',function(event){var button=event.target.closest('#cw-ctl [data-cw="spd"]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();if(CW.busy)return;S.fast=button.dataset.v==='1';save();usfx('click');cwCtl()},true);

render();
