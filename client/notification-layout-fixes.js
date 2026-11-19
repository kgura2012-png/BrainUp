// Stable grid rows keep names readable beside the balance controls.
var playersBeforeStableRows=svPlayersHtml;
svPlayersHtml=function(){var html=playersBeforeStableRows.apply(this,arguments);return html.replace('Players (','Игроки (').replace('<section class="bu-ac"><h4>Игроки (','<section class="bu-ac admin-player-list"><h4>Игроки (').replace(/class="li net-player-row"><div>/g,'class="li net-player-row"><div class="net-player-identity">').replace(/<div class="r"><input id="net-amount-/g,'<div class="r net-player-actions"><input id="net-amount-')};
// Completion state takes priority over legacy !important control styles.
var doneBeforeLayoutCleanup=cwDone;
cwDone=function(){var result=doneBeforeLayoutCleanup.apply(this,arguments),controls=document.getElementById('cw-ctl');if(controls){controls.hidden=true;controls.classList.add('case-controls-settled')}return result};

// Route only after the verified account has loaded; background renders cannot reopen it.
function partnershipLaunchRequested(href,startParam){try{return new URL(href).searchParams.get('screen')==='partnership'||startParam==='partnership'}catch(error){return false}}
var PARTNERSHIP_LAUNCH_PENDING=partnershipLaunchRequested(location.href,window.Telegram&&window.Telegram.WebApp&&window.Telegram.WebApp.initDataUnsafe&&window.Telegram.WebApp.initDataUnsafe.start_param);
var ADMIN_LAUNCH_PENDING=false;try{ADMIN_LAUNCH_PENDING=new URL(location.href).searchParams.get('screen')==='admin'}catch(error){}
var CASES_LAUNCH_PENDING=!PARTNERSHIP_LAUNCH_PENDING&&!ADMIN_LAUNCH_PENDING;
if(CASES_LAUNCH_PENDING)showSec('cases');
var renderBeforePartnershipLaunch=render;
render=function(){var result=renderBeforePartnershipLaunch.apply(this,arguments);if(CASES_LAUNCH_PENDING&&NET.ready){CASES_LAUNCH_PENDING=false;queueMicrotask(function(){showSec('cases')})}if(PARTNERSHIP_LAUNCH_PENDING&&NET.ready){PARTNERSHIP_LAUNCH_PENDING=false;queueMicrotask(function(){showSec('referrals')})}if(ADMIN_LAUNCH_PENDING&&NET.ready){ADMIN_LAUNCH_PENDING=false;if(NET.admin)queueMicrotask(function(){openAdmin()})}return result};
