import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHmac} from 'node:crypto';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import {fresh, account} from '../server/model.mjs';
import seed from '../server/seed.json' with {type:'json'};

export async function verifyCloudflareBuild(worker, out, verifyTelegramIdentity, buildBotKeyboard, caseCatalogRecovery) {
  const appOrigin = 'https://brainup.brainupofficial.workers.dev/';
  const keyboard = buildBotKeyboard('https://brainup-mobile-nov26.regalpeach22.chatgpt.site/', {APP_ORIGIN:appOrigin});
  assert.deepEqual(keyboard.inline_keyboard.flat().flatMap(button => button.web_app ? [button.web_app.url] : []),
    [appOrigin, appOrigin + '?screen=partnership']);

  // Published Ed25519 example from Telegram-Mini-Apps/tma.js, evaluated at its original timestamp.
  const sample = new URLSearchParams({
    auth_date:'1733584787',
    chat_instance:'8134722200314281151',
    chat_type:'private',
    user:String.raw`{"id":279058397,"first_name":"Vladislav + - ? \/","last_name":"Kibenko","username":"vdkfrost","language_code":"ru","is_premium":true,"allows_write_to_pm":true,"photo_url":"https:\/\/t.me\/i\/userpic\/320\/4FPEE4tmP3ATHa57u6MqTDih13LTOiMoKoLDRG4PnSA.svg"}`,
    signature:'zL-ucjNyREiHDE8aihFwpfR9aggP2xiAo3NSpfe-p7IbCisNlDKlo7Kb6G4D0Ao2mBrSgEk4maLSdv6MLIlADQ'
  });
  const testBotId = '7342037359', signedAt = Number(sample.get('auth_date')) * 1000;
  assert.equal((await verifyTelegramIdentity(sample.toString(), undefined, signedAt, testBotId)).id,'tg:279058397');
  await assert.rejects(verifyTelegramIdentity(sample.toString(), undefined, signedAt, '9239395916'), /Неверная подпись/);
  const forgedUser = new URLSearchParams(sample);
  forgedUser.set('user',JSON.stringify({id:1116312381,first_name:'Owner'}));
  await assert.rejects(verifyTelegramIdentity(forgedUser.toString(), undefined, signedAt, testBotId), /Неверная подпись/);
  const expired = await worker.fetch(new Request('https://brainup.test/api/action',{
    headers:{'X-Telegram-Init-Data':sample.toString()}
  }), {TELEGRAM_BOT_ID:testBotId});
  assert.equal(expired.status,401);
  assert.match((await expired.json()).error,/вход устарел/);
  const ASSETS = {async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const files = {'/index.html':['index.html','text/html'], '/assets/telegram-welcome.jpg':['assets/telegram-welcome.jpg','image/jpeg']};
    const file = files[pathname] || (/^\/assets\/restored-cases\/\d+\.webp$/.test(pathname) ? [pathname.slice(1),'image/webp'] : null);
    if (!file) return new Response(null, {status:404});
    const data = await readFile(path.join(out, 'public', file[0]));
    if (request.headers.get('range') === 'bytes=0-99') return new Response(data.subarray(0,100), {status:206});
    return new Response(request.method === 'HEAD' ? null : data, {headers:{'Content-Type':file[1]}});
  }};
  const page = await worker.fetch(new Request('https://brainup.test/'), {ASSETS});
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('Cache-Control'), 'no-store');
  const html = await page.text();
  assert.match(html, /brainup-mobile/);
  assert.match(html, /--brainup-glow-soft/);
  assert.match(html, /data-admin-case-odds/);
  assert.match(html, /data-admin-player-search/);
  const audio = await worker.fetch(new Request('https://brainup.test/assets/last-christmas.mp3', {headers:{range:'bytes=0-99'}}), {ASSETS});
  assert.equal(audio.status, 404);
  const photo = await worker.fetch(new Request('https://brainup.test/assets/telegram-welcome.jpg'), {ASSETS});
  assert.equal(photo.headers.get('Content-Type'), 'image/jpeg');
  for (const entry of caseCatalogRecovery.cases) {
    const artwork = await worker.fetch(new Request('https://brainup.test'+entry.img), {ASSETS});
    assert.equal(artwork.status,200);
    const bytes = Buffer.from(await artwork.arrayBuffer());
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
  }
  assert.equal((await worker.fetch(new Request('https://brainup.test/.env'), {ASSETS})).status,404);
  const forged = {'oai-authenticated-user-id':'tg:1116312381','oai-authenticated-user-full-name':'Owner'};
  for (const endpoint of ['action','feed','topups','support']) {
    const response = await worker.fetch(new Request('https://brainup.test/api/'+endpoint, {headers:forged}), {});
    assert.equal(response.status,401);
    assert.equal((await response.json()).signIn,undefined);
  }
  assert.equal((await worker.fetch(new Request('https://brainup.test/api/action', {headers:{...forged,'X-Telegram-Init-Data':'bad'}}), {TELEGRAM_BOT_TOKEN:'test'})).status,401);
  assert.equal((await worker.fetch(new Request('https://brainup.test/telegram/webhook', {method:'POST'}), {})).status,503);
  assert.equal((await worker.fetch(new Request('https://brainup.test/healthz'), {})).status,503);

  const db=localDatabase();
  try {
    const schema=await readFile(new URL('../cloudflare/migrations/0001_schema.sql', import.meta.url),'utf8');
    db.sqlite.exec(schema); db.sqlite.exec(schema);
    db.sqlite.exec(await readFile(new URL('../cloudflare/migrations/0003_site_state_parts.sql', import.meta.url), 'utf8'));
    const state=fresh(seed,'tg:1116312381');
    state.migrationCheck = 'Ж'.repeat(1_100_000) + '🚀';
    state.config.cases.push({id:200020,name:'Current custom case',price:77,drops:[0],grp:'',sectionId:'other'});
    const user=account(state,'tg:123','Ник игрока');user.balance=321;user.fc[200001]=1;
    const token='local-build-verification';
    const secret=createHmac('sha256','WebAppData').update(token).digest();
    function signedTelegram(user) {
      const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify(user)});
      params.set('hash',createHmac('sha256',secret).update([...params.entries()].sort().map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
      return {'X-Telegram-Init-Data':params.toString()};
    }
    const playerHeaders=signedTelegram({id:123,first_name:'Migration test',username:'migration_check'});
    const ownerHeaders=signedTelegram({id:1116312381,first_name:'Owner'});
    const env={DB:db,ASSETS,TELEGRAM_BOT_TOKEN:token,TELEGRAM_WEBHOOK_SECRET:'test-secret'};
    assert.equal((await worker.fetch(new Request('https://brainup.test/healthz'),env)).status,200);
    const headers={...forged,...playerHeaders};
    const initial=await worker.fetch(new Request('https://brainup.test/api/action',{headers}),env);
    assert.equal(initial.status,200);
    const initialData=await initial.json();
    assert.equal(initialData.userId,'tg:123');
    assert.equal(initialData.user.balance,0);
    assert.deepEqual(initialData.user.inv, []);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM site_state').get().count,1);

    db.sqlite.prepare('UPDATE site_state SET revision = 7, data = ? WHERE id = 1').run(JSON.stringify(state));
    const recoveryUrl='https://brainup.test/internal/case-catalog-recovery';
    assert.equal((await worker.fetch(new Request(recoveryUrl,{method:'POST'}),env)).status,403);
    const stamp=String(Math.floor(Date.now()/1000));
    const proof=createHmac('sha256',token).update('brainup-case-catalog:' + caseCatalogRecovery.revision + ':' + stamp).digest('hex');
    const savedCatalog=await worker.fetch(new Request(recoveryUrl,{method:'POST',
      headers:{'X-BrainUp-Catalog-Proof':stamp+'.'+proof}}),env);
    assert.equal(savedCatalog.status,200);
    assert.equal((await savedCatalog.json()).revision,caseCatalogRecovery.revision);
    const response=await worker.fetch(new Request('https://brainup.test/api/action',{headers}),env);
    assert.equal(response.status,200);
    const data=await response.json();
    assert.equal(data.userId,'tg:123');
    assert.equal(data.user.balance,321);
    assert.equal(data.admin,false);
    assert.equal(data.config.caseCatalogRecoveryRevision, caseCatalogRecovery.revision);
    assert.equal(data.config.cases.find(entry=>entry.id===200020).name,'Current custom case');
    assert.equal(data.config.cases.filter(entry=>entry.name===caseCatalogRecovery.cases[0].name).length,1);
    assert.equal(data.config.cases.find(entry=>entry.id===100001),undefined);
    for (const entry of caseCatalogRecovery.cases) {
      const recovered = data.config.cases.find(candidate=>candidate.name===entry.name);
      assert.equal(recovered?.img,entry.img);
      assert.equal(recovered.price,entry.price);
      assert.deepEqual(recovered.drops,entry.drops);
    }
    const stored = db.sqlite.prepare('SELECT data FROM site_state WHERE id = 1').get();
    assert.match(stored.data, /^brainup-segments:/);
    const saved = db.sqlite.prepare('SELECT data FROM site_state_parts ORDER BY ordinal').all().map(part => part.data).join('');
    assert.equal(JSON.parse(saved).migrationCheck, state.migrationCheck);
    const reloaded = await worker.fetch(new Request('https://brainup.test/api/action', {headers:playerHeaders}), env);
    assert.equal((await reloaded.json()).user.balance,321);

    async function action(headers, action, data) {
      const response=await worker.fetch(new Request('https://brainup.test/api/action',{
        method:'POST',headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({action,data,requestId:crypto.randomUUID()})
      }),env);
      return {status:response.status,data:await response.json()};
    }
    const paid=data.config.cases.find(entry=>entry.name===caseCatalogRecovery.cases[0].name);
    const chosen=paid.drops.at(-1);
    const odds=Object.fromEntries(paid.drops.map(id=>[id,id===chosen?10000:0]));
    assert.equal((await action(playerHeaders,'admin-case-odds',{id:paid.id,odds})).status,400);
    assert.equal((await action(ownerHeaders,'admin-case-odds',{id:paid.id,odds:{[chosen]:10000}})).status,400);
    const savedOdds=await action(ownerHeaders,'admin-case-odds',{id:paid.id,odds});
    assert.equal(savedOdds.status,200);
    assert.deepEqual(savedOdds.data.config.cases.find(entry=>entry.id===paid.id).rewardOdds,odds);
    const searchRecord=savedOdds.data.players.find(player=>player.id==='tg:123');
    assert.equal(searchRecord.username,'migration_check');
    assert.equal(searchRecord.name,'Ник игрока');
    const actualNow=Date.now, openedAt=actualNow();
    try {
      Date.now=()=>openedAt;
      const purchase=await action(playerHeaders,'case',{id:paid.id,n:1});
      assert.equal(purchase.status,200);
      assert.equal(purchase.data.result.wins[0].w.id,chosen);
      assert.deepEqual(purchase.data.drops,[]);
      assert.equal(purchase.data.topDrop,null);

      async function getLiveDrop() {
        const response=await worker.fetch(new Request('https://brainup.test/api/feed',{headers:playerHeaders}),env);
        assert.equal(response.status,200);
        return response.json();
      }
      Date.now=()=>openedAt+4999;
      assert.deepEqual((await getLiveDrop()).drops,[]);
      Date.now=()=>openedAt+5000;
      const published=await getLiveDrop();
      assert.equal(published.drops[0].itemId,chosen);
      assert.equal(published.topDrop.itemId,chosen);
    } finally {
      Date.now=actualNow;
    }

    const free=caseCatalogRecovery.cases.find(entry=>entry.id===200001);
    const freeOdds=Object.fromEntries(free.drops.map(id=>[id,0]));
    Object.assign(freeOdds,{'token-2':0,'token-5':10000});
    assert.equal((await action(ownerHeaders,'admin-case-odds',{id:free.id,odds:freeOdds})).status,200);
    const won=await action(playerHeaders,'case',{id:free.id,free:true});
    assert.equal(won.status,200);
    assert.equal(won.data.result.wins[0].coins,5);
    assert.equal((await worker.fetch(new Request('https://brainup.test/healthz'),env)).status,200);
    assert.equal((await worker.fetch(new Request('https://brainup.test/telegram/webhook',{method:'POST',body:'{}'}),env)).status,403);
    const originalFetch=globalThis.fetch;
    const calls=[];
    globalThis.fetch=async(url, options)=>{
      calls.push({method:new URL(url).pathname.split('/').at(-1),body:JSON.parse(options.body)});
      return Response.json({ok:true,result:true});
    };
    try {
      const webhookEnv={...env,APP_ORIGIN:appOrigin,TELEGRAM_BOT_TOKEN:'9239395916:local-test'};
      async function start(reply) {
        const chat={id:123,type:'private'},from={id:123};
        return worker.fetch(new Request('https://brainup.test/telegram/webhook',{
          method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'test-secret'},
          body:JSON.stringify({message:{chat,from,text:'/start',reply_to_message:reply}})
        }),webhookEnv);
      }
      assert.equal((await start({from:{id:9239395916},chat:{id:123},message_id:56,
        caption:'👋 Добро пожаловать в BrainUp!'})).status,200);
      assert.deepEqual(calls.map(call=>call.method),['editMessageReplyMarkup']);
      assert.equal(calls[0].body.message_id,56);
      assert.equal(calls[0].body.reply_markup.inline_keyboard[0][0].web_app.url,appOrigin);
      calls.length=0;
      assert.equal((await start()).status,200);
      assert.equal(calls.at(-1).method,'sendPhoto');
      assert.equal(calls.at(-1).body.reply_markup.inline_keyboard[0][0].web_app.url,appOrigin);
    } finally {
      globalThis.fetch=originalFetch;
    }
  } finally {db.sqlite.close();}
}
