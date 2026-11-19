import test from 'node:test';
import assert from 'node:assert/strict';
import {handleBrowserTelegramAuth,browserLoginTelegramUpdate,browserTelegramIdentity} from '../server/browser-telegram.mjs';
import {requestIdentity} from '../server/request-identity.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import {handle} from '../server/service.mjs';
import {telegramWebhook} from '../server/telegram.mjs';
import {readFile} from 'node:fs/promises';
import {installBrowserSessionTransport,rememberBrowserSession,installBrowserLoginResume} from '../client/browser-auth.mjs';
const origin='https://brainup.test',actor={id:123,username:'Player123',first_name:'Игрок'};
function fixture(t){const DB=localDatabase();t.after(()=>DB.sqlite.close());return {DB,TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_WEBHOOK_SECRET:'test-secret',TELEGRAM_BOT_USERNAME:'brainup_test_bot'}}
function req(action,cookie='',source=origin){return new Request(origin+'/auth/telegram/'+action,{method:'POST',headers:{Origin:source,Cookie:cookie}})}
const cookieFrom=(response,name)=>response.headers.getSetCookie().find(x=>x.startsWith(name+'='))?.split(';')[0];
async function start(env){const response=await handleBrowserTelegramAuth(req('start'),env);assert.equal(response.status,200);const data=await response.json();return {...data,cookie:cookieFrom(response,'__Host-brainup_login'),id:new URL(data.url).searchParams.get('start').slice(6)}}
function message(id,user=actor){return {message:{text:'/start login_'+id,from:user,chat:{type:'private',id:user.id}}}}
function confirm(id,user=actor,decision='yes'){return {callback_query:{id:'query',data:'web_'+decision+':'+id,from:user,message:{message_id:1,chat:{type:'private',id:user.id}}}}}
const noopAPI=async()=>({});

test('Telegram approval logs the initiating browser into the same tg account, with a secure remembered session',async t=>{
 const env=fixture(t),login=await start(env),messages=[];
 assert.match(login.code,/^\d{6}$/);assert.equal(new URL(login.url).hostname,'t.me');
 assert.equal((await (await handleBrowserTelegramAuth(req('status',login.cookie),env)).json()).status,'pending');
 await browserLoginTelegramUpdate(message(login.id),env,async(method,body)=>messages.push({method,body}),origin);
 assert.match(messages.find(x=>x.method==='sendMessage').body.text,new RegExp(login.code));
 assert.equal((await (await handleBrowserTelegramAuth(req('status',login.cookie),env)).json()).status,'pending');
 await browserLoginTelegramUpdate(confirm(login.id),env,noopAPI,origin);
 const response=await handleBrowserTelegramAuth(req('status',login.cookie),env);
 assert.equal(response.status,200);assert.equal((await response.json()).status,'approved');
 const session=cookieFrom(response,'__Host-brainup_session');assert.ok(session);
 const flags=response.headers.getSetCookie().find(x=>x.startsWith('__Host-brainup_session='));
 for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/','Max-Age=2592000'])assert.ok(flags.includes(flag));
 const request=new Request(origin+'/api/action',{headers:{Cookie:session}}),identity=await requestIdentity(request,env);
 assert.equal(identity.id,'tg:123');assert.equal(identity.telegramProfile.username,'Player123');
 env.DB.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
 const state=await (await handle(request,env.DB,identity)).json();assert.equal(state.userId,'tg:123');assert.equal(state.telegram.id,123);
 assert.equal((await handleBrowserTelegramAuth(req('status',login.cookie),env)).status,410);
 // Change significant signature bits; the final base64url character can contain unused padding bits.
 const signatureStart=session.lastIndexOf('.')+1;assert(signatureStart>0);
 const forged=session.slice(0,signatureStart)+(session[signatureStart]==='a'?'b':'a')+session.slice(signatureStart+1);
 assert.equal(await browserTelegramIdentity(new Request(origin,{headers:{Cookie:forged}}),env),null);
 assert.equal(await browserTelegramIdentity(request,{...env,TELEGRAM_BOT_TOKEN:'changed-token'}),null);
 assert.equal(await browserTelegramIdentity(request,env,Math.floor(Date.now()/1000)+2592001),null);
});

