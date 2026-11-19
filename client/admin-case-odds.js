var casesAdminBeforeOdds=casesAdminHtml;
casesAdminHtml=function(){
 return casesAdminBeforeOdds.apply(this,arguments).replace(/(<button data-a="cdel" data-id="(\d+)">)/g,function(match,button,id){
  return '<button type="button" data-admin-case-odds="'+id+'">Проценты</button>'+button;
 });
};

var caseOddsPercent=new Intl.NumberFormat('ru',{maximumFractionDigits:2});
function caseOddsDefaults(items){
 var total=items.reduce(function(sum,item){return sum+item.rewardWeight},0);
 var shares=items.map(function(item,index){
  var exact=item.rewardWeight/total*CASE_ODDS_TOTAL,basis=Math.floor(exact);
  return {index:index,basis:basis,remainder:exact-basis};
 });
 var weights=shares.map(function(share){return share.basis});
 var left=CASE_ODDS_TOTAL-weights.reduce(function(sum,basis){return sum+basis},0);
 shares.sort(function(a,b){return b.remainder-a.remainder}).slice(0,left).forEach(function(share){weights[share.index]++});
 return weights;
}
function showCaseOdds(id){
 var c=cById(id),items=c&&cDrops(c);
 if(!items||!items.length||!items.some(function(item){return item.rewardWeight>0}))return toast('В кейсе нет доступных наград');
 if(new Set(items.map(function(item){return String(item.id)})).size!==items.length)return toast('Уберите повторы из содержимого кейса');
 var weights=caseOddsDefaults(items);
 var rows=items.map(function(item,index){
  return '<label class="case-odds-row"><img src="'+esc(av(item))+'" alt=""><span>'+esc(item.name)+'</span>'
   +'<span class="case-odds-percent"><input class="bu-in" type="text" inputmode="decimal" autocomplete="off" maxlength="6"'
   +' data-case-odds-value="'+esc(String(item.id))+'" value="'+caseOddsPercent.format(weights[index]/100)+'">%</span></label>';
 }).join('');
 openModal('<form class="case-odds-form" data-case-odds-form="'+id+'"><h3 class="bu-mt">Проценты выпадения</h3><p>'+esc(c.name)+'</p>'
  +'<div class="case-odds-list">'+rows+'</div><p role="status" data-case-odds-total></p><div class="case-odds-actions">'
  +'<button class="bu-btn" type="submit">Сохранить проценты</button>'
  +(c.rewardOdds?'<button type="button" class="bu-btn" data-case-odds-reset>Вернуть стандартные</button>':'')
  +'</div></form>');
 var form=document.querySelector('[data-case-odds-form]');
 if(form)readCaseOddsForm(form);
}
function readCaseOddsForm(form){
 var odds={},total=0,valid=true,status=form.querySelector('[data-case-odds-total]');
 form.querySelectorAll('[data-case-odds-value]').forEach(function(input){
  var value=input.value.trim();
  var basis=/^\d{1,3}(?:[.,]\d{0,2})?$/.test(value)?Math.round(Number(value.replace(',','.'))*100):NaN;
  var correct=Number.isInteger(basis)&&basis>=0&&basis<=CASE_ODDS_TOTAL;
  input.setAttribute('aria-invalid',String(!correct));
  if(!correct){valid=false;return}
  odds[input.dataset.caseOddsValue]=basis;total+=basis;
 });
 status.textContent=!valid?'Для каждой награды укажите от 0 до 100%.'
  :'Сумма '+caseOddsPercent.format(total/100)+'% из 100%.';
 form.querySelector('[type="submit"]').disabled=!valid||total!==CASE_ODDS_TOTAL||form.dataset.saving==='true';
 return valid&&total===CASE_ODDS_TOTAL?odds:null;
}
async function saveCaseOdds(form,reset){
 if(!isOwner()||form.dataset.saving==='true')return;
 if(NET.busy)return toast('Дождитесь завершения текущего действия');
 var odds=reset?null:readCaseOddsForm(form);
 if(!reset&&!odds)return;
 var draft=caseSectionsDraft(),resetButton=form.querySelector('[data-case-odds-reset]');
 form.dataset.saving='true';
 form.querySelector('[type="submit"]').disabled=true;
 if(resetButton)resetButton.disabled=true;
 try{
  var result=await NET.request('admin-case-odds',{id:Number(form.dataset.caseOddsForm),odds:odds});
  NET.adopt(result);
  if(form.isConnected)closeModal();
  if(U.atab==='cases')caseSectionsRefresh(draft);
  else renderCases();
  toast(reset?'Стандартные проценты восстановлены':'Проценты сохранены');
 }catch(error){toast(error.message)}
 finally{
  if(form.isConnected){
   delete form.dataset.saving;
   if(resetButton)resetButton.disabled=false;
   readCaseOddsForm(form);
  }
 }
}
document.addEventListener('input',function(event){
 if(event.target.matches('[data-case-odds-value]'))readCaseOddsForm(event.target.closest('[data-case-odds-form]'));
});
document.addEventListener('click',function(event){
 var button=event.target.closest('[data-admin-case-odds],[data-case-odds-reset]');
 if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(!isOwner()||button.disabled)return;
 if(button.hasAttribute('data-case-odds-reset'))saveCaseOdds(button.closest('[data-case-odds-form]'),true);
 else showCaseOdds(Number(button.dataset.adminCaseOdds));
},true);
document.addEventListener('submit',function(event){
 if(!event.target.matches('[data-case-odds-form]'))return;
 event.preventDefault();event.stopImmediatePropagation();
 saveCaseOdds(event.target,false);
},true);
