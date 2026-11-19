import {recordPartnerDeposit} from './partner-accounting.mjs';
export const UAH_TOPUP_AMOUNTS=[10,20,50,100,200,500,1000,2000,5000,10000];
const uahAssert=(ok,message)=>{if(!ok)throw Error(message)};
export function uahTopupView(record,now=Date.now()){
 const st=['new','ready','checking'].includes(record.st)&&record.expiresAt<=now?'expired':record.st;
 const {card,...safe}=record;return {...safe,st,...(['ready','checking','ok'].includes(st)&&record.shownAt?{card}:{} )};
}
export function executeUahTopup(s,id,action,b,now){
 if(!['uah-card-save','uah-topup','uah-show-card','uah-paid','uah-review','uah-cancel'].includes(action))return null;
 const owner=()=>uahAssert(s.owner===id,'Доступ только владельцу');
 if(action==='uah-card-save'){
  owner();const raw=String(b.card??'').trim();uahAssert(/^[\d\s-]*$/.test(raw),'Введите только номер карты');const card=raw.replace(/[\s-]/g,'');uahAssert(card===''||/^\d{16}$/.test(card),'Номер карты должен содержать 16 цифр');
  s.config.uahCard=card;return {configured:!!card};
 }
 const user=s.users[id];uahAssert(user,'Сначала войдите');
 if(action==='uah-topup'){
  uahAssert(!s.config.topupsClosed&&!s.config.topupsUahClosed,'Пополнения гривнами временно закрыты');uahAssert(!!s.config.uahCard,'Пополнение гривнами пока не настроено');
  uahAssert(typeof b.amount==='number'&&Number.isFinite(b.amount)&&b.amount>=1&&b.amount<=1000000&&Math.abs(b.amount*100-Math.round(b.amount*100))<1e-6,'Введите сумму от 1 до 1 000 000 грн, до двух знаков после запятой');
  uahAssert(!(s.uahTopups||[]).some(r=>r.userId===id&&['new','ready','checking'].includes(uahTopupView(r,now).st)),'У вас уже есть активная заявка');
  const nick=String(b.nick||user.me||'Игрок').trim();uahAssert(nick.length>=1&&nick.length<=32&&!/[\u0000-\u001f\u007f]/.test(nick),'Введите ник: до 32 символов');
  const code=String(b.promo||'').trim().toUpperCase();if(code){const partner=s.partners[code];uahAssert(partner&&!partner.disabled&&partner.userId!==id,'Код партнёра не найден');uahAssert(!user.bound||user.bound===code,'Вы уже привязаны к другому партнёру');if(!user.bound){user.bound=code;partner.list??=[];partner.list.push({k:id,name:user.me,vol:0,earned:0,ts:now});partner.count=partner.list.length;}}
  const record={id:crypto.randomUUID(),number:(s.uahTopupNumber||0)+1,userId:id,user:user.me,nick,type:'uah',amount:b.amount,rate:1.25,total:Math.round(Math.round(b.amount*100)*1.25)/100,notifyOwner:true,promo:user.bound||'',st:'new',ts:now,expiresAt:now+1800000};
  s.uahTopupNumber=record.number;(s.uahTopups||=[]).push(record);return {topup:uahTopupView(record,now)};
 }
 const record=(s.uahTopups||[]).find(r=>r.id===b.id);uahAssert(record,'Заявка не найдена');
 if(['uah-show-card','uah-review'].includes(action))owner();else uahAssert(record.userId===id,'Заявка не найдена');
 uahAssert(['new','ready','checking'].includes(uahTopupView(record,now).st),'Заявка уже обработана или истекла');
 if(action==='uah-show-card'){uahAssert(record.st==='new','Карта уже показана');uahAssert(!!s.config.uahCard,'Сначала сохраните номер карты');record.card=s.config.uahCard;record.shownAt=now;record.st='ready';record.expiresAt=now+1800000;}
 else if(action==='uah-paid'){uahAssert(record.st==='ready','Сначала дождитесь реквизитов');record.st='checking';record.paymentClaimedAt=now;record.expiresAt=now+86400000;}
 else if(action==='uah-cancel'){uahAssert(record.st!=='checking','Оплата уже передана на проверку');record.st='no';record.cancelledAt=now;}
 else if(action==='uah-review'){
  uahAssert(['ok','no'].includes(b.status),'Выберите решение');if(b.status==='ok'){uahAssert(record.st==='checking','Сначала дождитесь отметки об оплате');const target=s.users[record.userId];uahAssert(target,'Игрок не найден');target.balance=(Math.round(target.balance*100)+Math.round(record.total*100))/100;recordPartnerDeposit(s,target,record.total,record.promo);}
  record.st=b.status;record.processedAt=now;record.processedBy=id;
 }
 return {topup:uahTopupView(record,now)};
}
