import {upgradeSuccessChance} from '../shared/upgrade-chance.mjs';
import {shopPurchasePrice} from '../shared/shop-price.mjs';
import {withCatalogPrice} from '../shared/catalog-prices.mjs';
import {buffTopupQuote} from '../shared/buffs.mjs';
import {executeUahTopup,uahTopupView} from './uah-topups.mjs';
import {capturePartnerGame,settlePartnerGame,recordPartnerDeposit} from './partner-accounting.mjs';
import {isFiftyFiftyCase,pickCaseItem,FREE_CASE_ODDS} from '../shared/case-odds.mjs';
import {dropPlayerId} from './player-profile.mjs';
import {caseSectionList,caseSectionFor} from '../shared/case-sections.mjs';
// All amounts use two decimal places. Client state is never accepted as money.
export const money = n => Math.round(n * 100) / 100;
export const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const AUTO_PROMO_WORDS=['UPGRADE','DRAGON','CANNELLONI','TRALALERO','BOMBADINO','CANDYSLAP','BRAINROT','TUNGTUNG','GARAMA','CAPPUCCINO','TRIPITROPI','SPAGHETTI'];
export function winterPromotion(now=Date.now(),seed=0) {
  const period=7200000,slot=Math.floor(now/period);
  let value=(Math.imul(slot,0x9e3779b1)^(seed>>>0))>>>0;
  value=Math.imul(value^(value>>>16),0x85ebca6b)>>>0;value=Math.imul(value^(value>>>13),0xc2b2ae35)>>>0;value=(value^(value>>>16))>>>0;
  const word=AUTO_PROMO_WORDS[value%AUTO_PROMO_WORDS.length],suffix=(value>>>0).toString(36).toUpperCase().padStart(4,'0').slice(-4);
  return {code:'BU-'+word+'-'+suffix,bonus:9,expiresAt:(slot+1)*period,serverNow:now};
}
export function partnerClaimOpen(now=Date.now()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Kyiv',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(part=>[part.type,part.value]));
  return parts.weekday==='Sun'&&Number(parts.hour)>=12&&Number(parts.hour)<22;
}
export const RULES = { dropExponent: 1.8, rocketTail: 1.6, rocketEdge: .94, rocketMax: 1000, growth: .00012 };
const GEAR_TOPUP_IDS = [19,20,22,24,53,56];
export const TOPUP_EXCLUDED_IDS = [25,28,29,33,36];
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const norm = s => String(s || '').trim().toUpperCase();

