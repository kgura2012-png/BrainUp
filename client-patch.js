/* Connected mode: server owns all inventory, balances, results and queue numbers. */
var NET={ready:false,busy:false,admin:false,id:'',queue:null,players:[]};
var hosted=/^https?:$/.test(location.protocol);
var SHOP_NOTE='Цена выше стоимости брейнрота на 5%. Купленное нельзя вывести, только отыграть или продать.';
var trNote=function(){return Q3(SHOP_NOTE,'Price is 5% above the brainrot value. Purchases cannot be withdrawn; play or sell them.','Ціна вища за вартість брейнрота на 5%. Куплене не можна вивести, лише відіграти або продати.')};
shopCard=function(it){return '<button class="bu-card sh" data-id="'+it.id+'" data-uid="0" style="--tc:'+tier(it.price)[0]+'"><span class="p"><i class="coin"></i>'+fmt(shopPrice(it))+' <small>+5%</small></span><img src="'+av(it)+'" alt=""><span class="n">'+esc(it.name)+'</span><span class="h">'+Q3('Купить','Buy','Купити')+'</span></button>'};
var baseRender=render;
render=function(){var v=baseRender.apply(this,arguments),e=$('#bu-shop-note');if(!e){e=document.createElement('p');e.id='bu-shop-note';e.className='bu-shop-note';$('#bu-lgrid').before(e)}e.hidden=U.tab!=='shop';e.textContent=trNote();return v};
// Use one weighting function for displayed odds and selection, including preview.
function dropWeight(it){return Math.pow(it.price,-1.8)}
cPick=function(d){var sum=d.reduce(function(s,x){return s+dropWeight(x)},0),r=Math.random()*sum;for(var i=0;i<d.length;i++){r-=dropWeight(d[i]);if(r<=0)return d[i]}return d[d.length-1]};
cwChance=function(it,d){return dropWeight(it)/d.reduce(function(s,x){return s+dropWeight(x)},0)*100};
rGen=function(){return Math.min(1000,Math.max(1,Math.floor(Math.pow(.94/(1-Math.random()),1/1.6)*100)/100))};
// Permanent browser identity also fixes nickname changes in the downloadable preview.
var localPid;try{localPid=localStorage.getItem('bu_identity_v4');if(!localPid){localPid=crypto.randomUUID();localStorage.setItem('bu_identity_v4',localPid)}}catch(e){localPid='preview'}
var oldPkey=pKey;pKey=function(){return NET.id||localPid};
var previousBound=Object.values(S.rb||{})[0];if(previousBound){S.rb=S.rb||{};S.rb[pKey()]=previousBound}
var oldDeleteRef=refAct;
var oldCwRender=cwRender;
cwRender=function(){oldCwRender();var c=cById(CW.id);if(!c)return;var d=cDrops(c),sorted=d.slice().sort(function(a,b){return b.price-a.price});[].forEach.call(CW.el.querySelectorAll('.cw-pz'),function(el,i){var it=sorted[i];if(!it)return;var p=cwChance(it,d),b=document.createElement('em');b.className='bu-odds';b.textContent=(p<.01?p.toFixed(4):p.toFixed(2))+'%';el.appendChild(b)});var n=document.createElement('p');n.className='bu-shop-note';n.textContent=Q3('Шансы указаны для одного открытия. Результат каждого открытия случаен.','Odds are per opening. Every result is random.','Шанси вказані для одного відкриття. Кожен результат випадковий.');$('#cw-box').appendChild(n)};
var oldBxRefresh=bxRefresh;
function queueHtml(){var q=NET.queue;if(!q)return '';var pending=(S.wd||[]).filter(function(w){return w.status==='pending'});return '<section class="bu-queue"><b>'+Q3('Очередь вывода','Withdrawal queue','Черга виведення')+'</b><p>'+Q3('Ближайшее воскресенье','Next Sunday','Найближча неділя')+': '+esc(q.date)+' · '+Q3('Заявок','Requests','Заявок')+': '+q.count+'</p><small>'+Q3('Без лимита мест · время Киева · обработка по очереди','No slot limit · Kyiv time · first come, first served','Без ліміту місць · час Києва · обробка по черзі')+'</small>'+pending.map(function(w){return '<p class="bu-qentry">'+esc(w.date)+' · '+Q3('Место №','Position #','Місце №')+w.position+' · '+esc(w.nick)+'</p>'}).join('')+'</section>'}
bxRefresh=function(){oldBxRefresh.apply(this,arguments);var h=$('#bx-hist');if(h){var q=$('#bu-queue');if(q)q.remove();var e=document.createElement('div');e.id='bu-queue';e.innerHTML=queueHtml();h.before(e)}};
var oldProfilePage=profilePage;
var oldPromoMake=promoMake,oldPromoDel=promoDel;
// Local preview reserves promo funds from spendable balance as well.
promoMake=function(){if(hosted)return NET.promoMake();var p=myRef();if(!p)return;var code=refNorm($('#pr-code').value),max=+$('#pr-max').value,cid=$('#pr-case').value,amount=r2(+$('#pr-amt').value),c=cid?cById(+cid):null;if(!refValid(code)||S.promos[code]||A.refs[code])return toast('This code is already taken');if(!Number.isInteger(max)||max<1||max>100000)return toast('Enter activations count');var cost=c?c.price:amount,total=r2(cost*max);if(!(cost>0)||S.balance<total)return toast('Not enough coins — top up your balance');S.balance=r2(S.balance-total);S.promos[code]={type:c?'case':'coin',amount:c?0:amount,caseId:c?c.id:null,cost:cost,max:max,used:[],owner:p.code};save();render();showSec('profile')};
promoDel=function(code){if(hosted)return NET.promoDel(code);var p=S.promos[code],r=myRef();if(!p||!r||p.owner!==r.code)return;S.balance=r2(S.balance+Math.max(0,p.max-p.used.length)*(p.cost||p.amount||0));delete S.promos[code];save();render();showSec('profile')};
if(hosted){
  // Disable legacy nickname sync and insecure client password fallbacks.
  SV.on=false;ADM_OK=false;ADMIN_PASS='';
  isOwner=function(){return NET.ready&&NET.admin};
  var savedPreferences='';
  save=function(){var prefs={lang:S.lang,device:S.device,streamer:S.streamer,fast:S.fast,sound:S.sound,ui:S.ui,vol:S.vol};try{var encoded=JSON.stringify(prefs);if(encoded!==savedPreferences){localStorage.setItem('bu_preferences_v4',encoded);savedPreferences=encoded}}catch(e){}};
  var catalogTimer;
  saveA=function(){if(NET.ready&&NET.admin){clearTimeout(catalogTimer);catalogTimer=setTimeout(function(){act('admin-catalog',{catalog:{custom:A.custom,cases:A.cases,imgs:A.imgs,tpc:A.tpc,nid:A.nid,cnid:A.cnid,delp:A.delp}})},1200)}return true};
  svCatLater=function(){};svSync=function(){};
  myRef=function(){for(var k in A.refs)if(A.refs[k].userId===NET.id)return A.refs[k];return null};
  boundCode=function(){return S.bound||''};
  tryLink=function(){if(NET.ready&&!S.bound&&S.rlink){var code=S.rlink;S.rlink='';refBind(code)}};
  refBind=function(code){act('ref-bind',{code:code},function(){toast(Q3('Код привязан навсегда','Referral bound permanently','Код прив’язано назавжди'));if(U.sec==='profile')showSec('profile')});return false};
  profilePage=function(){if(U.ptab==='ref')return refPage();var html=oldProfilePage();html=html.replace(/<button\b[^>]*data-pa="logout"[^>]*>[\s\S]*?<\/button>/g,'');html=html.replace(/<div class="bu-tg">[\s\S]*?<\/div>/,'<div class="bu-tg">'+Q3('Аккаунт подключён к серверу','Account connected to server','Акаунт підключено до сервера')+'</div>');return html+queueHtml()};
  applyTg=function(){toast(Q3('Вход выполняется через аккаунт сайта','Use the site account to sign in','Вхід виконується через акаунт сайту'))};
  mountTg=function(){};
  askAdmin=function(){if(NET.admin)openAdmin();else toast(Q3('Доступ только владельцу','Owner access only','Доступ лише власнику'))};adminLogin=askAdmin;
  API.addBalance=function(){return false};API.addItem=function(){return false};API.resolveUpgrade=function(){return false};API.play=function(){return false};
  upgrade=async function(){
    if(U.busy||NET.busy)return;
    var ch=chance();if(ch==null)return;if(bet()/I(U.target).price*100>80+1e-9)return toast('Максимальный шанс апгрейда — 80%');
    var target=I(U.target),d={chance:ch,target:target,items:selItems(),bet:bet(),balanceBet:U.bal};
    var ids=d.items.map(function(x){return x.uid}),coins=U.bal;
    U.busy=true;ctlUpdate(d.bet,d.chance);
    var upgradeButton=document.querySelector('.bu-app .up-button-upgrade');
    upgradeButton.setAttribute('aria-busy','true');upgradeButton.dataset.busyLabel=Q3('Обрабатываем…','Processing…','Обробляємо…');
    function resetUpgrade(){U.sel={};U.bal=0;U.target=null;U.pending=null;S.pend=null;fxClean();}
    try {
      await completeDemoUpgrade({
        request:function(){return requestAction('upgrade',{ids:ids,coins:coins,target:target.id})},
        adopt:adopt,
        animate:function(j,signal){upgradeButton.dataset.busyLabel=Q3('Показываем результат…','Showing result…','Показуємо результат…');return anim(d,j.result.win,null,{snapshot:true,signal:signal})},
        reset:resetUpgrade,
        refresh:async function(){var r=await fetch('/api/action',{cache:'no-store',signal:AbortSignal.timeout(8000)});var j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Ошибка синхронизации');adopt(j)},
        visibility:document,maxAnimationMs:S.fast?3000:8000,
        onAnimationError:function(){toast('Результат сохранён. Анимация пропущена.')}
      });
    } catch(e){toast(e.message)}
    finally{U.busy=false;upgradeButton.removeAttribute('aria-busy');delete upgradeButton.dataset.busyLabel;render();if(typeof bxRefresh==='function')bxRefresh(true)}
  };
  cwGo=async function(free){if(CW.busy||NET.busy||U.busy||D.rolling)return;var c=cById(CW.id);if(!c)return;CW.busy=1;caseBusy=true;CW.last=[];try{var j=await requestAction('case',{id:c.id,n:CW.n,free:!!free});adopt(j);CW.last=j.result.wins;render();cwPlay(c,cDrops(c),CW.last)}catch(e){CW.busy=0;caseBusy=false;toast(e.message)}};
  bxSell=function(list){act('sell',{ids:list.map(function(x){return x.uid})},function(j){BX.sel={};render();bxRefresh(true);toast(Q3('Продано за ','Sold for ','Продано за ')+fmt(j.result.total))})};
  bxWd=function(list){var eligible=list.filter(function(x){return !x.sh});if(!eligible.length)return toast(Q3('Купленное нельзя вывести, только отыграть или продать.','Purchases cannot be withdrawn; play or sell them.','Куплене не можна вивести, лише відіграти або продати.'));BX.wd=eligible;BX.wdp=eligible.map(function(x){return {uid:x.uid,it:x.it}});openModal('<h3 class="bu-mt">'+Q3('Записаться в очередь вывода','Join withdrawal queue','Записатися в чергу виведення')+'</h3><p>'+Q3('Обработка по воскресеньям, по времени Киева. Без лимита мест.','Processed on Sundays, Kyiv time. No slot limit.','Обробка щонеділі, за часом Києва. Без ліміту місць.')+'</p><div class="tq-tags">'+eligible.map(function(x){return '<span class="tq-t">'+esc(x.it.name)+' · '+fmt(x.it.price)+'</span>'}).join('')+'</div><label class="tp-l" for="bx-nick">Roblox</label><input id="bx-nick" class="bu-in" style="width:100%" maxlength="32" value="'+esc(S.rnick||'')+'" placeholder="'+Q3('Ваш ник в Roblox','Your Roblox nickname','Ваш нік у Roblox')+'"><div class="bu-row" style="margin-top:16px"><button class="bu-btn" data-bx="wdgo">'+Q3('Подтвердить заявку','Confirm request','Підтвердити заявку')+'</button></div>');};
  bxWdGo=bxWdGo_o=function(){var n=$('#bx-nick'),nick=n?n.value.trim():'';var ids=(BX.wdp||[]).map(function(p){return p.uid});if(!ids.length)ids=(BX.wd||[]).map(function(x){return x.uid});act('withdraw',{nick:nick,ids:ids},function(j){BX.sel={};BX.wd=[];BX.wdp=[];closeModal();render();bxRefresh(true);toast(Q3('Заявка: ','Request: ','Заявка: ')+j.result.withdrawal.date+' · №'+j.result.withdrawal.position)})};
  rollDice=async function(){if(D.rolling||NET.busy||U.busy||caseBusy||!D.bet||D.color==null)return;D.rolling=true;var rollButton=$('.bu-droll');if(rollButton)rollButton.disabled=true;var col=D.color,b=D.bet,stakeInfo=dBetInfo();try{var j=await requestAction('dice',{color:col,bet:b}),r=j.result;adopt(j);D.bet=nextDiceSelection(b,r,j.user.inv,j.user.balance,stakeInfo&&stakeInfo.value);var host=$('.bu-dslots');if(host)host.classList.add('rolling');sfx('dr_shake');for(var i=0;i<4;i++){var e=$('#bu-ds'+i);if(e){e.innerHTML='<i class="dsh"></i>'+dCube3(r.res[i]);var cube=e.querySelector('.dcube3');cube.animate([{transform:'translateY(-100px) rotateX(540deg) rotateY(720deg)'},{transform:'translateY(0) rotateX(0) rotateY(0)'}],{duration:S.fast?100:240,easing:'cubic-bezier(.2,.8,.3,1)'});}}await sleep(S.fast?80:280);D.res=r.res;D.match=r.res.map(function(x){return x===col?1:0});sfx(r.mult?'dr_win':'dr_lose');toast(r.mult?(r.settlement==='items'?stakeInfo.name+' ×'+r.mult:'+'+fmt(r.paid)+' монет'):'Проигрыш');}catch(e){toast(e.message)}finally{D.rolling=false;render();renderDice()}};
  mPlay=function(){if(NET.busy||mG())return;act('mines-start',{n:MN.n,ids:mSelList().map(function(x){return x.uid})},function(){MN.sel={};MN.end=null;MN.res=null;MN.last=-1;mRender()})};
  function mineEnd(j){var r=j.result;if(r.end){MN.end=r.board;MN.res={w:r.win,p:r.paid,it:r.item,ch:r.change};sfx(r.win?'cash':'mines_lose')}else{sfx('gem',j.user&&j.user.mg?j.user.mg.open.length:1)}mRender()}
  var mineClickBusy=false;MN.queued=[];MN.waiting={};
  async function drainMineClicks(){
   if(mineClickBusy||!MN.queued.length)return;if(!mG()||U.sec!=='mines'){MN.queued=[];MN.waiting={};return}
   var i=MN.queued.shift();mineClickBusy=true;NET.trigger=document.querySelector('.bu-mcell[data-i="'+i+'"]');
   try{var j=await requestAction('mines-open',{i:i});adopt(j);delete MN.waiting[i];MN.last=i;if(j.result.end){MN.queued=[];MN.waiting={};hdr()}mineEnd(j)}
   catch(error){MN.queued=[];MN.waiting={};mRender();toast(error.message)}finally{mineClickBusy=false;drainMineClicks()}
  }
  mOpen=function(i){var g=mG();if(!g||g.open.includes(i)||MN.waiting[i])return;if(NET.busy&&!mineClickBusy)return toast('Дождитесь текущей операции');MN.queued.push(i);MN.waiting[i]=true;var button=document.querySelector('.bu-mcell[data-i="'+i+'"]');if(button){button.classList.add('pending');button.setAttribute('aria-busy','true');button.disabled=true}drainMineClicks()};
  mCash=function(){if(NET.busy||mineClickBusy||MN.queued.length)return;act('mines-cash',{},mineEnd)};

  tpSend=function(){act('topup',{type:TP.tab,nick:TP.nick,promo:TP.promo,items:Object.keys(TP.sel).map(function(id){return {id:+id,q:TP.sel[id]}})},function(j){TP.sel={};TP.step=1;tradeWin(j.result.topup,A.tradeNick||'');admRefresh()})};
  // Server keeps the crash secret until the round ends. Client only animates it.
  var serverRocket=false,rocketPoll=false;
  rocketPlace=function(){if(NET.busy||R.placed)return;act('rocket-place',{bet:R.bet,auto:R.auto?R.autoAt:0},function(j){serverRocket=true;R.phase='wait';R.t0=j.result.start-6000;R.wait=6000;R.crash=1000;R.tc=Math.log(1000)/RK;R.placed={val:j.activeRocket.value,done:0,type:R.bet.type,item:rInfo()&&rInfo().item,auto:0};R.bet=null;R.k='';rocketUI()})};
  rocketCancel=function(){act('rocket-cancel',{},function(){serverRocket=false;R.placed=null;R.k='';render();rocketUI()})};
  function finishRocket(j){var r=j.result;if(r.phase==='done'||r.won!==undefined){serverRocket=false;if(R.placed){R.placed.done=1;R.placed.x=r.mult||0;R.placed.l=r.won?0:1;}R.phase='boom';R.t0=Date.now();R.crash=r.crash||r.mult||1;R.hist.unshift(R.crash);R.hist=R.hist.slice(0,14);R.lh='';sfx(r.won?'win':'boom');render();rocketUI()}}
  rCash=function(){if(!serverRocket||NET.busy)return;act('rocket-cash',{},finishRocket)};
  var legacyRocketTick=rocketTick;
  rocketTick=function(){if(!serverRocket)return legacyRocketTick();var now=Date.now();if(R.phase==='wait'&&now-R.t0>=R.wait){R.phase='fly';R.t0+=R.wait;sfx('whoosh')}if(R.phase==='fly')R.mult=Math.exp(RK*(now-R.t0));if(rVis())rocketUI();if(!rocketPoll&&NET.ready&&now-(NET.lastRocketPoll||0)>=800){NET.lastRocketPoll=now;rocketPoll=true;requestAction('rocket-status',{}).then(function(j){adopt(j);finishRocket(j)}).catch(function(e){toast(e.message)}).finally(function(){rocketPoll=false})}};
  // Legacy interval captured its old function; pause it and delegate to the live one.
  rFly=function(){if(serverRocket)return;R.phase='fly';R.t0=Date.now();R.tc=R.crash>1?Math.log(R.crash)/RK:0};
  setInterval(function(){if(serverRocket)rocketTick()},300);
  document.addEventListener('click',function(e){var b=e.target.closest('button,[data-net]');if(!b)return;
    NET.trigger=b;queueMicrotask(function(){if(NET.trigger===b)NET.trigger=null});var block=function(){e.preventDefault();e.stopImmediatePropagation()};
    if(!NET.ready&&(b.closest('.bu-app,.bu-modal,.bu-adm,.cw')||b.dataset.act==='admin')){block();return toast(Q3('Подключение к серверу…','Connecting to server…','Підключення до сервера…'))}
    if(b.dataset.adminShowNick){block();act('admin-topup-show',{id:b.dataset.adminShowNick},function(){toast('Ник показан игроку');admin()});return;}
    if(b.dataset.adminPromo){block();var kind=b.dataset.adminPromo;act('admin-promo-create',{type:kind,code:$('#promo-'+kind+'-code').value,max:+$('#promo-'+kind+'-max').value,amount:kind==='coin'?+$('#promo-coin-amount').value:0,caseId:kind==='case'?+$('#promo-case-id').value:null},function(j){toast('Промокод создан: '+j.result.code);admin()});return;}
    if(b.dataset.adminPromoDelete){block();act('admin-promo-delete',{code:b.dataset.adminPromoDelete},function(){toast('Промокод отключён');admin()});return;}
    if(b.dataset.adminBalance){block();var who=b.dataset.userId||$('#net-admin-player').value,amount=+(b.dataset.row!=null?$('#net-amount-'+b.dataset.row).value:$('#net-admin-amount').value);if(!Number.isFinite(amount)||amount<0||(amount===0&&b.dataset.adminBalance!=='set'))return toast('Проверьте сумму');if(!who)return toast('Выберите игрока');act('admin-balance',{userId:who,mode:b.dataset.adminBalance,amount:amount},function(j){toast('Баланс обновлён: '+j.result.updated);admin()});return;}
    if(b.dataset.net==='rename'){block();var n=prompt(Q3('Новый ник','New nickname','Новий нік'),S.me);if(n)act('rename',{name:n},function(){render();showSec('profile')});return;}
    if(b.closest('#bu-lgrid')&&U.tab==='shop'){block();act('shop',{id:+b.dataset.id},function(){render();toast(Q3('Куплено · наценка 5%','Purchased · 5% markup','Куплено · націнка 5%'))});return;}
    if(b.dataset.cw==='sell'){block();act('sell',{ids:(CW.last||[]).map(function(x){return x.uid})},function(){CW.last=[];b.disabled=true;b.textContent='✓';render()});return;}
    if(b.dataset.rf==='wd'){block();act('partner-withdraw',{},function(j){showSec('profile');toast(j.result.withdrawal.date+' · №'+j.result.withdrawal.position)});return;}
    if(b.dataset.rf==='t-ref'||b.dataset.rf==='t-vol'){block();return;}
    if(b.dataset.tq||b.dataset.wq){block();act('admin-virtual-request',{kind:b.dataset.tq?'topup':'withdraw',id:b.dataset.id,status:b.dataset.tq||b.dataset.wq},function(){admin()});return;}
    if(b.dataset.bn&&b.dataset.bn!=='code'){block();toast(Q3('Эта награда пока не подключена к серверу','This reward is not connected yet','Цю нагороду ще не підключено до сервера'));return;}
    if(b.dataset.v2){var k=b.dataset.v2;if(k==='trade'){block();act('admin-recipient',{nick:$('#v-trade').value},function(){toast('Ник сохранён');admin()});return;}if(k==='pnew'||k==='pdel'||k==='bset'||k==='badd'||k==='bsub'){block();toast(Q3('Используйте баланс игрока и партнёрские промокоды','Use player balance and partner promo tools','Використовуйте баланс гравця та партнерські промокоди'));return;}}
    if(b.dataset.a==='give'){block();var to=resolvePlayerIdentity(NET.players,$('#a-nick').value);if(!to)return toast('Укажите ник или @username игрока из Players');act('admin-balance',{userId:to.id,mode:'add',amount:+$('#a-amt').value},function(){toast('Баланс обновлён');admin()});return;}
    if(b.dataset.a==='pnew'||b.dataset.a==='pdel'||b.dataset.a==='play'){block();toast(Q3('Используйте партнёрские промокоды','Use partner promo tools','Використовуйте партнерські промокоди'));return;}
  },true);
  refAct=function(a,b){if(a==='radd'){var name=$('#a-rowner').value,to=NET.players.filter(function(x){return x.name===name})[0];if(!to){toast(Q3('Игрок должен сначала войти','Player must sign in first','Гравець має спочатку увійти'));return true}act('admin-partner',{userId:to.id,code:$('#a-rcode').value||refGen(),pct:+$('#a-rpct').value,bonus:+$('#a-rbon').value},function(){admin()});return true}
    if(a==='rdel'||a==='rpset'){var code=b.dataset.n;act('admin-partner-edit',{code:code,disable:a==='rdel',pct:+($('#a-rp-'+code)||{}).value,bonus:+($('#a-rb-'+code)||{}).value},function(){admin()});return true}return oldDeleteRef(a,b)};
  function serverPlayers(){var out={};NET.players.forEach(function(p){out[playerIdentityLabel(p)]={balance:p.balance,inv:[]}});S.players=out;}
  function adopt(j){if(!j.ok)throw new Error(j.error||'Ошибка сервера');if(Object.prototype.hasOwnProperty.call(j,'minePatch')){S.mg=j.minePatch;return;}NET.telegram=j.telegram||null;NET.admin=!!j.admin;document.documentElement.classList.toggle("bu-admin",NET.admin);NET.id=j.userId;NET.queue=j.queue;NET.players=j.players||NET.players;
    var prefs={lang:S.lang,device:S.device,streamer:S.streamer,fast:S.fast,sound:S.sound,ui:S.ui,vol:S.vol},rlink=S.rlink;Object.assign(S,j.user,prefs);S.rlink=rlink;S.tg=null;S.promos=j.user.promos||{};S.fc={};Object.keys(j.user.fc||{}).forEach(function(k){S.fc[NET.id+'|'+k]=j.user.fc[k]});
    Object.keys(S.promos).forEach(function(k){if(S.promos[k].deleted)delete S.promos[k]});if(j.config){Object.assign(A,j.config);build()}NET.ready=true;if(NET.feed)NET.feed(j);if(j.players)serverPlayers();save();}
  async function requestAction(action,data){if(!NET.ready)throw new Error('Подключение к серверу…');if(NET.busy)throw new Error('Дождитесь завершения операции');NET.busy=true;NET.actionEpoch=(NET.actionEpoch||0)+1;var stopFeedback=beginRequestFeedback(NET.trigger,Q3('Обработка…','Processing…','Обробка…'));NET.trigger=null;document.documentElement.classList.add('bu-network-busy');var controller=new AbortController(),deadline=setTimeout(function(){controller.abort()},20000);try{var response=await fetch('/api/action',{signal:controller.signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,data:data,requestId:crypto.randomUUID()})});var j=await response.json();if(!response.ok||!j.ok)throw new Error(j.error||'Ошибка сервера');return j}finally{clearTimeout(deadline);stopFeedback();document.documentElement.classList.remove('bu-network-busy');NET.busy=false}}
  function act(action,data,done){return requestAction(action,data).then(function(j){adopt(j);if(action.indexOf('mines-')===0)hdr();else render();if(done)done(j);return j}).catch(function(e){toast(e.message)})}
  NET.act=act;NET.request=requestAction;NET.adopt=adopt;
  function netPromoMake(){act('promo-create',{code:$('#pr-code').value,max:+$('#pr-max').value,amount:+$('#pr-amt').value,caseId:$('#pr-case').value||null},function(j){toast(Q3('С баланса списано: ','Balance debited: ','З балансу списано: ')+fmt(j.result.total));showSec('profile')})}
  function netPromoDel(code){act('promo-delete',{code:code},function(){showSec('profile')})}
  NET.promoMake=netPromoMake;NET.promoDel=netPromoDel;
  promoRedeem=promoRedeem_o=function(code){act('promo-redeem',{code:code},function(){render();if(U.sec==='profile')showSec('profile');if(U.sec==='bonuses')showSec('bonuses');toast(Q3('Код активирован','Code activated','Код активовано'))})};
  // Never import untrusted browser balances into the database.
  S.balance=0;S.inv=[];S.promos={};S.players={};S.wd=[];S.mg=null;S.pend=null;A.refs={};A.tops=[];A.wds=[];
  try{Object.assign(S,JSON.parse(localStorage.getItem('bu_preferences_v4')||'{}'))}catch(e){}
  var connecting=document.createElement('div');connecting.id='bu-connect';connecting.className='bu-connect';connecting.textContent=Q3('Подключаем аккаунт и базу данных…','Connecting account and database…','Підключаємо акаунт і базу даних…');document.body.appendChild(connecting);
  fetch('/api/action').then(function(r){return r.json()}).then(function(j){if(!j.ok){connecting.textContent=j.error||'Ошибка подключения';if(j.signIn){var a=document.createElement('a');a.href=j.signIn;a.target='_top';a.className='bu-btn';a.textContent='Войти';connecting.appendChild(a)}return}adopt(j);connecting.remove();render();applyDevice();setStreamer(!!S.streamer);tryLink();if(j.activeRocket){serverRocket=true;R.phase='wait';R.t0=j.activeRocket.start-6000;R.wait=6000;R.crash=1000;R.tc=Math.log(1000)/RK;R.placed={val:j.activeRocket.value,done:0,auto:0};} }).catch(function(){connecting.textContent='Не удалось подключиться к базе. Обновите страницу.'});
}
render();
