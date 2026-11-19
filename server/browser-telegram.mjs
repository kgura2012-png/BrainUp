const loginCookie='__Host-brainup_login',sessionCookie='__Host-brainup_session';
const loginTTL=300,sessionTTL=30*24*60*60;
const authSchema=`CREATE TABLE IF NOT EXISTS telegram_web_logins (
 id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, code TEXT NOT NULL,
 expires INTEGER NOT NULL, actor TEXT, profile TEXT, status TEXT NOT NULL DEFAULT 'pending'
)`;
const authEncoder=new TextEncoder();
function hex(bytes){return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')}
function randomAuthToken(){return hex(crypto.getRandomValues(new Uint8Array(16)))}
async function authHash(value){return hex(await crypto.subtle.digest('SHA-256',authEncoder.encode(value)))}
function readCookie(request,name){return (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||''}
function authCookie(name,value,seconds){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`}
function authJSON(data,status=200,cookies=[]){const headers=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});for(const cookie of cookies)headers.append('Set-Cookie',cookie);return Response.json(data,{status,headers})}
function authProfile(user){
 if(!Number.isSafeInteger(user?.id)||user.id<=0)throw Error('Пользователь Telegram отсутствует');
 return {id:user.id,username:String(user.username||'').slice(0,32),first_name:String(user.first_name||'').slice(0,100),last_name:String(user.last_name||'').slice(0,100),photo_url:typeof user.photo_url==='string'&&user.photo_url.startsWith('https://')?user.photo_url.slice(0,512):''};
}
function browserIdentity(profile){return {id:'tg:'+profile.id,name:[profile.first_name,profile.last_name].filter(Boolean).join(' ')||profile.username||'Player',telegramUsername:profile.username.toLowerCase(),telegramProfile:profile}}
function base64Auth(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unbase64Auth(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))}
async function browserSigningKey(token){
 const secret=await crypto.subtle.digest('SHA-256',authEncoder.encode('BrainUp browser session v1\0'+token));
 return crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function createBrowserSession(profile,token,now){
 const payload=base64Auth(authEncoder.encode(JSON.stringify({v:1,iat:now,exp:now+sessionTTL,profile:authProfile(profile)})));
 const signature=await crypto.subtle.sign('HMAC',await browserSigningKey(token),authEncoder.encode(payload));
 return payload+'.'+base64Auth(new Uint8Array(signature));
}
export async function browserTelegramIdentity(request,env,now=Math.floor(Date.now()/1000)){
 const value=request.headers.get('X-BrainUp-Session')||readCookie(request,sessionCookie);
 if(!value||value.length>3800||!env.TELEGRAM_BOT_TOKEN)return null;
 try{
  const parts=value.split('.');if(parts.length!==2)return null;
  if(!await crypto.subtle.verify('HMAC',await browserSigningKey(env.TELEGRAM_BOT_TOKEN),unbase64Auth(parts[1]),authEncoder.encode(parts[0])))return null;
  const payload=JSON.parse(new TextDecoder().decode(unbase64Auth(parts[0])));
  if(payload.v!==1||!Number.isSafeInteger(payload.exp)||!Number.isSafeInteger(payload.iat)||payload.exp<=now||payload.iat>now+30||payload.exp-payload.iat!==sessionTTL)return null;
  return browserIdentity(authProfile(payload.profile));
 }catch{return null}
}
async function authTable(db){await db.prepare(authSchema).run()}
function browserLoginProof(request){return request.headers.get('X-BrainUp-Login')||readCookie(request,loginCookie)}
async function browserLoginRecord(request,db){
 const [id,secret]=browserLoginProof(request).split('.');
 if(!/^[a-f0-9]{32}$/.test(id||'')||!/^[a-f0-9]{32}$/.test(secret||''))return null;
 return db.prepare('SELECT * FROM telegram_web_logins WHERE id = ? AND secret_hash = ? AND expires > ?').bind(id,await authHash(secret),Math.floor(Date.now()/1000)).first();
}
let cachedBotUsername;
export async function browserBotUsername(env){
 if(/^[A-Za-z0-9_]{5,32}$/.test(env.TELEGRAM_BOT_USERNAME||''))return env.TELEGRAM_BOT_USERNAME;
 const botId=env.TELEGRAM_BOT_TOKEN.split(':')[0];
 if(cachedBotUsername?.id===botId&&cachedBotUsername.expires>Date.now())return cachedBotUsername.name;
 const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/getMe',{signal:AbortSignal.timeout(7000)}),data=await response.json();
 if(!response.ok||!data.ok||!/^[A-Za-z0-9_]{5,32}$/.test(data.result?.username||''))throw Error('Не удалось открыть Telegram. Повторите попытку.');
 cachedBotUsername={id:botId,name:data.result.username,expires:Date.now()+3600000};return data.result.username;
}
export async function handleBrowserTelegramAuth(request,env){
 const url=new URL(request.url),action=url.pathname.split('/').at(-1);
 if(!['start','status','logout'].includes(action))return authJSON({ok:false},404);
 if(request.method!=='POST')return authJSON({ok:false,error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==url.origin)return authJSON({ok:false,error:'Недопустимый источник запроса'},403);
 if(action==='logout')return authJSON({ok:true},200,[authCookie(sessionCookie,'',0),authCookie(loginCookie,'',0)]);
 if(!env.DB||!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_WEBHOOK_SECRET)return authJSON({ok:false,error:'Вход через Telegram пока недоступен'},503);
 if(env.MIGRATION_READ_ONLY==='true')return authJSON({ok:false,error:'Сайт обновляется. Повторите вход позже.'},503);
 try{
  await authTable(env.DB);
  if(action==='start'){
   const username=await browserBotUsername(env),now=Math.floor(Date.now()/1000);
   await env.DB.prepare('DELETE FROM telegram_web_logins WHERE expires <= ?').bind(now).run();
   const existing=await browserLoginRecord(request,env.DB);
   if(existing&&existing.status!=='denied')return authJSON({ok:true,url:'https://t.me/'+username+'?start=login_'+existing.id,login:browserLoginProof(request),code:existing.code,expires:existing.expires});
   const id=randomAuthToken(),secret=randomAuthToken(),code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
   await env.DB.prepare('INSERT INTO telegram_web_logins(id,secret_hash,code,expires) VALUES(?,?,?,?)').bind(id,await authHash(secret),code,now+loginTTL).run();
   return authJSON({ok:true,url:'https://t.me/'+username+'?start=login_'+id,login:id+'.'+secret,code,expires:now+loginTTL},200,[authCookie(loginCookie,id+'.'+secret,loginTTL)]);
  }
  const record=await browserLoginRecord(request,env.DB);
  if(!record)return authJSON({ok:false,error:'Время входа истекло. Нажмите «Войти через Telegram» ещё раз.'},410);
  if(record.status==='denied')return authJSON({ok:false,error:'Вход отклонён в Telegram.'},403);
  if(record.status!=='approved')return authJSON({ok:true,status:'pending'});
  const now=Math.floor(Date.now()/1000),session=await createBrowserSession(JSON.parse(record.profile),env.TELEGRAM_BOT_TOKEN,now);
  const consumed=await env.DB.prepare("DELETE FROM telegram_web_logins WHERE id = ? AND status = 'approved' RETURNING profile").bind(record.id).first();
  if(!consumed)return authJSON({ok:false,error:'Этот вход уже завершён. Обновите страницу.'},409);
  return authJSON({ok:true,status:'approved',session,expires:now+sessionTTL},200,[authCookie(sessionCookie,session,sessionTTL),authCookie(loginCookie,'',0)]);
 }catch{return authJSON({ok:false,error:'Не удалось выполнить вход. Повторите попытку.'},503)}
}

// Only call after the Telegram webhook secret and the account's ban were checked.
export async function browserLoginTelegramUpdate(update,env,api,origin){
 const m=update.message,q=update.callback_query;
 const start=/^\/start(?:@\w+)?\s+login_([a-f0-9]{32})$/.exec(String(m?.text||'').trim());
 const callback=/^web_(yes|no):([a-f0-9]{32})$/.exec(String(q?.data||''));
 if(!start&&!callback)return false;
 const actor=m?.from||q?.from,chat=m?.chat||q?.message?.chat;
 if(chat?.type!=='private'||chat.id!==actor?.id||!Number.isSafeInteger(actor?.id))return true;
 if(!env.DB)return true;
 await authTable(env.DB);
 const id=start?start[1]:callback[2],record=await env.DB.prepare('SELECT * FROM telegram_web_logins WHERE id = ? AND expires > ?').bind(id,Math.floor(Date.now()/1000)).first();
 const expired=async()=>{if(q)await api('answerCallbackQuery',{callback_query_id:q.id,text:'Запрос входа истёк или уже использован',show_alert:true});else await api('sendMessage',{chat_id:actor.id,text:'Запрос входа истёк. Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.'})};
 if(!record||record.status!=='pending'||record.actor&&record.actor!==String(actor.id)){await expired();return true}
 if(start){
  await env.DB.prepare("UPDATE telegram_web_logins SET actor = ? WHERE id = ? AND status = 'pending' AND (actor IS NULL OR actor = ?)").bind(String(actor.id),id,String(actor.id)).run();
  const bound=await env.DB.prepare('SELECT actor FROM telegram_web_logins WHERE id = ?').bind(id).first();
  if(bound?.actor!==String(actor.id)){await expired();return true}
  await api('setWebhook',{url:new URL('/telegram/webhook',origin).href,secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message','callback_query','pre_checkout_query']});
  await api('sendMessage',{chat_id:actor.id,text:'🔐 Вход в BrainUp\n\nСайт: '+new URL(origin).host+'\nКод: '+record.code+'\n\nПодтвердите, только если вы сами начали вход и этот код совпадает с кодом на вашем экране.\nЗапрос действует 5 минут.',reply_markup:{inline_keyboard:[[{text:'✅ Подтвердить вход',callback_data:'web_yes:'+id}],[{text:'❌ Отклонить',callback_data:'web_no:'+id}]]}});
 }else{
  if(record.actor!==String(actor.id)){await expired();return true}
  const approved=callback[1]==='yes';
  const result=await env.DB.prepare("UPDATE telegram_web_logins SET status = ?, profile = ? WHERE id = ? AND status = 'pending' AND actor = ?").bind(approved?'approved':'denied',approved?JSON.stringify(authProfile(actor)):null,id,String(actor.id)).run();
  if(!result.meta?.changes){await expired();return true}
  await api('answerCallbackQuery',{callback_query_id:q.id,text:approved?'Вход подтверждён':'Вход отклонён'});
  await api('editMessageText',{chat_id:actor.id,message_id:q.message.message_id,text:approved?'✅ Вход в BrainUp подтверждён. Вернитесь в тот браузер, где начали вход: сайт откроется автоматически.':'Вход на сайт BrainUp отклонён.',reply_markup:{inline_keyboard:[]}});
 }
 return true;
}
