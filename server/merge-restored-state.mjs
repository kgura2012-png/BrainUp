function assert(ok, message) { if(!ok) throw Error(message || 'Invalid BrainUp state'); }
function equal(a,b,message) { assert(JSON.stringify(a)===JSON.stringify(b),message || 'BrainUp state mismatch'); }
export function mergeRestoredBrainupState(legacy,current){
equal(legacy.owner,current.owner);
function union(before,after,where) {
  const merged={...before};
  for (const [id,value] of Object.entries(after||{})) {
    if(Object.hasOwn(merged,id))equal(merged[id],value,'Conflicting records in '+where);
    merged[id]=value;
  }
  return merged;
}
function records(before,after,where) {
  const index=items=>Object.fromEntries((items||[]).map(entry=>{
    assert(entry?.id!=null,'Missing record ID in '+where);
    return [entry.id,entry];
  }));
  return [...new Map([...Object.entries(union(index(before),index(after),where))]).values()];
}
function remap(item,delta) {
  if(!delta||!item||typeof item!=='object')return item;
  if(Array.isArray(item))return item.map(x=>remap(x,delta));
  return Object.fromEntries(Object.entries(item).map(([k,v])=>[
    k, ['uid','inventoryUid'].includes(k)&&Number.isSafeInteger(v)?v+delta:remap(v,delta)
  ]));
}
const shifts=new Map(), users={...legacy.users};
for(const [id,fresh] of Object.entries(current.users)){
  const old=legacy.users[id];
  if(!old){users[id]=fresh;continue;}
  assert(!(old.bound&&fresh.bound&&old.bound!==fresh.bound),'Conflicting referral links');
  const delta=Math.max(0,(old.uid||1)-1);
  shifts.set(id,delta);
  const u={...old,...fresh,bound:fresh.bound||old.bound,uid:Math.max(old.uid||1,(fresh.uid||1)+delta)};
  for(const name of ['win','lose','upg','casesOpened','diceRolls','fuses','virtualWithdrawn']){
    if(name in old||name in fresh)u[name]=(old[name]||0)+(fresh[name]||0);
  }
  u.fc={...old.fc};
  for(const [key,count] of Object.entries(fresh.fc||{}))u.fc[key]=Math.max(u.fc[key]||0,count);
  u.bn={...old.bn,...fresh.bn,sp:Math.round(((old.bn?.sp||0)+(fresh.bn?.sp||0))*100)/100};
  for(const key of ['sub','nick'])if(old.bn?.[key]||fresh.bn?.[key])u.bn[key]=Math.max(old.bn?.[key]||0,fresh.bn?.[key]||0);
  if(old.bn?.share&&fresh.bn?.share)u.bn.share=old.bn.share.expiresAt>=fresh.bn.share.expiresAt?old.bn.share:fresh.bn.share;
  if(old.ageConfirmedAt||fresh.ageConfirmedAt)u.ageConfirmedAt=Math.max(old.ageConfirmedAt||0,fresh.ageConfirmedAt||0);
  if((old.telegramNameVerifiedAt||0)>(fresh.telegramNameVerifiedAt||0)){
    u.telegramName=old.telegramName;
    u.telegramNameVerifiedAt=old.telegramNameVerifiedAt;
  }
  if(old.activity||fresh.activity)u.activity=records(old.activity,fresh.activity,'activity').sort((a,b)=>b.ts-a.ts);
  if(old.bestDrop||fresh.bestDrop)u.bestDrop=(fresh.bestDrop?.price||0)>(old.bestDrop?.price||0)?remap(fresh.bestDrop,delta):old.bestDrop;
  for(const name of ['pending','mine','rocket','fuseBoss']){
    if(old[name]&&fresh[name])equal(old[name],fresh[name],'Conflicting unfinished game');
    if(old[name]&&!fresh[name])u[name]=old[name];
  }
  users[id]=u;
}
for(const [id,u] of Object.entries(users)){
  equal(u.id,id);
  assert(!u.rocket,'An unsettled Rocket round would restore an emptied balance');
  u.balance=0;
  u.inv=[];
}
const state={...legacy,...current,users};
state.config={...legacy.config,...current.config};
assert(legacy.config.cases.every(c=>current.config.cases.some(other=>c.id===other.id||c.name===other.name)), 'Restore the absent cases before moving state');
for(const name of ['imgs','tpc','itemPrices','retiredPartners']){
  if(legacy.config[name]||current.config[name])state.config[name]={...legacy.config[name],...current.config[name]};
}
state.config.custom=records(legacy.config.custom,current.config.custom,'catalog items');
state.config.tradeNick=current.config.tradeNick||legacy.config.tradeNick||'';
for(const name of ['nid','cnid'])state.config[name]=Math.max(legacy.config[name]||0,current.config[name]||0);
for(const name of ['partners','promos','starsBalanceEntries','starsPartnerEntries']){
  if(legacy[name]||current[name])state[name]=union(legacy[name],current[name],name);
}
for(const name of ['withdrawals','topups','uahTopups','simulationTopups','simulationBookings','collaborationApplications']){
  if(legacy[name]||current[name])state[name]=records(legacy[name],current[name],name);
}
for(const name of ['topupNumber','uahTopupNumber','simulationTopupNumber']){
  if(state[name]!=null)state[name]=Math.max(legacy[name]||0,current[name]||0);
}
const receipts={};
for(const [id,receipt] of Object.entries(current.receipts||{})){
  const user=Object.keys(current.users).find(key=>id.startsWith(key+':'));
  receipts[id]=remap(receipt,shifts.get(user));
}
state.receipts=union(legacy.receipts,receipts,'receipts');
const shiftDrop=entry=>remap(entry,shifts.get(entry?.userId));
state.drops=records(legacy.drops,(current.drops||[]).map(shiftDrop),'drops').sort((a,b)=>b.ts-a.ts);
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'});
state.topDrop=[legacy.topDrop,shiftDrop(current.topDrop)].filter(d=>d?.ts&&day.format(d.ts)===day.format(new Date())).sort((a,b)=>b.price-a.price)[0]||null;
state.previousTopDrops=records(legacy.previousTopDrops,(current.previousTopDrops||[]).map(shiftDrop),'prior top drops');
state.feedRevision=Math.max(legacy.feedRevision||0,current.feedRevision||0)+1;

return state;
}