test('public deep-link token cannot authorize another browser or Telegram account',async t=>{
 const env=fixture(t),login=await start(env);
 assert.equal((await handleBrowserTelegramAuth(req('start','','https://evil.test'),env)).status,403);
 assert.equal((await handleBrowserTelegramAuth(req('status','__Host-brainup_login='+login.id+'.'+'0'.repeat(32)),env)).status,410);
 await browserLoginTelegramUpdate(message(login.id),env,noopAPI,origin);
 await browserLoginTelegramUpdate(confirm(login.id,{id:456,first_name:'Other'}),env,noopAPI,origin);
 assert.equal((await (await handleBrowserTelegramAuth(req('status',login.cookie),env)).json()).status,'pending');
 await browserLoginTelegramUpdate(confirm(login.id),env,noopAPI,origin);
 assert.equal((await handleBrowserTelegramAuth(req('status',login.cookie,'https://evil.test'),env)).status,403);
 const replies=await Promise.all([handleBrowserTelegramAuth(req('status',login.cookie),env),handleBrowserTelegramAuth(req('status',login.cookie),env)]);
 assert.equal(replies.filter(x=>x.status===200).length,1);
});

test('rejection, expiration and logout never grant a browser session',async t=>{
 const env=fixture(t),login=await start(env);
 await browserLoginTelegramUpdate(message(login.id),env,noopAPI,origin);
 await browserLoginTelegramUpdate(confirm(login.id,actor,'no'),env,noopAPI,origin);
 const denied=await handleBrowserTelegramAuth(req('status',login.cookie),env);assert.equal(denied.status,403);assert.equal(cookieFrom(denied,'__Host-brainup_session'),undefined);
 const next=await start(env);env.DB.sqlite.prepare('UPDATE telegram_web_logins SET expires=0 WHERE id=?').run(next.id);
 await browserLoginTelegramUpdate(confirm(next.id),env,noopAPI,origin);
 assert.equal((await handleBrowserTelegramAuth(req('status',next.cookie),env)).status,410);
 const logout=await handleBrowserTelegramAuth(req('logout',login.cookie),env);
 assert.equal(logout.status,200);assert.equal(logout.headers.getSetCookie().length,2);
 for(const cookie of logout.headers.getSetCookie())assert.match(cookie,/Max-Age=0/);
});

test('unverified mini app data and proxy headers cannot authorize website access',async t=>{
 const env=fixture(t);
 assert.equal(await requestIdentity(new Request(origin,{headers:{'oai-authenticated-user-id':'tg:1116312381'}}),env),null);
 await assert.rejects(()=>requestIdentity(new Request(origin,{headers:{'X-Telegram-Init-Data':'forged'}}),env));
});

test('real webhook routes login approval and requires its secret before processing callbacks',async t=>{
 const env=fixture(t),login=await start(env),calls=[];
 env.DB.sqlite.exec(await readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({method:String(url).split('/').at(-1),body:JSON.parse(options.body)});return Response.json({ok:true,result:{}})});
 const webhook=(update,secret='test-secret')=>telegramWebhook(new Request(origin+'/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret,'Content-Type':'application/json'},body:JSON.stringify(update)}),env);
 assert.equal((await webhook(message(login.id))).status,200);
 assert.ok(calls.some(x=>x.method==='setWebhook'&&x.body.allowed_updates.includes('callback_query')));
 assert.equal((await webhook(confirm(login.id),'wrong-secret')).status,403);
 assert.equal((await (await handleBrowserTelegramAuth(req('status',login.cookie),env)).json()).status,'pending');
 assert.equal((await webhook(confirm(login.id))).status,200);
 assert.equal((await (await handleBrowserTelegramAuth(req('status',login.cookie),env)).json()).status,'approved');
});

function memoryStorage(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}}

