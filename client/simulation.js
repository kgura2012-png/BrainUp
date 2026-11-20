// Free internal records. No receiving nickname, trade instructions or fulfilment action.
var GEAR_TOPUP_IDS=[19,20,22,24,53,56];
function simulationTopupTabs(){
 return '<div class="tp-tabs simulation-topup-tabs">'+['stars','items','gears'].map(function(type){
  return '<button data-tp2="tab" data-v="'+type+'"'+(TP.tab===type?' class="on"':'')+'><b>'+topupMethodLabel(type)+'</b>'+(topupMethodClosed(type)?'<small>Временно закрыты</small>':'')+'</button>';
 }).join('')+'</div>';
}
tpList=function(){
 var query=TP.q.trim().toLowerCase();
 return C.filter(function(item){
  var gear=GEAR_TOPUP_IDS.includes(Number(item.id)),override=A.tpc&&A.tpc[item.id];
  return (TP.tab==='gears'?gear&&(!override||override.on!==0):!gear&&tpOn(item))&&item.name.toLowerCase().includes(query);
 }).sort(function(a,b){return tpCredit(a)-tpCredit(b)||a.name.localeCompare(b.name)});
};
tpPage=function(){
 if(topupMethodClosed(TP.tab))return '<div class="tp-wrap"><h3 class="bu-mt">Пополнение</h3>'+simulationTopupTabs()+'<p role="status">Этот способ временно закрыт. Попробуйте позже.</p></div>';
 if(TP.tab==='stars')return simulationStarsPage();
 return '<div class="tp-wrap"><h3 class="bu-mt">Начисление токенов</h3>'+simulationTopupTabs()+'<p>Заявка на начисление по каталогу. Предметы используются только внутри приложения. Передавать их кому-либо не нужно.</p><input id="tp-q" placeholder="Поиск по названию" value="'+esc(TP.q)+'"><div class="tp-grid" id="tp-grid"></div><label>Код партнёра<input id="tp-pr" maxlength="20" value="'+esc(TP.promo||'')+'"></label><div id="tp-ph" class="tp-ph"></div><div id="tp-sum"></div><button class="bu-btn" data-tp2="send">Создать заявку</button></div>';
};
submitTopupRequest=async function(){
 if(NET.busy||topupMethodClosed(TP.tab))return toast('Способ временно недоступен');
 var data={type:TP.tab,promo:TP.promo||''};if(TP.tab==='stars'){data.units=Number(TP.stars);if(!Number.isSafeInteger(data.units)||data.units<25||data.units>10000)return toast('Укажите целое число от 25 до 10 000')}else{data.items=Object.keys(TP.sel).map(function(id){return {id:Number(id),q:TP.sel[id]}});if(!data.items.length)return toast('Выберите предметы')}
 try{var reply=await NET.request('simulation-topup',data);NET.adopt(reply);TP.sel={};render();topupStatusDialog(reply.result.topup)}catch(error){toast(error.message)}
};tpSend=submitTopupRequest;
// The partner balance is internal only; it has no payout route.
refWd=function(r){return '<div class="bu-rfc" id="bu-rfwd"><small>Предварительный баланс</small><div class="bu-rfp">'+COIN+'<span>'+fmt(r2(r.pending||0))+'</span></div><p>Начисления за бесплатные операции приглашённых пользователей. Обмен на деньги и внешние предметы недоступен.</p></div>'};
wdDragons=function(){return C.filter(function(item){return ['Dragon Canelonni','Dragon Cannelloni'].includes(item.name)})};
wdOpts=function(it){var g=wdG();if(!g||it.price<g.price)return [];return [g].concat(wdDragons()).filter(function(x){return x.price<=it.price}).map(function(x){var q=Math.min(4,Math.floor((it.price+1e-9)/x.price));return {items:[x],q:q,change:r2(it.price-x.price*q)}})};
var chooseBeforeSimulation=wdPick;wdPick=function(){chooseBeforeSimulation();(BX.wdp||[]).forEach(function(p){var o=p.opts[p.k]||p.opts[0];if(o.items[0].name===WD_G){o.q=Math.min(4,o.q||1);o.change=r2(p.it.price-o.items[0].price*o.q)}})};
var simulationBookingBusy=false,simulationDialogEpoch=0;
var chooseBeforeSimulationSlots=bxWd;
bxWd=async function(list){
 if(NET.busy||U.busy)return;var epoch=++simulationDialogEpoch;
 try{var reply=await NET.request('simulation-slots',{});if(epoch!==simulationDialogEpoch)return;BX.wdp=[];chooseBeforeSimulationSlots(list);if(!BX.wdp||!BX.wdp.length)return;
  var heading=mbox.querySelector('h3');if(heading)heading.textContent='Запись на воскресенье';var info=mbox.querySelector('p');if(info)info.textContent='Время записи указано по Киеву.';
  mbox.querySelectorAll('[data-wd-count]').forEach(function(input){input.max=String(Math.min(4,Number(input.max)));input.value=String(Math.min(4,Number(input.value)));var label=input.parentElement;if(label.firstChild.nodeType===3)label.firstChild.textContent='Количество (макс. '+input.max+')'});
  var button=mbox.querySelector('[data-virtual-withdraw]');if(button){button.removeAttribute('data-virtual-withdraw');button.dataset.simulationBook='yes';button.textContent='Записаться';button.disabled=!reply.result.slots.length;button.insertAdjacentHTML('beforebegin','<label>Никнейм<input id="simulation-nick" maxlength="20" autocomplete="off" value="'+esc(S.me||'')+'"></label><label>Время · '+esc(reply.result.date)+' · Киев<select id="simulation-slot">'+reply.result.slots.map(function(slot){return '<option value="'+slot.at+'">'+slot.time+'–'+new Date(slot.at+300000).toLocaleTimeString('ru-RU',{timeZone:'Europe/Kyiv',hour:'2-digit',minute:'2-digit'})+'</option>'}).join('')+'</select></label>'+(!reply.result.slots.length?'<p>Свободных мест на это воскресенье нет.</p>':''));}wdSum();
 }catch(error){toast(error.message)}
};
bxWdGo=bxWdGo_o=async function(){
 if(simulationBookingBusy||NET.busy)return;var nick=$('#simulation-nick'),slot=$('#simulation-slot');if(!nick||!slot)return;wdPick();
 var plan=(BX.wdp||[]).map(function(p){var o=p.opts[p.k]||p.opts[0];return Object.assign({target:o.items[0].id,q:o.q||1},p.uids?{ids:p.uids}:{uid:p.uid})});simulationBookingBusy=true;
 try{var reply=await NET.request('simulation-book',{nick:nick.value,at:Number(slot.value),plan:plan});NET.adopt(reply);var booking=reply.result.booking;BX.sel={};BX.wdp=[];render();openModal('<h3 class="bu-mt">Вы записаны</h3>'+simulationBookingDates(booking)+'<p>Ник: '+esc(booking.nick)+'</p><p>'+booking.items.map(function(item){return esc(item.name)+' ×'+item.q}).join(', ')+'</p><p>Расчётная сдача: '+fmt(booking.change)+'</p>')}catch(error){toast(error.message)}finally{simulationBookingBusy=false}
};
document.addEventListener('click',function(event){if(!event.target.closest('[data-simulation-book]'))return;event.preventDefault();event.stopImmediatePropagation();bxWdGo()},true);
var queueBeforeSimulation=queueHtml;queueHtml=function(){return (A.simulationBookings||[]).filter(function(x){return x.userId===NET.id&&x.status==='booked'}).map(function(x){return '<section class="bu-queue"><h4>Моя запись</h4>'+simulationBookingDates(x)+'<p>Ник: '+esc(x.nick)+'</p><p>Передача предметов не предусмотрена.</p></section>'}).join('')};
var topupsAdminBeforeSimulation=tqAdminHtml;tqAdminHtml=function(){var template=document.createElement('template');template.innerHTML=topupsAdminBeforeSimulation();template.content.querySelectorAll('section').forEach(function(section){if(!section.querySelector('#support-ledger')&&!section.classList.contains('topups-switch'))section.remove()});return template.innerHTML+'<section class="bu-ac simulation-reviewer-settings"><h4>Ник проверяющего в приложении</h4><p>Показывается в бесплатной заявке после нажатия «Показать ник».</p><div class="r"><input id="simulation-reviewer-nick" maxlength="32" placeholder="Ник проверяющего" value="'+esc(A.simulationReviewerNick||'')+'"><button data-simulation-save-reviewer>Сохранить</button></div></section><section class="bu-ac simulation-topup-list"><h4>Бесплатные начисления</h4><div class="simulation-topup-cards">'+(A.simulationTopups||[]).slice().reverse().map(simulationAdminRow).join('')+'</div></section>'};
wqAdminHtml=function(){return '<section class="bu-ac"><h4>Записи на воскресенье</h4><p>Внутреннее расписание без передачи предметов.</p>'+(A.simulationBookings||[]).map(function(x){return '<p>'+esc(x.date)+' · '+esc(x.time)+' · Киев · '+esc(x.nick)+'</p>'}).join('')+'</section>'};
async function refreshReferralLedger(){
 if(!NET.ready||NET.busy||U.busy||document.hidden||U.sec!=='referrals')return;
 var active=document.activeElement;if(active&&active.matches('input,textarea,select'))return;
 try{var reply=await NET.request('state',{});NET.adopt(reply);if(U.sec==='referrals'){var host=$('#bu-soon');if(host)host.innerHTML=refPage()}}catch(error){}
}
var sectionBeforeReferralRefresh=showSec;showSec=function(id){var result=sectionBeforeReferralRefresh(id);if(id==='referrals')refreshReferralLedger();return result};
setInterval(refreshReferralLedger,10000);

