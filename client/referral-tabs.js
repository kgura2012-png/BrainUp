// Partner dashboard. All balances, referrals and promos come from the server state.
var REFERRALS_UI={tab:'main',type:'coin',amount:'10',max:'10',code:'',caseId:null,busy:false,visibleUsers:30};
var referralPageBeforeTabs=refPage;
function referralTabIcon(name){
 var paths={main:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',stats:'<path d="M4 3v17h17M9 16v-5m5 5V6m5 10V9"/>',users:'<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 5"/>',promos:'<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M2 8h20M12 8v13"/><path d="M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',share:'<path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3"/>'};
 return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||paths.main)+'</svg>';
}
function referralMoney(value){return fmt(r2(Number(value)||0))}
function referralRefresh(){if(!['profile','referrals'].includes(U.sec))return;if(U.sec==='profile')U.ptab='ref';showSec(U.sec==='profile'?'profile':'referrals')}
function referralCatalog(){return (A.cases||[]).filter(function(c){return !c.bonus&&Number(c.price)>0})}
function referralPromoCost(){
 var state=REFERRALS_UI,c=state.type==='case'?referralCatalog().find(function(c){return c.id===state.caseId}):null;
 var cost=state.type==='case'?(c?Number(c.price):0):Number(state.amount),max=Number(state.max);
 return Number.isFinite(cost)&&cost>0&&Number.isSafeInteger(max)&&max>=1&&max<=100000?r2(cost*max):0;
}
function referralMain(partner){
 var link=telegramPartnerLinks[partner.code]||'';
 setTimeout(loadTelegramPartnerLink,0);
 return '<section class="referral-card referral-invite"><h2>Приглашай друзей и получай '+referralMoney(partner.pct)+'%</h2><p class="referral-caption">Процент от разницы между ставками и выплатами рефералов. Баланс может быть отрицательным.</p><label for="bu-referral-telegram">Реферальная ссылка</label><div class="referral-copy-row"><input id="bu-referral-telegram" data-code="'+esc(partner.code)+'" readonly value="'+esc(link)+'" placeholder="Загружаем ссылку на бота…"><button type="button" data-referral-telegram aria-label="Скопировать реферальную ссылку">Скопировать</button></div><label for="referral-partner-code">Партнёрский промокод</label><div class="referral-copy-row"><input id="referral-partner-code" readonly value="'+esc(partner.code)+'"><button type="button" data-ref-action="copy-code" aria-label="Скопировать партнёрский промокод">'+referralTabIcon('copy')+'</button></div></section>'
  +'<section class="referral-card referral-balance-card">'+refWd(partner)+'<div class="referral-transferred"><span>Уже переведено на баланс</span><strong>'+referralMoney(partner.paid)+' '+COIN+'</strong></div><button type="button" class="referral-primary referral-share" data-ref-action="share">'+referralTabIcon('share')+'Отправить ссылку друзьям</button></section>';
}
function referralStats(partner){
 var rows=partner.list||[],values=[['Регистрации',partner.count||rows.length],['Активные пользователи',rows.filter(function(x){return Number(x.vol)>0}).length],['Пополнения рефералов',referralMoney(partner.vol)+' '+COIN],['Баланс партнёра',referralMoney(partner.pending)+' '+COIN],['Переведено на баланс',referralMoney(partner.paid)+' '+COIN],['Общий доход',referralMoney((Number(partner.pending)||0)+(Number(partner.paid)||0))+' '+COIN]];
 return '<h2 class="referral-section-title">Сводка</h2><div class="referral-stats">'+values.map(function(x){return '<article class="referral-stat"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></article>'}).join('')+'</div>';
}
function referralUsers(partner){
 var all=(partner.list||[]).slice().sort(function(a,b){return (b.ts||0)-(a.ts||0)});
 return '<div class="referral-list-heading"><h2 class="referral-section-title">Приглашённые пользователи</h2><span>'+all.length+'</span></div><div class="referral-users">'+(all.slice(0,REFERRALS_UI.visibleUsers).map(function(user){
  var name=String(user.name||'Игрок'),date=user.ts?new Date(user.ts).toLocaleDateString('ru-RU'):'—';
  return '<article class="referral-user"><span class="referral-user-avatar" aria-hidden="true">'+esc(Array.from(name)[0].toUpperCase())+'</span><div class="referral-user-info"><b>'+esc(name)+'</b><small>С '+esc(date)+' · пополнения '+referralMoney(user.vol)+'</small></div><div class="referral-user-earned"><b>'+((Number(user.earned)||0)>0?'+':'')+referralMoney(user.earned)+'</b><small>результат</small></div></article>';
 }).join('')||'<div class="referral-empty">Пока никто не присоединился. Поделись ссылкой на главной вкладке.</div>')+'</div>'+(all.length>REFERRALS_UI.visibleUsers?'<button class="referral-secondary referral-load-more" data-ref-action="more-users">Показать ещё</button>':'');
}
function referralPromoList(partner){
 var codes=Object.keys(S.promos||{}).filter(function(code){var p=S.promos[code];return p.owner===partner.code&&!p.deleted});
 return '<h2 class="referral-section-title referral-promos-title">Мои промокоды</h2><div class="referral-promo-list">'+(codes.map(function(code){
  var p=S.promos[code],used=(p.used||[]).length,c=p.type==='case'?cById(p.caseId):null,finished=used>=p.max;
  return '<article class="referral-promo-row"><div><b>'+esc(code)+'</b><small>'+(p.type==='case'?'Кейс «'+esc(c?c.name:'Недоступен')+'»':referralMoney(p.amount)+' BU')+' · активаций <strong>'+used+'/'+Number(p.max)+'</strong>'+(finished?' · закончился':'')+'</small></div><button type="button" data-ref-action="copy-promo" data-code="'+esc(code)+'" aria-label="Скопировать промокод '+esc(code)+'">'+referralTabIcon('copy')+'</button><button type="button" class="referral-delete" data-ref-action="delete-promo" data-code="'+esc(code)+'" aria-label="Удалить промокод '+esc(code)+'"'+(REFERRALS_UI.busy?' disabled':'')+'>'+referralTabIcon('close')+'</button></article>';
 }).join('')||'<div class="referral-empty">Промокодов пока нет. Создай первый с помощью формы выше.</div>')+'</div>';
}
function referralPromos(partner){
 var state=REFERRALS_UI,chosen=state.caseId?cById(state.caseId):null;
 return '<section class="referral-card referral-promo-create"><h2>Создай свой промокод</h2><p class="referral-caption">Стоимость активаций резервируется с твоего внутреннего баланса. Неиспользованный остаток возвращается при удалении промокода.</p><div class="referral-promo-types" role="group" aria-label="Награда по промокоду"><button type="button" data-ref-promo-type="coin" aria-pressed="'+(state.type==='coin')+'">На токены</button><button type="button" data-ref-promo-type="case" aria-pressed="'+(state.type==='case')+'">На кейс</button></div><form id="referral-promo-form">'
  +(state.type==='coin'?'<label for="referral-promo-amount">Токенов за активацию</label><input id="referral-promo-amount" data-ref-field="amount" type="number" inputmode="decimal" min="0.01" max="10000000" step="0.01" required value="'+esc(state.amount)+'">':'<label>Кейс (бесплатное открытие)</label><button type="button" class="referral-case-select" data-ref-action="choose-case">'+(chosen?'<img src="'+esc(cImg(chosen))+'" alt=""><span>'+esc(chosen.name)+'</span><small>'+referralMoney(chosen.price)+' BU</small>':'<span>Выбери кейс</span>')+'<span aria-hidden="true">⌄</span></button>')
  +'<label for="referral-promo-max">Активаций</label><input id="referral-promo-max" data-ref-field="max" type="number" inputmode="numeric" min="1" max="100000" step="1" required value="'+esc(state.max)+'"><label for="referral-promo-code">Код <small>(можно оставить пустым)</small></label><input id="referral-promo-code" data-ref-field="code" type="text" autocomplete="off" spellcheck="false" maxlength="20" placeholder="MYCODE" value="'+esc(state.code)+'"><div class="referral-promo-summary"><span>Спишется: <b id="referral-promo-cost">'+referralMoney(referralPromoCost())+' '+COIN+'</b></span><small>На балансе: '+referralMoney(S.balance)+' BU</small></div><button type="submit" id="referral-promo-submit" class="referral-primary"'+(state.busy||!referralPromoCost()||referralPromoCost()>Number(S.balance)?' disabled':'')+'>'+(state.busy?'Создаём…':'Создать промокод')+'</button></form></section>'+referralPromoList(partner);
}
refPage=function(){
 var partner=myRef();if(!partner||partner.disabled)return referralPageBeforeTabs.apply(this,arguments);
 var tab=REFERRALS_UI.tab,tabs=[['main','Главная'],['stats','Статистика'],['users','Пользователи'],['promos','Промокоды']];
 if(!tabs.some(function(x){return x[0]===tab}))tab=REFERRALS_UI.tab='main';
 var content=tab==='main'?referralMain(partner):tab==='stats'?referralStats(partner):tab==='users'?referralUsers(partner):referralPromos(partner);
 return '<section class="referrals-ui"><header class="referral-header"><h1>Рефералы</h1><button type="button" class="referral-close" data-rf="back" aria-label="Вернуться в профиль">'+referralTabIcon('close')+'</button></header><nav class="referral-tabs" role="tablist" aria-label="Разделы рефералов">'+tabs.map(function(x){return '<button type="button" role="tab" id="referral-tab-'+x[0]+'" data-ref-tab="'+x[0]+'" aria-selected="'+(x[0]===tab)+'" aria-controls="referral-panel" tabindex="'+(x[0]===tab?'0':'-1')+'">'+referralTabIcon(x[0])+x[1]+'</button>'}).join('')+'</nav><div id="referral-panel" role="tabpanel" aria-labelledby="referral-tab-'+tab+'">'+content+'</div></section>';
};
function referralOpenCasePicker(){
 var list=referralCatalog();
 openModal('<section class="referral-case-picker"><header><h3>Выбери кейс</h3><button type="button" class="referral-close" data-ref-action="close-picker" aria-label="Закрыть выбор кейса">'+referralTabIcon('close')+'</button></header><div class="referral-case-grid">'+(list.map(function(c){return '<button type="button" class="referral-case-option" data-ref-case="'+Number(c.id)+'" aria-pressed="'+(REFERRALS_UI.caseId===c.id)+'"><img src="'+esc(cImg(c))+'" alt="" loading="lazy"><b>'+esc(c.name)+'</b><span>'+referralMoney(c.price)+' '+COIN+'</span></button>'}).join('')||'<p>Доступных кейсов пока нет.</p>')+'</div></section>');
 modal.dataset.view='referral-case-picker';
}
function referralUpdatePromoCost(){
 var cost=referralPromoCost(),label=document.getElementById('referral-promo-cost'),submit=document.getElementById('referral-promo-submit');
 if(label)label.innerHTML=referralMoney(cost)+' '+COIN;
 if(submit)submit.disabled=REFERRALS_UI.busy||!(cost>0)||cost>Number(S.balance);
}
async function referralCopyText(text){try{await navigator.clipboard.writeText(text);toast('Скопировано')}catch(error){toast('Не удалось скопировать. Выдели код и скопируй вручную.')}}
document.addEventListener('click',async function(event){
 var button=event.target.closest('[data-ref-tab],[data-ref-promo-type],[data-ref-action],[data-ref-case]');if(!button||button.disabled)return;
 event.preventDefault();event.stopImmediatePropagation();
 var partner=myRef();if(!partner||partner.disabled)return;
 if(button.dataset.refTab){REFERRALS_UI.tab=button.dataset.refTab;referralRefresh();return}
 if(button.dataset.refPromoType){REFERRALS_UI.type=button.dataset.refPromoType;referralRefresh();return}
 if(button.dataset.refCase){var chosen=referralCatalog().find(function(c){return c.id===Number(button.dataset.refCase)});if(chosen){REFERRALS_UI.caseId=chosen.id;closeModal();referralRefresh()}return}
 var action=button.dataset.refAction;
 if(action==='copy-code')return referralCopyText(partner.code);
 if(action==='copy-promo')return referralCopyText(button.dataset.code);
 if(action==='more-users'){REFERRALS_UI.visibleUsers+=30;referralRefresh();return}
 if(action==='choose-case'){referralOpenCasePicker();return}
 if(action==='close-picker'){closeModal();return}
 if(action==='share'){
  await loadTelegramPartnerLink();var link=telegramPartnerLinks[partner.code];if(!link)return toast('Ссылка пока недоступна. Попробуй ещё раз.');
  var share='https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent('Присоединяйся к BrainUp!'),tg=window.Telegram&&Telegram.WebApp;
  if(tg&&typeof tg.openTelegramLink==='function')tg.openTelegramLink(share);else window.open(share,'_blank','noopener');return;
 }
 if(action==='delete-promo'){
  var code=button.dataset.code,promo=S.promos&&S.promos[code];if(REFERRALS_UI.busy||NET.busy||!promo||promo.owner!==partner.code||promo.deleted)return;
  if(!window.confirm('Удалить промокод '+code+'? Неиспользованные токены вернутся на баланс.'))return;
  REFERRALS_UI.busy=true;button.disabled=true;
  try{var reply=await NET.request('promo-delete',{code:code});NET.adopt(reply);render();toast('Промокод удалён')}catch(error){toast(error.message)}finally{REFERRALS_UI.busy=false;referralRefresh()}
 }
},true);
document.addEventListener('input',function(event){var key=event.target.dataset&&event.target.dataset.refField;if(!['amount','max','code'].includes(key))return;REFERRALS_UI[key]=event.target.value;referralUpdatePromoCost()});
document.addEventListener('submit',async function(event){
 if(event.target.id!=='referral-promo-form')return;event.preventDefault();
 var partner=myRef(),state=REFERRALS_UI;if(!partner||partner.disabled||state.busy||NET.busy||!event.target.reportValidity())return;
 var cost=referralPromoCost();if(!(cost>0))return toast(state.type==='case'?'Выбери кейс':'Укажи сумму и число активаций');if(cost>Number(S.balance))return toast('Недостаточно токенов на балансе');
 var code=String(state.code||'').trim().toUpperCase();
 if(!code){var bytes=crypto.getRandomValues(new Uint8Array(6));code='PROMO-'+Array.from(bytes,function(x){return x.toString(16).padStart(2,'0')}).join('').toUpperCase();state.code=code;var input=document.getElementById('referral-promo-code');if(input)input.value=code}
 if(!/^[A-Z0-9_-]{3,20}$/.test(code))return toast('Код: 3–20 латинских букв, цифр, - или _');
 if(code.startsWith('BU-')||code.startsWith('SNOW-'))return toast('Этот префикс зарезервирован для автопромокодов');
 state.busy=true;referralUpdatePromoCost();
 try{var reply=await NET.request('promo-create',{code:code,max:Number(state.max),amount:state.type==='coin'?Number(state.amount):0,caseId:state.type==='case'?state.caseId:null});NET.adopt(reply);state.code='';render();toast('Промокод создан. Списано '+referralMoney(reply.result.total)+' BU')}catch(error){toast(error.message)}finally{state.busy=false;referralRefresh()}
});
document.addEventListener('keydown',function(event){
 var button=event.target.closest&&event.target.closest('[data-ref-tab]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();var tabs=['main','stats','users','promos'],index=tabs.indexOf(button.dataset.refTab),next=event.key==='Home'?0:event.key==='End'?3:(index+(event.key==='ArrowRight'?1:3))%4;
 REFERRALS_UI.tab=tabs[next];referralRefresh();var target=document.getElementById('referral-tab-'+tabs[next]);if(target)target.focus();
});

// The home tab keeps the Sunday transfer countdown current without re-rendering forms.
setInterval(function(){
 if(U.sec!=='referrals'||REFERRALS_UI.tab!=='main')return;
 var card=document.getElementById('bu-rfwd'),partner=myRef();if(!card||!partner)return;
 var clock=refClock();
 if(card.dataset.open!==(clock.open?'1':'0')){var template=document.createElement('template');template.innerHTML=refWd(partner);card.replaceWith(template.content.firstElementChild);return}
 var countdown=document.getElementById('bu-rfcd');if(countdown)countdown.textContent=refFmt(clock.left);
},1000);
