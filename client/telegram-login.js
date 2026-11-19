function showTelegramLogin(container){
 container.classList.remove('startup-hidden');container.classList.add('telegram-login');
 container.innerHTML='<section class="telegram-login-card"><span class="telegram-login-brand">BRAINUP</span><h1>Войти в BrainUp</h1><p>Подтверди вход через Telegram, чтобы открыть свой аккаунт.</p><button type="button" class="telegram-login-start">Войти через Telegram</button><div class="telegram-login-wait" hidden><p>Сравни код и подтверди вход в боте.</p><strong class="telegram-login-code"></strong><a class="telegram-login-reopen" target="_blank" rel="noopener noreferrer">Открыть Telegram ещё раз ↗</a><small>После подтверждения вернись в этот браузер.</small><button class="telegram-login-check" type="button">Я подтвердил вход</button></div><p class="telegram-login-status" role="status" aria-live="polite"></p></section>';
 var button=container.querySelector('.telegram-login-start'),wait=container.querySelector('.telegram-login-wait'),status=container.querySelector('.telegram-login-status'),timer,expires=0,polling=false,detachResume=null;
 var loginStorage=browserAuthStorage(window,'sessionStorage'),pending=readBrowserAuth(loginStorage,browserLoginKey);
 var proofPattern=/^[a-f0-9]{32}\.[a-f0-9]{32}$/,urlPattern=/^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=login_[a-f0-9]{32}$/;
 if(pending&&(!proofPattern.test(pending.proof||'')||!urlPattern.test(pending.url||'')))pending=null;
 function pause(){clearTimeout(timer)}
 function stop(){pause();if(detachResume)detachResume();detachResume=null}
 function clearPending(){pending=null;try{loginStorage.removeItem(browserLoginKey)}catch{}}
 function error(message){stop();expires=0;clearPending();button.hidden=false;button.disabled=false;button.textContent='Повторить вход через Telegram';wait.hidden=true;status.textContent=message}
 async function auth(action){
  var headers={'Content-Type':'application/json'};if(pending?.proof)headers['X-BrainUp-Login']=pending.proof;
  var response=await fetch('/auth/telegram/'+action,{method:'POST',credentials:'same-origin',headers:headers,body:'{}'}),reply=await response.json();
  if(!response.ok||!reply.ok){var failure=Error(reply.error||'Не удалось войти. Повторите попытку.');failure.status=response.status;throw failure}return reply;
 }
 async function poll(){
  if(polling||!expires||!container.isConnected)return;
  pause();if(Date.now()>=expires)return error('Время подтверждения истекло. Начни вход ещё раз.');polling=true;
  try{
   var reply=await auth('status');
   if(reply.status==='approved'){
    if(!rememberBrowserSession(browserAuthStorage(window,'localStorage'),reply.session,reply.expires))throw Error('Браузер запретил сохранение входа. Разреши хранение данных для этого сайта и повтори вход.');
    stop();expires=0;clearPending();status.textContent='Вход подтверждён. Открываем аккаунт…';location.reload();return;
   }
   status.textContent='Ожидаем подтверждения в Telegram…';
  }catch(e){if([400,401,403,409,410].includes(e.status)||/запретил сохранение/.test(e.message)){error(e.message);return}status.textContent='Проверяем подтверждение. Если связь пропала, оставь эту страницу открытой.'}
  finally{polling=false}
  if(expires)timer=setTimeout(poll,1800);
 }
 function showWaiting(){
  expires=pending.expires;container.querySelector('.telegram-login-code').textContent=pending.code;
  container.querySelector('.telegram-login-reopen').href=pending.url;wait.hidden=false;button.hidden=true;button.disabled=false;
  if(!detachResume)detachResume=installBrowserLoginResume(window,poll,pause);poll();
 }
 button.addEventListener('click',async function(){
  if(button.disabled)return;button.disabled=true;status.textContent='';var popup=null;
  try{
   popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
   var reply=await auth('start');
   if(!urlPattern.test(reply.url||'')||!proofPattern.test(reply.login||''))throw Error('Не удалось открыть Telegram.');
   pending={proof:reply.login,url:reply.url,code:reply.code,expires:reply.expires*1000};
   try{loginStorage.setItem(browserLoginKey,JSON.stringify(pending))}catch{}
   showWaiting();if(popup&&!popup.closed)popup.location.href=reply.url;
  }catch(e){if(popup&&!popup.closed)popup.close();error(e.message)}
 });
 container.querySelector('.telegram-login-check').addEventListener('click',poll);
 // Reloading or returning from a suspended browser preserves the original request.
 if(pending)showWaiting();
}

logout=async function(){
 if(window.Telegram&&Telegram.WebApp&&Telegram.WebApp.initData){toast('В мини-аппе используется ваш аккаунт Telegram. Для смены аккаунта откройте приложение из другого аккаунта.');return}
 try{var response=await fetch('/auth/telegram/logout',{method:'POST',credentials:'same-origin'});if(!response.ok)throw Error();try{browserAuthStorage(window,'localStorage').removeItem(browserSessionKey);browserAuthStorage(window,'sessionStorage').removeItem(browserLoginKey)}catch{}location.reload()}catch(e){toast('Не удалось выйти. Повторите попытку.')}
};
