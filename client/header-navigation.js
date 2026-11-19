// Bonuses is removed from both desktop navigation and the compact drawer.
SECS=SECS.filter(function(section){return section[0]!=='bonuses'});
document.querySelectorAll('[data-sec="bonuses"]').forEach(function(button){button.remove()});
document.querySelectorAll('#bu-drawer .bu-nav-heading').forEach(function(heading){if(heading.textContent.trim()==='Бонусы и аккаунт')heading.textContent='Аккаунт'});
var HEADER_WINDOW=null;
var HEADER_SECTIONS=[
 ['cases','Кейсы','M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1M8 7V4h8v3M3 12h18M10 12v3h4v-3'],
 ['upgrade','Апгрейд','M12 17V7m-4 4 4-4 4 4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'],
 ['dice','Дайсы','M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M7.5 7h1v1h-1zM15.5 7h1v1h-1zM11.5 11.5h1v1h-1zM7.5 16h1v1h-1zM15.5 16h1v1h-1z'],
 ['fuse','Фьюз Санты','M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9H8a3 3 0 1 1 3-3l1 3zm0 0h4a3 3 0 1 0-3-3l-1 3z'],
 ['mines','Мины','M17 13a6 6 0 1 1-12 0 6 6 0 0 1 12 0M14 8l3-3m-1-2 3 3m-1-3 2-1M8 11l1-1'],
 ['referrals','Рефералы','M15 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M18 20v-2a4 4 0 0 0-2-3.46M16 3.54a4 4 0 0 1 0 6.92']
];
function applyDrawerTypography(){document.querySelectorAll('#bu-drawer button[data-sec]').forEach(function(button){button.style.setProperty('font-family','"Montserrat","Nunito",Arial,sans-serif','important');button.style.setProperty('font-weight','700','important');button.style.setProperty('font-size','22px','important');button.style.setProperty('line-height','1.3');button.style.setProperty('min-height','54px');button.style.setProperty('height','auto');button.style.setProperty('padding-block','12px')})}
var openNavBeforeTypography=openNav;openNav=function(){applyDrawerTypography();return openNavBeforeTypography.apply(this,arguments)};
function updateWideNavigation(){document.querySelectorAll('[data-header-section]').forEach(function(button){var active=button.dataset.headerSection===U.sec;button.classList.toggle('on',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')})}
function updateMiniappWindow(state){var tg=window.Telegram&&window.Telegram.WebApp,insets=miniappHeaderInsets(tg,state);document.documentElement.style.setProperty('--miniapp-safe-top',insets.top+'px');document.documentElement.style.setProperty('--miniapp-safe-left',insets.left+'px');document.documentElement.style.setProperty('--miniapp-safe-right',insets.right+'px');document.body.classList.toggle('tg-fullscreen',state.native&&state.fullscreen);var button=document.getElementById('miniapp-size-toggle');if(button){button.setAttribute('aria-label',state.fullscreen?'Вернуться к обычному размеру':'Развернуть на весь экран');button.title=button.getAttribute('aria-label');button.setAttribute('aria-pressed',String(state.fullscreen));button.innerHTML=state.fullscreen?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v6H3M15 3v6h6M3 15h6v6M21 15h-6v6"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6"/></svg>';button.hidden=state.native&&!state.modern}
 var head=document.getElementById('bu-head');if(head)document.documentElement.style.setProperty('--bu-head',Math.ceil(head.getBoundingClientRect().height+insets.top)+'px');}
function installWideHeader(){var head=document.getElementById('bu-head');if(!head)return;if(head.parentNode!==document.body)document.body.prepend(head);var logo=head.querySelector('.bu-hlogo');if(logo){logo.classList.add('brainup-brand');logo.innerHTML='<img class="brand-wordmark-image" src="'+BRAINUP_WORDMARK_IMAGE+'" alt="BrainUp">';logo.setAttribute('role','button');logo.setAttribute('tabindex','0');logo.setAttribute('aria-label','BrainUp — открыть кейсы');logo.title='К кейсам'}
 if(!document.getElementById('wide-navigation')){var nav=document.createElement('nav');nav.id='wide-navigation';nav.className='wide-navigation';nav.setAttribute('aria-label','Разделы сайта');nav.innerHTML=HEADER_SECTIONS.map(function(section){return '<button data-header-section="'+section[0]+'"><i aria-hidden="true">'+secIcon(section[2])+'</i><span>'+section[1]+'</span></button>'}).join('');head.insertBefore(nav,head.querySelector('.bu-hr'))}
 if(!document.getElementById('miniapp-size-toggle')){var button=document.createElement('button');button.id='miniapp-size-toggle';button.type='button';button.setAttribute('aria-label','Развернуть на весь экран');document.body.appendChild(button)}updateWideNavigation();}
function goHeaderHome(){if(CW.el&&CW.el.classList.contains('on'))cwClose();if(modal.classList.contains('on'))closeModal();showSec('cases');window.scrollTo({top:0,behavior:'auto'})}
var sectionBeforeWideHeader=showSec;showSec=function(){if(CW.el&&CW.el.classList.contains('on'))cwClose();var result=sectionBeforeWideHeader.apply(this,arguments);updateWideNavigation();return result};
document.addEventListener('click',function(event){if(event.target.closest('.bu-hlogo')){goHeaderHome();return}var section=event.target.closest('[data-header-section]');if(section){showSec(section.dataset.headerSection);return}var more=event.target.closest('[data-header-more]');if(more){openNav();more.setAttribute('aria-expanded','true');return}if(event.target.closest('#miniapp-size-toggle')&&HEADER_WINDOW)HEADER_WINDOW.toggle().catch(function(){toast('Браузер не разрешил изменить размер окна')})});
document.addEventListener('keydown',function(event){if(event.target.closest('.bu-hlogo')&&['Enter',' '].includes(event.key)){event.preventDefault();goHeaderHome()}});
installWideHeader();applyDrawerTypography();
installNavigationFeedback(document,function(){return !window.matchMedia('(prefers-reduced-motion: reduce)').matches});
function initializeMiniappWindow(){if(HEADER_WINDOW)return;HEADER_WINDOW=createMiniappWindowController(window.Telegram&&window.Telegram.WebApp,document,updateMiniappWindow);HEADER_WINDOW.init();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeMiniappWindow,{once:true});else initializeMiniappWindow();
var headerResizePending=false;window.addEventListener('resize',function(){if(headerResizePending)return;headerResizePending=true;requestAnimationFrame(function(){headerResizePending=false;if(HEADER_WINDOW)updateMiniappWindow(HEADER_WINDOW.state())})});

if(U.sec==='bonuses')showSec('cases');
