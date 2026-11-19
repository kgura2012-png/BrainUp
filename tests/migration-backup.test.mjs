import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import {handle} from '../server/service.mjs';
import {fresh,account} from '../server/model.mjs';
import seed from '../server/seed.json' with {type:'json'};

async function database(){const db=localDatabase();db.sqlite.exec(await readFile(new URL('../cloudflare/migrations/0001_schema.sql',import.meta.url),'utf8'));const state=fresh(seed,'tg:1116312381');account(state,state.owner,'Owner');account(state,'tg:123','Player');db.sqlite.prepare('INSERT INTO site_state VALUES(1,42,?)').run(JSON.stringify(state));db.sqlite.exec("INSERT INTO support_payments(id,user_id,stars,created_at,expires_at) VALUES('p1',123,25,1,2)");return db;}
function request(action){return new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,requestId:'migration-test-123',data:{}})});}
test('only owner can export full backup; exports preserve all tables and revision',async()=>{
 const db=await database();try{
  assert.equal((await handle(request('admin-backup'),db,{id:'tg:123'})).status,403);
  assert.equal((await handle(request('admin-backup'),db,null)).status,401);
  const response=await handle(request('admin-backup'),db,{id:'tg:1116312381'},{migrationReadOnly:true});
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  const {backup}=await response.json();assert.equal(backup.format,'brainup-d1-backup');assert.equal(backup.tables.site_state[0].revision,42);assert.equal(backup.tables.support_payments[0].id,'p1');assert.deepEqual(backup.tables.support_receipts,[]);
  assert.equal(db.sqlite.prepare('SELECT revision FROM site_state').get().revision,42);
 }finally{db.sqlite.close();}
});
test('migration freeze blocks normal actions without changing balances or revision',async()=>{
 const db=await database();try{
  const response=await handle(request('state'),db,{id:'tg:123'},{migrationReadOnly:true});assert.equal(response.status,503);assert.equal(db.sqlite.prepare('SELECT revision FROM site_state').get().revision,42);
 }finally{db.sqlite.close();}
});
