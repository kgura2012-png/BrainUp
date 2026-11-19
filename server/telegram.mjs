import {readBrainupState} from './state-storage.mjs';
import {supportTelegramUpdate} from './support.mjs';
import {handle} from './service.mjs';
import {browserLoginTelegramUpdate} from './browser-telegram.mjs';
// Telegram Mini App identity is trusted only after server-side HMAC verification.
export async function telegramIdentity(raw, token, now = Date.now()) {
  if (!token || !raw || raw.length > 16384) throw Error('Telegram не настроен или данные входа отсутствуют');
  const p = new URLSearchParams(raw), seen = new Set();
  for (const [key] of p) { if (seen.has(key)) throw Error('Некорректные данные Telegram'); seen.add(key); }
  const hash = p.get('hash'); p.delete('hash');
  if (!/^[a-f0-9]{64}$/.test(hash || '')) throw Error('Некорректная подпись Telegram');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode('WebAppData'), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const secret = await crypto.subtle.sign('HMAC', key, enc.encode(token));
  const signing = await crypto.subtle.importKey('raw', secret, {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
  const check = [...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  const valid = await crypto.subtle.verify('HMAC', signing, Uint8Array.from(hash.match(/../g), x=>parseInt(x,16)), enc.encode(check));
  if (!valid) throw Error('Неверная подпись Telegram');
  const date = Number(p.get('auth_date')), age = now/1000-date;
  if (!Number.isFinite(date) || age < -30 || age > 3600) throw Error('Откройте Mini App заново: вход устарел');
  const user = JSON.parse(p.get('user') || 'null');
  if (!Number.isSafeInteger(user?.id) || user.id <= 0) throw Error('Пользователь Telegram отсутствует');
  const photo=typeof user.photo_url==='string'&&user.photo_url.startsWith('https://')?user.photo_url:'';
  const telegramProfile={id:user.id,username:String(user.username||''),first_name:String(user.first_name||''),last_name:String(user.last_name||''),photo_url:photo};
  return {telegramProfile,id:'tg:'+user.id, telegramUsername:String(user.username||'').toLowerCase(), name:[user.first_name,user.last_name].filter(Boolean).join(' ').slice(0,100)||user.username||'Player'};
}
export function buildBotKeyboard(origin,env={}) {
  const supportUrl = 'https://t.me/BrainUpOfficialSupport_bot';
  return {inline_keyboard:[
    [{text:'🚀 Играть',web_app:{url:new URL('/',origin).href}}],
    [{text:'📰 Новости',url:env.TELEGRAM_NEWS_URL||'https://t.me/BrainUp_Official'},{text:'💬 Поддержка',url:supportUrl}],
    [{text:'🎁 Ввести бонус-код',callback_data:'bonus_code'}],
    [{text:'🤝 Партнёрство',web_app:{url:new URL('/?screen=partnership',origin).href}}]
  ]};
}
export async function telegramWebhook(request, env, defaultStartPhoto) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return new Response('Not configured',{status:503});
  if (request.method !== 'POST' || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('Forbidden',{status:403});
  const update=await request.json(),m=update.message,q=update.callback_query,origin=new URL('/',request.url).href;
  const api=async(method,body)=>{const r=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok||!j.ok)throw Error('Telegram request failed');return j.result};
  const prompt='🎁 Введите бонус-код ответом на это сообщение:';
  const ask=chat_id=>api('sendMessage',{chat_id,text:prompt,reply_markup:{force_reply:true,input_field_placeholder:'Бонус-код',selective:true}});
  try {
    if(await supportTelegramUpdate(update,env,api))return new Response('OK');
    if(m?.chat?.type==='private'&&/^\/paysupport(?:@\w+)?$/.test(String(m.text||'').trim())){await api('sendMessage',{chat_id:m.chat.id,text:'По вопросам оплаты напишите в поддержку: https://t.me/BrainUpOfficialSupport_bot. Приложите квитанцию Telegram и дату платежа.'});return new Response('OK');}
    const actor=m?.from||q?.from;
    if(actor&&env.DB){const row=await readBrainupState(env.DB);if(row&&JSON.parse(row.data).users['tg:'+actor.id]?.banned){if(q)await api('answerCallbackQuery',{callback_query_id:q.id,text:'Доступ заблокирован',show_alert:true});else if(m.chat?.type==='private')await api('sendMessage',{chat_id:m.chat.id,text:'Доступ к BrainUp заблокирован.'});return new Response('OK');}}
    if(await browserLoginTelegramUpdate(update,env,api,origin))return new Response('OK');
    if(q?.data==='bonus_code'&&q.message?.chat?.type==='private'&&q.message.chat.id===q.from?.id){
      await api('answerCallbackQuery',{callback_query_id:q.id});await ask(q.from.id);return new Response('OK');
    }
    if(m?.chat?.type!=='private'||!Number.isSafeInteger(m.from?.id))return new Response('OK');
    const text=String(m.text||'').trim();
    if(/^\/start(?:@\w+)?(?:\s|$)/.test(text)){
      let referralNote='';
      const referral=/^\/start(?:@\w+)?\s+ref_([A-Za-z0-9_-]{3,20})$/.exec(text);
      if(referral&&env.DB){
        if(!Number.isSafeInteger(update.update_id))return new Response('Invalid update',{status:400});
        const user=m.from,identity={id:'tg:'+user.id,name:[user.first_name,user.last_name].filter(Boolean).join(' ')||user.username||'Player',telegramUsername:user.username||'',telegramProfile:{id:user.id,username:user.username||'',first_name:user.first_name||'',last_name:user.last_name||'',photo_url:''}};
        const operation=new Request(new URL('/api/action',origin),{method:'POST',headers:{Origin:new URL(origin).origin,'Content-Type':'application/json'},body:JSON.stringify({action:'ref-bind',requestId:'telegram-referral-'+update.update_id,data:{code:referral[1]}})});
        const result=await (await handle(operation,env.DB,identity)).json();
        referralNote=result.ok?'\n\n🤝 Приглашение партнёра сохранено.':/навсегда|привязан/.test(result.error||'')?'\n\nТы уже привязан к партнёру. Привязка сохранена.':'\n\nПриглашение недействительно или недоступно.';
      }
      // Enable callbacks for the new keyboard when an existing user opens the bot.
      await api('setWebhook',{url:new URL('/telegram/webhook',origin).href,secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message','callback_query','pre_checkout_query']});
      const welcome = '👋 Добро пожаловать в BrainUp!\n\nСобирай брейнротов и играй.\nНажми «🚀 Играть», чтобы открыть приложение.'+referralNote;
      const keyboard = {chat_id:m.chat.id,reply_markup:buildBotKeyboard(origin,env)};
      const photo = env.TELEGRAM_START_PHOTO?.trim() || defaultStartPhoto;
      if (photo) {
        await api('sendPhoto',{...keyboard,photo,caption:welcome});
      } else {
        await api('sendMessage',{...keyboard,text:welcome});
      }
      return new Response('OK');
    }
    const moderation=/^\/(ban|unban)(?:@\w+)?(?:\s+(\S+))?$/i.exec(text);
    if(moderation){
      if(!Number.isSafeInteger(update.update_id))return new Response('Invalid update',{status:400});
      const who=m.from,identity={id:'tg:'+who.id,name:who.first_name||'Player',telegramUsername:who.username||''};
      const operation=new Request(new URL('/api/action',origin),{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(origin).origin},body:JSON.stringify({action:'admin-ban',requestId:'telegram-ban-'+update.update_id,data:{lookup:moderation[2]||'',banned:moderation[1].toLowerCase()==='ban'}})});
      const response=await handle(operation,env.DB,identity),result=await response.json();
      await api('sendMessage',{chat_id:m.chat.id,text:result.ok?(result.result.banned?'⛔ Игрок заблокирован: ':'✅ Игрок разблокирован: ')+(result.result.username?'@'+result.result.username:result.result.name):'❌ '+(result.error||'Укажите /ban @username или /unban Telegram_ID')});
      return new Response('OK');
    }
    if(/^\/bonus(?:@\w+)?$/.test(text)){await ask(m.chat.id);return new Response('OK');}
    const botId=Number(env.TELEGRAM_BOT_TOKEN.split(':')[0]);
    const trustedReply=m.reply_to_message?.from?.id===botId&&m.reply_to_message?.text===prompt;
    const command=/^\/bonus(?:@\w+)?\s+(.+)$/i.exec(text);
    const code=command?command[1].trim():trustedReply?text:null;
    if(code!==null){
      if(!/^[A-Za-z0-9_-]{3,20}$/.test(code)){await api('sendMessage',{chat_id:m.chat.id,text:'Код должен содержать 3–20 латинских букв, цифр, _ или -.'});return new Response('OK');}
      if(!Number.isSafeInteger(update.update_id))return new Response('Invalid update',{status:400});
      const user=m.from,identity={id:'tg:'+user.id,name:[user.first_name,user.last_name].filter(Boolean).join(' ')||user.username||'Player',telegramUsername:user.username||'',telegramProfile:{id:user.id,username:user.username||'',first_name:user.first_name||'',last_name:user.last_name||'',photo_url:''}};
      const action=new Request(new URL('/api/action',origin),{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(origin).origin},body:JSON.stringify({action:'promo-redeem',requestId:'telegram-'+update.update_id,data:{code}})});
      const response=await handle(action,env.DB,identity),result=await response.json();
      await api('sendMessage',{chat_id:m.chat.id,text:result.ok?'✅ Бонус-код активирован. Награда доступна в приложении.':'❌ '+(result.error||'Не удалось активировать код'),reply_markup:buildBotKeyboard(origin,env)});
    }
    return new Response('OK');
  }catch{return new Response('Retry',{status:502});}
}

export async function notifyTopupCreated(env,record){
 if(!env.TELEGRAM_BOT_TOKEN)throw Error('Telegram bot is not configured');
 const entries=(record.items||[]).map(x=>x.n+' ×'+x.q),what=record.type==='stars'?'Единицы: '+record.stars:entries.slice(0,30).join('\n')+(entries.length>30?'\n… ещё '+(entries.length-30)+' позиций':'');
 const text=('📥 Заявка на пополнение №'+(record.number||record.id)+'\nИгрок: '+record.user+(record.username?' (@'+record.username+')':'')+'\nНик игрока: '+(record.nick||'не указан')+'\n\n'+what+'\n\nК начислению: '+record.total+' токенов\nОжидание: 10 минут. Решение — в админке BrainUp.').slice(0,4096);
 const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:1116312381,text})}),result=await response.json();if(!response.ok||!result.ok)throw Error('Telegram top-up notification failed');return result.result;
}