function simulationAdminRow(record){
 var buttons='';if(record.st==='new')buttons='<button data-simulation-show="'+esc(record.id)+'">Показать ник</button>';
 if(record.st==='ready')buttons='<button data-simulation-accept="'+esc(record.id)+'">Принять полностью</button>';
 if(['new','ready'].includes(record.st))buttons+='<button data-simulation-reject="'+esc(record.id)+'">Отклонить</button>';
 return '<div class="tq-row"><b>№'+esc(record.number||record.id.slice(0,8))+' · '+esc(record.nick||'Ник не указан')+'</b><p>'+requestStatusText(record.st)+' · '+fmt(record.total)+' токенов</p><p>'+(record.type==='stars'?esc(record.stars)+' ⭐ × 1,25':(record.type==='gears'?'Гиры · ':'')+record.items.map(function(x){return esc(x.n)+' ×'+x.q}).join(', '))+'</p>'+(record.reviewer?'<p>Ник проверяющего в приложении: '+esc(record.reviewer)+'</p>':'')+'<p>Заявка без передачи предметов.</p>'+(record.st==='ok'?'<p>Начислено партнёру: '+fmt(record.commission)+'</p>':'')+'<div class="tq-a">'+buttons+'</div></div>';
}
var statusBeforeFreeQueue=topupStatusDialog;
topupStatusDialog=function(record){
 if(!record.simulation||!record.free)return toast('Эта заявка больше недоступна');
 TP.activeId=record.id;TP.lastStatus=record.st;try{localStorage.setItem('bu_topup_active:'+NET.id,record.id);localStorage.setItem('bu_topup_seen:'+NET.id+':'+record.id,record.st)}catch(error){}
 var title=record.st==='new'?'Очередь на начисление':record.st==='ready'?'Ник показан':record.st==='ok'?'Заявка принята':record.st==='expired'?'Время ожидания истекло':'Заявка отклонена';
 var body=record.st==='new'?'<p>Место в очереди: <b>'+record.position+'</b></p>':record.st==='ready'?'<p>Дождитесь принятия заявки.</p>':record.st==='ok'?'<p>Начислено '+fmt(record.total)+' токенов.</p>':'<p>Баланс не изменён. Можно создать новую заявку.</p>';
 if(['ready','ok'].includes(record.st)&&record.reviewer)body=simulationReviewerCard(record.reviewer)+body;
 if(['new','ready'].includes(record.st))body+='<p>Осталось: <strong data-topup-countdown="'+esc(record.id)+'">10:00</strong></p>';
 openModal('<h3 class="bu-mt">'+title+' · №'+esc(record.number||record.id.slice(0,8))+'</h3>'+body+'<p>Передавать предметы кому-либо не нужно.</p><button class="bu-btn" data-pa="close">Закрыть</button>');modal.dataset.view='topup-queue';topupCountdown();
};
var bookingQueueBeforeFreeRequests=queueHtml;
queueHtml=function(){var requests=(A.tops||[]).filter(function(x){return x.simulation&&x.free&&x.userId===NET.id}).slice(-10).reverse();return (requests.length?'<section class="bu-queue"><h4>Мои заявки</h4>'+requests.map(function(x){return '<p><button class="bu-btn" data-topup-status="'+esc(x.id)+'">№'+esc(x.number||x.id.slice(0,8))+' · '+requestStatusText(x.st)+'</button></p>'}).join('')+'</section>':'')+bookingQueueBeforeFreeRequests()};
document.addEventListener('click',async function(event){
 var button=event.target.closest('[data-simulation-show],[data-simulation-accept],[data-simulation-reject]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();if(!isOwner()||button.disabled||NET.busy)return;
 var showing=button.hasAttribute('data-simulation-show'),id=button.dataset.simulationShow||button.dataset.simulationAccept||button.dataset.simulationReject;if(button.hasAttribute('data-simulation-accept')&&typeof adminBuffApprovalReady==='function'&&!adminBuffApprovalReady(id))return;button.disabled=true;
 try{var reply=await NET.request(showing?'simulation-show':'simulation-review',{id:id,status:button.hasAttribute('data-simulation-accept')?'ok':'no'});NET.adopt(reply);render();admin();toast(showing?'Ник показан':reply.result.topup.st==='ok'?'Заявка принята':'Заявка отклонена')}catch(error){button.disabled=false;toast(error.message)}
},true);

document.addEventListener('click',async function(event){var button=event.target.closest('[data-simulation-save-reviewer]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();if(!isOwner()||button.disabled||NET.busy)return;var input=$('#simulation-reviewer-nick');if(!input)return;button.disabled=true;try{var reply=await NET.request('simulation-reviewer',{nick:input.value});NET.adopt(reply);admin();toast('Ник проверяющего сохранён')}catch(error){toast(error.message);button.disabled=false}},true);

function simulationPromoCode(){return refNorm(TP.promo||'')}
tpBonus=function(){var partner=A.refs[simulationPromoCode()];return partner&&!partner.disabled?Number(partner.bonus)||0:0};
tpPh=function(){var hint=$('#tp-ph');if(!hint)return;var code=simulationPromoCode(),partner=A.refs[code];hint.className='tp-ph'+(code&&(!partner||partner.disabled)?' bad':'');hint.textContent=!code?'':partner&&!partner.disabled?'Бонус партнёра: +'+fmt(tpBonus())+'%':'Код не найден или отключён'};
function simulationStarsPage(){
 var units=TP.stars===undefined?100:TP.stars;
 return '<div class="tp-wrap stars-payment-form"><h3 class="bu-mt">Stars</h3>'+simulationTopupTabs()+'<p>Расчёт без оплаты. Звёзды не списываются.</p><label class="stars-field-label" for="tp-st">Количество звёзд</label><div class="stars-amount-row"><input id="tp-st" type="number" inputmode="numeric" min="25" max="10000" step="1" value="'+esc(units)+'"><div class="stars-payment-total simulation-stars-total"><small>Токенов на баланс</small><strong>= <span id="simulation-credit-total">'+fmt(tpTotal())+'</span>'+COIN+'</strong></div></div><p class="stars-input-hint">1 ⭐ = 1,25 токена · от 25 до 10 000</p><div class="tp-q stars-presets">'+[25,50,100,250,500,1000].map(function(value){return '<button data-tp2="q" data-v="'+value+'">'+value+' ⭐</button>'}).join('')+'</div><label class="tp-l" for="tp-pr">Код партнёра (необязательно)</label><input id="tp-pr" maxlength="20" placeholder="PROMO" value="'+esc(TP.promo||'')+'"><div id="tp-ph" class="tp-ph"></div><div id="tp-sum"></div><button class="bu-btn bx-go" data-tp2="stars">Создать заявку</button></div>';
}
var summaryBeforeSimulationStars=tpSum;
tpSum=function(){
 if(TP.tab!=='stars'){summaryBeforeSimulationStars();tpPh();return}
 var total=$('#simulation-credit-total');if(total)total.textContent=fmt(tpTotal());var summary=$('#tp-sum');if(summary)summary.innerHTML='<p>База: '+fmt(tpBase())+' токенов'+(tpBonus()?'<br>Бонус '+fmt(tpBonus())+'%: +'+fmt(r2(tpBase()*tpBonus()/100))+' токенов':'')+'</p>';tpPh();
};

function simulationReviewerCard(nick){return '<div class="simulation-reviewer-card" role="group" aria-label="Ник проверяющего"><span>Ник проверяющего в приложении</span><strong>'+esc(nick)+'</strong></div>'}

var profileRecordTab='main',profileBeforeBookingTabs=profilePage;
function simulationBookingDateTime(timestamp){
 if(!Number.isFinite(timestamp)||timestamp<=0)return '';
 return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Kyiv',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(timestamp)+' · Киев';
}
function simulationBookingDates(record){
 var created=simulationBookingDateTime(record.createdAt)||'Не сохранено для старой заявки';
 var scheduled=simulationBookingDateTime(record.at)||[record.date,record.time,'Киев'].filter(Boolean).join(' · ');
 return '<div class="simulation-booking-dates"><p>Заявка создана: <b>'+esc(created)+'</b></p><p>Вывод назначен: <b>'+esc(scheduled)+'</b></p></div>';
}
function simulationBookingStatus(record){return record.status==='cancelled'?'Отменено':record.status==='completed'?'Завершено':'Запланировано'}
function simulationBookingCard(record,owner){
 var booked=record.status==='booked',buttons=booked?'<button class="bu-btn secondary" data-simulation-book-cancel="'+esc(record.id)+'">Отменить запись</button>':'';
 if(owner&&booked){buttons+='<button class="bu-btn" data-simulation-book-complete="'+esc(record.id)+'"'+(Date.now()<record.at+300000?' disabled':'')+'>Завершить запись</button>';}
 var identity='<p>Ник: '+esc(record.nick||record.user||'Не указан')+'</p>';
 if(owner){
  var username=String(record.username||'').replace(/^@+/,'');
  var telegramId=/^tg:([1-9]\d*)$/.exec(record.userId||'');
  identity+='<p>Telegram: '+(/^[a-zA-Z0-9_]{1,32}$/.test(username)?'@'+esc(username):telegramId?'ID '+esc(telegramId[1])+' (без @username)':'@username не указан')+'</p>';
 }
 return '<article class="profile-booking"><h3>Запись на вывод</h3>'+simulationBookingDates(record)+'<p>'+simulationBookingStatus(record)+'</p>'+identity+'<p>'+record.items.map(function(item){return esc(item.name)+' ×'+item.q}).join(', ')+'</p><p>Расчётная сдача: '+fmt(record.change)+'</p><div class="profile-booking-actions">'+buttons+'</div></article>';
}
profilePage=function(){
 if(U.ptab==='ref')return profileBeforeBookingTabs();
 var tabs='<nav class="profile-record-tabs" aria-label="Разделы профиля"><button class="bu-btn'+(profileRecordTab==='main'?'':' secondary')+'" data-profile-record-tab="main">Профиль</button><button class="bu-btn'+(profileRecordTab==='withdrawals'?'':' secondary')+'" data-profile-record-tab="withdrawals">Выводы</button></nav>';
 if(profileRecordTab==='main')return profileBeforeBookingTabs().replace('<div class="brain-profile">','<div class="brain-profile">'+tabs);
 var records=(S.simulationBookings||[]).slice().sort(function(a,b){return a.at-b.at});
 return '<div class="brain-profile">'+tabs+'<section class="profile-box"><h2>Записи на воскресенье</h2><p>Внутреннее расписание без передачи предметов. Время указано по Киеву.</p><div class="profile-bookings">'+(records.length?records.map(function(record){return simulationBookingCard(record,false)}).join(''):'<p>Запланированных записей пока нет.</p>')+'</div></section></div>';
};
wqAdminHtml=function(){var records=(A.simulationBookings||[]).slice().sort(function(a,b){return a.at-b.at});return '<section class="bu-ac" style="grid-column:1/-1"><h4>Записи на воскресенье</h4><p>Внутреннее расписание без передачи предметов. Завершение доступно после окончания пятиминутного времени записи.</p><div class="profile-bookings">'+(records.length?records.map(function(record){return simulationBookingCard(record,true)}).join(''):'<p>Записей пока нет.</p>')+'</div></section>'};
document.addEventListener('click',async function(event){
 var tab=event.target.closest('[data-profile-record-tab]');if(tab){event.preventDefault();event.stopImmediatePropagation();profileRecordTab=tab.dataset.profileRecordTab;showSec('profile');if(profileRecordTab==='withdrawals')refreshBookingRecords();return}
 var button=event.target.closest('[data-simulation-book-cancel],[data-simulation-book-complete]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();if(button.disabled||NET.busy)return;
 var completing=button.hasAttribute('data-simulation-book-complete'),id=button.dataset.simulationBookComplete||button.dataset.simulationBookCancel;button.disabled=true;
 try{var reply=await NET.request(completing?'simulation-book-complete':'simulation-book-cancel',{id:id});NET.adopt(reply);if(ad.classList.contains('on'))admin();if(U.sec==='profile')showSec('profile');toast(completing?'Запись завершена':'Запись отменена')}catch(error){button.disabled=false;toast(error.message)}
},true);

async function refreshBookingRecords(){if(!NET.ready||NET.busy||U.busy||document.hidden||U.sec!=='profile'||profileRecordTab!=='withdrawals')return;try{var reply=await NET.request('state',{});NET.adopt(reply);if(U.sec==='profile'&&profileRecordTab==='withdrawals'){$('#bu-soon').innerHTML=profilePage()}}catch(error){}}
setInterval(refreshBookingRecords,10000);
