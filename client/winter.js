// Winter appearance does not change inventory, prices or game probabilities.
document.body.classList.add('bu-winter');
document.documentElement.style.setProperty('--winter-backdrop','url("'+FUSE_BACKGROUND_IMAGE+'")');
var WINTER_TOKEN_SVG="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 80 80\"><defs><linearGradient id=\"rim\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop stop-color=\"#e7ffb8\"/><stop offset=\".3\" stop-color=\"#8cef53\"/><stop offset=\".65\" stop-color=\"#286d28\"/><stop offset=\"1\" stop-color=\"#a7f77d\"/></linearGradient><radialGradient id=\"face\" cx=\".35\" cy=\".25\" r=\".85\"><stop stop-color=\"#303b2c\"/><stop offset=\"1\" stop-color=\"#090d09\"/></radialGradient></defs><circle cx=\"40\" cy=\"43\" r=\"36\" fill=\"#080b08\"/><circle cx=\"40\" cy=\"39\" r=\"35\" fill=\"url(#rim)\" stroke=\"#132712\" stroke-width=\"2\"/><circle cx=\"40\" cy=\"39\" r=\"29\" fill=\"url(#face)\" stroke=\"#caff9c\" stroke-width=\"1.5\"/><circle cx=\"40\" cy=\"39\" r=\"25\" fill=\"none\" stroke=\"#507d3c\" stroke-width=\"1\"/><path d=\"M13 28A29 29 0 0 1 40 10\" fill=\"none\" stroke=\"#efffd9\" stroke-width=\"2\" stroke-linecap=\"round\"/><text x=\"39\" y=\"49\" fill=\"#d5ffb4\" font-family=\"Arial Black,Arial,sans-serif\" font-weight=\"900\" font-size=\"29\" letter-spacing=\"-2\" text-anchor=\"middle\">BU</text></svg>";
var WINTER_TOKEN_IMAGE='data:image/svg+xml,'+encodeURIComponent(WINTER_TOKEN_SVG);
document.documentElement.style.setProperty('--winter-token','url("'+WINTER_TOKEN_IMAGE+'")');
COIN='<i class="coin" role="img" aria-label="BU" title="BU — токен BrainUp"></i>';
var winterSearch='',winterPromoRefreshAt=0,winterPromoRefreshing=false;
function currentWinterPromo(){var p=A.winterPromotion;return p&&p.expiresAt>(Date.now()+(TP.clockOffset||0))?p:null}
function winterHero(){var promo=currentWinterPromo();return '<section class="winter-hero"><div class="winter-hero-copy"><div class="winter-eyebrow">BRAINUP / ЗИМНИЙ СЕЗОН</div><div class="winter-promo-clock">АВТОПРОМОКОД <span>Обновление каждые 2 часа · <b data-winter-timer>—</b></span></div><h1><em>+9%</em> к пополнению</h1><p>Зажги свою зиму. Собирай брейнротов.</p><div class="winter-promo-actions"><button class="winter-code" data-winter-copy aria-label="Скопировать автопромокод"><small>КОД</small><b data-winter-code>'+esc(promo?promo.code:'Загрузка…')+'</b><span>⧉</span></button><button class="bu-btn" data-winter-topup>Пополнить</button></div></div></section>'}
function winterFreeCases(){var list=A.cases.filter(function(c){return c.bonus&&['sub','nick'].includes(c.bonusKey)});return list.map(function(c){return '<button class="winter-free-case" data-ca="open" data-id="'+c.id+'"><img src="'+cImg(c)+'" alt=""><span><b>'+esc(c.bonusKey==='nick'?'Кейс за тег':'Кейс за подписку')+'</b><small>Бесплатно · каждые 12 часов</small></span><strong>Открыть <i>↗</i></strong></button>'}).join('')}
function winterCatalog(){var q=winterSearch.trim().toLocaleLowerCase('ru'),list=A.cases.filter(function(c){return !c.bonus&&(!q||c.name.toLocaleLowerCase('ru').includes(q)||cDrops(c).some(function(item){return item.name.toLocaleLowerCase('ru').includes(q)}))});if(!list.length)return '<p class="winter-empty">'+(q?'По этому запросу кейсов нет.':'Кейсы скоро появятся.')+'</p>';return [['basic','Базовые кейсы'],['theme','Тематические кейсы'],['','Другие кейсы']].map(function(group){var items=list.filter(function(c){return group[0]?c.grp===group[0]:!['basic','theme'].includes(c.grp)});return items.length?'<section class="winter-case-section"><h2>'+group[1]+'<span>'+items.length+'</span></h2><div class="bu-cgrid">'+items.map(caseCard).join('')+'</div></section>':''}).join('')}
casesPage=function(){return '<div class="bu-cwrap winter-catalog">'+winterHero()+'<section class="winter-free-section" aria-label="Бесплатные кейсы"><h2>Бесплатные кейсы</h2><div class="winter-free-cases">'+winterFreeCases()+'</div></section><div id="winter-case-results">'+winterCatalog()+'</div></div>'};
var winterOldCaseCard=caseCard;
caseCard=function(c){return winterOldCaseCard(c).replace(' items',' предметов').replace('<span class="bu-cimg">','<span class="winter-card-snow" aria-hidden="true"></span><span class="bu-cimg">')};
var winterOldBonus=tpBonus;
tpBonus=function(){var p=currentWinterPromo(),partner=A.refs[boundCode()],partnerBonus=partner&&!partner.disabled?Number(partner.bonus)||0:0;if(p&&simulationPromoCode()===p.code)return Math.max(partnerBonus,p.bonus);return winterOldBonus()};
var winterOldPromoHint=tpPh;
tpPh=function(){var p=currentWinterPromo(),code=simulationPromoCode(),hint=$('#tp-ph');if(hint&&(code.startsWith('SNOW-')||code.startsWith('BU-'))){var valid=p&&code===p.code;hint.className='tp-ph'+(valid?'':' bad');hint.textContent=valid?'Автопромокод: +'+fmt(tpBonus())+'%. Применяется больший бонус.':'Код истёк. Возьмите новый на странице кейсов.';return}winterOldPromoHint()};
var winterOldTopupPage=tpPage;
tpPage=function(){return winterOldTopupPage().replace(/Код партнёра/g,'Промокод или код партнёра')};
function winterTick(){var promo=currentWinterPromo();document.querySelectorAll('[data-winter-code]').forEach(function(el){el.textContent=promo?promo.code:'Обновляем…'});document.querySelectorAll('[data-winter-timer]').forEach(function(el){var left=promo?Math.max(0,Math.ceil((promo.expiresAt-Date.now()-(TP.clockOffset||0))/1000)):0;el.textContent=promo?[Math.floor(left/3600),Math.floor(left%3600/60),left%60].map(function(n){return String(n).padStart(2,'0')}).join(':'):'—'});if(!promo&&NET.ready&&!NET.busy&&!winterPromoRefreshing&&!document.hidden&&Date.now()>winterPromoRefreshAt){winterPromoRefreshing=true;winterPromoRefreshAt=Date.now()+15000;NET.request('state',{}).then(function(reply){NET.adopt(reply);if(reply.config&&reply.config.winterPromotion)TP.clockOffset=reply.config.winterPromotion.serverNow-Date.now()}).catch(function(){}).finally(function(){winterPromoRefreshing=false})}}
setInterval(winterTick,1000);document.addEventListener('visibilitychange',function(){if(!document.hidden)winterTick()});
document.addEventListener('input',function(e){if(!e.target.matches('[data-winter-search]'))return;winterSearch=e.target.value;var list=$('#winter-case-results');if(list)list.innerHTML=winterCatalog()});
document.addEventListener('click',async function(e){var button=e.target.closest('[data-winter-copy],[data-winter-topup]');if(!button)return;var promo=currentWinterPromo();if(!promo){winterTick();return toast('Обновляем промокод. Попробуйте через секунду.')}if(button.hasAttribute('data-winter-topup')){TP.tab='items';TP.promo=promo.code;topup();return}try{await navigator.clipboard.writeText(promo.code);toast('Промокод скопирован')}catch(error){toast('Ваш промокод: '+promo.code)}});

