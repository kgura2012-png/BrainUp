import {readBrainupState} from './state-storage.mjs';
// Durable bot outbox. The cron capability is server-only and never appears in browser responses.
export async function notificationSchema(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS app_notification_control (id INTEGER PRIMARY KEY CHECK(id=1), cron_key TEXT NOT NULL, last_tick_at INTEGER, last_result TEXT)').run();
 const bytes=crypto.getRandomValues(new Uint8Array(32)),key=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 await db.prepare('INSERT OR IGNORE INTO app_notification_control(id,cron_key) VALUES(1,?)').bind(key).run();
 await db.prepare("CREATE TABLE IF NOT EXISTS app_notification_jobs (id TEXT PRIMARY KEY, kind TEXT NOT NULL, record_id TEXT NOT NULL, recipient TEXT NOT NULL, due_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, retry_at INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER, sent_at INTEGER, message_id INTEGER, error TEXT)").run();
 await db.prepare('CREATE INDEX IF NOT EXISTS app_notification_due ON app_notification_jobs(status,retry_at,due_at)').run();
}
async function notificationState(db){const row=await readBrainupState(db);return row?JSON.parse(row.data):null}
function notificationRecord(state,job,now){
 const records=job.kind==='uah'?(state?.uahTopups||[]):(state?.simulationBookings||[]),record=records.find(entry=>entry.id===job.record_id);
 if(job.kind==='uah')return record?.notifyOwner&&record.st==='new'&&record.expiresAt>now?record:null;
 return record?.simulation===true&&record.status==='booked'&&record.at>now&&record.at-300000<=now&&!state.users[record.userId]?.banned?record:null;
}
export async function processNotificationJobs(env,origin,now=Date.now()){
 if(env.MIGRATION_READ_ONLY==='true')throw Error('Maintenance in progress');if(!env.DB)throw Error('Notification database unavailable');if(!env.TELEGRAM_BOT_TOKEN)throw Error('Telegram bot is not configured');
 const db=env.DB;await notificationSchema(db);const state=await notificationState(db),result={sent:0,failed:0,skipped:0};
 if(!state)return result;
 const add=async(id,kind,record,recipient,due,expires)=>db.prepare('INSERT OR IGNORE INTO app_notification_jobs(id,kind,record_id,recipient,due_at,expires_at) VALUES(?,?,?,?,?,?)').bind(id,kind,record.id,String(recipient),due,expires).run();
 for(const record of state.uahTopups||[])if(record.notifyOwner&&record.st==='new'&&record.expiresAt>now)await add('uah:'+record.id,'uah',record,1116312381,record.ts,record.expiresAt);
 for(const record of state.simulationBookings||[])if(record.simulation===true&&record.status==='booked'&&record.at-300000<=now&&record.at>now&&/^tg:[1-9][0-9]*$/.test(record.userId||''))await add('booking:'+record.id,'booking',record,record.userId.slice(3),record.at-300000,record.at);
 const due=await db.prepare("SELECT * FROM app_notification_jobs WHERE due_at<=? AND expires_at>? AND attempts<8 AND ((status IN ('pending','failed') AND retry_at<=?) OR (status='sending' AND lease_until<=?)) ORDER BY due_at LIMIT 50").bind(now,now,now,now).all();
 for(const job of due.results){
  const lease=crypto.randomUUID(),claimed=await db.prepare("UPDATE app_notification_jobs SET status='sending',lease_token=?,lease_until=?,attempts=attempts+1 WHERE id=? AND ((status IN ('pending','failed') AND retry_at<=?) OR (status='sending' AND lease_until<=?))").bind(lease,now+120000,job.id,now,now).run();if(!claimed.meta.changes)continue;
  const latest=await notificationState(db),record=notificationRecord(latest,job,now);
  if(!record){await db.prepare("UPDATE app_notification_jobs SET status='skipped',lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").bind(job.id,lease).run();result.skipped++;continue}
  const safeOrigin=new URL(origin).origin;let text;
  if(job.kind==='uah'){
   const user=latest.users[record.userId];text='📥 Новая заявка на пополнение гривнами №'+record.number+'\nИгрок: '+record.user+(user?.telegramUsername?' (@'+user.telegramUsername+')':'')+'\nНик в заявке: '+record.nick+'\nСумма: '+record.amount+' грн\nК начислению: '+record.total+' BU\n\nОткройте раздел «Пополнения → Гривны» в админке. Карта показывается только по кнопке «Показать карту».';
  }else{
   const minutes=Math.max(1,Math.ceil((record.at-now)/60000));text='⏰ Внутренняя запись BrainUp скоро начнётся\n\nДо начала: '+minutes+' мин.\nДата: '+record.date+'\nОкно: '+record.time+'–'+new Date(record.at+300000).toLocaleTimeString('ru-RU',{timeZone:'Europe/Kyiv',hour:'2-digit',minute:'2-digit'})+' (Киев)\nНик: '+record.nick+'\n\nЗайдите в BrainUp заранее и откройте раздел записей. Передача игровых предметов не предусмотрена.';
  }
  try{
   const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:job.recipient,text:text.slice(0,4096),reply_markup:{inline_keyboard:[[{text:job.kind==='uah'?'Открыть админку':'Открыть BrainUp',web_app:{url:safeOrigin+(job.kind==='uah'?'/?screen=admin':'/')}}]]}}),signal:AbortSignal.timeout(8000)}),data=await response.json();
   if(!response.ok||!data.ok)throw Error(data.error_code===403?'Получателю нужно открыть бота и разрешить сообщения':'Telegram временно не доставил сообщение');
   await db.prepare("UPDATE app_notification_jobs SET status='sent',sent_at=?,message_id=?,error=NULL,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").bind(now,data.result?.message_id||null,job.id,lease).run();result.sent++;
  }catch(error){await db.prepare("UPDATE app_notification_jobs SET status='failed',error=?,retry_at=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").bind(String(error.message||'Ошибка отправки').slice(0,200),now+Math.min(60000,15000*(job.attempts+1)),job.id,lease).run();result.failed++;}
 }
 await db.prepare("UPDATE app_notification_jobs SET status='expired' WHERE expires_at<=? AND status IN ('pending','failed','sending')").bind(now).run();
 await db.prepare('UPDATE app_notification_control SET last_tick_at=?,last_result=? WHERE id=1').bind(now,JSON.stringify(result)).run();return result;
}
export async function handleNotificationTick(request,env){
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});if(env.MIGRATION_READ_ONLY==='true')return Response.json({ok:false},{status:503});if(!env.DB)return Response.json({ok:false},{status:503});await notificationSchema(env.DB);
 const control=await env.DB.prepare('SELECT cron_key FROM app_notification_control WHERE id=1').first(),provided=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
 let difference=provided.length^(control?.cron_key.length||0);for(let i=0;i<(control?.cron_key.length||0);i++)difference|=control.cron_key.charCodeAt(i)^(provided.charCodeAt(i)||0);
 if(difference||!control?.cron_key)return Response.json({ok:false,error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{return Response.json({ok:true,...await processNotificationJobs(env,new URL(request.url).origin)},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({ok:false,error:'Notification service unavailable'},{status:503})}
}

// Active authenticated feed traffic is a fallback; it is not an unattended scheduler.
var notificationTrafficLastAt=0;
export function processNotificationsFromTraffic(env,origin,ctx,now=Date.now()){
 if(!env.DB||!env.TELEGRAM_BOT_TOKEN||env.MIGRATION_READ_ONLY==='true'||now-notificationTrafficLastAt<60000)return null;
 notificationTrafficLastAt=now;const work=processNotificationJobs(env,origin,now).catch(()=>null);if(ctx?.waitUntil)ctx.waitUntil(work);return work;
}
