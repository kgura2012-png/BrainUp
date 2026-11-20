import {applyCaseCatalogRecovery} from './case-catalog-recovery.mjs';
import {readBrainupState, saveBrainupState} from './state-storage.mjs';
import {uahTopupView} from './uah-topups.mjs';
import { account, execute, fresh, random, view, publicFeed, topupStatus, simulationTopupView, minePatchView } from './model.mjs';
import {isFiftyFiftyCase} from '../shared/case-odds.mjs';
import seed from './seed.json' with { type: 'json' };
import {migrationBackup} from './migration-backup.mjs';
import {publicPlayerProfile,telegramReferralUrl} from './player-profile.mjs';
export function adminPlayerList(state){return Object.values(state.users).map(u=>({id:u.id,username:u.telegramUsername||'',telegramName:u.telegramName||'',name:u.me,balance:u.balance,inventoryCount:u.inv.length,banned:!!u.banned}));}
async function adminInventoryVersion(entries) {
  const source = JSON.stringify(entries.map(({uid, id}) => [uid, id]));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function adminInventoryGroups(state, entries) {
  const names = new Map([...seed.items, ...(state.config.custom || [])].map(item => [item.id, item.name]));
  const groups = new Map();
  for (const {id} of entries) {
    if (!groups.has(id)) groups.set(id, {id, name: names.get(id) || 'Предмет №' + id, count: 0});
    groups.get(id).count++;
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id - b.id);
}

export async function readFeed(request,db,identity){
  if(!identity?.id)return Response.json({ok:false,error:'Войдите в аккаунт'},{status:401});
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  const row=await readBrainupState(db);
  const snapshot=row?JSON.parse(row.data):null;
  if(snapshot?.users[identity.id]?.banned)return Response.json({ok:false,error:'Доступ заблокирован'},{status:403});
  return Response.json({ok:true,...(snapshot?publicFeed(snapshot):{drops:[],topDrop:null})},{headers:{'Cache-Control':'no-store'}});
}
export async function readTopups(request,db,identity){
 if(!identity?.id)return Response.json({ok:false,error:'Войдите в аккаунт'},{status:401});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 const row=await readBrainupState(db),state=row?JSON.parse(row.data):null,user=state?.users[identity.id];
 if(user?.banned)return Response.json({ok:false,error:'Доступ заблокирован'},{status:403});
 const now=Date.now();return Response.json({ok:true,now,topupsClosed:!!state?.config.topupsClosed,topupsStarsClosed:!!(state?.config.topupsClosed||state?.config.topupsStarsClosed),topupsItemsClosed:!!(state?.config.topupsClosed||state?.config.topupsItemsClosed),topupsGearsClosed:!!(state?.config.topupsClosed||state?.config.topupsGearsClosed),topupsUahClosed:!!(state?.config.topupsClosed||state?.config.topupsUahClosed),uahConfigured:!!state?.config.uahCard,uahTopups:(state?.uahTopups||[]).filter(x=>x.userId===identity.id).map(x=>uahTopupView(x,now)),balance:user?.balance||0,topups:(state?.simulationTopups||[]).filter(x=>x.userId===identity.id).map(x=>simulationTopupView(state,x,now))},{headers:{'Cache-Control':'no-store'}});
}
export async function handle(request, db, identity, options={}) {
  const receivedAt=Date.now();
  const json=(data,status=200)=>Response.json({...data,demo:true,telegram:identity?.telegramProfile||null},{status,headers:{'Cache-Control':'no-store'}});
  if(!identity?.id)return json({ok:false,error:'Войдите через Telegram',telegramLogin:true},401);
  if(!db)return json({ok:false,error:'База данных не подключена'},503);
  if(request.method==='POST'){
    const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({ok:false,error:'Недопустимый источник'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({ok:false,error:'Ожидается JSON'},415);
  }
  let body={action:'state',requestId:crypto.randomUUID(),data:{}};
  if(request.method==='POST'){try{const raw=await request.text();if(raw.length>5_000_000)return json({ok:false,error:'Запрос слишком большой'},413);body=JSON.parse(raw);}catch{return json({ok:false,error:'Некорректный запрос'},400);}}
  if(!/^[a-z-]{1,40}$/.test(body.action||'')||!/^[-a-zA-Z0-9]{8,80}$/.test(body.requestId||''))return json({ok:false,error:'Некорректное действие'},400);
  if(body.action==='admin-backup')return migrationBackup(db,identity);
  if(body.action==='admin-inventory-view'){
    const row = await readBrainupState(db);
    const state = row && JSON.parse(row.data);
    if (!state || state.owner !== identity.id) return json({ok:false,error:'Доступ только владельцу'},403);
    const userId = body.data?.userId;
    if (typeof userId !== 'string' || !Object.hasOwn(state.users, userId)) {
      return json({ok:false,error:'Игрок не найден'},404);
    }
    const entries = state.users[userId].inv;
    return json({ok:true, inventory:{
      total: entries.length,
      version: await adminInventoryVersion(entries),
      groups: adminInventoryGroups(state, entries)
    }});
  }
  if (options.migrationReadOnly && body.action === 'admin-inventory-remove') {
    return json({ok:false,error:'Идёт перенос. Изменение инвентаря временно недоступно.'},503);
  }
  if(['player-profile','referral-info'].includes(body.action)){
    const row=await readBrainupState(db),state=row?JSON.parse(row.data):null;
    if(!state)return json({ok:false,error:'Игрок не найден'},404);
    if(state.users[identity.id]?.banned)return json({ok:false,error:'Доступ заблокирован'},403);
    try{
      if(body.action==='player-profile')return json({ok:true,result:{profile:publicPlayerProfile(state,seed,body.data)}});
      const partner=Object.values(state.partners).find(partner=>partner.userId===identity.id&&!partner.disabled);
      if(!partner)return json({ok:false,error:'Доступно только партнёру'},403);
      const username=await options.getBotUsername?.();
      return json({ok:true,result:{url:telegramReferralUrl(username,partner.code),code:partner.code}});
    }catch(error){return json({ok:false,error:error.message},body.action==='player-profile'?404:503)}
  }
  if(options.migrationReadOnly)return json({ok:false,error:'Идёт перенос сайта. Попробуйте немного позже.'},503);
  if(['topup','withdraw','partner-withdraw','admin-topup','admin-withdraw','admin-trade','virtual-topup','virtual-withdraw','admin-recipient','admin-topup-show','admin-virtual-request'].includes(body.action))return json({ok:false,error:'Операция недоступна'},403);
  if(body.action.startsWith('rocket-'))return json({ok:false,error:'Режим удалён'},410);
  let subscriptionVerified=false;
  if((body.action==='bonus-claim'&&body.data?.key==='sub'||body.action==='bonus-sub-check')){
    if(!identity.id.startsWith('tg:')||!options.checkSubscription)return json({ok:false,error:'Откройте приложение через Telegram для проверки подписки'},400);
    try{subscriptionVerified=await options.checkSubscription(identity.telegramProfile?.id||Number(identity.id.slice(3)))}catch(error){return json({ok:false,error:error.message||'Не удалось проверить подписку'},400)}
  }
  if(body.action==='bonus-sub-check')body.data={subscriptionVerified};
  if(body.action==='bonus-claim')body.data={key:body.data?.key,subscriptionVerified};
  let tagName,preparedShare;
  if(body.action==='bonus-tag-check'||body.action==='bonus-claim'&&body.data?.key==='nick'||body.action==='case'&&Number(body.data?.id)===200003){
    if(!identity.id.startsWith('tg:')||!options.getTelegramName)return json({ok:false,error:'Откройте приложение в Telegram'},400);
    try{tagName=await options.getTelegramName(Number(identity.id.slice(3)))}catch{return json({ok:false,error:'Не удалось проверить имя Telegram. Запустите бота и повторите.'},400)}
    if(body.action==='bonus-tag-check')body.data={name:tagName};
  }
  if(body.action==='bonus-share-prepare'){
    if(!identity.id.startsWith('tg:')||!options.prepareBonusShare)return json({ok:false,error:'Отправка приглашения доступна в Telegram'},400);
    try{preparedShare=await options.prepareBonusShare(Number(identity.id.slice(3)));body.data={...preparedShare,nonce:crypto.randomUUID()}}catch{return json({ok:false,error:'Не удалось подготовить приглашение. Повторите позже.'},400)}
  }
  const compact=['mines-start','mines-open','mines-cash','dice','upgrade','fuse','fuse-hit','rocket-place','rocket-cancel','rocket-status','rocket-cash'].includes(body.action);
  // A write conflict can retry settlement, but it must not reroll this upgrade.
  let upgradeDraw;
  const draw=body.action==='upgrade'?()=>upgradeDraw??=random():random;
  for(let attempt=0;attempt<12;attempt++){
    let row=await readBrainupState(db);
    if(!row){
      await db.prepare('INSERT OR IGNORE INTO site_state (id, revision, data) VALUES (1, 0, ?)').bind(JSON.stringify(fresh(seed,'telegram-admin-pending'))).run();
      row=await readBrainupState(db);
    }
    const state=JSON.parse(row.data);
    const recoveredCases=applyCaseCatalogRecovery(state.config, options.caseCatalogRecovery, seed);
    const initializedAutoPromo=!Number.isSafeInteger(state.config.autoPromoSeed);
    if(initializedAutoPromo)state.config.autoPromoSeed=crypto.getRandomValues(new Uint32Array(1))[0];
    const refreshedCaseOdds=!state.config.caseOddsV146;
    if(refreshedCaseOdds){for(const c of state.config.cases){if(isFiftyFiftyCase(c))c.drops=[55,95]}state.config.caseOddsV146=true;}
    const restoredActivationCases=!state.config.activationCasesV145;
    if(restoredActivationCases){
      const ids=[200001,200003];state.config.delp=(state.config.delp||[]).filter(id=>!ids.includes(id));
      for(const id of ids){const preset=seed.cases.find(c=>c.id===id),existing=state.config.cases.find(c=>c.id===id);if(existing)Object.assign(existing,{name:preset.name,sectionId:'free'});else state.config.cases.push({...structuredClone(preset),sectionId:'free'});}
      if(Array.isArray(state.config.caseSections)&&!state.config.caseSections.some(section=>section.id==='free'))state.config.caseSections.unshift({id:'free',name:'Бесплатные кейсы'});
      state.config.activationCasesV39=true;state.config.activationCasesV145=true;
    }

    for(const bonus of seed.cases.filter(c=>c.bonus&&!(state.config.delp||[]).includes(c.id))){
      const existing=state.config.cases.find(c=>c.id===bonus.id);
      if(!existing)state.config.cases.push(structuredClone(bonus));
      else Object.assign(existing,{bonus:1,grp:'bonus',bonusKey:bonus.bonusKey});
    }
    state.telegramAdminId='tg:1116312381';
    state.owner=state.telegramAdminId;
    if(state.users[identity.id]?.banned&&identity.id!==state.owner)return json({ok:false,error:'Доступ заблокирован'},403);
    let retiredRocket=false;const previousRound=state.users[identity.id]?.rocket;if(previousRound){const retired=state.users[identity.id];if(previousRound.item)retired.inv.push(previousRound.item);else retired.balance=Math.round((retired.balance+previousRound.value)*100)/100;retired.rocket=null;retiredRocket=true;}
    const current=state.users[identity.id],verifiedUsername=identity.id.startsWith('tg:')?(identity.telegramProfile?.username??identity.telegramUsername):undefined;
    const verifiedName=identity.telegramProfile?[identity.telegramProfile.first_name,identity.telegramProfile.last_name].filter(Boolean).join(' '):undefined;
    const usernameChanged=(verifiedUsername!==undefined&&current?.telegramUsername!==verifiedUsername)||(verifiedName!==undefined&&current?.telegramName!==verifiedName);
    if(body.action==='state'&&current&&!current.rocket&&!usernameChanged&&!retiredRocket&&!restoredActivationCases&&!refreshedCaseOdds&&!initializedAutoPromo&&!recoveredCases){
      const answer=view(state,identity.id,seed);
      if(answer.admin)answer.players=adminPlayerList(state);
      return json(answer);
    }
    const user=account(state,identity.id,identity.name);
    if(verifiedUsername!==undefined)user.telegramUsername=String(verifiedUsername).replace(/^@/,'').slice(0,32);
    if(verifiedName!==undefined&&!user.telegramNameVerifiedAt)user.telegramName=verifiedName.slice(0,256);
    if(tagName!==undefined){user.telegramName=tagName;user.telegramNameVerifiedAt=Date.now()}
    const key=identity.id+':'+body.requestId;let result=state.receipts[key];
    if(result){if(body.action==='mines-open'&&!result.end)return json(minePatchView(state,identity.id,result));const answer={...view(state,identity.id,seed,Date.now(),{compact}),result};if(answer.admin&&!compact)answer.players=adminPlayerList(state);return json(answer);}
    if (body.action === 'admin-inventory-remove') {
      if (state.owner !== identity.id) return json({ok:false,error:'Доступ только владельцу'},403);
      const userId = body.data?.userId;
      if (typeof userId !== 'string' || !Object.hasOwn(state.users, userId)) {
        return json({ok:false,error:'Игрок не найден'},404);
      }
      if (body.data.version !== await adminInventoryVersion(state.users[userId].inv)) {
        return json({ok:false,error:'Инвентарь изменился. Проверьте список перед повторным списанием.'},409);
      }
    }
    try { result=execute(state,identity.id,seed,body.action,body.data||{},body.action==='rocket-cash'?receivedAt:Date.now(),draw); }
    catch(e){return json({ok:false,error:e.message},400);}
    state.receipts[key]=result;
    const keys=Object.keys(state.receipts);if(keys.length>5000)for(const k of keys.slice(0,keys.length-5000))delete state.receipts[k];
    const update=await saveBrainupState(db, row.revision, state);
    if(update.meta.changes){if(['collaboration-review','collaboration-notify-retry'].includes(body.action)&&options.onCollaborationDecision){const notification=await deliverCollaborationDecision(db,result.application.id,options.onCollaborationDecision);result.application.notification=notification;const app=state.collaborationApplications?.find(x=>x.id===result.application.id);if(app)app.notification=notification;}if(body.action==='uah-topup'&&result.topup?.type==='uah'&&options.onUahTopupCreated)try{const work=options.onUahTopupCreated(result.topup);if(work?.catch)work.catch(()=>{})}catch{}if(body.action==='simulation-topup'&&result.topup?.simulation===true&&result.topup.free===true&&options.onSimulationTopupCreated)try{const notification=options.onSimulationTopupCreated(result.topup);if(notification?.catch)notification.catch(()=>{})}catch{}if(body.action==='mines-open'&&!result.end)return json(minePatchView(state,identity.id,result));const answer={...view(state,identity.id,seed,Date.now(),{compact}),result};if(answer.admin&&!compact)answer.players=adminPlayerList(state);return json(answer);}
  }
  return json({ok:false,error:'Слишком много одновременных операций. Повторите запрос.'},409);
}

// Polling a running rocket is read-only and never competes with cash-out writes.
export async function readRocket(request,db,identity,now=Date.now()){
 if(!identity?.id)return Response.json({ok:false,error:'Войдите в аккаунт'},{status:401});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 const row=await readBrainupState(db),state=row?JSON.parse(row.data):null,u=state?.users[identity.id];
 if(u?.banned)return Response.json({ok:false,error:'Доступ заблокирован'},{status:403});
 const g=u?.rocket;let phase='done',mult=1;
 if(g){const end=g.start+Math.log(g.crash)/.00012,autoEnd=g.auto>=1.01&&g.auto<g.crash?g.start+Math.log(g.auto)/.00012:Infinity;phase=now>=Math.min(end,autoEnd)?'settle':now<g.start?'wait':'fly';if(phase==='fly')mult=Math.exp(.00012*(now-g.start))}
 return Response.json({ok:true,now,phase,start:g?.start||0,mult},{headers:{'Cache-Control':'no-store'}});
}

// A short persisted lease prevents concurrent retries from sending twice.
export async function deliverCollaborationDecision(db,applicationId,send){
 const claim=crypto.randomUUID();let application;
 async function update(change){for(let attempt=0;attempt<12;attempt++){const row=await readBrainupState(db);if(!row)return null;const state=JSON.parse(row.data),record=(state.collaborationApplications||[]).find(x=>x.id===applicationId);if(!record)return null;const result=change(record);if(result===false)return record.notification||{state:'unavailable'};const saved=await saveBrainupState(db, row.revision, state);if(saved.meta.changes){application=structuredClone(record);return record.notification}}throw Error('Не удалось сохранить статус уведомления');}
 const current=await update(record=>{const note=record.notification||{};if(note.state==='sent'||note.state==='sending'&&note.leaseUntil>Date.now())return false;record.notification={state:'sending',attempts:(note.attempts||0)+1,claim,leaseUntil:Date.now()+15000};});
 if(!application||current?.claim!==claim)return current;
 let outcome;
 try{const sent=await send(application);outcome=sent?{state:'sent',sentAt:Date.now()}:{state:'unavailable',error:'Доставка в бот доступна только для аккаунта Telegram'};}catch(error){outcome={state:'failed',error:String(error.message||'Не удалось отправить сообщение').slice(0,200)}}
 return await update(record=>{if(record.notification?.claim!==claim)return false;record.notification={...outcome,attempts:record.notification.attempts};})||outcome;
}