test('login and reload succeed when the hosting proxy does not preserve any Set-Cookie headers',async t=>{
 const env=fixture(t);
 // The browser receives JSON but no cookies; this reproduces immediate status 410.
 const started=await (await handleBrowserTelegramAuth(req('start'),env)).json();
 assert.match(started.login,/^[a-f0-9]{32}\.[a-f0-9]{32}$/);
 const request=()=>new Request(origin+'/auth/telegram/status',{method:'POST',headers:{Origin:origin,'X-BrainUp-Login':started.login}});
 assert.equal((await handleBrowserTelegramAuth(req('status'),env)).status,410);
 assert.equal((await (await handleBrowserTelegramAuth(request(),env)).json()).status,'pending');
 const id=started.login.split('.')[0];
 await browserLoginTelegramUpdate(message(id),env,noopAPI,origin);
 await browserLoginTelegramUpdate(confirm(id),env,noopAPI,origin);
 const completed=await (await handleBrowserTelegramAuth(request(),env)).json();
 assert.equal(completed.status,'approved');
 const storage=memoryStorage();assert.equal(rememberBrowserSession(storage,completed.session,completed.expires),true);
 // A fresh page installs transport before its first /api/action request.
 let sent;
 const page={location:new URL(origin+'/'),localStorage:storage,async fetch(input,options){sent=new Request(new URL(input,origin),options);return requestIdentity(sent,env)}};
 installBrowserSessionTransport(page);
 const user=await page.fetch('/api/action');assert.equal(user.id,'tg:123');
 assert.equal(sent.headers.get('Cookie'),null);assert.ok(sent.headers.get('X-BrainUp-Session'));
 await page.fetch('https://other.test/api/action');assert.equal(sent.headers.get('X-BrainUp-Session'),null);
 await page.fetch('/assets/last-christmas.mp3');assert.equal(sent.headers.get('X-BrainUp-Session'),null);
 const stolenPublicId=new Request(origin+'/auth/telegram/status',{method:'POST',headers:{Origin:origin,'X-BrainUp-Login':id+'.'+'0'.repeat(32)}});
 assert.equal((await handleBrowserTelegramAuth(stolenPublicId,env)).status,410);
});

test('returning from Telegram resumes status checks after pagehide, visibility and page restoration',()=>{
 const page=new EventTarget();page.document=new EventTarget();page.document.hidden=false;
 let checks=0,pauses=0;
 const dispose=installBrowserLoginResume(page,()=>checks++,()=>pauses++);
 page.dispatchEvent(new Event('pagehide'));assert.equal(pauses,1);
 page.document.hidden=true;page.document.dispatchEvent(new Event('visibilitychange'));assert.equal(checks,0);
 page.document.hidden=false;page.dispatchEvent(new Event('pageshow'));assert.equal(checks,1);
 page.dispatchEvent(new Event('focus'));assert.equal(checks,2);
 page.document.dispatchEvent(new Event('visibilitychange'));assert.equal(checks,3);
 dispose();page.dispatchEvent(new Event('pageshow'));assert.equal(checks,3);
});

test('session transport preserves existing request headers and rejects expired browser storage',async()=>{
 const storage=memoryStorage();storage.setItem('bu_telegram_session_v1',JSON.stringify({token:'expired',expires:1}));
 let headers;
 const page={location:new URL(origin),localStorage:storage,async fetch(input,options){headers=new Headers(options?.headers||(input instanceof Request?input.headers:undefined))}};
 installBrowserSessionTransport(page);
 await page.fetch(new Request(origin+'/api/action',{headers:{'X-Telegram-Init-Data':'native-mini-app'}}));
 assert.equal(headers.get('X-BrainUp-Session'),null);assert.equal(headers.get('X-Telegram-Init-Data'),'native-mini-app');
 assert.equal(storage.getItem('bu_telegram_session_v1'),null);
});
