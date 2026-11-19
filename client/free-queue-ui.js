// Actual free application UI. No payment, Roblox transfer or trade fulfilment.
var FREE_QUEUE_DRAFT=null,FREE_QUEUE_SUBMITTING=false,FREE_QUEUE_LAST_PHASE={};
function freeQueueNow(){return Date.now()+(TP.clockOffset||0)}
function freeQueueClock(ms){var seconds=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')}
function freeQueuePhase(record,now){if(record.st==='new')return 'waiting';if(record.st==='ready')return now<record.ts+25000?'waiting':'ready';return record.st}
function freeQueueFrame(title,body,actions){return '<section class="test-queue free-request-queue"><header><h3>'+title+'</h3></header>'+body+'<footer id="request-queue-actions">'+actions+'</footer></section>'}
submitTopupRequest=async function(){
 if(FREE_QUEUE_SUBMITTING||NET.busy||topupMethodClosed(TP.tab))return;
 var nick=String(TP.nick||'').trim();if(TP.tab!=='stars'&&(nick.length<3||nick.length>32||/[\u0000-\u001f\u007f]/.test(nick))){toast('Укажи ник в игре: от 3 до 32 символов');var input=document.getElementById('tp-nk');if(input)input.focus();return}
 var data={type:TP.tab,promo:TP.promo||''};if(TP.tab!=='stars')data.nick=nick;
 if(TP.tab==='stars'){data.units=Number(TP.stars);if(!Number.isSafeInteger(data.units)||data.units<25||data.units>10000)return toast('Укажите целое число от 25 до 10 000')}
 else{data.items=Object.keys(TP.sel).map(function(id){return {id:Number(id),q:TP.sel[id]}});if(!data.items.length)return toast('Выберите предметы')}
 FREE_QUEUE_DRAFT=data;
 openModal(freeQueueFrame('Проверка заявки временно недоступна','<div class="test-queue-icon">⌛</div><h4>Сейчас мы не можем обработать твою заявку</h4><p>Встань в очередь. Когда проверяющий освободит место, следующий экран откроется автоматически.</p><small class="free-queue-note">Передача предметов не требуется.</small><div class="test-queue-estimate"><small>ПРИМЕРНОЕ ВРЕМЯ ОЖИДАНИЯ</small><b>~00:25</b></div>','<button data-free-queue="close">Закрыть</button><button class="primary" data-free-queue="join">Встать в очередь</button>'));modal.dataset.view='free-queue-intro';
};tpSend=submitTopupRequest;
function freeQueueRemember(record){TP.activeId=record.id;TP.lastStatus=record.st;try{localStorage.setItem('bu_topup_active:'+NET.id,record.id);localStorage.setItem('bu_topup_seen:'+NET.id+':'+record.id,record.st)}catch(e){}}
function freeQueueBadge(){var badge=document.getElementById('free-queue-badge');if(!badge){badge=document.createElement('button');badge.id='free-queue-badge';badge.dataset.freeQueue='resume';document.body.appendChild(badge)}var record=(A.tops||[]).find(function(r){return r.id===TP.activeId&&r.free&&r.simulation});badge.hidden=!record||!['new','ready'].includes(record.st);if(!badge.hidden)badge.textContent=freeQueuePhase(record,freeQueueNow())==='waiting'?'Твоя заявка в очереди · Открыть':'🔔 Твоя очередь подошла · Открыть'}
topupStatusDialog=function(record){
 if(!record||!record.free||!record.simulation)return toast('Эта заявка недоступна');
 freeQueueRemember(record);var phase=freeQueuePhase(record,freeQueueNow()),body='',actions='',previousPhase=FREE_QUEUE_LAST_PHASE[record.id];FREE_QUEUE_LAST_PHASE[record.id]=phase;if(phase==='ready'&&previousPhase!=='ready')toast('Твоя очередь подошла! Открой бесплатную заявку.');
 if(phase==='waiting'){
  var wait=Math.max(0,record.ts+Math.max(1,record.position||1)*25000-freeQueueNow());
  body='<div class="test-queue-ring"><b data-free-wait>'+freeQueueClock(wait)+'</b></div><h4>Ожидай своей очереди</h4><p>Как только проверяющий вызовет тебя, окно проверки откроется автоматически. Ничего нажимать не нужно.</p><span class="test-queue-search" data-free-search>'+(wait>0?'Ищем свободное место…':'Ожидаем проверяющего…')+'</span><p class="test-queue-position">Ты '+Math.max(1,record.position||1)+'-й в очереди из '+Math.max(1,record.queueCount||1)+'</p><p class="free-queue-player">Ник в заявке: <b>'+esc(record.nick||'Ник не указан')+'</b></p>';
  actions='<button class="danger" data-free-queue="cancel" data-id="'+esc(record.id)+'">Отменить заявку</button><button data-free-queue="close">Свернуть, ожидание продолжится</button>';
 }else if(phase==='ready'){
  var reviewer=record.reviewer||'Проверяющий',nick=record.nick||'Ник не указан';
  body='<label>ПРОВЕРЯЮЩИЙ В ПРИЛОЖЕНИИ</label><div class="test-queue-field">'+esc(reviewer)+'</div><button class="test-queue-copy" data-free-queue="copy-reviewer">Скопировать имя</button><label>ВАШ НИК В ПРИЛОЖЕНИИ</label><div class="test-queue-field">'+esc(nick)+'</div><button class="test-queue-copy" data-free-queue="copy-user">Скопировать ник</button><div class="test-queue-instructions"><b>Проверка бесплатной заявки</b><ol><li>Проверь имя проверяющего и свой ник.</li><li>Проверь состав заявки: '+(record.type==='stars'?esc(record.stars)+' условных Stars':(record.items||[]).map(function(x){return esc(x.n)+' ×'+x.q}).join(', '))+'.</li><li>Оставь заявку открытой или сверни окно. Передавать предметы не нужно.</li><li>После подтверждения администратором внутренние токены появятся на балансе автоматически.</li></ol></div><p class="test-queue-deadline">Время ожидания проверки: <b data-topup-countdown="'+esc(record.id)+'">'+freeQueueClock(record.expiresAt-freeQueueNow())+'</b></p>';
  actions='<button class="danger" data-free-queue="cancel" data-id="'+esc(record.id)+'">Отменить заявку</button><button data-free-queue="close">Свернуть</button>';
 }else{
  body='<div class="test-queue-icon">'+(record.st==='ok'?'✓':'⌛')+'</div><h4>'+(record.st==='ok'?'Заявка принята':record.st==='expired'?'Время ожидания истекло':'Заявка отменена или отклонена')+'</h4><p>'+(record.st==='ok'?'Начислено '+fmt(record.total)+' внутренних токенов.':'Баланс не изменён. Можно создать новую заявку.')+'</p>';
  actions='<button data-free-queue="close">Закрыть</button><button class="primary" data-free-queue="new">Новая заявка</button>';
 }
 openModal(freeQueueFrame(phase==='waiting'?'Ты в очереди':phase==='ready'?'Твоя очередь подошла':'Статус заявки',body,actions));modal.dataset.view='topup-queue';topupCountdown();freeQueueBadge();
};
function freeQueueTick(){var record=(A.tops||[]).find(function(r){return r.id===TP.activeId&&r.free&&r.simulation});if(!record){freeQueueBadge();return}var phase=freeQueuePhase(record,freeQueueNow()),previous=FREE_QUEUE_LAST_PHASE[record.id];if(phase==='ready'&&previous==='waiting'&&!U.busy&&!NET.busy){topupStatusDialog(record)}if(modal.classList.contains('on')&&modal.dataset.view==='topup-queue'){var label=mbox.querySelector('[data-free-wait]');if(label){var wait=Math.max(0,record.ts+Math.max(1,record.position||1)*25000-freeQueueNow());label.textContent=freeQueueClock(wait);var text=mbox.querySelector('[data-free-search]');if(text&&wait<=0)text.textContent='Ожидаем проверяющего…'}}freeQueueBadge()}
document.addEventListener('click',async function(event){var button=event.target.closest('[data-free-queue]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();var action=button.dataset.freeQueue;
 if(action==='close'){closeModal();return}
 if(action==='new'){closeModal();topup();return}
 if(action==='resume'){var record=(A.tops||[]).find(function(r){return r.id===TP.activeId});if(record)topupStatusDialog(record);return}
 if(action==='join'){if(FREE_QUEUE_SUBMITTING||NET.busy||!FREE_QUEUE_DRAFT)return;FREE_QUEUE_SUBMITTING=true;button.disabled=true;try{var reply=await NET.request('simulation-topup',FREE_QUEUE_DRAFT);NET.adopt(reply);TP.sel={};FREE_QUEUE_DRAFT=null;render();var record=reply.result.topup;if(!(A.tops||[]).some(function(r){return r.id===record.id}))(A.tops||=[]).push(record);topupStatusDialog(record)}catch(error){toast(error.message);button.disabled=false}finally{FREE_QUEUE_SUBMITTING=false}return}
 if(action==='cancel'){if(NET.busy)return;button.disabled=true;try{var reply=await NET.request('simulation-cancel',{id:button.dataset.id});NET.adopt(reply);render();topupStatusDialog(reply.result.topup)}catch(error){button.disabled=false;toast(error.message)}return}
 if(action==='copy-reviewer'||action==='copy-user'){var record=(A.tops||[]).find(function(r){return r.id===TP.activeId});if(!record)return;if(action==='copy-user'&&!record.nick)return toast('В этой старой заявке ник не указывался');try{await navigator.clipboard.writeText(action==='copy-reviewer'?record.reviewer||'Проверяющий':record.nick||'Ник не указан');toast('Скопировано')}catch(e){toast('Не удалось скопировать')}}
},true);
setInterval(freeQueueTick,1000);document.addEventListener('visibilitychange',function(){if(!document.hidden)freeQueueTick()});freeQueueBadge();

var topupPageBeforePlayerNick=tpPage;
tpPage=function(){var html=topupPageBeforePlayerNick.apply(this,arguments);if(TP.tab==='stars'||topupMethodClosed(TP.tab))return html;return html.replace('</h3>','</h3><section class="topup-player-card"><label for="tp-nk">Ник в игре</label><input id="tp-nk" class="bu-in" type="text" maxlength="32" minlength="3" autocomplete="off" spellcheck="false" placeholder="Укажи ник для этой заявки" value="'+esc(TP.nick||'')+'"><small>Этот ник будет показан в очереди и в заявке.</small></section>')};
document.addEventListener('input',function(event){if(event.target.id==='tp-nk')TP.nick=event.target.value});