export async function notifySimulationTopupCreated(env,record){
 if(record?.simulation!==true||record.free!==true||record.st!=='new')return null;
 if(!env.TELEGRAM_BOT_TOKEN)throw Error('Telegram bot is not configured');
 const entries=(record.items||[]).slice(0,30).map(x=>String(x.n)+' ×'+x.q);
 const what=record.type==='stars'?'Stars: '+record.stars+' (расчёт без оплаты)':entries.join('\n')+((record.items||[]).length>30?'\n… ещё '+(record.items.length-30)+' позиций':'');
 const text=('📥 Бесплатная заявка №'+(record.number||record.id)+'\nНик в заявке: '+(record.nick||record.user)+'\nСпособ: '+(record.type==='stars'?'Stars':record.type==='gears'?'Гиры':'Брейнроты')+'\n\n'+what+'\n\nБаза: '+record.base+' токенов\nБонус: '+record.bonus+'%\nК начислению: '+record.total+' токенов\n\nОжидание: 10 минут. Подтверждение — в админке BrainUp.\nПередача предметов и оплата не требуются.').slice(0,4096);
 const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:1116312381,text}),signal:AbortSignal.timeout(7000)}),result=await response.json();
 if(!response.ok||!result.ok)throw Error('Telegram free-request notification failed');return result.result;
}