function resolveCaseSectionInput(config,data,fallback='other') {
  const sections=caseSectionList(config);
  if(data.sectionName!=null){
    const name=String(data.sectionName).trim().replace(/\s+/g,' ');
    assert(name.length>0&&name.length<=60&&!/[\u0000-\u001f\u007f]/.test(name),'Название раздела: от 1 до 60 символов');
    const existing=sections.find(section=>section.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru'));
    if(existing)return existing.id;
    assert(sections.length<40,'Можно создать до 40 разделов');
    const section={id:'section-'+crypto.randomUUID(),name};sections.push(section);config.caseSections=sections;return section.id;
  }
  const sectionId=data.sectionId==null?fallback:String(data.sectionId);
  assert(sections.some(section=>section.id===sectionId),'Раздел не найден');return sectionId;
}

export function weightedPick(items, rng = random) {
  let total = items.reduce((s, x) => s + x.price ** -RULES.dropExponent, 0), roll = rng() * total;
  for (const item of items) { roll -= item.price ** -RULES.dropExponent; if (roll <= 0) return item; }
  return items.at(-1);
}
export function rocketCrash(rng = random) {
  return Math.min(RULES.rocketMax, Math.max(1, Math.floor((RULES.rocketEdge / (1 - rng())) ** (1 / RULES.rocketTail) * 100) / 100));
}
export function sundayKey(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date(now));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  const date = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (7 - ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday)) % 7);
  return date.toISOString().slice(0,10);
}
export function isSunday(now) { return new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Kyiv',weekday:'short'}).format(new Date(now)) === 'Sun'; }
export function saturdayKey(now=Date.now()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(now).map(part=>[part.type,part.value]));
  const date=new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`),weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday);date.setUTCDate(date.getUTCDate()+(6-weekday+7)%7);return date.toISOString().slice(0,10);
}
// An isolated appointment simulator; it never reserves or transfers external items.
export function simulationSlots(s,now=Date.now()){
  let date=sundayKey(now);
  function noon(day){const utc=Date.parse(day+'T12:00:00Z'),p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(utc).map(x=>[x.type,x.value]));return utc-(Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`)-utc);}
  if(noon(date)+8*3600000<=now){date=new Date(Date.parse(date+'T12:00:00Z')+7*86400000).toISOString().slice(0,10);}
  const start=noon(date),booked=new Set((s.simulationBookings||[]).filter(x=>x.status==='booked').map(x=>x.at));
  return {date,timeZone:'Europe/Kyiv',slots:Array.from({length:96},(_,i)=>({at:start+i*300000,time:String(12+Math.floor(i/12)).padStart(2,'0')+':'+String(i%12*5).padStart(2,'0')})).filter(x=>x.at>now&&!booked.has(x.at))};
}
export function fresh(seed, owner) { return { owner, users:{}, config:{autoPromoSeed:crypto.getRandomValues(new Uint32Array(1))[0],custom:[],imgs:{},nid:1000,cases:structuredClone(seed.cases),cnid:200004,tpc:{},tradeNick:''}, partners:{}, promos:{}, withdrawals:[], topups:[], receipts:{} }; }
export function account(state, id, name) {
  if (!state.users[id]) state.users[id] = {id,me:name || 'Player',balance:0,inv:[],uid:1,win:0,lose:0,upg:0,fc:{},bound:'',pending:null,bn:{sp:0}};
  return state.users[id];
}
const catalog = (s, seed) => [...seed.items,...s.config.custom].filter(item=>!item.hidden).map(item=>withCatalogPrice(item,s.config.itemPrices));
const own = (s,id) => assert(s.owner === id, 'Доступ только владельцу');
const itemBy = (s,seed,id,allowHidden=false) => { const it=[...seed.items,...s.config.custom].find(x=>x.id===Number(id));assert(it&&(allowHidden||!it.hidden),'Предмет не найден');return withCatalogPrice(it,s.config.itemPrices); };
function debit(u, value) { assert(Number.isFinite(value) && value > 0 && u.balance >= value, 'Недостаточно монет');u.balance=money(u.balance-value); }
function take(u, ids) {
  assert(Array.isArray(ids)&&ids.length>0&&ids.length<=100,'Выберите предметы');
  const set=new Set(ids.map(Number));assert(set.size===ids.length,'Повтор предмета');
  const items=u.inv.filter(x=>set.has(x.uid));assert(items.length===set.size,'Предмет уже использован');
  u.inv=u.inv.filter(x=>!set.has(x.uid));return items;
}
function add(u,id,extra={}) { const x={uid:u.uid++,id,...extra};u.inv.push(x);return x; }
function pay(u,s,seed,value) {
  const it=catalog(s,seed).filter(x=>x.price<=value).sort((a,b)=>b.price-a.price)[0];
  if(it)add(u,it.id);const change=money(value-(it?.price||0));u.balance=money(u.balance+change);return {item:it||null,change};
}
function stake(u,s,seed,b) {
  assert(b&&['coin','item'].includes(b.type),'Выберите ставку');
  if(b.type==='coin'){const value=money(Number(b.amt));debit(u,value);return {value,item:null};}
  const [x]=take(u,[Number(b.uid)]);return {value:itemBy(s,seed,x.id,true).price,item:x};
}
function partner(s,id) { return Object.values(s.partners).find(p=>p.userId===id); }
function bind(s,u,code) {
  assert(!u.bound,'Реферальный код уже привязан навсегда');
  const p=s.partners[norm(code)];assert(p&&!p.disabled,'Код не найден');assert(p.userId!==u.id,'Нельзя привязать свой код');
  u.bound=p.code;p.list.push({k:u.id,name:u.me,vol:0,earned:0,ts:Date.now()});p.count=p.list.length;return p;
}
function reserve(s,u,now,data) {
  const date=sundayKey(now), position=s.withdrawals.filter(x=>x.date===date).length+1;
  const rec={id:crypto.randomUUID(),time:now,userId:u.id,user:u.me,nick:data.nick||u.me,status:'pending',date,position,...data};
  s.withdrawals.push(rec);return rec;
}
function settleRocket(s,u,seed,now,manual=false) {
  const g=u.rocket;if(!g)return null;
  if(manual)assert(now>=g.start,'Раунд ещё не начался');
  const end=g.start+Math.log(g.crash)/RULES.growth;
  if(now<end&&!manual)return null;
  let x=0;
  if(g.auto>=1.01&&g.auto<g.crash&&now>=g.start+Math.log(g.auto)/RULES.growth)x=g.auto;
  else if(manual&&now>=g.start&&now<end)x=Math.floor(Math.exp(RULES.growth*(now-g.start))*100)/100;
  const result={mult:x,crash:g.crash,won:x>0};if(x)Object.assign(result,pay(u,s,seed,money(g.value*x)));
  u.rocket=null;return result;
}
export function topupStatus(s,record,now=Date.now()){
  const expired=['new','ready'].includes(record.st)&&record.expiresAt&&now>=record.expiresAt,st=expired?'expired':record.st;
  const waiting=s.topups.filter(x=>x.virtual&&x.st==='new'&&(!x.expiresAt||x.expiresAt>now));
  return {...record,st,recipient:['ready','ok'].includes(st)?record.recipient||'':'',position:st==='new'?waiting.findIndex(x=>x.id===record.id)+1:0,queueCount:waiting.length};
}
export function simulationTopupView(s,record,now=Date.now()){
  const waiting=(s.simulationTopups||[]).filter(x=>x.free===true&&x.simulation===true&&x.st==='new'&&x.expiresAt>now);
  const st=['new','ready'].includes(record.st)&&record.expiresAt<=now?'expired':record.st;
  return {...record,st,reviewer:['ready','ok'].includes(st)?record.reviewer||'':'',position:st==='new'?waiting.findIndex(x=>x.id===record.id)+1:0,queueCount:waiting.length};
}
export function minePatchView(s,id,result){const g=s.users[id].mine;return {ok:true,admin:s.owner===id,userId:id,minePatch:g?{n:g.n,stake:g.stake,open:g.open,imgs:g.imgs,mines:[]}:null,result};}
export function isBrainrotDrop(drop){return !!drop&&drop.itemId!=null&&drop.rewardKind!=='coins';}
export function publicFeed(s,now=Date.now()) {
  const drops=(s.drops||[]).filter(isBrainrotDrop),today=feedDay(now);
  let topDrop=isBrainrotDrop(s.topDrop)&&feedDay(s.topDrop.ts)===today?s.topDrop:null;
  for(const drop of drops)if(feedDay(drop.ts)===today&&(!topDrop||drop.price>topDrop.price))topDrop=drop;
  const withPlayer=drop=>{const userId=dropPlayerId(s,drop);return userId?{...drop,userId}:drop};
  return {drops:drops.slice(0,60).map(withPlayer),topDrop:topDrop?withPlayer(topDrop):null,feedRevision:s.feedRevision||0};
}
export function view(s,id,seed,now=Date.now(),options={}) {
  const u=s.users[id],admin=s.owner===id,us=structuredClone(u);
  delete us.rocket;delete us.mine;
  us.online=s.config.online??us.online??0;
  us.simulationBookings=(s.simulationBookings||[]).filter(x=>x.userId===id);
  us.collaborationApplications=(s.collaborationApplications||[]).filter(x=>x.userId===id);
  us.rb=u.bound?{[id]:u.bound}:{};us.players={};us.promos={};us.wd=s.withdrawals.filter(x=>x.userId===id);
  if(u.mine)us.mg={n:u.mine.n,stake:u.mine.stake,open:u.mine.open,imgs:u.mine.imgs,mines:[]};else us.mg=null;
  const {autoPromoSeed,uahCard,retiredPartners,...publicConfig}=s.config;
  if(admin)publicConfig.retiredPartners=structuredClone(retiredPartners||{});
  if(admin)publicConfig.uahCard=uahCard||'';publicConfig.uahConfigured=!!uahCard;
  publicConfig.uahTopups=(s.uahTopups||[]).filter(record=>admin||record.userId===id).map(record=>uahTopupView(record,now));
  const refs={};if(!options.compact)for(const [code,p] of Object.entries(s.partners)){refs[code]=admin||p.userId===id?structuredClone(p):{code,owner:p.owner,pct:p.pct,bonus:p.bonus,disabled:p.disabled,list:[]};}
  for(const [code,p] of Object.entries(s.promos))if(admin||p.userId===id)us.promos[code]=structuredClone(p);
  const active=u.rocket?{start:u.rocket.start,auto:u.rocket.auto,value:u.rocket.value}:null;
  return {ok:true,admin,userId:id,user:us,...publicFeed(s,now),...(!options.compact?{config:{...publicConfig,collaborationApplications:admin?(s.collaborationApplications||[]):[],winterMusicUrl:s.config.winterMusicUrl||'/assets/last-christmas.mp3',winterPromotion:winterPromotion(now,s.config.autoPromoSeed),simulationTopups:(s.simulationTopups||[]).filter(x=>admin||x.userId===id).map(x=>simulationTopupView(s,x,now)),simulationBookings:(s.simulationBookings||[]).filter(x=>admin||x.userId===id),refs,wds:admin?s.withdrawals:us.wd,tops:(s.simulationTopups||[]).filter(x=>admin||x.userId===id).map(x=>simulationTopupView(s,x,now))}}:{}),queue:{date:sundayKey(now),count:s.withdrawals.filter(x=>x.date===sundayKey(now)).length},activeRocket:active,rules:RULES};
}
function executeCommand(s,id,seed,action,b={},now=Date.now(),rng=random) {
  const u=s.users[id];assert(u,'Сначала войдите');
  const uahResult=executeUahTopup(s,id,action,b,now);if(uahResult)return uahResult;
  const rocketResult=action.startsWith('rocket-')?null:settleRocket(s,u,seed,now);
  if(action==='state')return {rocket:rocketResult};
  if(action==='admin-winter-music'){
    own(s,id);const url=String(b.url||'').trim();
    if(url){let parsed;try{parsed=new URL(url)}catch{throw Error('Укажите прямую HTTPS-ссылку на аудиофайл')}
      assert(parsed.protocol==='https:'&&!parsed.username&&!parsed.password,'Нужна HTTPS-ссылка без логина и пароля');assert(url.length<=2048,'Слишком длинная ссылка');}
    s.config.winterMusicUrl=url;return {url};
  }
  if(action==='simulation-slots')return simulationSlots(s,now);
  if(action==='age-confirm'){if(!u.ageConfirmedAt)u.ageConfirmedAt=now;return {confirmedAt:u.ageConfirmedAt};}
  if(action==='collaboration-notify-retry'){
    own(s,id);const application=(s.collaborationApplications||[]).find(x=>x.id===b.id);assert(application&&['approved','rejected'].includes(application.status),'Сначала рассмотрите анкету');assert(/^tg:[0-9]+$/.test(application.userId),'Заявитель должен войти через Telegram');assert(application.notification?.state!=='sent','Сообщение уже отправлено');assert((application.notification?.attempts||0)<10,'Достигнут лимит повторов');return {application};
  }
  if(action==='collaboration-apply'){
    assert(!Object.values(s.partners||{}).some(p=>p.userId===id&&!p.disabled),'У вас уже есть партнёрский кабинет');
    const applications=s.collaborationApplications||=[];
    assert(!applications.some(x=>x.userId===id&&['new','approved'].includes(x.status)),'У вас уже есть отправленная анкета');
    const fields={};for(const key of ['platform','audience','online','links']){const value=String(b[key]||'').trim();assert(value.length>=2&&value.length<=(key==='links'?2000:500),'Заполните все поля анкеты');assert(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),'Некорректный текст');fields[key]=value;}
    const links=fields.links.split(/[\s,]+/).filter(Boolean);assert(links.length>0&&links.length<=10,'Укажите от 1 до 10 ссылок');
    for(const link of links){let url;try{url=new URL(link)}catch{}assert(url&&['https:','http:'].includes(url.protocol)&&!url.username&&!url.password,'Укажите полные ссылки https://');}
    const verified=String(u.telegramUsername||'').replace(/^@/,'');const contact=verified||String(b.contact||'').trim().replace(/^@/,'');assert(/^[a-zA-Z0-9_]{3,32}$/.test(contact),'Укажите Telegram username для связи');
    const application={id:crypto.randomUUID(),userId:id,user:u.me,contact,contactVerified:!!verified,...fields,status:'new',createdAt:now};applications.push(application);return {application};
  }
  if(action==='collaboration-review'){
    own(s,id);const application=(s.collaborationApplications||[]).find(x=>x.id===b.id);assert(application,'Анкета не найдена');assert(application.status==='new','Анкета уже рассмотрена');assert(['approved','rejected'].includes(b.status),'Укажите решение');application.status=b.status;application.reviewedAt=now;application.reviewedBy=id;application.notification={state:'pending',attempts:0};return {application};
  }
  if(action==='simulation-topup'){
    const applicationNick=b.nick===undefined?'':String(b.nick).trim();assert(b.nick===undefined||applicationNick.length>=3&&applicationNick.length<=32&&!/[\u0000-\u001f\u007f]/.test(applicationNick),'Введите ник: 3–32 символа без переносов строк');
    const type=b.type||'items';assert(['stars','items','gears'].includes(type),'Выберите способ');
    assert(!s.config.topupsClosed&&!s.config[type==='stars'?'topupsStarsClosed':type==='gears'?'topupsGearsClosed':'topupsItemsClosed'],type==='stars'?'Пополнения Stars временно закрыты':type==='gears'?'Пополнения гирами временно закрыты':'Пополнения брейнротами временно закрыты');
    let items=[],stars=0,base=0;
    if(type==='stars'){
      stars=Number(b.units);assert(Number.isSafeInteger(stars)&&stars>=25&&stars<=10000,'Количество: от 25 до 10 000');base=money(stars*1.25);
    }else{
      assert(Array.isArray(b.items)&&b.items.length>0&&b.items.length<=100,'Выберите предметы');
      assert(new Set(b.items.map(x=>Number(x.id))).size===b.items.length,'Повтор предмета');
      items=b.items.map(x=>{const it=itemBy(s,seed,x.id),q=Number(x.q);assert(!it.mutation,'В пополнениях доступны только обычные брейнроты');assert(!TOPUP_EXCLUDED_IDS.includes(it.baseId??it.id),'Этот брейнрот недоступен для пополнения');assert(s.config.tpc[it.id]?.on!==0,'Этот брейнрот отключён для пополнения');assert(GEAR_TOPUP_IDS.includes(it.id)===(type==='gears'),'Предмет недоступен в этой вкладке');assert(Number.isSafeInteger(q)&&q>0&&q<=100,'Неверное количество');const value=Number(s.config.tpc[it.id]?.v)||it.price;return {id:it.id,n:it.name,q,v:value};});
      base=money(items.reduce((n,x)=>n+x.v*x.q,0));
    }
    assert(base>0&&base<=1e7,'Слишком большая сумма');
    const code=norm(b.promo),promotion=winterPromotion(now,s.config.autoPromoSeed),autoPromo=code===promotion.code;
    if(code.startsWith('SNOW-')||code.startsWith('BU-'))assert(autoPromo,'Автопромокод истёк. Возьмите новый на странице кейсов.');
    if(code&&!autoPromo){assert(!u.bound||u.bound===code,'Вы уже привязаны к другому партнёру');if(!u.bound)bind(s,u,code);}
    const p=s.partners[u.bound],partnerBonus=code&&p&&!p.disabled?Number(p.bonus)||0:0;
    const bonus=autoPromo?Math.max(partnerBonus,promotion.bonus):partnerBonus,total=money(base*(1+bonus/100));
    s.simulationTopupNumber=Math.max(s.simulationTopupNumber||0,...(s.simulationTopups||[]).map(x=>x.number||0))+1;
    const receipt={id:crypto.randomUUID(),number:s.simulationTopupNumber,simulation:true,free:true,userId:id,user:u.me,nick:applicationNick,type,stars,items,base,bonus,total,autoPromo:autoPromo?code:null,promo:u.bound,commission:0,ts:now,expiresAt:now+600000,st:'new',reviewer:''};
    (s.simulationTopups||=[]).push(receipt);return {topup:simulationTopupView(s,receipt,now)};
  }
  if(action==='simulation-cancel'){
    const record=(s.simulationTopups||[]).find(x=>x.id===b.id);
    assert(record?.free===true&&record.simulation===true&&record.userId===id,'Заявка не найдена');
    assert(['new','ready'].includes(record.st),'Заявка уже обработана');
    record.st='no';record.cancelled=true;record.cancelledAt=now;
    return {topup:simulationTopupView(s,record,now)};
  }
  if(action==='simulation-reviewer'){
    own(s,id);const nick=String(b.nick||'').trim();assert(nick===''||nick.length>=3&&nick.length<=32,'Ник: 3–32 символа');
    assert(!/[\u0000-\u001f\u007f]/.test(nick),'Неверный ник');s.config.simulationReviewerNick=nick;return {nick};
  }
  if(action==='simulation-show'||action==='simulation-review'||action==='simulation-buffs'){
    own(s,id);const record=(s.simulationTopups||[]).find(x=>x.id===b.id);
    assert(record?.simulation===true&&record.free===true,'Заявка не найдена');
    assert(['new','ready'].includes(record.st),'Заявка уже обработана');assert(record.expiresAt>now,'Время заявки истекло');
    let buffQuote=null;
    if(action==='simulation-review'&&b.status==='ok')assert(b.buffItems===undefined,'Сначала сохраните бафы отдельной кнопкой');
    if(action==='simulation-buffs'){
      assert(record.type==='items','Бафы доступны только для брейнротов');buffQuote=buffTopupQuote(record,b.buffItems);
    }
    if(action==='simulation-buffs'){Object.assign(record,buffQuote,{buffReviewedAt:now,buffReviewedBy:id});return {topup:simulationTopupView(s,record,now)};}
    if(action==='simulation-show'){
      assert(record.st==='new','Ник уже показан');record.st='ready';record.reviewer=s.config.simulationReviewerNick||u.me;record.shownAt=now;record.expiresAt=now+600000;
    }else{
      assert(['ok','no'].includes(b.status),'Выберите решение');
      if(b.status==='ok'){
        assert(record.st==='ready','Сначала нажмите «Показать ник»');const target=s.users[record.userId];assert(target,'Игрок не найден');
        target.balance=money(target.balance+record.total);
        record.commission=0;recordPartnerDeposit(s,target,record.base,record.promo);
      }
      record.st=b.status;record.processedAt=now;record.processedBy=id;
    }
    return {topup:simulationTopupView(s,record,now)};
  }
  if(action==='simulation-book'){
    const nick=String(b.nick||'').trim();assert(/^[a-zA-Z0-9_]{3,20}$/.test(nick),'Ник: 3–20 латинских букв, цифр или _');
    const available=simulationSlots(s,now),slot=available.slots.find(x=>x.at===Number(b.at));assert(slot,'Время уже занято или недоступно');
    assert(!(s.simulationBookings||[]).some(x=>x.userId===id&&x.status==='booked'&&x.at>now),'У вас уже есть запись');
    assert(Array.isArray(b.plan)&&b.plan.length>0&&b.plan.length<=100,'Выберите предметы');
    const used=new Set(),items=[],g=catalog(s,seed).find(x=>x.name==='Garama and Madundung');let value=0,payout=0;
    for(const entry of b.plan){
      const ids=(Array.isArray(entry.ids)?entry.ids:[entry.uid]).map(Number);assert(ids.length>0,'Выберите предметы');let group=0;
      for(const uid of ids){assert(!used.has(uid),'Повтор предмета');used.add(uid);const inv=u.inv.find(x=>x.uid===uid);assert(inv&&!inv.sh,'Предмет недоступен');const source=itemBy(s,seed,inv.id,true);assert(g&&source.price>=g.price,'Недостаточная стоимость');group=money(group+source.price);}
      const target=itemBy(s,seed,entry.target),q=Number(entry.q??1);assert(target.name==='Garama and Madundung'||['Dragon Canelonni','Dragon Cannelloni'].includes(target.name),'Доступны Гарама и Dragon Cannelloni');
      assert(Number.isSafeInteger(q)&&q>=1&&q<=4&&q*target.price<=group,'Неверное количество');
      value=money(value+group);payout=money(payout+target.price*q);items.push({id:target.id,name:target.name,price:target.price,q});
    }
    // Scheduling only: inventory and balances remain untouched, no operator fulfils it.
    const booking={id:crypto.randomUUID(),simulation:true,userId:id,user:u.me,nick,createdAt:now,date:available.date,at:slot.at,time:slot.time,status:'booked',items,change:money(value-payout),total:value};
    (s.simulationBookings||=[]).push(booking);return {booking};
  }
  if(action==='simulation-book-cancel'||action==='simulation-book-complete'){
    const booking=(s.simulationBookings||[]).find(x=>x.id===b.id);assert(booking?.simulation===true,'Запись не найдена');
    if(action==='simulation-book-complete')own(s,id);else assert(booking.userId===id||s.owner===id,'Нет доступа к записи');
    assert(booking.status==='booked','Запись уже обработана');
    if(action==='simulation-book-complete'){
      assert(now>=booking.at+300000,'Завершение доступно после времени записи');booking.status='completed';booking.completedAt=now;booking.completedBy=id;
    }else{booking.status='cancelled';booking.cancelledAt=now;booking.cancelledBy=id;}
    // Internal schedule only. No balance, inventory or external transfer is changed.
    return {booking};
  }
  if(action==='rename'){const n=String(b.name||'').trim();assert(n.length>=3&&n.length<=32,'Ник: 3–32 символа');u.me=n;return {};}
  if(action==='shop'){const it=itemBy(s,seed,b.id),price=money(shopPurchasePrice(it.price));debit(u,price);return {item:add(u,it.id,{sh:1,paid:price}),price};}
  if(action==='sell'||action==='sell-all'){const items=action==='sell-all'?u.inv.splice(0):take(u,b.ids);let total=0;for(const x of items){const it=itemBy(s,seed,x.id,true);total+=x.sh?Math.min(x.paid,it.price):it.price;}u.balance=money(u.balance+total);return {total:money(total),...(action==='sell-all'?{count:items.length}:{})};}
  if(action==='bonus-sub-check'){u.bn.subscriptionChecked=b.subscriptionVerified===true;return {subscribed:u.bn.subscriptionChecked};}
  if(action==='bonus-tag-check'){u.telegramName=String(b.name||'').slice(0,256);return {eligible:/(?:^|[^a-z0-9_])@BrainUpOfficial_bot(?![a-z0-9_])/i.test(u.telegramName)};}
  if(action==='bonus-share-prepare'){
    assert(b.messageId&&b.nonce&&b.expiresAt>now,'Приглашение недоступно');
    u.bn.share={nonce:b.nonce,messageId:b.messageId,expiresAt:Math.min(b.expiresAt,now+600000),confirmedAt:0};return {...u.bn.share};
  }
  if(action==='bonus-share-complete'){
    const share=u.bn.share;assert(share&&share.nonce===b.nonce&&share.expiresAt>now&&!share.consumed,'Приглашение устарело');
    assert(b.sent===true,'Отправка отменена');share.confirmedAt=now;return {shared:true};
  }
  if(action==='bonus-claim'){
    const key=String(b.key),c=s.config.cases.find(c=>c.bonus&&c.bonusKey===key);assert(c,'Бонусный кейс не найден');
    if(key==='nick')assert(id.startsWith('tg:')&&/(?:^|[^a-z0-9_])@BrainUpOfficial_bot(?![a-z0-9_])/i.test(u.telegramName||''),'Добавьте @BrainUpOfficial_bot в имя Telegram и заново откройте приложение');
    else if(key==='sub'){assert(b.subscriptionVerified===true,'Подпишитесь на канал и проверьте подписку');assert(u.bn.share?.confirmedAt&&!u.bn.share.consumed&&u.bn.share.expiresAt>now,'Сначала отправьте приглашение другу');}
    else if(key==='ref')assert(u.bound&&!u.bn.refDone,'Привяжите реферальный код; награда доступна один раз');
    else assert(false,'Неизвестный бонус');
    if(key!=='ref')assert(!u.bn[key]||now-u.bn[key]>=43200000,'Кейс доступен раз в 12 часов');
    if(key==='sub')u.bn.share.consumed=true;
    if(key==='ref')u.bn.refDone=1;else u.bn[key]=now;
    u.fc[c.id]=(u.fc[c.id]||0)+1;return {caseId:c.id};
  }
  if(action==='case'){
    const c=s.config.cases.find(c=>c.id===Number(b.id));assert(c,'Кейс не найден');if(c.bonusKey==='nick')assert(id.startsWith('tg:')&&/(?:^|[^a-z0-9_])@BrainUpOfficial_bot(?![a-z0-9_])/i.test(u.telegramName||''),'Добавьте @BrainUpOfficial_bot в имя Telegram');const n=b.free?1:Number(b.n);assert([1,2,3,4,5].includes(n),'От 1 до 5 кейсов');
    assert(!c.bonus||b.free,'Бонусные кейсы доступны только за выполнение условий');
    const activeIds=new Set(catalog(s,seed).map(item=>item.id)),drops=c.drops.filter(id=>activeIds.has(Number(id))).map(id=>itemBy(s,seed,id));assert(drops.length,'Кейс пуст');
    const fifty=isFiftyFiftyCase(c);if(fifty)assert(drops.length===2&&drops.some(item=>item.id===55)&&drops.some(item=>item.id===95),'В кейсе должны быть ровно два предмета: Dragon Canelonni (36%) и Noobini Pizzanini (64%)');
    if(b.free){assert(u.fc[c.id]>0,'Нет бесплатного открытия');u.fc[c.id]--;}else {debit(u,money(c.price*n));u.bn.sp=money(u.bn.sp+c.price*n);}
    const wins=[];
    for(let i=0;i<n;i++){
      if(c.bonus&&['sub','nick'].includes(c.bonusKey)){
        const roll=rng();if(roll<FREE_CASE_ODDS.coins){const amount=roll<FREE_CASE_ODDS.coins2?2:5,w={id:null,name:amount===2?'2 монеты':'5 монет',price:amount,rewardKind:'coins'};u.balance=money(u.balance+amount);wins.push({w,uid:null,coins:amount});}
        else{const w=pickCaseItem(c,drops,rng);wins.push({w,uid:add(u,w.id).uid});}
      }else{const w=pickCaseItem(c,drops,rng);wins.push({w,uid:add(u,w.id).uid});}
    }return {wins};
  }
  if(action==='fuse'){
    assert(Array.isArray(b.ids)&&b.ids.length===4&&new Set(b.ids.map(Number)).size===4,'Выберите четыре разных предмета');
    const inputs=b.ids.map(uid=>u.inv.find(x=>x.uid===Number(uid)));assert(inputs.every(Boolean),'Предмет уже использован');
    const total=money(inputs.reduce((sum,x)=>sum+itemBy(s,seed,x.id,true).price,0));
    assert(!u.fuseBoss||u.fuseBoss.claimed,'Сначала заберите трофей оборотня');
    const pool=catalog(s,seed).filter(x=>x.price>=total*.3&&x.price<=total*10);assert(pool.length,'Нет подходящих результатов');
    const w=weightedPick(pool,rng);take(u,b.ids);const prize=add(u,w.id);u.fuses=(u.fuses||0)+1;
    let extra=null,boss=null;if(rng()<1/50){const item=weightedPick(pool,rng);extra={w:item,uid:add(u,item.id).uid};}
    if(total>=100&&rng()<1/40){const trophy=weightedPick(pool,rng);boss={id:crypto.randomUUID(),hits:0,trophyId:trophy.id,claimed:false};u.fuseBoss=boss;}
    return {w,uid:prize.uid,total,extra,boss};
  }
  if(action==='fuse-hit'){const boss=u.fuseBoss;assert(boss&&!boss.claimed&&boss.id===b.id,'Событие завершено');boss.hits=Math.min(10,boss.hits+1);let prize=null;if(boss.hits===10){const w=itemBy(s,seed,boss.trophyId,true);prize={w,uid:add(u,w.id).uid};boss.claimed=true;}return {hits:boss.hits,prize};}
  if(action==='upgrade'){
    const target=itemBy(s,seed,b.target),items=take(u,b.ids),value=items.reduce((n,x)=>n+itemBy(s,seed,x.id,true).price,0),coins=money(Number(b.coins)||0);
    assert(coins>=0,'Неверная сумма');if(coins)debit(u,coins);assert(target.price>value+coins,'Цель должна быть дороже ставки');
    const chance=upgradeSuccessChance(value+coins,target.price);assert(chance!==null,'Максимальный шанс апгрейда — 80%');const draw=rng()*100,win=draw<chance;u.upg++;if(win){u.win++;add(u,target.id);}else u.lose++;return {win,chance,target,roll:100-draw};
  }
  if(action==='virtual-withdraw'){
    assert(Array.isArray(b.plan)&&b.plan.length>0&&b.plan.length<=100,'Выберите предметы');
    const groups=b.plan.map(entry=>({...entry,ids:(Array.isArray(entry.ids)?entry.ids:[entry.uid]).map(Number)})),ids=groups.flatMap(x=>x.ids);assert(ids.length>0&&ids.length<=100&&new Set(ids).size===ids.length,'Повтор предмета или пустая заявка');
    const items=[],orig=[];let change=0;const g=catalog(s,seed).find(x=>x.name==='Garama and Madundung');assert(g,'Гарама недоступна');
    for(const entry of groups){
      assert(entry.ids.length>0,'Пустая группа');let value=0;
      for(const uid of entry.ids){const owned=u.inv.find(x=>x.uid===uid);assert(owned,'Предмет уже использован');assert(!owned.sh,'Купленные предметы нельзя вывести');const source=itemBy(s,seed,owned.id,true);assert(source.price>=g.price,'Вывод доступен от стоимости Гарамы');value=money(value+source.price);orig.push({id:source.id,name:source.name,price:source.price});}
      const target=itemBy(s,seed,entry.target);assert(target.name==='Garama and Madundung'||/dragon/i.test(target.name),'Выберите Гараму или дракона');assert(target.price<=value,'Недостаточная стоимость предмета');
      const q=Number(entry.q??1),max=Math.floor((value+1e-9)/target.price);assert(Number.isSafeInteger(q)&&q>=1&&q<=max,'Неверное количество');assert(target.name==='Garama and Madundung'||q===1,'Дракон выводится по одному');
      items.push({id:target.id,name:target.name,price:target.price,q});change=money(change+value-target.price*q);
    }
    const reserved=take(u,ids);
    const receipt=reserve(s,u,now,{kind:'virtual',virtual:true,nick:String(b.nick||u.me).trim().slice(0,32),items,orig,reserved,change,total:money(items.reduce((n,x)=>n+x.price*(x.q||1),0)+change)});
    return {receipt};
  }
  if(action==='admin-topups-toggle'){
    own(s,id);assert(typeof b.closed==='boolean','Неверное значение');
    if(b.type!==undefined){
      assert(['stars','items','gears','uah'].includes(b.type),'Выберите способ');
      // Preserve the other method when splitting the legacy global switch.
      s.config.topupsStarsClosed=!!(s.config.topupsClosed||s.config.topupsStarsClosed);
      s.config.topupsItemsClosed=!!(s.config.topupsClosed||s.config.topupsItemsClosed);
      s.config.topupsGearsClosed=!!(s.config.topupsClosed||s.config.topupsGearsClosed);
      s.config.topupsUahClosed=!!(s.config.topupsClosed||s.config.topupsUahClosed);
      s.config.topupsClosed=false;
      s.config[{stars:'topupsStarsClosed',items:'topupsItemsClosed',gears:'topupsGearsClosed',uah:'topupsUahClosed'}[b.type]]=b.closed;
    }else{
      s.config.topupsClosed=b.closed;s.config.topupsStarsClosed=b.closed;s.config.topupsItemsClosed=b.closed;s.config.topupsGearsClosed=b.closed;s.config.topupsUahClosed=b.closed;
    }
    return {closed:b.closed,type:b.type||'all'};
  }
  if(action==='virtual-topup'){
    assert(!s.config.topupsClosed,'Пополнения временно закрыты');
    const type=String(b.type);assert(['stars','items'].includes(type),'Выберите способ');
    assert(!s.config[type==='stars'?'topupsStarsClosed':'topupsItemsClosed'],type==='stars'?'Пополнения Stars временно закрыты':'Пополнения брейнротами временно закрыты');
    let base=0,items=[],units=0;const nick=String(b.nick||'').trim();
    if(type==='stars'){units=Number(b.units);assert(Number.isSafeInteger(units)&&units>=25&&units<=1000000,'Количество: от 25 до 1 000 000');base=money(units*1.25);}
    else{
      assert(nick.length>=3&&nick.length<=32,'Укажите ник');assert(Array.isArray(b.items)&&b.items.length>0&&b.items.length<=100,'Выберите предметы');
      assert(new Set(b.items.map(x=>Number(x.id))).size===b.items.length,'Повтор предмета');
      const g=catalog(s,seed).find(x=>x.name==='Garama and Madundung');
      items=b.items.map(x=>{const it=itemBy(s,seed,x.id),q=Number(x.q),setting=s.config.tpc[it.id];assert(g&&it.price>=g.price&&setting?.on!==0,'Предмет не принимается');assert(Number.isSafeInteger(q)&&q>=1&&q<=1000,'Неверное количество');const v=Number(it.price);assert(Number.isFinite(v)&&v>0,'Неверная цена');base=money(base+v*q);return {id:it.id,n:it.name,q,v};});
    }
    const code=norm(b.promo),promotion=winterPromotion(now,s.config.autoPromoSeed),autoPromo=code===promotion.code;
    if(code.startsWith('SNOW-')||code.startsWith('BU-'))assert(autoPromo,'Автопромокод истёк. Возьмите новый на странице кейсов.');
    if(code&&!autoPromo){assert(!u.bound||u.bound===code,'Вы уже привязаны к другому партнёру');if(!u.bound)bind(s,u,code);}
    const p=s.partners[u.bound],partnerBonus=code&&p&&!p.disabled?Number(p.bonus)||0:0;
    const bonus=autoPromo?Math.max(partnerBonus,promotion.bonus):partnerBonus,total=money(base*(1+bonus/100));assert(Number.isFinite(total)&&total>0&&total<=1e9,'Слишком большая сумма');
    s.topupNumber=Math.max(s.topupNumber||0,s.topups.length)+1;
    const topup={id:crypto.randomUUID(),number:s.topupNumber,expiresAt:now+600000,username:u.telegramUsername||'',userId:id,user:u.me,virtual:true,type,nick,items,stars:units,base,bonus,total,promo:u.bound,st:'new',ts:now,recipient:''};
    s.topups.push(topup);return {topup};
  }
  if(action==='admin-recipient'){
    own(s,id);const nick=String(b.nick||'').trim();assert(nick===''||/^[a-zA-Z0-9_]{3,32}$/.test(nick),'Ник: 3–32 латинских буквы, цифры или _');s.config.tradeNick=nick;return {nick};
  }
  if(action==='admin-topup-show'){
    own(s,id);const record=s.topups.find(x=>x.id===b.id);assert(record&&record.virtual&&record.st==='new','Заявка недоступна');assert(!record.expiresAt||now<record.expiresAt,'Время заявки истекло');assert(s.config.tradeNick,'Сначала укажите ник в админке');
    record.st='ready';record.recipient=s.config.tradeNick;record.shownAt=now;record.expiresAt=now+600000;return {id:record.id,status:'ready'};
  }
  if(action==='admin-virtual-request'){
    own(s,id);assert(['topup','withdraw'].includes(b.kind),'Неверный тип заявки');assert(['ok','no'].includes(b.status),'Выберите решение');
    const list=b.kind==='topup'?s.topups:s.withdrawals,record=list.find(x=>x.id===b.id);assert(record&&record.virtual===true,'Заявка не найдена');
    const statusKey=b.kind==='topup'?'st':'status',waiting=b.kind==='topup'?'new':'pending';assert(b.kind==='topup'?['new','ready'].includes(record.st):record[statusKey]===waiting,'Заявка уже обработана');
    const target=s.users[record.userId];assert(target,'Игрок не найден');
    if(b.kind==='topup'&&b.status==='ok'){assert(record.st==='ready','Сначала нажмите «Показать ник»');assert(!record.expiresAt||now<record.expiresAt,'Время заявки истекло');target.balance=money(target.balance+record.total);}
    if(b.kind==='withdraw'){
      if(b.status==='ok'){target.balance=money(target.balance+record.change);target.virtualWithdrawn=money((target.virtualWithdrawn||0)+record.total-record.change);}
      else for(const item of record.reserved||record.orig)add(target,item.id,Object.fromEntries(Object.entries(item).filter(([key])=>!['id','uid','name','price'].includes(key))));
    }
    record[statusKey]=b.status;record.processedAt=now;record.processedBy=id;return {id:record.id,status:b.status};
  }
  if(action==='dice'){
    const col=Number(b.color);assert(Number.isInteger(col)&&col>=0&&col<6,'Выберите цвет');const inf=stake(u,s,seed,b.bet);
    const mode='n',res=Array.from({length:4},()=>Math.floor(rng()*6));
    const k=res.filter(x=>x===col).length,mult=k===1?2:k===4?3:0;
    const paid=money(inf.value*mult),awarded=[];if(inf.item){for(let i=0;i<mult;i++)awarded.push(add(u,inf.item.id));}else u.balance=money(u.balance+paid);u.dh=[{v:inf.value,c:col,r:res,k,m:mode,x:mult},...(u.dh||[])].slice(0,20);return {res,mult,paid,mode,itemId:inf.item?.id??null,awarded,settlement:inf.item?'items':'coins'};
  }
  if(action==='rocket-place'){
    assert(!u.rocket,'Ставка уже сделана');const inf=stake(u,s,seed,b.bet);const auto=Number(b.auto)||0;assert(auto===0||auto>=1.01&&auto<=1000,'Автовывод от ×1.01 до ×1000');
    u.rocket={...inf,crash:rocketCrash(rng),auto,start:now+6000};return {start:u.rocket.start};
  }
  if(action==='rocket-cancel'){const g=u.rocket;assert(g&&now<g.start,'Ставки закрыты');if(g.item)u.inv.push(g.item);else u.balance=money(u.balance+g.value);u.rocket=null;return {};}
  if(action==='rocket-status'){const g=u.rocket;if(!g)return {phase:'done'};const end=g.start+Math.log(g.crash)/RULES.growth;
    if(now>=end||g.auto>=1.01&&g.auto<g.crash&&now>=g.start+Math.log(g.auto)/RULES.growth){const result=settleRocket(s,u,seed,now,true);return {phase:'done',...result};}
    return {phase:now<g.start?'wait':'fly',start:g.start,mult:now<g.start?1:Math.exp(RULES.growth*(now-g.start))};}
  if(action==='rocket-cash'){const result=settleRocket(s,u,seed,now,true);assert(result,'Нет активной ставки');return result;}
  if(action==='mines-start'){
    assert(!u.mine,'Игра уже идёт');const n=Number(b.n);assert(Number.isInteger(n)&&n>=1&&n<=24,'От 1 до 24 мин');assert(b.ids?.length<=5,'До 5 предметов');const items=take(u,b.ids),positions=Array.from({length:25},(_,i)=>i);
    for(let i=24;i>0;i--){const j=Math.floor(rng()*(i+1));[positions[i],positions[j]]=[positions[j],positions[i]];}
    u.mine={n,stake:items.reduce((n,x)=>n+itemBy(s,seed,x.id,true).price,0),mines:positions.slice(0,n),open:[],imgs:Array.from({length:25},()=>seed.items[0].id)};return {};
  }
  if(action==='mines-open'||action==='mines-cash'){
    const g=u.mine;assert(g,'Нет активной игры');let win=true,end=false,hit=-1;
    if(action==='mines-open'){const i=Number(b.i);assert(Number.isInteger(i)&&i>=0&&i<25&&!g.open.includes(i),'Клетка недоступна');if(g.mines.includes(i)){win=false;end=true;hit=i;}else {g.open.push(i);end=g.open.length===25-g.n;}}
    else {assert(g.open.length,'Откройте клетку');end=true;}
    if(!end)return {end:false};let mult=.96;for(let i=0;i<g.open.length;i++)mult*=(25-i)/(25-g.n-i);mult=Math.floor(mult*100+1e-9)/100;
    const paid=win?money(g.stake*mult):0,result={end:true,win,paid,board:{...g,hit},...(win?pay(u,s,seed,paid):{})};u.mine=null;return result;
  }
  if(action==='ref-bind'){bind(s,u,b.code);return {};}
  if(action==='promo-create'){
    const p=partner(s,id);assert(p&&!p.disabled,'Доступно партнёру');const code=norm(b.code),max=Number(b.max);assert(!code.startsWith('SNOW-')&&!code.startsWith('BU-'),'Префикс автопромокодов зарезервирован');assert(/^[A-Z0-9_-]{3,20}$/.test(code),'Код: 3–20 букв, цифр, - или _');assert(!s.promos[code]&&!s.partners[code],'Код занят');assert(Number.isInteger(max)&&max>=1&&max<=100000,'Неверное число активаций');
    const c=b.caseId?s.config.cases.find(x=>x.id===Number(b.caseId)):null;assert(!b.caseId||c,'Кейс не найден');const amount=money(Number(b.amount)),cost=c?c.price:amount;assert(Number.isFinite(cost)&&cost>0,'Неверная сумма');const total=money(cost*max);debit(u,total);
    s.promos[code]={code,userId:id,owner:p.code,type:c?'case':'coin',amount:c?0:amount,caseId:c?.id||null,cost,max,used:[],reserved:total};return {total};
  }
  if(action==='promo-delete'){
    const code=norm(b.code),p=s.promos[code];assert(p&&p.userId===id,'Промокод не найден');assert(!p.deleted,'Уже удалён');const refund=money((p.max-p.used.length)*p.cost);u.balance=money(u.balance+refund);p.deleted=true;p.reserved=0;return {refund};
  }
  if(action==='promo-redeem'){
    const code=norm(b.code),p=s.promos[code];if(!p){bind(s,u,code);return {bound:true};}
    assert(!p.deleted&&p.used.length<p.max,'Промокод недоступен');assert(!p.used.includes(id),'Промокод уже активирован');assert(p.userId!==id,'Нельзя активировать свой промокод');
    p.used.push(id);p.reserved=money(p.reserved-p.cost);if(p.type==='case')u.fc[p.caseId]=(u.fc[p.caseId]||0)+1;else u.balance=money(u.balance+p.amount);return {};
  }
  if(action==='withdraw'){
    const nick=String(b.nick||'').trim();assert(nick.length>=3&&nick.length<=32,'Введите ник Roblox');const items=take(u,b.ids);assert(items.every(x=>!x.sh),'Купленное нельзя вывести, только отыграть или продать');
    const orig=items.map(x=>({...x,...itemBy(s,seed,x.id,true)})),total=money(orig.reduce((v,x)=>v+x.price,0));assert(total>0,'Пустая заявка');
    return {withdrawal:reserve(s,u,now,{kind:'items',nick,orig,items:orig,total,change:0})};
  }
  if(action==='partner-claim'){
    assert(partnerClaimOpen(now),'Вывод предварительного баланса доступен только по воскресеньям с 12:00 до 22:00 по Киеву');
    const p=partner(s,id);assert(p&&!p.disabled,'Партнёрский аккаунт недоступен');
    const total=money(Number(p.pending));assert(Number.isFinite(total)&&total>0,'Нет средств для вывода');
    p.pending=0;p.paid=money((p.paid||0)+total);u.balance=money(u.balance+total);
    p.claims=[{id:crypto.randomUUID(),at:now,total},...(p.claims||[])].slice(0,100);
    return {claimed:total};
  }
  if(action==='partner-withdraw'){
    const p=partner(s,id);assert(p&&p.pending>0,'Нет средств для вывода');const total=p.pending;p.pending=0;return {withdrawal:reserve(s,u,now,{kind:'partner',partner:p.code,total,items:[]})};
  }
  if(action==='topup'){
    assert(b.type==='items','Оплата Stars ещё не подключена');const nick=String(b.nick||'').trim();assert(nick.length>=3&&nick.length<=32,'Введите ник Roblox');assert(Array.isArray(b.items)&&b.items.length&&b.items.length<=100,'Выберите предметы');
    let base=0;const items=b.items.map(x=>{const it=itemBy(s,seed,x.id),q=Number(x.q);assert(Number.isInteger(q)&&q>0&&q<=1000,'Неверное количество');const v=s.config.tpc[it.id]?.v??seed.topValues[it.name]??(it.price>10000?it.price:money(it.price*.9));assert(s.config.tpc[it.id]?.on!==0,'Предмет не принимается');base+=v*q;return {n:it.name,id:it.id,q,v};});
    const code=norm(b.promo);if(code){assert(!u.bound||u.bound===code,'Вы уже привязаны к другому партнёру');if(!u.bound)bind(s,u,code);}
    const p=s.partners[u.bound],bonus=p&&!p.disabled?p.bonus:0;const rec={id:crypto.randomUUID(),userId:id,user:u.me,type:'items',nick,items,base:money(base),bonus,total:money(base*(1+bonus/100)),promo:u.bound,st:'new',ts:now};s.topups.push(rec);return {topup:rec};
  }
  if(action==='admin-promo-create'){
    own(s,id);const code=norm(b.code),max=Number(b.max),type=String(b.type);
    assert(/^[A-Z0-9_-]{3,20}$/.test(code),'Код: 3–20 букв A–Z, цифр, _ или -');
    assert(!code.startsWith('SNOW-')&&!code.startsWith('BU-'),'Префикс автопромокодов зарезервирован');assert(!s.promos[code]&&!s.partners[code],'Код уже существует');assert(Number.isInteger(max)&&max>=1&&max<=100000,'От 1 до 100 000 активаций');
    assert(['coin','case'].includes(type),'Выберите тип промокода');let amount=0,caseId=null;
    if(type==='coin'){amount=money(Number(b.amount));assert(Number.isFinite(amount)&&amount>0&&amount<=1e9,'Укажите количество монет');}
    else{const c=s.config.cases.find(x=>x.id===Number(b.caseId));assert(c,'Кейс не найден');caseId=c.id;}
    s.promos[code]={code,userId:id,owner:'BrainUp',type,amount,caseId,cost:0,max,used:[],reserved:0,adminCreated:true};return {code};
  }
  if(action==='admin-promo-delete'){own(s,id);const p=s.promos[norm(b.code)];assert(p,'Код не найден');if(!p.deleted&&p.reserved>0&&s.users[p.userId])s.users[p.userId].balance=money(s.users[p.userId].balance+p.reserved);p.reserved=0;p.deleted=true;return {};}
  if(action==='admin-ban'){
    own(s,id);const query=String(b.lookup||b.userId||'').trim().toLowerCase();
    let user=s.users[query]||s.users['tg:'+query];
    if(!user){const matches=Object.values(s.users).filter(u=>u.telegramUsername&&u.telegramUsername.toLowerCase()===query.replace(/^@/,''));assert(matches.length<=1,'Несколько совпадений: укажите Telegram ID');user=matches[0];}
    if(!user&&/^[1-9][0-9]{0,14}$/.test(query)&&Number.isSafeInteger(Number(query)))user=account(s,'tg:'+query,'Игрок');
    assert(user,'Игрок не найден. Укажите ID или username вошедшего игрока');assert(user.id!==s.owner,'Нельзя заблокировать владельца');
    assert(typeof b.banned==='boolean','Укажите бан или разбан');user.banned=b.banned;return {userId:user.id,name:user.me,username:user.telegramUsername||'',banned:user.banned};
  }
  if(action==='admin-balance'){
    own(s,id);const amount=money(Number(b.amount));assert(Number.isFinite(amount)&&(b.mode==='set'?amount>=0:amount>0)&&amount<=1e9,'Проверьте сумму (до 1 000 000 000)');
    assert(['add','subtract','set'].includes(b.mode),'Неизвестная операция');
    const targets=b.userId==='all'?Object.values(s.users):[s.users[b.userId]];assert(targets.length&&targets.every(Boolean),'Игрок не найден');
    const values=targets.map(u=>b.mode==='set'?amount:money(u.balance+(b.mode==='subtract'?-amount:amount)));
    assert(values.every(n=>Number.isFinite(n)&&n>=0),'Недостаточно монет для списания');
    targets.forEach((u,i)=>u.balance=values[i]);return {updated:targets.length};
  }
  if(action==='admin-give'){own(s,id);const to=s.users[b.userId];assert(to,'Игрок не найден');const value=money(Number(b.amount));assert(Number.isFinite(value)&&value!==0&&to.balance+value>=0,'Неверная сумма');to.balance=money(to.balance+value);return {};}
  if(action==='admin-partner'){
    own(s,id);const target=s.users[b.userId],code=norm(b.code),pct=Number(b.pct),bonus=Number(b.bonus)||0;
    assert(!code.startsWith('SNOW-')&&!code.startsWith('BU-'),'Префикс автопромокодов зарезервирован');assert(target,'Игрок должен сначала войти');assert(/^[A-Z0-9_-]{3,20}$/.test(code)&&!s.partners[code]&&!s.config.retiredPartners?.[code]&&!s.promos[code],'Код занят или неверен');assert(!partner(s,b.userId),'У игрока уже есть код');assert(pct>=0&&pct<=100&&bonus>=0&&bonus<=100,'Процент от 0 до 100');
    s.partners[code]={code,userId:b.userId,owner:target.me,pct,bonus,count:0,vol:0,pending:0,paid:0,list:[]};return {};
  }
  if(action==='admin-partner-delete'){
    own(s,id);const code=norm(b.code),p=s.partners[code];assert(p,'Партнёр уже удалён');
    (s.config.retiredPartners??={})[code]={...structuredClone(p),disabled:true,deletedAt:now,deletedBy:id};delete s.partners[code];
    for(const user of Object.values(s.users))if(user.bound===code)user.bound='';return {deleted:code};
  }
  if(action==='admin-feed-clear'){
    own(s,id);const removed=(s.drops||[]).length;s.drops=[];s.topDrop=null;s.feedRevision=(s.feedRevision||0)+1;s.feedClearedAt=now;return {removed,feedRevision:s.feedRevision};
  }
  if(action==='admin-partner-edit'){own(s,id);const p=s.partners[norm(b.code)];assert(p,'Партнёр не найден');if(b.disable)p.disabled=true;else {const pct=Number(b.pct),bonus=Number(b.bonus);assert(pct>=0&&pct<=100&&bonus>=0&&bonus<=100,'Процент от 0 до 100');p.pct=pct;p.bonus=bonus;}return {};}
  if(action==='admin-topup'){
    own(s,id);const t=s.topups.find(x=>x.id===b.id);assert(t&&t.st==='new','Заявка уже обработана');if(b.status==='ok'){
      const target=s.users[t.userId];target.balance=money(target.balance+t.total);recordPartnerDeposit(s,target,t.base);t.st='ok';
    }else t.st='no';return {};
  }
  if(action==='admin-withdraw'){
    own(s,id);const w=s.withdrawals.find(x=>x.id===b.id);assert(w&&w.status==='pending','Заявка уже обработана');const target=s.users[w.userId];
    if(b.status==='ok'){assert(isSunday(now)&&w.date<=sundayKey(now),'Вывод обрабатывается по воскресеньям, время Киева');const next=s.withdrawals.find(x=>x.status==='pending'&&x.date<=sundayKey(now));assert(next?.id===w.id,'Сначала обработайте предыдущую заявку в очереди');w.status='ok';if(w.kind==='partner'){s.partners[w.partner].paid=money(s.partners[w.partner].paid+w.total);target.balance=money(target.balance+w.total);}}
    else {w.status='no';if(w.kind==='partner')s.partners[w.partner].pending=money(s.partners[w.partner].pending+w.total);else for(const x of w.orig)add(target,x.id);}
    w.processedAt=now;return {};
  }
  if(action==='admin-trade'){own(s,id);s.config.tradeNick=String(b.nick||'').trim().slice(0,32);return {};}
  if(action==='admin-case-create'){
    own(s,id);const name=String(b.name||'').trim().replace(/\s+/g,' '),price=money(Number(b.price)),image=String(b.image||'');
    assert(name.length>0&&name.length<=80&&Number.isFinite(price)&&price>0&&price<=1e9,'Проверьте название и цену');
    assert(!s.config.cases.some(c=>c.name.toLowerCase()===name.toLowerCase()),'Кейс с таким названием уже существует');
    assert(image.length<=1500000&&/^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image),'Загрузите картинку кейса');
    assert(Array.isArray(b.drops)&&b.drops.length>0&&b.drops.length<=2000,'Выберите содержимое кейса');
    const drops=b.drops.map(Number);assert(new Set(drops).size===drops.length,'Повтор предмета');for(const dropId of drops)itemBy(s,seed,dropId);
    const taken=[...seed.cases.map(c=>c.id),...s.config.cases.map(c=>c.id),...(s.config.delp||[])];
    const caseId=Math.max(200004,Number(s.config.cnid)||0,...taken.map(id=>Number(id)+1));
    const sectionId=resolveCaseSectionInput(s.config,b);
    s.config.cases.push({id:caseId,name,price,img:image,imageOverride:true,drops,grp:'',sectionId});s.config.cnid=caseId+1;return {caseId};
  }
  if(action==='admin-case-delete'){
    own(s,id);const caseId=Number(b.id);assert(s.config.cases.some(c=>c.id===caseId),'Кейс уже удалён');
    s.config.cases=s.config.cases.filter(c=>c.id!==caseId);s.config.delp=[...new Set([...(s.config.delp||[]),caseId])];return {caseId};
  }
  if(action==='admin-case-image'){
    own(s,id);const c=s.config.cases.find(c=>c.id===Number(b.id));assert(c,'Кейс не найден');const image=String(b.image||'');
    assert(image.length<=1500000&&/^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image),'Неверное изображение или слишком большой файл');
    c.img=image;c.imageOverride=true;return {caseId:c.id};
  }
  if(action==='admin-case-edit'){
    own(s,id);const c=s.config.cases.find(c=>c.id===Number(b.id));assert(c,'Кейс не найден');
    const name=String(b.name||'').trim(),price=money(Number(b.price));assert(name.length>0&&name.length<=80&&price>0&&price<=1e9&&Number.isFinite(price),'Проверьте название и цену');
    assert(Array.isArray(b.drops)&&b.drops.length>0&&b.drops.length<=2000&&new Set(b.drops).size===b.drops.length,'Выберите предметы без повторов');
    for(const itemId of b.drops)itemBy(s,seed,itemId);
    if(b.sectionId!=null||b.sectionName!=null)c.sectionId=resolveCaseSectionInput(s.config,b);
    c.name=name;if(!c.bonus)c.price=price;c.drops=b.drops.map(Number);return {caseId:c.id};
  }
  if(action==='admin-case-section-save'){
    own(s,id);const sections=caseSectionList(s.config),name=String(b.name||'').trim().replace(/\s+/g,' ');
    assert(name.length>0&&name.length<=60&&!/[\u0000-\u001f\u007f]/.test(name),'Название раздела: от 1 до 60 символов');
    const existing=b.id?sections.find(section=>section.id===b.id):null;assert(!b.id||existing,'Раздел не найден');
    assert(!sections.some(section=>section.id!==existing?.id&&section.name.toLocaleLowerCase()===name.toLocaleLowerCase()),'Раздел с таким названием уже есть');
    if(existing)existing.name=name;else{assert(sections.length<40,'Можно создать до 40 разделов');sections.push({id:'section-'+crypto.randomUUID(),name});}
    s.config.caseSections=sections;return {section:existing||sections.at(-1)};
  }
  if(action==='admin-case-section-delete'){
    own(s,id);const sections=caseSectionList(s.config),section=sections.find(section=>section.id===b.id);assert(section,'Раздел не найден');assert(section.id!=='other','Последний резервный раздел нельзя удалить');
    for(const c of s.config.cases)if(caseSectionFor(c,sections)===section.id)c.sectionId='other';
    s.config.caseSections=sections.filter(entry=>entry.id!==section.id);return {sectionId:section.id};
  }
  if(action==='admin-case-section-order'){
    own(s,id);const sections=caseSectionList(s.config),ids=b.ids;assert(Array.isArray(ids)&&ids.length===sections.length&&new Set(ids).size===sections.length&&ids.every(value=>sections.some(section=>section.id===value)),'Некорректный порядок разделов');
    s.config.caseSections=ids.map(value=>sections.find(section=>section.id===value));return {};
  }
  if(action==='admin-case-section'){
    own(s,id);const c=s.config.cases.find(c=>c.id===Number(b.caseId));assert(c,'Кейс не найден');c.sectionId=resolveCaseSectionInput(s.config,b);return {caseId:c.id};
  }
  if(action==='admin-topup-settings'){
    own(s,id);assert(Array.isArray(b.updates)&&b.updates.length>0&&b.updates.length<=2000,'Выберите предметы');
    const updates=b.updates.map(entry=>{const it=itemBy(s,seed,entry.id);const value={...s.config.tpc[it.id]};if(entry.on!==undefined){assert(typeof entry.on==='boolean','Неверное значение');value.on=entry.on?1:0;}if(entry.credit!==undefined){const credit=money(Number(entry.credit));assert(Number.isFinite(credit)&&credit>=0&&credit<=1e9,'Неверная цена');if(credit)value.v=credit;else delete value.v;}return {id:it.id,value};});
    for(const entry of updates)s.config.tpc[entry.id]=entry.value;return {updated:updates.length};
  }
  if(action==='admin-counters'){
    own(s,id);assert(['online','upgrades'].includes(b.kind),'Выберите счётчик');const value=Number(b.value);assert(Number.isSafeInteger(value)&&value>=0&&value<=1000000000,'Введите целое неотрицательное число');if(b.kind==='online')s.config.online=value;else u.upg=value;return {value};
  }
  if(action==='admin-item-price'){
    own(s,id);const item=itemBy(s,seed,b.id,true);
    if(b.price===null){if(s.config.itemPrices)delete s.config.itemPrices[item.id];return {itemId:item.id,price:itemBy(s,seed,item.id,true).price};}
    const price=b.price;assert(typeof price==='number'&&Number.isFinite(price)&&price>=.01&&price<=1e9&&Math.abs(price*100-Math.round(price*100))<1e-5,'Цена: от 0,01 до 1 000 000 000 BU, до двух знаков после запятой');
    (s.config.itemPrices||={})[item.id]=money(price);return {itemId:item.id,price:money(price)};
  }
  if(action==='admin-item-image'){
    own(s,id);const item=itemBy(s,seed,b.id,true);if(b.image===null){delete s.config.imgs[item.id];return {itemId:item.id};}
    const image=String(b.image||'');assert(image.length<=4000000&&/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image),'Выберите PNG размером до 3 МБ');
    let signature='';try{signature=atob(image.split(',')[1].slice(0,16));}catch{}assert([137,80,78,71,13,10,26,10].every((value,index)=>signature.charCodeAt(index)===value),'Файл не является PNG');
    s.config.imgs[item.id]=image;return {itemId:item.id};
  }
  if(action==='admin-catalog'){own(s,id);const c=b.catalog;assert(c&&Array.isArray(c.custom)&&Array.isArray(c.cases),'Неверный каталог');
    assert(new Set(c.cases.map(x=>x.id)).size===c.cases.length,'Повтор ID кейса');
    const sections=caseSectionList(s.config);for(const entry of c.cases){const previous=s.config.cases.find(x=>x.id===entry.id);if(entry.sectionId==null&&previous?.sectionId)entry.sectionId=previous.sectionId;assert(entry.sectionId==null||sections.some(section=>section.id===entry.sectionId),'Раздел кейса не найден');}
    const items=[...seed.items,...c.custom];assert(items.every(x=>Number.isFinite(x.price)&&x.price>0&&x.price<=1e9&&String(x.name).length<=80),'Неверные предметы');assert(new Set(items.map(x=>x.id)).size===items.length,'Повтор ID');
    assert(c.cases.every(x=>x.price>0&&Number.isFinite(x.price)&&Number.isSafeInteger(x.id)&&String(x.name||'').trim().length>0&&String(x.name).length<=80&&Array.isArray(x.drops)&&x.drops.length&&x.drops.every(id=>items.some(i=>i.id===id))),'Неверные кейсы');
    const deleted=[...new Set([...(s.config.delp||[]),...(c.delp||[])])];
    for(const k of ['custom','cases','imgs','tpc','nid','cnid'])if(c[k]!=null)s.config[k]=c[k];s.config.delp=deleted;s.config.cases=s.config.cases.filter(x=>!deleted.includes(x.id));return {};
  }
  throw new Error('Действие не поддерживается');
}
export function feedDay(ts){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ts));}
export function execute(s,id,seed,action,b={},now=Date.now(),rng=random){
  const partnerGame=capturePartnerGame(s,id,seed,action,b);
  const result=executeCommand(s,id,seed,action,b,now,rng);
  settlePartnerGame(s,id,partnerGame,result,now);
  const record=(game,itemId,price,extra={})=>{
    if(!(price>0)||itemId==null||extra.rewardKind==='coins')return;
    const d={id:crypto.randomUUID(),game,userId:id,user:s.users[id].me,itemId:itemId??null,price:money(price),ts:now,...extra};
    s.drops=[d,...(s.drops||[])].slice(0,200);
    if(itemId!=null&&(!s.users[id].bestDrop||d.price>s.users[id].bestDrop.price))s.users[id].bestDrop={...d,itemName:catalog(s,seed).find(x=>x.id===itemId)?.name||''};
    if(!isBrainrotDrop(s.topDrop)||feedDay(s.topDrop.ts)!==feedDay(now)||d.price>s.topDrop.price)s.topDrop=d;
  };
  if(action==='case')for(const x of result.wins)record('case',x.w.rewardKind==='coins'?null:x.w.id,x.w.price,{rewardKind:x.w.rewardKind||'item',inventoryUid:x.uid,caseId:Number(b.id),caseName:s.config.cases.find(c=>c.id===Number(b.id))?.name||''});
  if(action==='fuse'){record('fuse',result.w.id,result.w.price,{inventoryUid:result.uid});if(result.extra)record('fuse',result.extra.w.id,result.extra.w.price,{inventoryUid:result.extra.uid});}
  if(action==='fuse-hit'&&result.prize)record('fuse',result.prize.w.id,result.prize.w.price,{inventoryUid:result.prize.uid});
  if(action==='upgrade'&&result.win)record('upgrade',result.target.id,result.target.price);
  if(action==='dice'&&result.mult)record('dice',result.itemId,result.paid,{qty:result.mult});
  if((action==='mines-cash'||action==='mines-open')&&result.end&&result.win)record('mines',result.item?.id,result.paid);
  const rocket=result.rocket||(action.startsWith('rocket-')?result:null);
  if(rocket?.won)record('rocket',rocket.item?.id,rocket.item?rocket.item.price+(rocket.change||0):rocket.change);
  const user=s.users[id];let event=null;
  if(action==='case'){user.casesOpened=(user.casesOpened||0)+result.wins.length;event={title:'Открытие кейса',detail:result.wins.map(x=>x.w.name).join(', ')}};
  if(action==='fuse')event={title:'Fuse',detail:'Получено: '+result.w.name};
  if(action==='upgrade')event={title:'Апгрейд',detail:result.win?'Выигрыш: '+result.target.name:'Предметы использованы · проигрыш'};
  if(action==='dice'){user.diceRolls=(user.diceRolls||0)+1;event={title:'Дайсы',detail:result.mult?'Выигрыш ×'+result.mult:'Проигрыш'}};
  if(action==='mines-cash'||action==='mines-open'&&result.end)event={title:'Мины',detail:result.win?'Получено: '+result.paid:'Проигрыш'};
  if(event)user.activity=[{id:crypto.randomUUID(),ts:now,...event},...(user.activity||[])].slice(0,50);
  return result;
}
