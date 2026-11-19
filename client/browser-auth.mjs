const browserSessionKey='bu_telegram_session_v1',browserLoginKey='bu_telegram_login_v1';
export function browserAuthStorage(target,kind){try{return target[kind]}catch{return null}}
export function readBrowserAuth(storage,key,now=Date.now()){
 try{const record=JSON.parse(storage?.getItem(key)||'null');if(record&&Number.isFinite(record.expires)&&record.expires>now)return record;storage?.removeItem(key)}catch{}
 return null;
}
export function rememberBrowserSession(storage,session,expires){
 if(typeof session!=='string'||session.length>3800||!Number.isFinite(expires)||expires*1000<=Date.now())throw Error('Сервер не подтвердил вход. Повторите попытку.');
 try{storage.setItem(browserSessionKey,JSON.stringify({token:session,expires:expires*1000}));return storage.getItem(browserSessionKey)!==null}catch{return false}
}
export function installBrowserSessionTransport(target){
 const originalFetch=target.fetch;
 target.fetch=function(input,options){
  const url=new URL(typeof input==='string'?input:input.url,target.location.href);
  if(url.origin===target.location.origin&&['/api/action','/api/feed','/api/topups','/api/support','/api/rocket'].includes(url.pathname)){
   const session=readBrowserAuth(browserAuthStorage(target,'localStorage'),browserSessionKey);
   if(session?.token){options=Object.assign({},options);const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined));headers.set('X-BrainUp-Session',session.token);options.headers=headers}
  }
  return originalFetch.call(this,input,options);
 };
}
export function installBrowserLoginResume(target,resume,pause){
 const visible=()=>{if(!target.document.hidden)resume()};
 target.document.addEventListener('visibilitychange',visible);
 target.addEventListener('focus',visible);
 target.addEventListener('pageshow',visible);
 target.addEventListener('pagehide',pause);
 return ()=>{target.document.removeEventListener('visibilitychange',visible);target.removeEventListener('focus',visible);target.removeEventListener('pageshow',visible);target.removeEventListener('pagehide',pause)};
}
// Install before the very first account request, including after a page reload.
if(typeof window!=='undefined')installBrowserSessionTransport(window);