export async function checkBonusSubscription(env,userId){
 if(!env.TELEGRAM_BOT_TOKEN)throw Error('Bot not configured');
 const channel=env.TELEGRAM_NEWS_CHANNEL||'@BrainUp_Official';
 const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/getChatMember',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:channel,user_id:userId}),signal:AbortSignal.timeout(8000)});
 const data=await response.json();if(!response.ok||!data.ok){const description=String(data.description||'');if(/member list|administrator|not enough rights|CHAT_ADMIN_REQUIRED/i.test(description))throw Error('Боту нужны права администратора канала '+channel);if(/chat not found|CHANNEL_INVALID/i.test(description))throw Error('Канал '+channel+' недоступен боту. Проверьте канал и добавьте в него бота');throw Error('Telegram не ответил на проверку подписки. Повторите попытку');}
 return ['creator','administrator','member'].includes(data.result.status)||(data.result.status==='restricted'&&data.result.is_member===true);
}

async function bonusTelegramCall(env,method,body){
 if(!env.TELEGRAM_BOT_TOKEN)throw Error('Bot unavailable');
 const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 const data=await response.json();if(!response.ok||!data.ok)throw Error('Telegram unavailable');return data.result;
}
export async function getBonusTelegramName(env,userId){const chat=await bonusTelegramCall(env,'getChat',{chat_id:userId});if(chat.type!=='private'||chat.id!==userId)throw Error('Wrong chat');return [chat.first_name,chat.last_name].filter(Boolean).join(' ')}
export async function prepareBonusInvitation(env, userId, bannerUrl) {
  const prepared = await bonusTelegramCall(env, 'savePreparedInlineMessage', {
    user_id: userId,
    allow_user_chats: true,
    allow_bot_chats: false,
    allow_group_chats: false,
    allow_channel_chats: false,
    result: {
      type: 'photo',
      id: crypto.randomUUID(),
      photo_url: bannerUrl,
      thumbnail_url: bannerUrl,
      title: 'Приглашение в BrainUp',
      caption: 'Заходи в BrainUp! Открывай кейсы, собирай брейнротов и играй вместе со мной. 🎁',
      reply_markup: {
        inline_keyboard: [[{text: 'Забрать бесплатный кейс', url: 'https://t.me/BrainUpOfficial_bot'}]]
      }
    }
  });
  return {messageId: prepared.id, expiresAt: prepared.expiration_date * 1000};
}

export async function notifyCollaborationDecision(env,application){
 if(!application||!['approved','rejected'].includes(application.status)||!/^tg:[0-9]+$/.test(application.userId||''))return null;
 if(!env.TELEGRAM_BOT_TOKEN)throw Error('Telegram bot is not configured');
 const text=application.status==='approved'?'Вашу заявку на сотрудничество с BrainUp одобрили. Скоро с вами свяжется менеджер.':'К сожалению, ваша заявка на сотрудничество с BrainUp отклонена. Спасибо за интерес к проекту.';
 const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:application.userId.slice(3),text}),signal:AbortSignal.timeout(7000)}),result=await response.json();
 if(!response.ok||!result.ok){if(result.error_code===403)throw Error('Заявителю нужно запустить бота и разрешить сообщения');throw Error('Telegram не доставил сообщение. Можно повторить отправку');}return result.result;
}
