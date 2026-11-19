// The case window uses the actual site feed, so its cards cannot drift in layout.
var unifiedLive=document.getElementById('bu-live'),unifiedLiveMarker=document.createComment('site-live-position'),unifiedLiveRendering=false;
if(unifiedLive&&unifiedLive.parentNode)unifiedLive.parentNode.insertBefore(unifiedLiveMarker,unifiedLive);
function restoreUnifiedLive(){if(unifiedLive&&unifiedLiveMarker.parentNode)unifiedLiveMarker.parentNode.insertBefore(unifiedLive,unifiedLiveMarker.nextSibling)}
updateCaseLiveDrops=function(){if(!unifiedLive||!CW.el)return;var old=document.getElementById('cw-live-drops');if(old)old.remove();if(unifiedLiveRendering||CW.el.classList.contains('on')){if(unifiedLive.parentNode!==CW.el)CW.el.prepend(unifiedLive)}else restoreUnifiedLive()};
var renderBeforeUnifiedLive=cwRender;cwRender=function(){unifiedLiveRendering=true;try{return renderBeforeUnifiedLive.apply(this,arguments)}finally{updateCaseLiveDrops();unifiedLiveRendering=false}};
var closeBeforeUnifiedLive=cwClose;cwClose=function(){var result=closeBeforeUnifiedLive.apply(this,arguments);restoreUnifiedLive();return result};

function refreshLiveDropTitle(){var root=document.getElementById('bu-live');if(!root)return;root.querySelectorAll('.bu-lh b').forEach(function(title){if(title.textContent!=='LIVE DROP')title.textContent='LIVE DROP'})}
var renderFeedBeforeEnglishTitle=renderDropFeed;renderDropFeed=function(){var result=renderFeedBeforeEnglishTitle.apply(this,arguments);refreshLiveDropTitle();return result};
refreshLiveDropTitle();
if(unifiedLive)new MutationObserver(refreshLiveDropTitle).observe(unifiedLive,{childList:true,subtree:true,characterData:true});

// Keep settings reachable from the profile after removing the desktop More menu.
var profileBeforeDirectSettings=profilePage;profilePage=function(){return profileBeforeDirectSettings.apply(this,arguments).replace('<div class="brain-profile">','<div class="brain-profile"><button class="profile-settings-link" data-profile-settings>Настройки</button>')};
document.addEventListener('click',function(event){if(event.target.closest('[data-profile-settings]'))settings()});
