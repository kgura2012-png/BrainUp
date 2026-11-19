import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fresh,account,execute} from '../server/model.mjs';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
const seed=JSON.parse(await fs.readFile(new URL('../server/seed.json',import.meta.url)));
const owner='tg:1116312381',id='tg:42';
function setup(){const s=fresh(seed,owner);account(s,owner,'Owner');const u=account(s,id,'Player');return {s,u}}
test('tag case requires the verified Telegram name, honors cooldown and cannot be purchased',()=>{const {s,u}=setup();u.me='@BrainUpOfficial_bot';assert.throws(()=>execute(s,id,seed,'bonus-claim',{key:'nick'}),/Telegram/);u.telegramName='Player @BrainUpOfficial_bot';const claimed=execute(s,id,seed,'bonus-claim',{key:'nick'},1000);assert.equal(u.fc[claimed.caseId],1);assert.throws(()=>execute(s,id,seed,'bonus-claim',{key:'nick'},1001),/12/);assert.throws(()=>execute(s,id,seed,'case',{id:claimed.caseId,n:1}),/условий/);const result=execute(s,id,seed,'case',{id:claimed.caseId,free:true},Date.now(),()=>.99);assert.equal(result.wins.length,1);assert.equal(u.inv.length,1);assert.equal(u.fc[claimed.caseId],0);assert.throws(()=>execute(s,id,seed,'case',{id:claimed.caseId,free:true}),/открытия/)});
test('referral case requires a bound code and is issued once',()=>{const {s,u}=setup();assert.throws(()=>execute(s,id,seed,'bonus-claim',{key:'ref'}),/код/);u.bound='FRIEND';execute(s,id,seed,'bonus-claim',{key:'ref'});assert.equal(u.fc[200002],1);assert.throws(()=>execute(s,id,seed,'bonus-claim',{key:'ref'}),/один раз/)});
test('case editor authorizes the owner and updated contents determine the next prize',()=>{const {s,u}=setup(),c=s.config.cases[0],item=seed.items[0];assert.throws(()=>execute(s,id,seed,'admin-case-edit',{id:c.id}),/владельцу/);execute(s,owner,seed,'admin-case-edit',{id:c.id,name:'Edited',price:7,drops:[item.id]});assert.deepEqual(c.drops,[item.id]);u.balance=20;const r=execute(s,id,seed,'case',{id:c.id,n:1});assert.equal(r.wins[0].w.id,item.id);assert.equal(u.balance,13);assert.throws(()=>execute(s,owner,seed,'admin-case-edit',{id:c.id,name:'Empty',price:7,drops:[]}),/предметы/);assert.deepEqual(c.drops,[item.id])});
test('subscription reward requires subscription plus a noncancelled share and consumes it once',async()=>{const db=localDatabase(':memory:'),identity={id,name:'P',telegramProfile:{id:42,first_name:'P',last_name:''}};try{
 db.sqlite.exec(await fs.readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));
 async function req(action,data,options={}){const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,requestId:crypto.randomUUID(),data})}),db,identity,options);return {status:r.status,j:await r.json()}}
 const options={checkSubscription:async()=>true,prepareBonusShare:async()=>({messageId:'prepared',expiresAt:Date.now()+600000})};
 assert.equal((await req('bonus-claim',{key:'sub',subscriptionVerified:true},options)).status,400);
 const prepared=await req('bonus-share-prepare',{},options);assert.equal(prepared.status,200);
 assert.equal((await req('bonus-share-complete',{nonce:prepared.j.result.nonce,sent:false})).status,400);
 assert.equal((await req('bonus-claim',{key:'sub'},options)).status,400);
 assert.equal((await req('bonus-share-complete',{nonce:'wrong',sent:true})).status,400);
 assert.equal((await req('bonus-share-complete',{nonce:prepared.j.result.nonce,sent:true})).status,200);
 assert.equal((await req('bonus-claim',{key:'sub',subscriptionVerified:true},{checkSubscription:async()=>false})).status,400);
 const accepted=await req('bonus-claim',{key:'sub'},options);assert.equal(accepted.status,200);assert.equal(accepted.j.user.fc[200001],1);
 assert.equal((await req('bonus-claim',{key:'sub'},options)).status,400);
 }finally{db.sqlite.close()}});
test('seven remaining catalog icons are embedded RGBA PNG cutouts',async()=>{const art=JSON.parse(await fs.readFile(new URL('../assets/brainrots/additional-art.json',import.meta.url)));for(const name of ["Cupid's Wings",'Wave Rider',"Witch's Broom","Santa's Sleigh",'Rainbow Hammer','Lavaka','gold gold gold']){assert(art[name].startsWith('data:image/png;base64,'));const bytes=Buffer.from(art[name].split(',')[1],'base64');assert.equal(bytes[25],6);assert(bytes.readUInt32BE(16)<=320&&bytes.readUInt32BE(20)<=320)}});
