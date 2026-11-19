import {readBrainupState, saveBrainupState} from './state-storage.mjs';
import {recordPartnerDeposit} from './partner-accounting.mjs';
const TOPUP_PREFIX = 'topup:';
const BU_CENTS_PER_STAR = 125;

async function applyStarsBalance(db, order, refunded) {
 const userKey = 'tg:' + order.user_id;
 for (let attempt = 0; attempt < 12; attempt++) {
  const row = await readBrainupState(db);
  const state = row && JSON.parse(row.data);
  const user = state?.users[userKey];
  if (!user) throw Error('Payment account unavailable');
  const entries = state.starsBalanceEntries ??= {};
  const previous = entries[order.id];
  if (previous === 'refunded' || (previous === 'paid' && !refunded)) return;
  const cents = order.stars * (order.bu_rate||135);
  const delta = refunded ? (previous === 'paid' ? -cents : 0) : cents;
  user.balance = (Math.round(user.balance * 100) + delta) / 100;
  const partnerEntries=state.starsPartnerEntries??={};
  if(!refunded){const code=recordPartnerDeposit(state,user,cents/100);if(code)partnerEntries[order.id]={code,amount:cents/100};}
  else if(previous==='paid'&&partnerEntries[order.id]){const entry=partnerEntries[order.id];recordPartnerDeposit(state,user,-entry.amount,entry.code);entry.refunded=true;}
  entries[order.id] = refunded ? 'refunded' : 'paid';
  const result = await saveBrainupState(db, row.revision, state);
  if (result.meta.changes === 1) return;
 }
 throw Error('Payment balance update must be retried');
}

