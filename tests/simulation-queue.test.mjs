import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fresh,account,execute,simulationTopupView} from '../server/model.mjs';
import {handle,readTopups} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import seed from '../server/seed.json' with {type:'json'};
test('reviewer nickname is owner-only, validated and pinned when shown',()=>{
 const s=fresh(seed,'owner');account(s,'owner','Owner');account(s,'p');const item=seed.items[0],now=1000;
 assert.throws(()=>execute(s,'p',seed,'simulation-reviewer',{nick:'Other'}));
 for(const nick of ['a','x'.repeat(33),'bad\nname'])assert.throws(()=>execute(s,'owner',seed,'simulation-reviewer',{nick}));
 execute(s,'owner',seed,'simulation-reviewer',{nick:'Reviewer_1'});assert.equal(s.config.simulationReviewerNick,'Reviewer_1');
 const t=execute(s,'p',seed,'simulation-topup',{items:[{id:item.id,q:1}]},now).topup;assert.equal(t.reviewer,'');
 const shown=execute(s,'owner',seed,'simulation-show',{id:t.id},now+1).topup;assert.equal(shown.reviewer,'Reviewer_1');
 execute(s,'owner',seed,'simulation-reviewer',{nick:'Reviewer_2'});assert.equal(s.simulationTopups[0].reviewer,'Reviewer_1');
 assert.equal(s.users.p.balance,0);assert.equal(s.topups.length,0);
});
test('free queue hides the reviewer until owner shows it; rejection and expiry never credit either balance',()=>{
 const s=fresh(seed,'owner');for(const id of ['owner','partner','a','b'])account(s,id,id);
 execute(s,'owner',seed,'admin-partner',{userId:'partner',code:'PARTNER',pct:50,bonus:0});const now=1000,item=seed.items[0],data={items:[{id:item.id,q:1}],promo:'PARTNER'};
 const a=execute(s,'a',seed,'simulation-topup',data,now).topup,b=execute(s,'b',seed,'simulation-topup',data,now+1).topup;
 assert.equal(a.position,1);assert.equal(b.position,2);assert.equal(b.number,a.number+1);assert.equal(a.reviewer,'');assert.equal(s.users.a.balance,0);
 assert.throws(()=>execute(s,'a',seed,'simulation-show',{id:a.id},now+2),/владельцу/);
 assert.throws(()=>execute(s,'owner',seed,'simulation-review',{id:a.id,status:'ok'},now+2),/Показать ник/);
 const shown=execute(s,'owner',seed,'simulation-show',{id:a.id},now+2).topup;assert.equal(shown.reviewer,'owner');assert.equal(shown.st,'ready');assert.equal(shown.expiresAt,now+600002);
 assert.equal(simulationTopupView(s,s.simulationTopups[1],now+3).position,1);
 execute(s,'owner',seed,'simulation-review',{id:a.id,status:'no'},now+3);assert.equal(s.users.a.balance,0);assert.equal(s.partners.PARTNER.pending,0);assert.equal(s.partners.PARTNER.vol,0);
 assert.throws(()=>execute(s,'owner',seed,'simulation-review',{id:a.id,status:'ok'},now+4),/обработана/);
 assert.equal(simulationTopupView(s,s.simulationTopups[1],b.expiresAt).st,'expired');assert.throws(()=>execute(s,'owner',seed,'simulation-show',{id:b.id},b.expiresAt),/истекло/);
 assert.equal(s.users.b.balance,0);assert.equal(s.topups.length,0);
});
test('queue status endpoint is private, read-only and reveals only the internal reviewer after show',async()=>{
 const db=localDatabase();try{
  db.sqlite.exec(await fs.readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));const owner={id:'tg:1116312381',name:'InternalReviewer'},a={id:'tg:42'},b={id:'tg:43'};
  async function req(who,action='state',data={}){const r=await handle(new Request('https://test/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,requestId:crypto.randomUUID()})}),db,who);return {status:r.status,j:await r.json()}}
  for(const who of [owner,a,b])await req(who);const item=seed.items[0],r=await req(a,'simulation-topup',{items:[{id:item.id,q:1}]});const id=r.j.result.topup.id;
  const status=async who=>await(await readTopups(new Request('https://test/api/topups'),db,who)).json();let poll=await status(a);assert.equal(poll.topups[0].position,1);assert.equal(poll.topups[0].reviewer,'');assert.equal((await status(b)).topups.length,0);
  const revision=db.sqlite.prepare('SELECT revision FROM site_state WHERE id=1').get().revision;await status(a);assert.equal(db.sqlite.prepare('SELECT revision FROM site_state WHERE id=1').get().revision,revision);
  assert.equal((await req(b,'simulation-review',{id,status:'ok'})).status,400);await req(owner,'simulation-show',{id});poll=await status(a);assert.equal(poll.topups[0].reviewer,'InternalReviewer');assert.equal(poll.balance,0);await req(owner,'simulation-review',{id,status:'ok'});poll=await status(a);assert.equal(poll.balance,item.price);assert.equal(poll.topups[0].st,'ok');assert.equal((await readTopups(new Request('https://test/api/topups'),db,null)).status,401);
 }finally{db.sqlite.close()}
});
