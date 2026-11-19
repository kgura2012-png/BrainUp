var ADMIN_TOPUP_TAB='uah',ADMIN_BRAIN_VIEW='requests',ADMIN_WORKSPACE_BUSY=false;
function adminTopupTabs(){return '<nav class="admin-payment-tabs" aria-label="Способы пополнения">'+[['uah','Гривны'],['items','Брейнроты'],['gears','Gears'],['stars','Звёзды']].map(function(tab){return '<button type="button" data-admin-payment-tab="'+tab[0]+'" aria-pressed="'+(ADMIN_TOPUP_TAB===tab[0])+'" class="'+(ADMIN_TOPUP_TAB===tab[0]?'on':'')+'">'+tab[1]+'</button>'}).join('')+'</nav>'}
tqAdminHtml=function(){
 var tabs=adminTopupTabs();
 if(ADMIN_TOPUP_TAB==='stars')return tabs+'<section class="bu-ac">'+topupMethodSwitch('stars','Звёзды · 1 ⭐ = 1,25 BU')+'<h4>Подтверждённые оплаты Stars</h4><div id="support-ledger">Загрузка оплат…</div></section>';
 if(['items','gears'].includes(ADMIN_TOPUP_TAB)){
  var gear=ADMIN_TOPUP_TAB==='gears';
  var switcher='<div class="admin-brain-tabs"><button data-admin-brain-view="requests" class="'+(ADMIN_BRAIN_VIEW==='requests'?'on':'')+'">Заявки</button><button data-admin-brain-view="settings" class="'+(ADMIN_BRAIN_VIEW==='settings'?'on':'')+'">Настройки каталога</button></div>';
  if(ADMIN_BRAIN_VIEW==='settings')return tabs+switcher+tbHtml();
  return tabs+switcher+'<section class="bu-ac">'+topupMethodSwitch(gear?'gears':'items',gear?'Gears':'Брейнроты')+'<h4>Ник проверяющего</h4><div class="r"><input id="simulation-reviewer-nick" maxlength="32" value="'+esc(A.simulationReviewerNick||'')+'" placeholder="Ник проверяющего"><button data-simulation-save-reviewer>Сохранить</button></div></section><section class="bu-ac"><h4>Заявки по '+(gear?'Gears':'брейнротам')+'</h4>'+((A.simulationTopups||[]).filter(function(r){return r.type===(gear?'gears':'items')}).slice().reverse().map(simulationAdminRow).join('')||'<p>Заявок пока нет.</p>')+'</section>';
 }
 return tabs+'<section class="bu-ac">'+topupMethodSwitch('uah','Гривны · 1 грн = 1,25 BU')+'<h4>Карта для пополнения</h4><label for="admin-uah-card">Номер карты</label><div class="r"><input id="admin-uah-card" inputmode="numeric" autocomplete="off" maxlength="23" placeholder="0000 0000 0000 0000" value="'+esc(A.uahCard||'')+'"><button data-uah-admin="save-card">Сохранить карту</button></div><p>Игрок увидит карту после «Показать карту» в его заявке.</p></section><section class="bu-ac"><h4>Заявки в гривнах</h4>'+((A.uahTopups||[]).slice().reverse().map(uahAdminRow).join('')||'<p>Заявок пока нет.</p>')+'</section>';
};
if(typeof tbItems==='function'){var adminTopupItemsBeforeGears=tbItems;tbItems=function(){return adminTopupItemsBeforeGears().filter(function(item){return GEAR_TOPUP_IDS.includes(item.id)===(ADMIN_TOPUP_TAB==='gears')})};}
function archivePartnersMarkup(){var rows=Object.values(A.retiredPartners||{});return rows.length?'<section class="bu-ac archived-partners"><details><summary>Архив удалённых партнёров · '+rows.length+'</summary>'+rows.map(function(p){return '<div class="li"><span><b>'+esc(p.code)+'</b> · '+esc(p.owner)+'<small>Баланс на момент удаления: '+fmt(p.pending||0)+' BU</small></span></div>'}).join('')+'</details></section>':''}
var refsBeforeArchive=refsAdminHtml;refsAdminHtml=function(){return refsBeforeArchive.apply(this,arguments)+archivePartnersMarkup()};
var adminBeforeWorkspace=admin;
admin=function(){var result=adminBeforeWorkspace.apply(this,arguments);if(!isOwner())return result;var content=ad.querySelector('.bu-acont');if(!content)return result;content.dataset.adminTab=U.atab||'main';if(!['tops','wds','cases'].includes(U.atab))content.insertAdjacentHTML('beforeend','<section class="bu-ac admin-feed-tools"><h4>Лайв-дроп</h4><p>Очистить общую ленту и топ дня. Инвентари, балансы и личная история сохранятся.</p><button type="button" data-admin-clear-feed>Очистить лайв-дроп</button></section>');return result};
var refreshGuardBeforeWorkspace=adminRefreshWouldDiscardInput;
adminRefreshWouldDiscardInput=function(){var card=document.getElementById('admin-uah-card'),reviewer=document.getElementById('simulation-reviewer-nick');return refreshGuardBeforeWorkspace()||!!(card&&card.value.replace(/[\s-]/g,'')!==String(A.uahCard||''))||!!(reviewer&&reviewer.value!==String(A.simulationReviewerNick||''))};
var feedBeforeModeration=NET.feed,FEED_LAST_REVISION=0;
NET.feed=function(reply){var revision=Number(reply.feedRevision)||0;if(revision<FEED_LAST_REVISION)return;FEED_LAST_REVISION=revision;return feedBeforeModeration.apply(this,arguments)};
document.addEventListener('click',async function(event){
 var button=event.target.closest('[data-admin-payment-tab],[data-admin-brain-view],[data-admin-clear-feed],[data-a="rdel"]');if(!button||button.disabled)return;event.preventDefault();event.stopImmediatePropagation();if(!isOwner())return;
 if(button.dataset.adminPaymentTab){ADMIN_TOPUP_TAB=button.dataset.adminPaymentTab;U.tqs=['items','gears'].includes(ADMIN_TOPUP_TAB)&&ADMIN_BRAIN_VIEW==='settings'?'items':'req';admin();return}
 if(button.dataset.adminBrainView){ADMIN_BRAIN_VIEW=button.dataset.adminBrainView;U.tqs=ADMIN_BRAIN_VIEW==='settings'?'items':'req';admin();return}
 if(NET.busy||ADMIN_WORKSPACE_BUSY)return toast('Дождись завершения текущего действия');var deleting=button.dataset.a==='rdel';ADMIN_WORKSPACE_BUSY=true;button.disabled=true;
 try{var reply=await NET.request(deleting?'admin-partner-delete':'admin-feed-clear',deleting?{code:button.dataset.n}:{});NET.adopt(reply);if(!deleting){feedSignature='';renderDropFeed()}render();admin();toast(deleting?'Партнёр удалён. История сохранена в архиве.':'Лайв-дроп очищен')}catch(error){button.disabled=false;toast(error.message)}finally{ADMIN_WORKSPACE_BUSY=false}
},true);
function mountHeaderSettings(){var actions=document.querySelector('#bu-head .bu-hr');if(!actions)return;if(!document.getElementById('header-settings')){var button=document.createElement('button');button.id='header-settings';button.type='button';button.setAttribute('aria-label','Настройки');button.title='Настройки';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.6 2.3-2 .9-2.1-.7-2 3.4 1.6 1.7-.2 2.2L2 14.5l2 3.4 2.3-.5 1.8 1.3L9 21h4l.7-2.3 2-1 2.2.6 2-3.4-1.6-1.7.2-2.2L20 9.5l-2-3.4-2.3.5-1.8-1.3L13 3z"/><circle cx="11" cy="12" r="3"/></svg>';actions.prepend(button)}var fullscreen=document.getElementById('miniapp-size-toggle'),avatar=actions.querySelector('.bu-hav');if(fullscreen&&fullscreen.parentNode!==actions)actions.insertBefore(fullscreen,avatar||null)}
document.addEventListener('click',function(event){if(!event.target.closest('#header-settings'))return;event.preventDefault();settings()});
var caseBeforeBackRemoval=cwRender;cwRender=function(){var result=caseBeforeBackRemoval.apply(this,arguments);document.querySelectorAll('.cw-back').forEach(function(button){button.remove()});return result};
mountHeaderSettings();

// This editor schedules internal records only; it never debits or issues items.
var SLOT_BOOKING_DRAFT=null,SLOT_BOOKING_BUSY=false;
wdOpts=function(item){var garama=wdG();if(!garama||item.price<garama.price)return [];return [garama].concat(wdDragons()).filter(function(target){return !target.mutation&&(target.name==='Garama and Madundung'||/^Dragon (?:Canelonni|Cannelloni)$/.test(target.name))&&target.price<=item.price}).map(function(target){var q=Math.min(4,Math.floor((item.price+1e-9)/target.price));return {items:[target],q:q,change:r2(item.price-target.price*q)}})};
function slotBookingPlan(){return (SLOT_BOOKING_DRAFT?.groups||[]).map(function(group){var option=group.options[group.choice],target=option.items[0],max=Math.min(4,Math.floor((group.value+1e-9)/target.price)),q=Math.max(1,Math.min(max,Number(group.q)||1));return {ids:group.ids,target:target.id,q:q}})}
function slotBookingSummary(){if(!SLOT_BOOKING_DRAFT)return;var total=0,count=0;slotBookingPlan().forEach(function(entry,index){total+=SLOT_BOOKING_DRAFT.groups[index].value-I(entry.target).price*entry.q;count+=entry.q});var sum=document.getElementById('slot-booking-summary');if(sum)sum.innerHTML='<span>В расчёте: '+count+' шт.</span><strong>Расчётная сдача: '+fmt(r2(total))+' BU</strong>'}
function slotBookingRow(group,index){var option=group.options[group.choice],target=option.items[0],max=Math.min(4,Math.floor((group.value+1e-9)/target.price));return '<article class="slot-booking-row"><header><img src="'+esc(av(group.item))+'" alt=""><span>'+esc(group.item.name)+'<small>'+group.ids.length+' шт. · '+fmt(group.value)+' BU</small></span></header><div class="slot-replacement-options">'+group.options.map(function(entry,k){var item=entry.items[0],q=k===group.choice?group.q:entry.q,change=r2(group.value-item.price*q);return '<label class="slot-replacement-option'+(k===group.choice?' selected':'')+'"><input type="radio" name="slot-target-'+index+'" value="'+k+'" data-slot-booking-target="'+index+'"'+(k===group.choice?' checked':'')+'><img src="'+esc(av(item))+'" alt=""><span><b>'+esc(item.name)+' ×'+q+'</b><small>Расчётная сдача '+fmt(change)+' BU</small></span><i aria-hidden="true"></i></label>'}).join('')+'</div><label class="slot-quantity-label">Количество · до '+max+'<input type="number" inputmode="numeric" min="1" max="'+max+'" step="1" value="'+group.q+'" data-slot-booking-quantity="'+index+'"></label></article>'}
function slotBookingLayout(reply){var draft=SLOT_BOOKING_DRAFT,total=draft.groups.reduce(function(sum,group){return sum+group.value},0),count=draft.groups.reduce(function(sum,group){return sum+group.ids.length},0);return '<section class="slot-booking slot-exchange"><h3 class="bu-mt">Запись на воскресенье</h3><p class="slot-exchange-note">Внутренняя запись и расчёт замены. Инвентарь и баланс не изменяются; передача предметов не предусмотрена.</p><div class="slot-exchange-layout"><div class="slot-exchange-main"><label for="slot-booking-nick">Ник в игре<input id="slot-booking-nick" maxlength="20" autocomplete="off" value="'+esc(S.rnick||'')+'" placeholder="Твой ник"></label><div class="slot-source-title"><h4>Выбранные брейнроты</h4><span>'+count+' шт. · '+fmt(total)+' BU</span></div><div class="slot-source-grid">'+draft.groups.map(function(group){return '<article class="slot-source-card"><img src="'+esc(av(group.item))+'" alt=""><b>'+esc(group.item.name)+'</b><span>'+fmt(group.value)+' BU · '+group.ids.length+' шт.</span></article>'}).join('')+'</div></div><aside class="slot-exchange-side"><h4>Выбери замену для расчёта</h4><div class="slot-booking-items">'+draft.groups.map(slotBookingRow).join('')+'</div><div id="slot-booking-summary"></div><label for="slot-booking-time">Суббота · '+esc(reply.result.date)+' · Киев<select id="slot-booking-time">'+reply.result.slots.map(function(slot){return '<option value="'+slot.at+'">'+slot.time+'–'+new Date(slot.at+300000).toLocaleTimeString('ru-RU',{timeZone:'Europe/Kyiv',hour:'2-digit',minute:'2-digit'})+'</option>'}).join('')+'</select></label><small class="slot-window-note">Окна каждые 5 минут, 12:00–20:00.</small><button type="button" class="bu-btn" data-slot-book-create'+(reply.result.slots.length?'':' disabled')+'>Записаться</button>'+(!reply.result.slots.length?'<p>На эту субботу свободных окон нет.</p>':'')+'</aside></div></section>'}

bxWd=async function(list){
 if(NET.busy||U.busy)return;var groups=new Map();(list||[]).filter(function(entry){return !entry.sh}).forEach(function(entry){(entry.uids||[entry.uid]).forEach(function(uid){var inv=S.inv.find(function(owned){return owned.uid===uid}),item=inv&&I(inv.id);if(!inv||inv.sh||!item||!wdG()||item.price<wdG().price)return;var group=groups.get(item.id);if(!group){group={item:item,ids:[],value:0,choice:0};groups.set(item.id,group)}group.ids.push(uid);group.value=r2(group.value+item.price)})});
 if(!groups.size)return toast('Нет подходящих предметов для внутренней записи');var epoch=++simulationDialogEpoch;openModal('<h3 class="bu-mt">Внутренняя запись</h3><p>Загружаем свободные окна…</p>');modal.dataset.view='booking-loading';
 try{var reply=await NET.request('simulation-slots',{});if(epoch!==simulationDialogEpoch||!modal.classList.contains('on'))return;SLOT_BOOKING_DRAFT={slots:reply.result.slots,date:reply.result.date,groups:Array.from(groups.values()).map(function(group){group.options=wdOpts({price:group.value});group.q=group.options[0].q;return group})};
 openModal(slotBookingLayout(reply));mbox.style.maxWidth='1080px';modal.dataset.view='booking-slots';slotBookingSummary();
 }catch(error){if(epoch===simulationDialogEpoch)toast(error.message)}
};
var closeBeforeSlotBooking=closeModal;closeModal=function(){if(['booking-loading','booking-slots'].includes(modal.dataset.view)){simulationDialogEpoch++;SLOT_BOOKING_DRAFT=null}return closeBeforeSlotBooking.apply(this,arguments)};
document.addEventListener('change',function(event){var index=event.target.dataset.slotBookingTarget;if(index===undefined||!SLOT_BOOKING_DRAFT)return;var group=SLOT_BOOKING_DRAFT.groups[Number(index)];group.choice=Number(event.target.value);group.q=group.options[group.choice].q;var row=event.target.closest('.slot-booking-row');row.outerHTML=slotBookingRow(group,Number(index));slotBookingSummary()});
document.addEventListener('input',function(event){var index=event.target.dataset.slotBookingQuantity;if(index===undefined||!SLOT_BOOKING_DRAFT)return;var group=SLOT_BOOKING_DRAFT.groups[Number(index)];group.q=Number(event.target.value);var option=event.target.closest('.slot-booking-row').querySelector('.slot-replacement-option.selected');if(option){var target=group.options[group.choice].items[0];option.querySelector('b').textContent=target.name+' ×'+group.q;option.querySelector('small').textContent='Расчётная сдача '+fmt(r2(group.value-target.price*group.q))+' BU'}slotBookingSummary()});
document.addEventListener('click',async function(event){var button=event.target.closest('[data-slot-book-create]');if(!button||button.disabled)return;event.preventDefault();event.stopImmediatePropagation();if(SLOT_BOOKING_BUSY||NET.busy||!SLOT_BOOKING_DRAFT)return;var nickname=document.getElementById('slot-booking-nick').value.trim(),at=Number(document.getElementById('slot-booking-time').value),invalid=SLOT_BOOKING_DRAFT.groups.some(function(group){var target=group.options[group.choice].items[0],max=Math.min(4,Math.floor((group.value+1e-9)/target.price));return !Number.isSafeInteger(group.q)||group.q<1||group.q>max});if(!/^[A-Za-z0-9_]{3,20}$/.test(nickname))return toast('Ник: 3–20 латинских букв, цифр или _');if(invalid)return toast('Выбери целое количество от 1 до 4 в каждой строке');SLOT_BOOKING_BUSY=true;button.disabled=true;
 try{var reply=await NET.request('simulation-book',{nick:nickname,at:at,plan:slotBookingPlan()});NET.adopt(reply);S.rnick=nickname;BX.sel={};render();var record=reply.result.booking;SLOT_BOOKING_DRAFT=null;openModal('<h3 class="bu-mt">Внутренняя запись создана</h3>'+simulationBookingDates(record)+'<p>Ник: '+esc(record.nick)+'</p><p>'+record.items.map(function(item){return esc(item.name)+' ×'+item.q}).join(', ')+'</p><p>Расчётная сдача: '+fmt(record.change)+' BU.</p><p>Инвентарь и баланс не изменены. Передача предметов не предусмотрена.</p>')}catch(error){toast(error.message);button.disabled=false}finally{SLOT_BOOKING_BUSY=false}
},true);

var adminTopupItemsBeforeNormalOnly=tbItems;tbItems=function(){return adminTopupItemsBeforeNormalOnly.apply(this,arguments).filter(function(item){return !item.mutation})};

// Keep search and inventory tools alongside the existing player balance controls.
var adminPlayerSearch = '';
var adminInventory = {userId: '', data: null, error: '', saving: false};

function adminPlayerKey(value) {
  return String(value || '').trim().replace(/^@/, '').normalize('NFKC').toLocaleLowerCase('ru');
}

function filterAdminPlayerRows(list) {
  var query = adminPlayerKey(adminPlayerSearch);
  var players = new Map(NET.players.map(function (player) { return [player.id, player]; }));
  var visible = 0;
  list.querySelectorAll('.net-player-row').forEach(function (row) {
    var player = players.get(row.dataset.inventoryPlayer);
    if (!player) return;
    var match = !query || [player.name, player.telegramName, player.username, player.id].some(function (value) {
      return adminPlayerKey(value).includes(query);
    });
    if (match) {
      row.style.removeProperty('display');
      visible++;
    } else {
      row.style.setProperty('display', 'none', 'important');
    }
  });
  list.querySelector('[data-admin-player-count]').textContent = visible
    ? 'Найдено: ' + visible
    : 'Игроки не найдены';
}

function renderAdminInventory(list) {
  list.querySelectorAll('[data-admin-inventory-panel]').forEach(function (panel) { panel.remove(); });
  var row = Array.from(list.querySelectorAll('.net-player-row')).find(function (candidate) {
    return candidate.dataset.inventoryPlayer === adminInventory.userId;
  });
  if (!row) return;
  var data = adminInventory.data;
  var panel = document.createElement('div');
  panel.dataset.adminInventoryPanel = '';
  panel.style.gridColumn = '1 / -1';
  panel.innerHTML = '<p><b>Инвентарь</b> <button type="button" data-admin-inventory-close>Закрыть</button></p>';
  if (adminInventory.error) {
    panel.insertAdjacentHTML('beforeend', '<p role="status">' + esc(adminInventory.error) + '</p>');
  } else if (!data) {
    panel.insertAdjacentHTML('beforeend', '<p role="status">Загружаем инвентарь…</p>');
  } else if (!data.total) {
    panel.insertAdjacentHTML('beforeend', '<p>Инвентарь пуст.</p>');
  } else {
    var options = data.groups.map(function (group) {
      return '<option value="' + esc(String(group.id)) + '">' + esc(group.name) + ' · ' + group.count + ' шт.</option>';
    }).join('');
    panel.insertAdjacentHTML('beforeend',
      '<p>Всего предметов: ' + data.total + '</p><div class="r">'
      + '<select aria-label="Предмет" data-admin-inventory-item>' + options + '</select>'
      + '<input aria-label="Количество" data-admin-inventory-quantity type="number" min="1" step="1" value="1" max="' + data.groups[0].count + '">'
      + '<button type="button" data-admin-inventory-remove="quantity">Списать по количеству</button>'
      + '<button type="button" class="dg" data-admin-inventory-remove="all">Списать весь инвентарь</button></div>');
  }
  row.append(panel);
}

function mountAdminPlayerTools() {
  var list = ad.querySelector('.admin-player-list');
  if (!list || !hosted || !NET.admin || !isOwner() || U.atab !== 'players') return;
  var heading = list.querySelector('h4');
  if (heading && !list.querySelector('[data-admin-player-search]')) {
    heading.insertAdjacentHTML('afterend',
      '<div class="r"><input type="search" aria-label="Поиск игрока" data-admin-player-search '
      + 'placeholder="Имя или @username в Telegram" maxlength="256"></div><p role="status" data-admin-player-count></p>');
    list.querySelector('[data-admin-player-search]').value = adminPlayerSearch;
    list.querySelectorAll('.net-player-row').forEach(function (row) {
      var control = row.querySelector('[data-admin-balance][data-user-id]');
      if (!control) return;
      row.dataset.inventoryPlayer = control.dataset.userId;
      control.parentElement.insertAdjacentHTML('beforeend', '<button type="button" data-admin-inventory-open>Инвентарь</button>');
    });
  }
  filterAdminPlayerRows(list);
  renderAdminInventory(list);
}

var adminBeforePlayerTools = admin;
admin = function () {
  var result = adminBeforePlayerTools.apply(this, arguments);
  mountAdminPlayerTools();
  return result;
};

var adminRefreshBeforePlayerTools = adminRefreshWouldDiscardInput;
adminRefreshWouldDiscardInput = function () {
  return adminRefreshBeforePlayerTools.apply(this, arguments)
    || (U.atab === 'players' && !!adminInventory.userId);
};

ad.addEventListener('input', function (event) {
  if (!event.target.matches('[data-admin-player-search]')) return;
  adminPlayerSearch = event.target.value;
  filterAdminPlayerRows(event.target.closest('.admin-player-list'));
});

ad.addEventListener('change', function (event) {
  if (!event.target.matches('[data-admin-inventory-item]') || !adminInventory.data) return;
  var group = adminInventory.data.groups.find(function (entry) { return entry.id === Number(event.target.value); });
  if (!group) return;
  var quantity = event.target.closest('[data-admin-inventory-panel]').querySelector('[data-admin-inventory-quantity]');
  quantity.max = group.count;
  quantity.value = 1;
});

async function loadAdminInventory(userId) {
  adminInventory.userId = userId;
  adminInventory.data = null;
  adminInventory.error = '';
  var list = ad.querySelector('.admin-player-list');
  if (list) renderAdminInventory(list);
  try {
    var reply = await NET.request('admin-inventory-view', {userId:userId});
    if (!reply.ok || !reply.inventory) throw Error(reply.error || 'Не удалось загрузить инвентарь');
    if (adminInventory.userId === userId) adminInventory.data = reply.inventory;
  } catch (error) {
    if (adminInventory.userId === userId) adminInventory.error = error.message;
  }
  list = ad.querySelector('.admin-player-list');
  if (list && adminInventory.userId === userId) renderAdminInventory(list);
}

ad.addEventListener('click', async function (event) {
  var button = event.target.closest('[data-admin-inventory-open],[data-admin-inventory-close],[data-admin-inventory-remove]');
  if (!button || !NET.admin || !isOwner() || adminInventory.saving) return;
  var row = button.closest('[data-inventory-player]');
  var userId = row.dataset.inventoryPlayer;
  if (button.hasAttribute('data-admin-inventory-open')) {
    await loadAdminInventory(userId);
    return;
  }
  if (button.hasAttribute('data-admin-inventory-close')) {
    adminInventory.userId = '';
    renderAdminInventory(row.closest('.admin-player-list'));
    return;
  }
  var data = adminInventory.data;
  if (!data || adminInventory.userId !== userId || NET.busy || U.busy) return;
  var player = NET.players.find(function (entry) { return entry.id === userId; });
  if (!player) return toast('Игрок не найден');
  var mode = button.dataset.adminInventoryRemove;
  var body = {userId:userId, version:data.version, mode:mode};
  var description = 'весь инвентарь (' + data.total + ' шт.)';
  if (mode === 'quantity') {
    var itemId = Number(row.querySelector('[data-admin-inventory-item]').value);
    var quantity = Number(row.querySelector('[data-admin-inventory-quantity]').value);
    var group = data.groups.find(function (entry) { return entry.id === itemId; });
    if (!group || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > group.count) {
      return toast('Укажи целое количество из наличия');
    }
    body.itemId = itemId;
    body.quantity = quantity;
    description = group.name + ' × ' + quantity;
  }
  if (!window.confirm('Списать у игрока ' + playerIdentityLabel(player) + ': ' + description + '?')) return;
  adminInventory.saving = true;
  button.disabled = true;
  try {
    var reply = await NET.request('admin-inventory-remove', body);
    NET.adopt(reply);
    render();
    admin();
    toast('Списано предметов: ' + reply.result.removed);
  } catch (error) {
    toast(error.message);
  } finally {
    await loadAdminInventory(userId);
    adminInventory.saving = false;
  }
});
