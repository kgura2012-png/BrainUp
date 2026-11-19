var UPGRADE_MUTATIONS={},UPGRADE_CARD_RENDERING=false;
function mutationIcon(key){return '/assets/mutation-icons/'+key+'.png?v='+(typeof MUTATION_ICON_VERSION==='undefined'?'1':MUTATION_ICON_VERSION)}
function mutationDefinition(key){return MUTATION_TYPES.find(function(entry){return entry.id===key})}
function mutationFactorText(key,item,base){var type=mutationDefinition(key),factor=item&&base&&base.price>0?item.price/base.price:type?type.referencePrice/MUTATION_REFERENCE_PRICE:1;return '×'+factor.toLocaleString('ru-RU',{maximumFractionDigits:6})}
function mutationOptions(selected,all){return (all?'<option value="all"'+(selected==='all'?' selected':'')+'>Все мутации</option>':'')+'<option value="default"'+(selected==='default'?' selected':'')+'>Обычные</option>'+MUTATION_TYPES.map(function(type){return '<option value="'+type.id+'"'+(selected===type.id?' selected':'')+'>'+type.name+' · '+mutationFactorText(type.id)+'</option>'}).join('')}
function mutationFamily(baseId){return MUTATION_BASES.find(function(base){return base.id===Number(baseId)})}
var imageBeforeMutations=av;
av=function(item){
 if(!item||!item.mutation)return imageBeforeMutations(item);
 if(typeof A!=='undefined'&&A.imgs&&A.imgs[item.id])return A.imgs[item.id];
 var art=MUTATION_ART[item.id];if(art){var digest=typeof art==='string'?art:art.digest,ext=typeof art==='string'?'png':art.ext||'png';return '/assets/mutations/'+item.id+'.'+ext+'?v='+digest}
 return imageBeforeMutations(I(item.baseId));
};
// A transient source outage must not leave blank cards or change the selected item.
document.addEventListener('error',function(event){
 var img=event.target;if(!img||img.tagName!=='IMG'||img.dataset.mutationFallback)return;
 var match=img.getAttribute('src')?.match(/^\/assets\/mutations\/(\d+)\.(?:png|webp|svg)/),item=match&&I(Number(match[1]));
 if(item?.mutation){img.dataset.mutationFallback='true';img.src=imageBeforeMutations(I(item.baseId));}
},true);
var targetListBeforeMutations=tList;
function chosenUpgradeItem(baseId){var id=UPGRADE_MUTATIONS[baseId],item=id==null?null:I(Number(id));return item&&(item.baseId??item.id)===Number(baseId)?item:null}
tList=function(){return targetListBeforeMutations().filter(function(item){var chosen=chosenUpgradeItem(item.baseId??item.id);return item.mutation?!!chosen&&chosen.id===item.id:!chosen||chosen.id===item.id})};
pick=function(want){
 var list=targetListBeforeMutations(),closest=selectUpgradeTarget(list,want,U.target);
 if(!closest){U.target=null;U.pg.t=1;render();return toast('Нет подходящей цели до выбранного множителя. Измени фильтры.')}
 var baseId=closest.baseId??closest.id;if(closest.mutation)UPGRADE_MUTATIONS[baseId]=closest.id;else delete UPGRADE_MUTATIONS[baseId];
 U.target=closest.id;var index=tList().findIndex(function(item){return item.id===closest.id});U.pg.t=Math.max(1,Math.floor(index/PAGE)+1);render();
 var stake=bet();if(stake>0&&Math.abs(closest.price-want)>.005)toast('Ближайшая доступная цель — ×'+fmt(closest.price/stake));
};
var targetCardBeforeMutations=upgradeTargetCard;
upgradeTargetCard=function(item){
 var html,baseId=item.baseId??item.id,base=mutationFamily(baseId),previous=UPGRADE_CARD_RENDERING;
 try{UPGRADE_CARD_RENDERING=true;html=targetCardBeforeMutations(item)}finally{UPGRADE_CARD_RENDERING=previous}
 if(!base)return html;
 var key=item.mutation||'default',type=mutationDefinition(key),label=(type?type.name:'Обычная')+' — изменить мутацию '+base.name;
 return '<div class="mutation-target-card">'+html+'<button type="button" class="mutation-selector" data-mutation-open="'+baseId+'" aria-haspopup="dialog" aria-label="'+esc(label)+'" title="'+esc(label)+'"'+(U.busy||NET.busy?' disabled':'')+'><img src="'+mutationIcon(key)+'" alt=""></button></div>';
};
function mountUpgradeMutationFilter(){
 var bar=document.getElementById('upgrade-mutation-filter');
 if(bar)bar.remove();
}
var renderBeforeMutations=render;
render=function(){var result=renderBeforeMutations.apply(this,arguments);mountUpgradeMutationFilter();return result};
function showMutationPicker(baseId){
 var family=mutationFamily(baseId),base=I(Number(baseId));if(!family||!base)return;
 var items=[base].concat(MUTATION_TYPES.map(function(type){return I(mutationItemId(base.id,type.id))}).filter(Boolean));
 var stake=bet(),selected=chosenUpgradeItem(base.id)?.id??base.id;
 openModal('<section class="mutation-picker"><header><div><small>Вариации цели</small><h3>'+esc(family.name)+'</h3></div></header><div class="mutation-choice-grid">'+items.map(function(item){var key=item.mutation||'default',type=mutationDefinition(key),chance=targetUpgradeChance(stake,item.price),available=stake<=0||chance!==null;return '<button type="button" class="mutation-choice'+(selected===item.id?' selected':'')+'" data-mutation-pick="'+item.id+'"'+(item.mutation&&!MUTATION_ART[item.id]?' title="Стилизованный вид мутации"':'')+(available?'':' disabled')+'><img class="mutation-choice-art" src="'+esc(av(item))+'" alt="" loading="lazy"><span class="mutation-choice-label"><img src="'+mutationIcon(key)+'" alt="">'+(type?type.name:'Обычный')+'</span><strong>'+COIN+fmt(item.price)+'</strong><small>'+mutationFactorText(key,item,base)+'</small></button>'}).join('')+'</div><p>Множитель × показывает цену мутации относительно обычного брейнрота. Стоимость пересчитывается от текущей базовой цены и округляется до 0,01 BU.</p></section>');
 modal.dataset.view='mutation-picker';
}
document.addEventListener('click',function(event){
 var button=event.target.closest('[data-mutation-open],[data-mutation-pick]');if(!button||button.disabled)return;
 event.preventDefault();event.stopImmediatePropagation();if(U.busy||NET.busy)return;
 if(button.dataset.mutationOpen){showMutationPicker(Number(button.dataset.mutationOpen));return}
 var item=I(Number(button.dataset.mutationPick));if(!item)return;
 if(bet()>0&&targetUpgradeChance(bet(),item.price)===null)return toast('Для этой цели ставка слишком большая');
 var baseId=item.baseId??item.id;if(item.mutation)UPGRADE_MUTATIONS[baseId]=item.id;else delete UPGRADE_MUTATIONS[baseId];
 U.target=item.id;var index=tList().findIndex(function(entry){return entry.id===item.id});U.pg.t=Math.floor(Math.max(0,index)/PAGE)+1;closeModal();render();
},true);

