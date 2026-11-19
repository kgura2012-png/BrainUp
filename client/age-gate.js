// Remember self-declaration locally and on the signed-in account.
(function(){
 var gate=document.getElementById('brainup-age-gate');if(!gate)return;
 var accepted=false;try{accepted=localStorage.getItem('brainup-age-18-v1')==='accepted'}catch(e){}
 if(document.cookie.split(';').some(function(x){return x.trim()==='brainup_age_18=accepted'}))accepted=true;
 var previous=document.activeElement,blocked=[],shown=false,closed=false,started=Date.now(),syncing=false;
 function remember(){try{localStorage.setItem('brainup-age-18-v1','accepted')}catch(e){}document.cookie='brainup_age_18=accepted; Max-Age=315360000; Path=/; SameSite=Lax; Secure';}
 function finish(){accepted=true;remember();if(!closed){closed=true;blocked.forEach(function(entry){entry.node.inert=entry.inert});document.documentElement.classList.remove('age-gate-open');gate.remove();if(previous&&previous.isConnected&&typeof previous.focus==='function')previous.focus()}}
 function show(){if(shown||closed)return;shown=true;Array.from(document.body.children).forEach(function(node){if(node!==gate&&!['SCRIPT','STYLE'].includes(node.tagName)){blocked.push({node:node,inert:node.inert});node.inert=true}});document.documentElement.classList.add('age-gate-open');document.getElementById('brainup-age-accept').focus()}
 var accept=document.getElementById('brainup-age-accept'),decline=document.getElementById('brainup-age-decline');
 accept.addEventListener('click',finish);
 decline.addEventListener('click',function(){gate.querySelector('.age-actions').remove();gate.querySelector('.age-note').remove();var title=document.getElementById('brainup-age-title');title.textContent='Вход недоступен';document.getElementById('brainup-age-description').textContent='Этот сайт предназначен только для пользователей от 18 лет. Закрой страницу или мини-приложение.';title.tabIndex=-1;title.focus()});
 gate.addEventListener('keydown',function(event){if(event.key==='Escape'){event.preventDefault();return}if(event.key!=='Tab')return;var buttons=Array.from(gate.querySelectorAll('button'));if(!buttons.length){event.preventDefault();return}var first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}});
 if(accepted)finish();
 var timer=setInterval(async function(){if(NET.ready&&S.ageConfirmedAt){finish();clearInterval(timer);return}if(!accepted&&(NET.ready||Date.now()-started>1500))show();if(accepted&&NET.ready&&!NET.busy&&!syncing){syncing=true;try{var reply=await NET.request('age-confirm',{});NET.adopt(reply);finish();clearInterval(timer)}catch(error){}finally{syncing=false}}},300);
})();
