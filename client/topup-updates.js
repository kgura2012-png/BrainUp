var UAH_AMOUNTS=[10,20,50,100,200,500,1000,2000,5000,10000],TOPUP_MUTATIONS={},TOPUP_BLOCKED_IDS=[25,28,29,33,36],UAH_UI_BUSY=false,UAH_ACTIVE_ID=null,UAH_POLL_BUSY=false;
function uahCreditPreview(value){var amount=Number(value);return Number.isFinite(amount)&&amount>=1&&amount<=1000000&&Math.abs(amount*100-Math.round(amount*100))<1e-6?Math.round(Math.round(amount*100)*1.25)/100:0}
var methodClosedBeforeUah=topupMethodClosed;
topupMethodClosed=function(type){return type==='uah'?!!(A.topupsClosed||A.topupsUahClosed):type==='gears'?!!(A.topupsClosed||A.topupsGearsClosed):methodClosedBeforeUah(type)};
var methodLabelBeforeUah=topupMethodLabel;
topupMethodLabel=function(type){return type==='uah'?'Гривны':methodLabelBeforeUah(type)};
topupReferenceTabs=function(){return '<div class="tp-tabs topup-reference-tabs" role="group" aria-label="Способ пополнения">'+[['stars','Звёзды'],['uah','Гривны'],['items','Брейнроты'],['gears','Gears']].map(function(tab){return '<button type="button" data-tp2="tab" data-v="'+tab[0]+'" class="'+(TP.tab===tab[0]?'on':'')+'" aria-pressed="'+(TP.tab===tab[0])+'">'+tab[1]+(topupMethodClosed(tab[0])?'<small>Временно закрыто</small>':'')+'</button>'}).join('')+'</div>'};
simulationTopupTabs=topupReferenceTabs;
function topupIdentityFields(promoId,withNick){return '<div class="topup-identity-fields'+(withNick?' with-nick':'')+'">'+(withNick?'<label class="topup-field-label" for="tp-nk">Ник в игре<input id="tp-nk" class="bu-in" type="text" maxlength="32" minlength="3" autocomplete="off" placeholder="Твой ник в игре" value="'+esc(TP.nick||'')+'"></label>':'')+'<label class="topup-field-label" for="'+promoId+'">Бонус-код или код друга<input id="'+promoId+'" type="text" maxlength="20" autocomplete="off" placeholder="Введи код" value="'+esc(TP.promo||'')+'"></label></div>'}
var topupPageBeforeRefresh=tpPage;
tpPage=function(){
 if(TP.tab==='stars')return topupPageBeforeRefresh.apply(this,arguments);
 var frame='<div class="tp-wrap topup-reference"><h3 class="bu-mt">Пополнение</h3>'+topupReferenceTabs();
 if(topupMethodClosed(TP.tab))return frame+'<p role="status">Этот способ временно закрыт. Попробуй позже.</p></div>';
 if(TP.tab==='uah'){
  var amount=TP.uah===undefined?10:TP.uah;TP.uah=amount;
  return frame+'<label class="topup-field-label" for="tp-uah">Сумма в гривнах</label><input id="tp-uah" type="number" inputmode="decimal" min="1" max="1000000" step="0.01" autocomplete="off" value="'+esc(amount)+'">'+topupIdentityFields('topup-code',false)+'<div class="topup-receive"><span>Получишь</span><div>'+COIN+'<strong id="uah-credit-amount">'+fmt(uahCreditPreview(amount))+'</strong></div></div><button type="button" class="bu-btn stars-create-invoice" data-uah-action="create"'+(A.uahConfigured?'':' disabled')+'>Создать заявку</button><p class="topup-rate">1 грн = 1,25 BU'+(A.uahConfigured?'':' · способ пока не настроен')+'</p></div>';
 }
 return frame+'<p class="topup-catalog-note">'+(TP.tab==='gears'?'Выбери Gears для заявки на пополнение.':'Выбери обычных брейнротов. Бафы проверит администратор при начислении.')+'</p><input id="tp-q" type="search" placeholder="Поиск по названию" value="'+esc(TP.q||'')+'"><div class="tp-grid" id="tp-grid"></div>'+topupIdentityFields('tp-pr',true)+'<div id="tp-ph" class="tp-ph"></div><div id="tp-sum"></div><button type="button" class="bu-btn stars-create-invoice" data-tp2="send">Создать заявку</button></div>';
};
tpCredit=function(item){var value=Number(A.tpc&&A.tpc[item.id]&&A.tpc[item.id].v);return r2(value>0?value:item.price)};
tpOn=function(item){var setting=A.tpc&&A.tpc[item.id];return !item.mutation&&!TOPUP_BLOCKED_IDS.includes(item.baseId??item.id)&&(GEAR_TOPUP_IDS.includes(item.id)?(!setting||setting.on!==0):(setting&&setting.on===1||tpDefOn(item)&&(!setting||setting.on!==0)))};
function topupChosenVariant(base){return base}
tpList=function(){var query=String(TP.q||'').trim().toLocaleLowerCase('ru');return C.filter(function(item){return !item.mutation&&(TP.tab==='gears'?GEAR_TOPUP_IDS.includes(item.id):!GEAR_TOPUP_IDS.includes(item.id))&&tpOn(item)&&(!query||item.name.toLocaleLowerCase('ru').includes(query))}).sort(function(a,b){return tpCredit(a)-tpCredit(b)||a.name.localeCompare(b.name)})};
tpCard=function(item){var n=TP.sel[item.id]||0;return '<div class="tp-it polished-topup-card'+(n?' on':'')+'" data-tp2="add" data-id="'+item.id+'" style="--tc:'+tier(item.price)[0]+'"><img src="'+esc(av(item))+'" alt="" loading="lazy"><b>'+esc(item.name)+'</b><span class="bx-p">'+COIN+fmt(tpCredit(item))+'</span>'+(n?'<span class="tp-qty">×'+n+'<button type="button" data-tp2="sub" data-id="'+item.id+'" aria-label="Убрать один">−</button></span>':'')+'</div>'};
// Old saved mutation selections are discarded before opening the catalog.
var topupReBeforeNormalOnly=tpRe;tpRe=function(){Object.keys(TP.sel||{}).forEach(function(id){var item=I(Number(id));if(!item||item.mutation||(['items','gears'].includes(TP.tab)&&GEAR_TOPUP_IDS.includes(item.id)!==(TP.tab==='gears')))delete TP.sel[id]});return topupReBeforeNormalOnly.apply(this,arguments)};
var topupSumBeforeUah=tpSum;
tpSum=function(){if(TP.tab==='uah'){var amount=$('#uah-credit-amount');if(amount)amount.textContent=fmt(uahCreditPreview(TP.uah));return}if(TP.tab==='stars')return topupSumBeforeUah.apply(this,arguments);var sum=$('#tp-sum');if(sum)sum.innerHTML='<div class="topup-receive"><span>Получишь</span><div>'+COIN+'<strong>'+fmt(tpTotal())+'</strong></div></div>';tpPh()};
function uahStatusLabel(status){return {new:'Ожидаем администратора',ready:'Реквизиты получены',checking:'Проверяем оплату',ok:'Баланс пополнен',no:'Заявка закрыта',expired:'Время заявки истекло'}[status]||status}
function uahRemember(id){UAH_ACTIVE_ID=id;try{localStorage.setItem('brainup-uah:'+NET.id,id)}catch(error){}}
function uahRequestDialog(record){uahRemember(record.id);var body='<div class="uah-request-summary"><b>'+fmt(record.amount)+' грн</b><span>'+COIN+fmt(record.total)+' BU</span></div><p role="status">'+uahStatusLabel(record.st)+'</p>',actions='';
 if(record.st==='new'){body+='<p>Карта появится здесь после нажатия «Показать карту» администратором.</p>';actions='<button data-uah-action="cancel" data-id="'+esc(record.id)+'">Отменить заявку</button>'}
 if(record.card&&['ready','checking','ok'].includes(record.st)){body+='<label class="topup-field-label">Карта для перевода</label><div class="uah-card-number">'+esc(record.card.replace(/(.{4})/g,'$1 ').trim())+'</div><button data-uah-action="copy-card" data-id="'+esc(record.id)+'">Скопировать номер</button>'}
 if(record.st==='ready'){body+='<p>Переведи ровно '+fmt(record.amount)+' грн на эту карту, затем нажми «Я оплатил».</p>';actions='<button data-uah-action="cancel" data-id="'+esc(record.id)+'">Отменить</button><button class="primary" data-uah-action="paid" data-id="'+esc(record.id)+'">Я оплатил</button>'}
 if(record.st==='checking')body+='<p>Зачисление произойдёт после проверки перевода администратором.</p>';
 if(record.st==='ok')body+='<p>Начислено '+fmt(record.total)+' BU.</p>';
 openModal('<section class="tp-wrap topup-reference uah-request"><h3 class="bu-mt">Заявка №'+esc(record.number)+'</h3>'+body+'<div class="uah-request-actions">'+actions+'<button data-pa="close">Свернуть</button></div></section>');modal.dataset.view='uah-request';uahBadge();
}
function uahBadge(){var active=(A.uahTopups||[]).find(function(r){return r.id===UAH_ACTIVE_ID}),badge=document.getElementById('uah-topup-badge');if(!badge){badge=document.createElement('button');badge.id='uah-topup-badge';badge.dataset.uahAction='resume';document.body.appendChild(badge)}badge.hidden=!active||!['new','ready','checking'].includes(active.st);if(!badge.hidden)badge.textContent='Пополнение '+active.amount+' грн · '+uahStatusLabel(active.st)}
function uahAdoptRecord(reply){NET.adopt(reply);var record=reply.result.topup;A.uahTopups=A.uahTopups||[];if(!A.uahTopups.some(function(r){return r.id===record.id}))A.uahTopups.push(record);render();uahRequestDialog(record)}
document.addEventListener('input',function(event){if(event.target.id==='tp-uah'){TP.uah=Number(event.target.value);tpSum()}});
document.addEventListener('click',async function(event){
 var button=event.target.closest('[data-uah-action]');if(!button||button.disabled)return;event.preventDefault();event.stopImmediatePropagation();var action=button.dataset.uahAction,record=(A.uahTopups||[]).find(function(r){return r.id===(button.dataset.id||UAH_ACTIVE_ID)});
 if(action==='resume'){if(record)uahRequestDialog(record);return}
 if(action==='copy-card'){if(record?.card)try{await navigator.clipboard.writeText(record.card);toast('Номер карты скопирован')}catch(error){toast('Не удалось скопировать номер')}return}
 if(UAH_UI_BUSY||NET.busy)return;UAH_UI_BUSY=true;button.disabled=true;
 try{var data=action==='create'?{amount:Number(TP.uah),promo:TP.promo||''}:{id:button.dataset.id};var reply=await NET.request(action==='create'?'uah-topup':action==='paid'?'uah-paid':'uah-cancel',data);uahAdoptRecord(reply)}catch(error){toast(error.message);button.disabled=false}finally{UAH_UI_BUSY=false}
},true);
async function pollUahTopups(){if(UAH_POLL_BUSY||!NET.ready||NET.busy||U.busy||document.hidden)return;if(!UAH_ACTIVE_ID)try{UAH_ACTIVE_ID=localStorage.getItem('brainup-uah:'+NET.id)}catch(error){}if(!UAH_ACTIVE_ID){var recent=(A.uahTopups||[]).slice().reverse().find(function(r){return ['new','ready','checking'].includes(r.st)});if(recent)uahRemember(recent.id)}if(!UAH_ACTIVE_ID)return;
 var old=(A.uahTopups||[]).find(function(r){return r.id===UAH_ACTIVE_ID});if(old&&!['new','ready','checking'].includes(old.st)&&!TP.uahBalanceNeedsRefresh)return;UAH_POLL_BUSY=true;var epoch=NET.actionEpoch;
 try{var response=await fetch('/api/topups',{cache:'no-store',signal:AbortSignal.timeout(7000)}),data=await response.json();if(!response.ok||!data.ok)return;A.uahTopups=data.uahTopups||[];var current=A.uahTopups.find(function(r){return r.id===UAH_ACTIVE_ID});uahBadge();if(current&&current.st!==old?.st){if(current.st==='ok'){if(!NET.busy&&NET.actionEpoch===epoch){var state=await NET.request('state',{});NET.adopt(state);render()}else TP.uahBalanceNeedsRefresh=true;}if(modal.dataset.view==='uah-request'&&modal.classList.contains('on'))uahRequestDialog(current);else if(current.st==='ready'||current.st==='ok')toast(uahStatusLabel(current.st))}if(TP.uahBalanceNeedsRefresh&&!NET.busy){var snapshot=await NET.request('state',{});NET.adopt(snapshot);TP.uahBalanceNeedsRefresh=false;render()}}
 catch(error){}finally{UAH_POLL_BUSY=false}
}
setInterval(pollUahTopups,5000);document.addEventListener('visibilitychange',function(){if(!document.hidden)pollUahTopups()});
var queueBeforeUah=queueHtml;queueHtml=function(){return (A.uahTopups||[]).length?'<section class="bu-queue"><h4>Пополнения гривнами</h4>'+(A.uahTopups||[]).slice(-10).reverse().map(function(r){return '<button class="bu-btn" data-uah-action="resume" data-id="'+esc(r.id)+'">№'+r.number+' · '+r.amount+' грн · '+uahStatusLabel(r.st)+'</button>'}).join('')+'</section>'+queueBeforeUah():queueBeforeUah()};