export async function supportSchema(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS support_payments (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, stars INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', invoice_url TEXT, checkout_query TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, bu_rate INTEGER NOT NULL DEFAULT 135)").run();
 const rateColumn=async()=>{const info=await db.prepare('PRAGMA table_info("support_payments")').all();return info.results.some(column=>column.name==='bu_rate')};
 if(!await rateColumn())try{await db.prepare('ALTER TABLE support_payments ADD COLUMN bu_rate INTEGER NOT NULL DEFAULT 135').run()}catch(error){if(!await rateColumn())throw error;}
 await db.prepare('CREATE TABLE IF NOT EXISTS support_receipts (charge_id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, user_id INTEGER NOT NULL, stars INTEGER NOT NULL, paid_at INTEGER NOT NULL, refunded_at INTEGER)').run();
}
async function supportApi(env,method,body){if(!env.TELEGRAM_BOT_TOKEN)throw Error('Оплата пока недоступна');const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(7000)}),data=await response.json();if(!response.ok||!data.ok)throw Error('Telegram не ответил. Повторите позже.');return data.result;}
async function supportAllowed(db,id){const row=await readBrainupState(db),state=row?JSON.parse(row.data):null;return !state?.config.topupsClosed&&!state?.config.topupsStarsClosed&&!state?.users['tg:'+id]?.banned;}
export async function handleSupport(request,env,identity){
 const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(!identity?.id?.startsWith('tg:'))return json({ok:false,error:'Откройте оплату в Telegram'},401);
 if(!env.DB||!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_WEBHOOK_SECRET)return json({ok:false,error:'Оплата пока недоступна'},503);
 const userId=Number(identity.id.slice(3));if(!Number.isSafeInteger(userId)||userId<=0)return json({ok:false,error:'Некорректный аккаунт'},401);
 await supportSchema(env.DB);const url=new URL(request.url);
 if(request.method==='GET'){
  if(url.searchParams.get('admin')==='1'){
   if(userId!==1116312381)return json({ok:false,error:'Доступ только владельцу'},403);
   const rows=await env.DB.prepare("SELECT json_group_array(json_object('chargeId',charge_id,'paymentId',payment_id,'userId',user_id,'stars',stars,'paidAt',paid_at,'refundedAt',refunded_at)) AS data FROM (SELECT * FROM support_receipts ORDER BY paid_at DESC LIMIT 100)").first();return json({ok:true,payments:JSON.parse(rows?.data||'[]')});
  }
  const id=url.searchParams.get('id'),row=await env.DB.prepare('SELECT * FROM support_payments WHERE id IN (?, ?) AND user_id = ? ORDER BY id DESC LIMIT 1').bind(id,TOPUP_PREFIX+id,userId).first();if(!row)return json({ok:false,error:'Платёж не найден'},404);
  return json({ok:true,id,stars:row.stars,creditedBU:row.status==='paid'&&row.id.startsWith(TOPUP_PREFIX)?row.stars*(row.bu_rate||135)/100:0,status:row.status,invoiceUrl:row.status==='pending'&&row.expires_at>Date.now()?row.invoice_url:null});
 }
 if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json({ok:false,error:'Недопустимый источник'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({ok:false,error:'Ожидается JSON'},415);
 let body;try{const raw=await request.text();if(raw.length>1024)throw Error();body=JSON.parse(raw)}catch{return json({ok:false,error:'Некорректный запрос'},400)}
 if(!/^[a-f0-9-]{36}$/i.test(body.id||'')||!Number.isSafeInteger(body.stars)||body.stars<1||body.stars>10000)return json({ok:false,error:'Укажите целое число от 1 до 10 000 Stars'},400);
 if(!await supportAllowed(env.DB,userId))return json({ok:false,error:'Пополнения временно закрыты'},403);
 const stateRow=await readBrainupState(env.DB);
 if(!stateRow||!JSON.parse(stateRow.data).users[identity.id])return json({ok:false,error:'Сначала войдите в аккаунт BrainUp'},409);
 const orderId=TOPUP_PREFIX+body.id;
 const now=Date.now();await env.DB.prepare('INSERT OR IGNORE INTO support_payments(id,user_id,stars,created_at,expires_at,bu_rate) VALUES (?,?,?,?,?,?)').bind(orderId,userId,body.stars,now,now+1800000,BU_CENTS_PER_STAR).run();
 const row=await env.DB.prepare('SELECT * FROM support_payments WHERE id = ?').bind(orderId).first();if(row.user_id!==userId||row.stars!==body.stars)return json({ok:false,error:'Платёж не совпадает'},409);
 if(row.status!=='pending'||row.expires_at<=now)return json({ok:false,error:'Создайте новый платёж'},409);
 let invoice=row.invoice_url;
 if(!invoice){try{await supportApi(env,'setWebhook',{url:new URL('/telegram/webhook',request.url).href,secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message','callback_query','pre_checkout_query']});invoice=await supportApi(env,'createInvoiceLink',{title:'Пополнение BrainUp',description:'На баланс поступит '+row.stars*(row.bu_rate||135)/100+' BU.',payload:'support:'+row.id,currency:'XTR',prices:[{label:'Пополнение BU',amount:row.stars}]});if(typeof invoice!=='string'||!invoice.startsWith('https://t.me/'))throw Error('Некорректный ответ Telegram');await env.DB.prepare('UPDATE support_payments SET invoice_url = ? WHERE id = ?').bind(invoice,row.id).run()}catch(error){return json({ok:false,error:error.message},502)}}
 return json({ok:true,id:body.id,stars:row.stars,invoiceUrl:invoice,status:'pending'});
}
export async function supportTelegramUpdate(update,env,api){
 const query=update.pre_checkout_query,payment=update.message?.successful_payment,refund=update.message?.refunded_payment;
 if(!query&&!payment&&!refund)return false;
 if(!env.DB)throw Error('Payment database unavailable');await supportSchema(env.DB);
 const event=query||payment||refund,payload=event.invoice_payload||'',id=payload.startsWith('support:')?payload.slice(8):'',userId=query?.from?.id||update.message?.from?.id;
 const order=await env.DB.prepare('SELECT * FROM support_payments WHERE id = ?').bind(id).first();
 const valid=order&&userId===order.user_id&&event.currency==='XTR'&&event.total_amount===order.stars;
 if(query){
  let accepted=!!valid&&!!order.invoice_url&&order.expires_at>Date.now()&&await supportAllowed(env.DB,userId);
  if(accepted&&order.status==='pending'){const changed=await env.DB.prepare("UPDATE support_payments SET status='checkout', checkout_query=? WHERE id=? AND status='pending'").bind(query.id,id).run();accepted=changed.meta.changes===1;if(!accepted){const latest=await env.DB.prepare('SELECT * FROM support_payments WHERE id=?').bind(id).first();accepted=latest?.status==='checkout'&&latest.checkout_query===query.id}}
  else if(accepted)accepted=order.status==='checkout'&&order.checkout_query===query.id;
  await api('answerPreCheckoutQuery',{pre_checkout_query_id:query.id,ok:accepted,...(!accepted?{error_message:'Платёж недоступен или уже обработан. Создайте новый счёт в приложении.'}:{})});return true;
 }
 if(!valid||!event.telegram_payment_charge_id)throw Error('Payment does not match an issued invoice');
 if(id.startsWith(TOPUP_PREFIX)&&!['checkout','paid','refunded'].includes(order.status))throw Error('Checkout was not approved');
 const charge=event.telegram_payment_charge_id,now=Date.now(),previous=await env.DB.prepare('SELECT * FROM support_receipts WHERE charge_id=?').bind(charge).first();
 if(previous&&(previous.payment_id!==id||previous.user_id!==userId||previous.stars!==order.stars))throw Error('Payment receipt mismatch');
 await env.DB.prepare('INSERT OR IGNORE INTO support_receipts(charge_id,payment_id,user_id,stars,paid_at,refunded_at) VALUES (?,?,?,?,?,?)').bind(charge,id,userId,order.stars,now,refund?now:null).run();
 if(refund)await env.DB.prepare('UPDATE support_receipts SET refunded_at=? WHERE charge_id=?').bind(now,charge).run();
 const receipt=await env.DB.prepare('SELECT * FROM support_receipts WHERE charge_id=?').bind(charge).first();
 if(id.startsWith(TOPUP_PREFIX))await applyStarsBalance(env.DB,order,!!receipt.refunded_at);
 await env.DB.prepare("UPDATE support_payments SET status=CASE WHEN status='refunded' OR ? THEN 'refunded' ELSE 'paid' END WHERE id=?").bind(receipt.refunded_at?1:0,id).run();
 return true;
}
