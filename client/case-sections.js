var caseSectionBusy=false;
function caseSectionOptions(selected){return caseSectionList(A).map(function(section){return '<option value="'+esc(section.id)+'"'+(section.id===selected?' selected':'')+'>'+esc(section.name)+'</option>'}).join('')}
function caseSectionName(selected){var section=caseSectionList(A).find(function(section){return section.id===selected});return section?section.name:''}
function caseSectionNameInput(id,selected,attributes){
 var name=caseSectionName(selected);
 return '<span class="case-section-picker"><select class="bu-in" data-case-section-choice aria-label="Раздел кейса">'+caseSectionList(A).map(function(section){return '<option value="'+esc(section.name)+'"'+(section.id===selected?' selected':'')+'>'+esc(section.name)+'</option>'}).join('')+'<option value="">＋ Новый раздел…</option></select><input type="text" class="bu-in case-section-name-input"'+(id?' id="'+id+'"':'')+' maxlength="60" autocomplete="off" value="'+esc(name)+'" placeholder="Название нового раздела" aria-label="Название нового раздела" '+(attributes||'')+' hidden></span>';
}
function syncCaseSectionPickers(){document.querySelectorAll('.case-section-picker').forEach(function(picker){var select=picker.querySelector('[data-case-section-choice]'),input=picker.querySelector('input'),known=Array.from(select.options).some(function(option){return option.value&&option.value===input.value});select.value=known?input.value:'';input.hidden=known})}
var casesAdminBeforeSections=casesAdminHtml;
casesAdminHtml=function(){
 var sections=caseSectionList(A),html=casesAdminBeforeSections();
 var manager='<section class="case-section-manager"><h3>Разделы кейсов</h3><p>Добавляй свои названия, меняй порядок и выбирай раздел для каждого кейса. Раздел меняет группировку; цена и условия открытия сохраняются.</p><div class="case-section-create"><input type="text" class="bu-in" aria-label="Название нового раздела" autocomplete="off" id="case-section-new-name" maxlength="60" placeholder="Название нового раздела"><button type="button" data-case-section-add>Добавить раздел</button></div><div class="case-section-list">'+sections.map(function(section,index){var count=A.cases.filter(function(c){return caseSectionFor(c,sections)===section.id}).length;return '<div class="case-section-row"><input type="text" class="bu-in" autocomplete="off" aria-label="Название раздела" maxlength="60" data-case-section-name="'+esc(section.id)+'" value="'+esc(section.name)+'"><span>'+count+' кейс.</span><button type="button" data-case-section-save="'+esc(section.id)+'">Сохранить</button><button type="button" data-case-section-move="'+esc(section.id)+'" data-direction="-1" aria-label="Поднять раздел"'+(index===0?' disabled':'')+'>↑</button><button type="button" data-case-section-move="'+esc(section.id)+'" data-direction="1" aria-label="Опустить раздел"'+(index===sections.length-1?' disabled':'')+'>↓</button>'+(section.id==='other'?'':'<button type="button" class="dg" data-case-section-delete="'+esc(section.id)+'">Удалить</button>')+'</div>'}).join('')+'</div></section>';
 html=html.replace('<input id="a-cfile"','<label class="case-section-field">Раздел'+caseSectionNameInput('a-csection','other')+'<small>Новое название создаст раздел при добавлении кейса</small></label><input id="a-cfile"');
 html=html.replace(/(<button data-a="cdel" data-id="(\d+)">)/g,function(match,button,id){var c=cById(Number(id));return '<div class="case-section-assignment"><label class="case-section-field">Раздел'+caseSectionNameInput('',c?caseSectionFor(c,sections):'other','data-case-section-for="'+id+'"')+'</label><button type="button" data-case-section-assign="'+id+'">Применить раздел</button></div>'+button});
 return manager+html;
};
var caseEditorBeforeSections=caseEditor;
caseEditor=function(id,edit){
 caseEditorBeforeSections.apply(this,arguments);if(!edit||!isOwner())return;
 var c=cById(id),fields=document.querySelector('.case-edit-fields');
 if(c&&isFiftyFiftyCase(c)){var note=document.querySelector('.case-edit-fields+p');if(note)note.textContent='Фиксированный состав: Dragon Canelonni — 36%, Noobini Pizzanini — 64%. Выбери только эти два предмета.'}
 if(c&&fields)fields.insertAdjacentHTML('beforeend','<label>Раздел'+caseSectionNameInput('case-edit-section',caseSectionFor(c,caseSectionList(A)))+'<small>Можно вписать новый раздел</small></label>');
};
function caseSectionsDraft(){
 var draft={image:adm.cimg,fields:{},drops:Array.from(document.querySelectorAll('.a-cd:checked')).map(function(input){return input.value})};
 ['a-cname','a-cprice','a-csection','a-cfrom','a-cto','case-section-new-name'].forEach(function(id){var input=document.getElementById(id);if(input)draft.fields[id]=input.value});return draft;
}
function caseSectionsRefresh(draft){
 admin();if(draft){adm.cimg=draft.image;Object.keys(draft.fields).forEach(function(id){var input=document.getElementById(id);if(input&&(!input.options||Array.from(input.options).some(function(option){return option.value===draft.fields[id]})))input.value=draft.fields[id]});document.querySelectorAll('.a-cd').forEach(function(input){input.checked=draft.drops.includes(input.value)});var preview=document.getElementById('a-cprev');if(preview&&draft.image){preview.src=draft.image;preview.style.display='block'}}syncCaseSectionPickers();renderCases();
}
async function saveCaseSectionAction(action,data,button){
 if(caseSectionBusy||NET.busy||!isOwner())return;var draft=caseSectionsDraft();caseSectionBusy=true;if(button)button.disabled=true;
 try{clearTimeout(catalogTimer);var reply=await NET.request(action,data);NET.adopt(reply);if(action==='admin-case-section-save'&&!data.id){draft.fields['case-section-new-name']='';draft.fields['a-csection']=reply.result.section.name;}caseSectionsRefresh(draft);toast('Разделы сохранены')}catch(error){toast(error.message);if(button)button.disabled=false}finally{caseSectionBusy=false}
}
document.addEventListener('click',function(event){
 var button=event.target.closest('[data-case-section-add],[data-case-section-save],[data-case-section-delete],[data-case-section-move],[data-case-section-assign]');if(!button||button.disabled)return;event.preventDefault();event.stopImmediatePropagation();if(!isOwner()||caseSectionBusy||NET.busy)return;
 if(button.dataset.caseSectionAssign){var field=button.closest('.case-section-assignment').querySelector('[data-case-section-for]'),name=field.value.trim();if(!name){field.focus();return toast('Впиши название раздела')}return saveCaseSectionAction('admin-case-section',{caseId:Number(button.dataset.caseSectionAssign),sectionName:name},button)}
 if(button.hasAttribute('data-case-section-add')){var input=document.getElementById('case-section-new-name'),name=input.value.trim();if(!name){input.focus();return toast('Впиши название раздела')}return saveCaseSectionAction('admin-case-section-save',{name:name},button)}
 if(button.dataset.caseSectionSave){var id=button.dataset.caseSectionSave,row=button.closest('.case-section-row'),name=row.querySelector('[data-case-section-name]').value.trim();if(!name)return toast('Название не может быть пустым');return saveCaseSectionAction('admin-case-section-save',{id:id,name:name},button)}
 if(button.dataset.caseSectionDelete){if(!confirm('Удалить раздел? Его кейсы останутся в разделе «Другие кейсы».'))return;return saveCaseSectionAction('admin-case-section-delete',{id:button.dataset.caseSectionDelete},button)}
 var sections=caseSectionList(A),index=sections.findIndex(function(section){return section.id===button.dataset.caseSectionMove}),target=index+Number(button.dataset.direction);if(index<0||target<0||target>=sections.length)return;var swap=sections[index];sections[index]=sections[target];sections[target]=swap;return saveCaseSectionAction('admin-case-section-order',{ids:sections.map(function(section){return section.id})},button);
},true);
document.addEventListener('change',async function(event){
 var select=event.target;if(select.matches&&select.matches('[data-case-section-choice]')){var input=select.closest('.case-section-picker').querySelector('input');input.value=select.value;input.hidden=!!select.value;if(!select.value)input.focus();return;}if(!select.matches||!select.matches('select[data-case-section-for]'))return;
 if(!isOwner())return;var c=cById(Number(select.dataset.caseSectionFor)),previous=c?caseSectionFor(c,caseSectionList(A)):'other';
 if(caseSectionBusy||NET.busy){select.value=previous;return toast('Дождись завершения текущего действия')}
 select.disabled=true;try{await saveCaseSectionAction('admin-case-section',{caseId:Number(select.dataset.caseSectionFor),sectionId:select.value},select)}finally{if(select.isConnected){select.disabled=false;var current=cById(Number(select.dataset.caseSectionFor));select.value=current?caseSectionFor(current,caseSectionList(A)):previous}}
});
function sectionBonusCaseCard(c){return '<button class="winter-free-case" data-ca="open" data-id="'+Number(c.id)+'"><img src="'+esc(cImg(c))+'" alt=""><span><b>'+esc(c.bonusKey==='nick'?'Кейс за тег':'Кейс за подписку')+'</b><small>'+esc(c.bonusKey==='nick'?'Юзернейм бота в имени Telegram':'Подписка на ТГК и пересланное сообщение')+'</small><small>Бесплатно · каждые 12 часов</small></span><strong>Открыть <i>↗</i></strong></button>'}
winterCatalog=function(){
 var query=winterSearch.trim().toLocaleLowerCase('ru'),sections=caseSectionList(A),list=A.cases.filter(function(c){return (!c.bonus||['sub','nick'].includes(c.bonusKey))&&(!query||c.name.toLocaleLowerCase('ru').includes(query)||cDrops(c).some(function(item){return item.name.toLocaleLowerCase('ru').includes(query)}))});
 if(!list.length)return '<p class="winter-empty">'+(query?'По этому запросу кейсов нет.':'Кейсы скоро появятся.')+'</p>';
 return sections.map(function(section){var cases=list.filter(function(c){return caseSectionFor(c,sections)===section.id}),free=cases.filter(function(c){return c.bonus}),paid=cases.filter(function(c){return !c.bonus});if(!cases.length)return '';return '<section class="winter-case-section" data-case-section="'+esc(section.id)+'"><h2>'+esc(section.name)+'<span>'+cases.length+'</span></h2>'+(free.length?'<div class="winter-free-cases">'+free.map(sectionBonusCaseCard).join('')+'</div>':'')+(paid.length?'<div class="bu-cgrid">'+paid.map(caseCard).join('')+'</div>':'')+'</section>'}).join('');
};
casesPage=function(){return '<div class="bu-cwrap winter-catalog">'+winterHero()+'<div id="winter-case-results">'+winterCatalog()+'</div></div>'};

document.addEventListener('keydown',function(event){
 if(event.key!=='Enter'||event.isComposing||event.repeat)return;
 var input=event.target,button;
 if(input.id==='case-section-new-name')button=input.closest('.case-section-create').querySelector('[data-case-section-add]');
 else if(input.matches&&input.matches('[data-case-section-name]'))button=input.closest('.case-section-row').querySelector('[data-case-section-save]');
 if(button){event.preventDefault();button.click()}
});
