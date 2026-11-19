// An already-issued free opening needs no new subscription or share check.
// Keep a click made during another request instead of silently dropping it.
var issuedFreeCasePending=false,openCaseBeforeIssuedFree=cwGo;
cwGo=async function(free){
 var c=cById(CW.id),issued=free&&c&&c.bonus&&(S.fc[fcKey(c.id)]||0)>0;
 if(!issued)return openCaseBeforeIssuedFree.apply(this,arguments);
 if(issuedFreeCasePending||CW.busy)return;
 if(!NET.ready)return toast('Дождитесь подключения к серверу');
 if(U.busy||D.rolling)return toast('Дождитесь завершения текущей игры');
 issuedFreeCasePending=true;
 var id=CW.id,token=CW.tok,button=document.querySelector('[data-cw="free"]');
 if(button){button.disabled=true;button.setAttribute('aria-busy','true');button.setAttribute('data-request-pending','Открываем…')}
 try{
  for(var tick=0;NET.busy&&tick<220;tick++)await sleep(100);
  if(CW.id!==id||CW.tok!==token||!CW.el||!CW.el.classList.contains('on'))return;
  if(NET.busy)return toast('Сервер ещё занят. Повторите открытие через несколько секунд');
  if(U.busy||D.rolling||CW.busy)return toast('Дождитесь завершения текущей игры');
  if(!(S.fc[fcKey(id)]>0))return toast('Бесплатное открытие уже использовано');
  return await openCaseBeforeIssuedFree.call(this,true);
 }finally{
  issuedFreeCasePending=false;
  if(button&&button.isConnected){button.disabled=false;button.removeAttribute('aria-busy');button.removeAttribute('data-request-pending')}
 }
};