function adminMutationToolbar(scope){return '<div class="admin-mutation-toolbar" data-mutation-scope="'+scope+'"><label>Мутация<select data-admin-mutation-filter>'+mutationOptions('all',true)+'</select></label><input data-admin-mutation-search placeholder="Поиск брейнрота или мутации"><span data-admin-mutation-count></span></div>'}
var casesAdminBeforeMutations=casesAdminHtml;
casesAdminHtml=function(){return casesAdminBeforeMutations().replace('<div class="bu-cklist">',adminMutationToolbar('create')+'<div class="bu-cklist">').replace(/<img /g,'<img loading="lazy" ')};
var adminBeforeMutations=admin;
admin=function(){var result=adminBeforeMutations.apply(this,arguments);document.querySelectorAll('[data-mutation-scope]').forEach(filterAdminMutations);return result};
var caseEditorBeforeMutations=caseEditor;
caseEditor=function(id,edit){caseEditorBeforeMutations.apply(this,arguments);if(!edit)return;var grid=document.querySelector('.case-edit-grid');if(grid){grid.insertAdjacentHTML('beforebegin',adminMutationToolbar('edit'));grid.querySelectorAll('img').forEach(function(img){img.loading='lazy'});filterAdminMutations(grid.previousElementSibling)}};
function filterAdminMutations(toolbar){
 if(!toolbar)return;var editing=toolbar.dataset.mutationScope==='edit',selector=editing?'[data-case-drop]':'.a-cd',root=toolbar.nextElementSibling,key=toolbar.querySelector('[data-admin-mutation-filter]').value,query=toolbar.querySelector('[data-admin-mutation-search]').value.trim().toLocaleLowerCase('ru');
 if(!root)return;var shown=0,selected=0;
 root.querySelectorAll(selector).forEach(function(input){var item=I(Number(input.value)),row=input.closest('label');if(!item||!row)return;var matches=(key==='all'||(key==='default'?!item.mutation:item.mutation===key))&&(!query||item.name.toLocaleLowerCase('ru').includes(query)||String(item.baseName||'').toLocaleLowerCase('ru').includes(query));row.classList.toggle('mutation-filtered-out',!matches);if(matches)shown++;if(input.checked)selected++;});
 var label=toolbar.querySelector('[data-admin-mutation-count]');if(label)label.textContent='Показано: '+shown+' · выбрано: '+selected;
}
document.addEventListener('input',function(event){if(!event.target.matches('[data-admin-mutation-search]'))return;filterAdminMutations(event.target.closest('[data-mutation-scope]'))});
document.addEventListener('change',function(event){
 if(event.target.matches('[data-admin-mutation-filter]'))filterAdminMutations(event.target.closest('[data-mutation-scope]'));
 if(event.target.matches('.a-cd,[data-case-drop]')){var root=event.target.closest('.bu-cklist,.case-edit-grid'),toolbar=root&&root.previousElementSibling;if(toolbar?.matches('[data-mutation-scope]'))filterAdminMutations(toolbar)}
});
// Bulk selection applies to the visible filtered rows; hidden checked rows stay selected.
document.addEventListener('click',function(event){
 var button=event.target.closest('[data-a="call"],[data-a="cnone"],[data-a="crange"]');if(!button||!isOwner())return;
 var root=document.querySelector('.bu-cklist'),toolbar=root&&root.previousElementSibling;if(!toolbar?.matches('[data-mutation-scope="create"]'))return;
 event.preventDefault();event.stopImmediatePropagation();var action=button.dataset.a,from=Number.parseFloat(document.getElementById('a-cfrom')?.value),to=Number.parseFloat(document.getElementById('a-cto')?.value);
 root.querySelectorAll('.a-cd').forEach(function(input){var row=input.closest('label');if(action==='cnone'){input.checked=false;return}if(row.classList.contains('mutation-filtered-out'))return;var price=Number(input.dataset.p);input.checked=action==='call'||((!Number.isFinite(from)||price>=from)&&(!Number.isFinite(to)||price<=to))});filterAdminMutations(toolbar);
},true);
mountUpgradeMutationFilter();
