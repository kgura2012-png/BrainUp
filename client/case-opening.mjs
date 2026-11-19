// Presentation only: prizes have already been settled by the server.
export async function playCaseOpening({stage,fast=false,reduced=false,wait,isCurrent=()=>true,skip=()=>false,onPhase=()=>{}}){
 if(!stage||reduced||skip())return isCurrent();
 const phases=fast?[['shake',220],['flash',120]]:[['shake',880],['flash',360]];
 stage.classList.add('case-chest-intro');
 stage.style?.setProperty('--case-opening-ms',fast?'120ms':'360ms');
 try{
  for(const [phase,duration] of phases){
   if(!isCurrent())return false;
   if(skip())return true;
   stage.dataset.openingPhase=phase;onPhase(phase);await wait(duration);
  }
  return isCurrent();
 }finally{delete stage.dataset.openingPhase;stage.classList.remove('case-chest-intro');stage.style?.removeProperty('--case-opening-ms')}
}
