export const DEFAULT_CASE_SECTIONS=[
 {id:'free',name:'Бесплатные кейсы'},
 {id:'theme',name:'Тематические кейсы'},
 {id:'all-in',name:'All-In'},
 {id:'partners',name:'Партнеры'},
 {id:'basic',name:'Базовые кейсы'},
 {id:'other',name:'Другие кейсы'}
];
export function caseSectionList(config={}){
 const raw=Array.isArray(config.caseSections)?config.caseSections:DEFAULT_CASE_SECTIONS,seen=new Set();
 const list=raw.filter(section=>section&&typeof section.id==='string'&&typeof section.name==='string'&&section.name.trim()&&!seen.has(section.id)&&seen.add(section.id)).map(section=>({id:section.id,name:section.name}));
 if(!list.some(section=>section.id==='other'))list.push({id:'other',name:'Другие кейсы'});
 return list;
}
export function caseSectionFor(c,sections){
 if(c.sectionId&&sections.some(section=>section.id===c.sectionId))return c.sectionId;
 if(c.bonus&&sections.some(section=>section.id==='free'))return 'free';
 if(c.grp&&sections.some(section=>section.id===c.grp))return c.grp;
 return 'other';
}
