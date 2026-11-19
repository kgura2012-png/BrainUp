import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {telegramIdentity,telegramWebhook} from '../server/telegram.mjs';
const token='test-token',now=Date.now();
function signed(date=Math.floor(now/1000)) {const p=new URLSearchParams({auth_date:String(date),user:JSON.stringify({id:123,first_name:'Test'})});const secret=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',secret).update([...p.entries()].sort().map(([k,v])=>k+'='+v).join('\n')).digest('hex'));return p.toString()}
test('Telegram verifies signature and isolates identity',async()=>{assert.deepEqual(await telegramIdentity(signed(),token,now),{id:'tg:123',telegramUsername:'',name:'Test',telegramProfile:{id:123,username:'',first_name:'Test',last_name:'',photo_url:''}});await assert.rejects(()=>telegramIdentity(signed().replace('Test','Fake'),token,now));await assert.rejects(()=>telegramIdentity(signed(1),token,now));await assert.rejects(()=>telegramIdentity(signed(),'wrong',now));await assert.rejects(()=>telegramIdentity(signed()+'&user=x',token,now));});
test('webhook rejects missing secret',async()=>{assert.equal((await telegramWebhook(new Request('https://test/telegram/webhook',{method:'POST'}),{TELEGRAM_BOT_TOKEN:token,TELEGRAM_WEBHOOK_SECRET:'secret'})).status,403)});
