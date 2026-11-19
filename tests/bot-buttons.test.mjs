import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildBotKeyboard,prepareBonusInvitation,telegramWebhook} from '../server/telegram.mjs';
import {fresh,account} from '../server/model.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import seed from '../server/seed.json' with {type:'json'};
const env={TELEGRAM_BOT_TOKEN:'123:fake',TELEGRAM_WEBHOOK_SECRET:'secret'};
const request=update=>new Request('https://test/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'secret'},body:JSON.stringify(update)});
test('subscription invite prepares the banner and a button for private sharing',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    assert(url.endsWith('/savePreparedInlineMessage'));
    const body=JSON.parse(options.body);
    assert.equal(body.user_id,42);
    assert.equal(body.allow_user_chats,true);
    assert.equal(body.allow_group_chats,false);
    assert.equal(body.result.type,'photo');
    assert.equal(body.result.photo_url,'https://test/assets/telegram-welcome.jpg');
    assert.equal(body.result.reply_markup.inline_keyboard[0][0].url,'https://t.me/BrainUpOfficial_bot');
    return Response.json({ok:true,result:{id:'invite',expiration_date:100}});
  };
  try {
    assert.deepEqual(await prepareBonusInvitation(env,42,'https://test/assets/telegram-welcome.jpg'),{messageId:'invite',expiresAt:100000});
  } finally {
    globalThis.fetch=original;
  }
});
async function mockTelegram(run){const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push({method:String(url).split('/').at(-1),body:JSON.parse(options.body)});return Response.json({ok:true,result:true})};try{await run(calls)}finally{globalThis.fetch=original}}
test('start attaches the welcome text and menu to the configured photo',()=>mockTelegram(async calls=>{
  const photo='https://test/welcome.jpg';
  const update={update_id:1,message:{chat:{id:42,type:'private'},from:{id:42},text:'/start'}};
  const response=await telegramWebhook(request(update),{...env,TELEGRAM_START_PHOTO:photo});
  assert.equal(response.status,200);
  assert.deepEqual(calls.map(call=>call.method),['setWebhook','sendPhoto']);
  assert.equal(calls[1].body.photo,photo);
  assert.match(calls[1].body.caption,/Добро пожаловать/);
  assert.deepEqual(calls[1].body.reply_markup,buildBotKeyboard('https://test/'));
}));
test('start keyboard opens the partner application in the Mini App and keeps support separate',()=>{const supportUrl='https://t.me/TestSupport';const k=buildBotKeyboard('https://test/',{TELEGRAM_SUPPORT_URL:supportUrl});assert.deepEqual(k.inline_keyboard.map(row=>row.length),[1,2,1,1]);assert.deepEqual(k.inline_keyboard[3][0],{text:'🤝 Партнёрство',web_app:{url:'https://test/?screen=partnership'}});assert.equal(k.inline_keyboard[0][0].web_app.url,'https://test/');assert.equal(k.inline_keyboard[2][0].callback_data,'bonus_code');assert.equal(k.inline_keyboard[1][1].url,'https://t.me/BrainUpOfficialSupport_bot')});
test('start enables callbacks before showing the new keyboard',()=>mockTelegram(async calls=>{const r=await telegramWebhook(request({update_id:1,message:{chat:{id:42,type:'private'},from:{id:42},text:'/start'}}),env);assert.equal(r.status,200);assert.equal(calls[0].method,'setWebhook');assert(calls[0].body.allowed_updates.includes('callback_query'));assert.equal(calls[1].body.reply_markup.inline_keyboard.length,4)}));
test('bonus button answers callback and prompts for a reply',()=>mockTelegram(async calls=>{const r=await telegramWebhook(request({update_id:2,callback_query:{id:'callback',data:'bonus_code',from:{id:42},message:{chat:{id:42,type:'private'}}}}),env);assert.equal(r.status,200);assert.equal(calls[0].method,'answerCallbackQuery');assert.equal(calls[1].body.reply_markup.force_reply,true)}));
test('bonus reply credits once through the same persistent server model',()=>mockTelegram(async calls=>{const db=localDatabase();db.sqlite.exec(await fs.readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));const state=fresh(seed,'tg:1116312381');account(state,'tg:1116312381','Owner');state.promos.TEST={code:'TEST',userId:'tg:1116312381',owner:'Owner',type:'coin',amount:25,max:10,used:[],reserved:250,cost:25};db.sqlite.prepare('INSERT INTO site_state (id,revision,data) VALUES (1,0,?)').run(JSON.stringify(state));const update={update_id:3,message:{chat:{id:42,type:'private'},from:{id:42,username:'Alice'},text:'TEST',reply_to_message:{from:{id:123},text:'🎁 Введите бонус-код ответом на это сообщение:'}}};try{assert.equal((await telegramWebhook(request(update),{...env,DB:db})).status,200);assert(calls.at(-1).body.text.includes('✅'));await telegramWebhook(request(update),{...env,DB:db});const persisted=JSON.parse(db.sqlite.prepare('SELECT data FROM site_state WHERE id=1').get().data);assert.equal(persisted.users['tg:42'].balance,25);assert.equal(persisted.users['tg:42'].telegramUsername,'Alice');assert.equal(persisted.promos.TEST.used.length,1);await telegramWebhook(request({...update,update_id:4}),{...env,DB:db});assert(calls.at(-1).body.text.includes('❌'));}finally{db.sqlite.close()}}));
