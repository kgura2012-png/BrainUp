// Price ratios measured from the user's Meowl screenshot (default = 17,640).
// Keep the integer ratios intact; round only the final BU price to cents.
export const MUTATION_REFERENCE_PRICE=17640;
export const MUTATION_TYPES=[
 {id:'gold',name:'Gold',referencePrice:18140},
 {id:'diamond',name:'Diamond',referencePrice:19140},
 {id:'rainbow',name:'Rainbow',referencePrice:28550},
 {id:'candy',name:'Candy',referencePrice:30150},
 {id:'lava',name:'Lava',referencePrice:32440},
 {id:'galaxy',name:'Galaxy',referencePrice:31890},
 {id:'yin-yang',name:'Yin Yang',referencePrice:32080},
 {id:'radioactive',name:'Radioactive',referencePrice:30490},
 {id:'cursed',name:'Cursed',referencePrice:29250},
 {id:'divine',name:'Divine',referencePrice:28930}
];
export function mutationPrice(basePrice,mutation){
 const entry=MUTATION_TYPES.find(entry=>entry.id===mutation);if(!entry)throw Error('Неизвестная мутация');
 if(!Number.isFinite(basePrice)||basePrice<=0)throw Error('Неверная базовая цена');
 return Math.round(Math.round(basePrice*100)*entry.referencePrice/MUTATION_REFERENCE_PRICE)/100;
}
export function mutationItemId(baseId,mutation){
 const index=MUTATION_TYPES.findIndex(entry=>entry.id===mutation);if(index<0||!Number.isSafeInteger(baseId)||baseId<0)throw Error('Неизвестная мутация');
 return 2000000+baseId*32+index+1;
}
export function expandMutationCatalog(baseItems,bases){
 return bases.flatMap(base=>{
  const item=baseItems.find(item=>item.id===base.id&&!item.hidden&&!item.mutation);if(!item)throw Error('Брейнрот для мутаций не найден: '+base.name);
  return MUTATION_TYPES.map(mutation=>({id:mutationItemId(item.id,mutation.id),name:base.name+' · '+mutation.name,price:mutationPrice(item.price,mutation.id),rarity:item.rarity||'Secret',baseId:item.id,baseName:base.name,mutation:mutation.id}));
 });
}