// Static specks stay still for reduced-motion users; the layer never captures clicks.
var winterSnow=document.createElement('div');winterSnow.className='winter-snow';winterSnow.setAttribute('aria-hidden','true');winterSnow.innerHTML=Array.from({length:22},function(_,i){return '<i style="--x:'+((i*47)%100)+'%;--delay:-'+(i*.81)+'s;--duration:'+(13+i%8)+'s;--size:'+(2+i%3)+'px"></i>'}).join('');document.body.appendChild(winterSnow);
if(U.sec==='cases')renderCases();if(U.sec==='fuse')paintFuse();hdr();winterTick();
// Header-level navigation matches the catalogue; the drawer retains account tools.
var winterHeader=$('#bu-head');
if(winterHeader){
 var winterNav=document.createElement('nav');winterNav.className='winter-navigation';winterNav.setAttribute('aria-label','Игровые разделы');
 winterNav.innerHTML=[['cases','Кейсы','◇'],['upgrade','Апгрейд','↑'],['dice','Дайсы','⚄'],['fuse','Фьюз Санты','❄'],['mines','Мины','✧']].map(function(section){return '<button data-winter-section="'+section[0]+'"><i aria-hidden="true">'+section[2]+'</i>'+section[1]+'</button>'}).join('');

}
function winterActiveSection(){document.querySelectorAll('[data-winter-section]').forEach(function(button){var on=button.dataset.winterSection===U.sec;button.classList.toggle('on',on);if(on)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')})}
var winterShowSection=showSec;showSec=function(id){var result=winterShowSection(id);winterActiveSection();return result};
document.addEventListener('click',function(e){var button=e.target.closest('[data-winter-section]');if(button)showSec(button.dataset.winterSection)});winterActiveSection();
SITE_TOKEN_IMAGE=WINTER_TOKEN_IMAGE;
// The balance control uses a real image, rather than an i.coin element.
document.querySelectorAll('.bu-app .bet-amount__amount img').forEach(function(image){image.src=WINTER_TOKEN_IMAGE;image.alt='BU';image.title='BU — токен BrainUp'});


// Reference case scene, retaining the existing opening and bonus handlers.
var winterCaseRender=cwRender;
cwRender=function(){
 winterCaseRender();var box=$('#cw-box'),c=cById(CW.id);if(!box||!c)return;
 box.classList.add('winter-case-window');var panel=box.querySelector('.cw-panel'),stage=$('#cw-stage'),reels=$('#cw-reels'),title=box.querySelector('.cw-title'),ctl=$('#cw-ctl');
 if(!panel||!stage||!reels)return;
 var scene=document.createElement('div');scene.className='winter-case-scene';panel.insertBefore(scene,stage);scene.appendChild(reels);scene.appendChild(stage);if(title)scene.after(title);var idle=reels.querySelector('.cw-idle');if(idle)idle.innerHTML+=idle.innerHTML;
 var description=box.querySelector('.cw-description');if(description)description.remove();
 if(ctl){ctl.querySelectorAll('[data-cw="qty"]').forEach(function(button){var n=Number(button.dataset.n);button.innerHTML='×'+n+'<small>'+COIN+fmt(c.price*n)+'</small>'});var tools=ctl.querySelector('.cw-quick-tools');if(tools)ctl.appendChild(tools)}
 var heading=box.querySelector('.cw-ph');if(heading)heading.textContent='Что может выпасть';
};
var winterCasePlay=cwPlay;cwPlay=function(){return winterCasePlay.apply(this,arguments)};
var winterCaseDone=cwDone;cwDone=function(){var result=winterCaseDone.apply(this,arguments);var scene=document.querySelector('.winter-case-scene');if(scene)scene.classList.add('settled');return result};

// The strip's measured item width is the source of truth for the winning centre.
cwSpin=function(strip,reel,tx,dur,WI,iw,tick,done){
 var token=CW.tok,start=0,last=-1,width=strip.children[WI].getBoundingClientRect().width;
 var destination=reel.clientWidth/2-(strip.children[WI].offsetLeft+width/2);
 var duration=matchMedia('(prefers-reduced-motion: reduce)').matches?180:dur*1000;
 function frame(now){if(token!==CW.tok||!strip.isConnected)return;if(!start)start=now;var progress=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-progress,5),x=destination*ease;strip.style.transform='translate3d('+x+'px,0,0)';var current=Math.floor((reel.clientWidth/2-x)/width);if(tick&&current!==last){last=current;sfx('ctick',current)}if(progress<1)requestAnimationFrame(frame);else{strip.style.filter='';done()}}
 requestAnimationFrame(frame);
};

// Hanging ornaments are decorative and never capture input.
