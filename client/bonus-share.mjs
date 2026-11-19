// Telegram may report success through its callback, its event, or both.
export function shareBonusInvitation(tg,messageId,{schedule=setTimeout,cancel=clearTimeout,timeoutMs=120000}={}){
 return new Promise((resolve,reject)=>{
  let finished=false,timer;
  function finish(sent,error){
   if(finished)return;finished=true;cancel(timer);
   tg.offEvent?.('shareMessageSent',sentEvent);tg.offEvent?.('shareMessageFailed',failedEvent);
   if(error)reject(error);else resolve(sent);
  }
  function sentEvent(){finish(true)}
  function failedEvent(event){finish(false,event?.error==='USER_DECLINED'?null:new Error('Telegram не смог отправить сообщение. Повторите отправку.'))}
  tg.onEvent?.('shareMessageSent',sentEvent);tg.onEvent?.('shareMessageFailed',failedEvent);
  timer=schedule(()=>finish(false,new Error('Telegram не подтвердил отправку. Повторите попытку.')),timeoutMs);
  try{tg.shareMessage(messageId,sent=>finish(sent===true))}catch(error){finish(false,error)}
 });
}

// Save only a real native success before making the network request. A focus
// check or a lost response must not force the player to message a friend again.
export function createBonusShareConfirmation({request,adopt,busy,owner,share,storage,now=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const key='bu-bonus-share-confirmation';let pending=null,saving=null;
 function persist(value){pending=value;try{if(value)storage?.setItem(key,JSON.stringify(value));else storage?.removeItem(key)}catch{}}
 function read(){
  if(!pending)try{pending=JSON.parse(storage?.getItem(key)||'null')}catch{}
  if(!pending||pending.userId!==owner())return null;
  if(pending.expiresAt<=now()){persist(null);return null}
  return pending;
 }
 function resume(){
  if(saving)return saving;
  const entry=read();if(!entry)return Promise.resolve(false);
  saving=(async()=>{
   try{
    for(let attempt=0;attempt<2;attempt++){
     for(let tick=0;busy()&&tick<200;tick++)await wait(100);
     if(busy()||entry.expiresAt<=now()||owner()!==entry.userId)throw Error('Повторите подтверждение пересылки');
     const current=share();
     if(current?.nonce===entry.nonce&&current.confirmedAt&&!current.consumed){persist(null);return true}
     try{
      const reply=await request('bonus-share-complete',{nonce:entry.nonce,sent:true});
      if(owner()!==entry.userId)return false;
      adopt(reply);persist(null);return true;
     }catch(error){if(attempt===1)throw error;await wait(350)}
    }
   }catch(error){throw new Error('Сообщение отправлено. Не удалось сохранить подтверждение — нажмите «Повторить подтверждение».')}
  })().finally(()=>{saving=null});
  return saving;
 }
 return {
  hasPending:()=>!!read(),isSaving:()=>!!saving,resume,
  confirm(sent,prepared){
   if(sent!==true)return Promise.resolve(false);
   persist({userId:owner(),nonce:prepared.nonce,expiresAt:prepared.expiresAt});
   return resume();
  }
 };
}
