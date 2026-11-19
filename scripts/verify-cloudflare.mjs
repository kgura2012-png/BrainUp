import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHmac} from 'node:crypto';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import {fresh, account} from '../server/model.mjs';
import seed from '../server/seed.json' with {type:'json'};

export async function verifyCloudflareBuild(worker, out) {
  const ASSETS = {async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const files = {'/index.html':['index.html','text/html'], '/assets/telegram-welcome.jpg':['assets/telegram-welcome.jpg','image/jpeg']};
    const file = files[pathname];
    if (!file) return new Response(null, {status:404});
    const data = await readFile(path.join(out, 'public', file[0]));
    if (request.headers.get('range') === 'bytes=0-99') return new Response(data.subarray(0,100), {status:206});
    return new Response(request.method === 'HEAD' ? null : data, {headers:{'Content-Type':file[1]}});
  }};
  const page = await worker.fetch(new Request('https://brainup.test/'), {ASSETS});
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('Cache-Control'), 'no-store');
  assert.match(await page.text(), /brainup-mobile/);
  const audio = await worker.fetch(new Request('https://brainup.test/assets/last-christmas.mp3', {headers:{range:'bytes=0-99'}}), {ASSETS});
  assert.equal(audio.status, 404);
  const photo = await worker.fetch(new Request('https://brainup.test/assets/telegram-welcome.jpg'), {ASSETS});
  assert.equal(photo.headers.get('Content-Type'), 'image/jpeg');
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
    const user=account(state,'tg:123','Migration test');user.balance=321;
    const token='local-build-verification';
    const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123,first_name:'Migration test'})});
    const secret=createHmac('sha256','WebAppData').update(token).digest();
    params.set('hash',createHmac('sha256',secret).update([...params.entries()].sort().map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
    const env={DB:db,ASSETS,TELEGRAM_BOT_TOKEN:token,TELEGRAM_WEBHOOK_SECRET:'test-secret'};
    assert.equal((await worker.fetch(new Request('https://brainup.test/healthz'),env)).status,200);
    const headers={...forged,'X-Telegram-Init-Data':params.toString()};
    const initial=await worker.fetch(new Request('https://brainup.test/api/action',{headers}),env);
    assert.equal(initial.status,200);
    const initialData=await initial.json();
    assert.equal(initialData.userId,'tg:123');
    assert.equal(initialData.user.balance,0);
    assert.deepEqual(initialData.user.inv, []);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM site_state').get().count,1);

    db.sqlite.prepare('UPDATE site_state SET revision = 7, data = ? WHERE id = 1').run(JSON.stringify(state));
    const response=await worker.fetch(new Request('https://brainup.test/api/action',{headers}),env);
    assert.equal(response.status,200);
    const data=await response.json();
    assert.equal(data.userId,'tg:123');
    assert.equal(data.user.balance,321);
    assert.equal(data.admin,false);
    const stored = db.sqlite.prepare('SELECT data FROM site_state WHERE id = 1').get();
    assert.match(stored.data, /^brainup-segments:/);
    const saved = db.sqlite.prepare('SELECT data FROM site_state_parts ORDER BY ordinal').all().map(part => part.data).join('');
    assert.equal(JSON.parse(saved).migrationCheck, state.migrationCheck);
    const reloaded = await worker.fetch(new Request('https://brainup.test/api/action', {headers:{'X-Telegram-Init-Data':params.toString()}}), env);
    assert.equal((await reloaded.json()).user.balance,321);
    assert.equal((await worker.fetch(new Request('https://brainup.test/healthz'),env)).status,200);
    assert.equal((await worker.fetch(new Request('https://brainup.test/telegram/webhook',{method:'POST',body:'{}'}),env)).status,403);
  } finally {db.sqlite.close();}
}
