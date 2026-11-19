// Percentages supplied by the site owner. Each percentage uses the item's base credit.
export const BUFF_GROUPS=[
 {id:'negative',name:'Снижают',hint:'Цена ниже',items:[['claws','Claws',-7.5,'🦀'],['taco','Taco',-15,'🌮']]},
 {id:'top',name:'Топ',hint:'+30% и выше',items:[['sleepy','Sleepy',125,'💤'],['10b','10B',100,'🔟'],['lightning','Lightning',80,'⚡'],['strawberry','Strawberry',80,'🍓'],['halo','Halo',75,'😇'],['john-pork','John Pork',50,'🐷'],['meowl','Meowl',50,'🐱'],['rainbow-balloon','Rainbow Balloon',50,'🌈'],['skibidi','Skibidi',45,'🚽'],['lucky','Lucky',40,'🍀'],['rose','Rose',35,'🌹'],['granny','Granny',30,'👵'],['jack-o-lantern-pet','Jack O’ Lantern Pet',30,'🎃'],['rip-gravestone','RIP Gravestone',30,'🪦']]},
 {id:'high',name:'Высокие',hint:'От +15%',items:[['26','26',25,'26'],['chocolate','Chocolate',25,'🍫'],['extinct','Extinct',25,'🦴'],['witch-hat','Witch Hat',25,'🧙'],['reindeer-pet','Reindeer Pet',22.5,'🦌'],['santa-hat','Santa Hat',22.5,'🎅'],['blue-balloon','Blue Balloon',20,'🔵'],['blue-egg','Blue Egg',20,'🥚'],['bunny-ears','Bunny Ears',20,'🐰'],['green-balloon','Green Balloon',20,'🟢'],['green-egg','Green Egg',20,'🥚'],['orange-balloon','Orange Balloon',20,'🟠'],['orange-egg','Orange Egg',20,'🥚'],['pink-balloon','Pink Balloon',20,'🩷'],['pink-egg','Pink Egg',20,'🥚'],['red-balloon','Red Balloon',20,'🔴'],['fireworks','Fireworks',15,'🎆'],['zombie','Zombie',15,'🧟']]},
 {id:'medium',name:'Средние',hint:'От +5%',items:[['aura-shades','Aura Shades',10,'🕶️'],['ball','Ball',10,'⚽'],['burger','Burger',10,'🍔'],['sun','Sun',10,'☀️'],['1-year','1 Year',7.5,'1Y'],['snowy','Snowy',7.5,'❄️'],['tie','Tie',7.5,'👔'],['wet','Wet',7.5,'💧'],['brazil','Brazil',5,'🇧🇷'],['bubblegum','Bubblegum',5,'🟣'],['galactic','Galactic',5,'🌌'],['glitched','Glitched',5,'👾'],['indonesian','Indonesian',5,'🇮🇩'],['nyan','Nyan',5,'🐈'],['sombrero','Sombrero',5,'👒']]},
 {id:'base',name:'Базовые',hint:'До +5%',items:[['matteo-hat','Matteo Hat',4.5,'🎩'],['paint','Paint',4.5,'🎨'],['spider','Spider',4.5,'🕷️'],['job-application','Job Application',4,'📄'],['shark-fin','Shark Fin',4,'🦈'],['concert','Concert',3.5,'🎇'],['bombardiro','Bombardiro',2.5,'✈️'],['fire','Fire',2.5,'🔥'],['mi-gatito','Mi Gatito',2.5,'🐈‍⬛'],['starfall','Starfall',2.5,'🌟'],['ufo','UFO',2.5,'🛸']]}
];
export const BUFFS=Object.fromEntries(BUFF_GROUPS.flatMap(group=>group.items.map(([id,name,percent,icon])=>[id,{id,name,percent,icon,group:group.id}])));
export function buffItemQuote(value,quantity,buffs=[]){
 if(!Array.isArray(buffs)||buffs.length>Object.keys(BUFFS).length||new Set(buffs).size!==buffs.length||buffs.some(id=>!Object.hasOwn(BUFFS,id)))throw Error('Выберите бафы из таблицы без повторов');
 if(!Number.isFinite(value)||value<=0||!Number.isSafeInteger(quantity)||quantity<1||quantity>100)throw Error('Неверная позиция заявки');
 const percent=buffs.reduce((sum,id)=>sum+BUFFS[id].percent,0),base=Math.round(value*quantity*100)/100,total=Math.round(base*(100+percent))/100;
 return {buffs:[...buffs],percent,base,adjustment:Math.round((total-base)*100)/100,total};
}
export function buffTopupQuote(record,entries){
 if(!Array.isArray(entries)||entries.length!==record.items.length||new Set(entries.map(x=>x.id)).size!==entries.length)throw Error('Укажите бафы для каждой позиции заявки');
 const items=record.items.map(item=>{const entry=entries.find(x=>x.id===item.id);if(!entry)throw Error('Позиция заявки не найдена');return {...item,...buffItemQuote(item.v,item.q,entry.buffs)}});
 const originalBase=Math.round(items.reduce((sum,item)=>sum+item.base,0)*100)/100,base=Math.round(items.reduce((sum,item)=>sum+item.total,0)*100)/100,total=Math.round(base*(100+record.bonus))/100;
 if(!Number.isFinite(total)||total<=0||total>1e8)throw Error('Слишком большая сумма');
 return {items,originalBase,base,buffAdjustment:Math.round((base-originalBase)*100)/100,total};
}
