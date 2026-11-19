import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import seed from '../server/seed.json' with {type:'json'};
const owner={id:'tg:1116312381',name:'Boss'},alice={id:'tg:42',name:'Alice'},bob={id:'tg:43',name:'Bob'};
async function fixture(){const db=localDatabase();db.sqlite.exec(await fs.readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));async function req(who,action='state',data={},requestId=crypto.randomUUID()){const response=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,requestId})}),db,who);return {status:response.status,j:await response.json()}}for(const who of [owner,alice,bob])await req(who);return {db,req}}
test('manual transfer and payout routes are retired for players and owner',async()=>{const {db,req}=await fixture();try{for(const action of ['virtual-topup','virtual-withdraw','admin-recipient','admin-topup-show','admin-virtual-request','partner-withdraw'])for(const who of [owner,alice])assert.equal((await req(who,action,{})).status,403)}finally{db.sqlite.close()}});
