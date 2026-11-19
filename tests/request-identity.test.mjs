import test from 'node:test';
import assert from 'node:assert/strict';
import {requestIdentity} from '../server/request-identity.mjs';

test('public Cloudflare never trusts caller-supplied Sites identity headers', async()=>{
  const request=new Request('https://test/api/action',{headers:{'oai-authenticated-user-id':'tg:1116312381','oai-authenticated-user-full-name':'Owner'}});
  assert.equal(await requestIdentity(request,{}),null);
  assert.deepEqual(await requestIdentity(request,{},true),{id:'tg:1116312381',name:'Owner'});
});
test('invalid Telegram data cannot fall back to a trusted Sites identity', async()=>{
  const request=new Request('https://test/api/action',{headers:{'oai-authenticated-user-id':'Owner','X-Telegram-Init-Data':'bad'}});
  await assert.rejects(()=>requestIdentity(request,{TELEGRAM_BOT_TOKEN:'test'},true));
});
