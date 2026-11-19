import {withCatalogPrice} from '../shared/catalog-prices.mjs';
// Partner revenue is a share of settled game margin, never a second fee on deposits.
const PARTNER_GAMES=new Set(['case','upgrade','dice','fuse','fuse-hit','mines-open','mines-cash']);
const partnerCents=value=>Math.round((Number(value)||0)*100);
function activePlayerPartner(s,u,code=u?.bound,allowDisabled=false){
 const p=code&&s.partners[code];return p&&u&&p.userId!==u.id&&(allowDisabled||!p.disabled)?p:null;
}
function partnerPlayerRow(p,u){
 p.list??=[];let row=p.list.find(entry=>entry.k===u.id);
 if(!row){row={k:u.id,name:u.me,vol:0,earned:0,ts:Date.now()};p.list.push(row);p.count=(Number(p.count)||0)+1;}return row;
}
export function recordPartnerDeposit(s,u,amount,code=u?.bound){
 const p=activePlayerPartner(s,u,code,amount<0);if(!p)return null;
 const row=partnerPlayerRow(p,u),cents=partnerCents(amount);
 p.vol=Math.max(0,partnerCents(p.vol)+cents)/100;row.vol=Math.max(0,partnerCents(row.vol)+cents)/100;return p.code;
}
export function capturePartnerGame(s,id,seed,action,b){
 if(!PARTNER_GAMES.has(action))return null;
 const u=s.users[id],p=activePlayerPartner(s,u),pct=Number(p?.pct);if(!p||!Number.isFinite(pct)||pct<0||pct>100)return null;
 const prices=new Map([...seed.items,...s.config.custom].map(item=>[Number(item.id),partnerCents(withCatalogPrice(item,s.config.itemPrices).price)]));
 const owned=uid=>{const item=u.inv.find(item=>item.uid===Number(uid));return item?prices.get(Number(item.id))||0:0};
 let stake=0;
 if(action==='case'){const c=s.config.cases.find(c=>c.id===Number(b.id));stake=b.free?0:partnerCents((c?.price||0)*Number(b.n||1));}
 else if(action==='upgrade')stake=(Array.isArray(b.ids)?b.ids:[]).reduce((sum,uid)=>sum+owned(uid),0)+partnerCents(b.coins);
 else if(action==='dice')stake=b.bet?.type==='coin'?partnerCents(b.bet.amt):owned(b.bet?.uid);
 else if(action==='fuse')stake=(Array.isArray(b.ids)?b.ids:[]).reduce((sum,uid)=>sum+owned(uid),0);
 else if(action.startsWith('mines-'))stake=partnerCents(u.mine?.stake);
 return {code:p.code,pct,stake,action};
}
export function settlePartnerGame(s,id,snapshot,result,now){
 if(!snapshot||snapshot.action.startsWith('mines-')&&!result.end||snapshot.action==='fuse-hit'&&!result.prize)return;
 const u=s.users[id],p=s.partners[snapshot.code];if(!p)return;
 let payout=0;
 if(snapshot.action==='case')payout=result.wins.reduce((sum,win)=>sum+partnerCents(win.w.price),0);
 else if(snapshot.action==='upgrade')payout=result.win?partnerCents(result.target.price):0;
 else if(snapshot.action==='dice'||snapshot.action.startsWith('mines-'))payout=partnerCents(result.paid);
 else if(snapshot.action==='fuse')payout=partnerCents(result.w.price)+partnerCents(result.extra?.w.price);
 else if(snapshot.action==='fuse-hit')payout=partnerCents(result.prize.w.price);
 const margin=snapshot.stake-payout;
 // Symmetric cent rounding keeps positive and negative adjustments balanced.
 const commission=Math.sign(margin)*Math.round(Math.abs(margin)*snapshot.pct/100),row=partnerPlayerRow(p,u);
 p.pending=(partnerCents(p.pending)+commission)/100;row.earned=(partnerCents(row.earned)+commission)/100;
 p.gameStakes=(partnerCents(p.gameStakes)+snapshot.stake)/100;p.gamePayouts=(partnerCents(p.gamePayouts)+payout)/100;p.gameMargin=(partnerCents(p.gameMargin)+margin)/100;
 row.gameStakes=(partnerCents(row.gameStakes)+snapshot.stake)/100;row.gamePayouts=(partnerCents(row.gamePayouts)+payout)/100;
 p.gameLedger=[{id:crypto.randomUUID(),at:now,userId:id,user:u.me,game:snapshot.action,stake:snapshot.stake/100,payout:payout/100,margin:margin/100,pct:snapshot.pct,amount:commission/100},...(p.gameLedger||[])].slice(0,200);
}
