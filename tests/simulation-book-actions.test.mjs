import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fresh,account,execute,simulationSlots,view} from '../server/model.mjs';
import seed from '../server/seed.json' with {type:'json'};
function fixture(){const s=fresh(seed,'owner');for(const id of ['owner','p','other'])account(s,id,id);const item=seed.items.find(x=>x.id===55);s.users.p.inv=[{uid:1,id:item.id}];s.users.p.uid=2;const now=Date.parse('2026-11-04T12:00:00Z'),at=simulationSlots(s,now).slots[0].at,record=execute(s,'p',seed,'simulation-book',{at,nick:'Player_42',createdAt:1,plan:[{uid:1,target:item.id,q:1}]},now).booking;return {s,now,at,record}}
test('only the record owner or admin can cancel; cancelling frees its slot without changing inventory or balance',()=>{
 const {s,now,at,record}=fixture(),before=JSON.stringify({...s.users.p,inv:record.reserved});assert.equal(s.users.p.inv.length,0);assert.equal(record.createdAt,now);assert.throws(()=>execute(s,'other',seed,'simulation-book-cancel',{id:record.id},now));
 execute(s,'p',seed,'simulation-book-cancel',{id:record.id},now);assert.equal(record.status,'cancelled');assert.equal(record.createdAt,now);assert.equal(view(s,'owner',seed,now).config.simulationBookings[0].createdAt,now);assert.equal(JSON.stringify(s.users.p),before);assert(simulationSlots(s,now).slots.some(x=>x.at===at));assert.throws(()=>execute(s,'p',seed,'simulation-book-cancel',{id:record.id},now));
 assert.equal(view(s,'p',seed,now).user.simulationBookings[0].status,'cancelled');assert.equal(view(s,'other',seed,now).user.simulationBookings.length,0);
});
test('only admin can complete after the scheduled five minutes, once, without issuing any items or tokens',()=>{
 const {s,at,record}=fixture(),before=JSON.stringify({...s.users.p,inv:record.reserved});assert.equal(s.users.p.inv.length,0);assert.throws(()=>execute(s,'p',seed,'simulation-book-complete',{id:record.id},at+300000));assert.throws(()=>execute(s,'owner',seed,'simulation-book-complete',{id:record.id},at+299999));
 execute(s,'owner',seed,'simulation-book-complete',{id:record.id},at+300000);assert.equal(record.status,'completed');assert.equal(JSON.stringify(s.users.p),before);assert.equal(s.withdrawals.length,0);assert.throws(()=>execute(s,'owner',seed,'simulation-book-complete',{id:record.id},at+300001));assert.throws(()=>execute(s,'p',seed,'simulation-book-cancel',{id:record.id},at+300001));
});
test('profile has a withdrawals tab with its schedule, status and cancel action',async()=>{
 const source=await fs.readFile(new URL('../client/simulation.js',import.meta.url),'utf8'),start=source.indexOf("var profileRecordTab='main'"),end=source.indexOf("document.addEventListener('click',async",start),{record}=fixture();
 const c=vm.createContext({profilePage:()=>'<div class="brain-profile">Profile</div>',S:{simulationBookings:[record]},A:{simulationBookings:[{...record,username:'@PlayerOnTelegram'}]},U:{ptab:'main'},esc:String,fmt:String,Date:{now:()=>0},wqAdminHtml:()=>''});vm.runInContext(source.slice(start,end),c);
 assert.match(c.profilePage(),/>Выводы</);c.profileRecordTab='withdrawals';const html=c.profilePage();assert.match(html,/Заявка создана:/);assert.match(html,/04\.11\.2026.*14:00/);assert.match(html,/Вывод назначен:/);assert.match(html,/08\.11\.2026.*12:00/);assert.match(html,/Player_42/);assert.match(html,/Отменить запись/);assert.match(html,/без передачи предметов/);assert.match(c.wqAdminHtml(),/Завершить запись/);assert.match(c.wqAdminHtml(),/Ник: Player_42/);assert.match(c.wqAdminHtml(),/Telegram: @PlayerOnTelegram/);assert.doesNotMatch(html,/Telegram:/);assert.match(c.simulationBookingCard({...record,userId:'tg:123',username:''},true),/Telegram: ID 123 \(без @username\)/);assert.match(c.wqAdminHtml(),/Заявка создана:/);assert.match(c.wqAdminHtml(),/Вывод назначен:/);delete record.createdAt;assert.match(c.simulationBookingCard(record,false),/Не сохранено для старой заявки/);assert.match(c.simulationBookingDateTime(Date.parse('2026-07-01T12:00:00Z')),/01\.07\.2026.*15:00/);
});

test('existing withdrawal bookings display the current verified Telegram username only in the admin view',()=>{
 const {s,now,record}=fixture();
 assert.equal(record.username,undefined);
 s.users.p.telegramUsername='CurrentPlayer';
 const admin=view(s,'owner',seed,now).config.simulationBookings;
 assert.equal(admin[0].nick,'Player_42');
 assert.equal(admin[0].username,'CurrentPlayer');
 assert.equal(view(s,'p',seed,now).config.simulationBookings[0].username,undefined);
 assert.equal(view(s,'other',seed,now).config.simulationBookings.length,0);
 assert.equal(record.username,undefined);
 s.users.p.telegramUsername='';
 assert.equal(view(s,'owner',seed,now).config.simulationBookings[0].username,'');
});
