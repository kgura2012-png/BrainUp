export function liveDropOrigin(drop,cases=[]){
 if(drop.game==='case'){
  const entry=cases.find(item=>item.id===Number(drop.caseId))||cases.find(item=>drop.caseName&&item.name===drop.caseName);
  return {section:'cases',label:drop.caseName||entry?.name||'Кейс',caseId:entry?.id??null,isCase:true};
 }
 const modes={upgrade:['upgrade','Апгрейд'],dice:['dice','Дайсы'],mines:['mines','Мины'],fuse:['fuse','Фьюз Санты']};
 const mode=modes[drop.game];
 return {section:mode?.[0]||'',label:mode?.[1]||'Брейнрот',caseId:null,isCase:false};
}
