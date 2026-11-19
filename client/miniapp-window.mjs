export function miniappHeaderInsets(tg,state){
 if(!state.native||!state.fullscreen)return {top:0,left:0,right:0};
 const inset=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
 const system=tg?.safeAreaInset||{},content=tg?.contentSafeAreaInset||{};
 // Telegram's controls occupy their own row, including desktop clients that
 // report a zero content inset. Keep our whole header below that row.
 return {top:inset(system.top)+Math.max(52,inset(content.top)),left:inset(system.left)+inset(content.left),right:inset(system.right)+inset(content.right)};
}
export function createMiniappWindowController(tg,doc,onChange=()=>{}){
 const native=!!tg?.initData,modern=native&&typeof tg.requestFullscreen==='function'&&(!tg.isVersionAtLeast||tg.isVersionAtLeast('8.0'));
 const emit=()=>onChange({native,fullscreen:native?!!tg.isFullscreen:!!doc.fullscreenElement,modern});
 function safeCall(name,...args){try{if(typeof tg?.[name]==='function')tg[name](...args)}catch(e){}}
 return {
  init(){if(native){safeCall('ready');safeCall('expand');safeCall('setHeaderColor','#050505');safeCall('setBackgroundColor','#050505');if(typeof tg.onEvent==='function'){tg.onEvent('fullscreenChanged',()=>{if(!tg.isFullscreen)safeCall('enableVerticalSwipes');emit()});tg.onEvent('fullscreenFailed',emit);tg.onEvent('safeAreaChanged',emit);tg.onEvent('contentSafeAreaChanged',emit)}if(modern)safeCall('requestFullscreen')}else doc.addEventListener?.('fullscreenchange',emit);emit()},
  async toggle(){if(native){if(modern){if(tg.isFullscreen){safeCall('exitFullscreen');safeCall('enableVerticalSwipes')}else safeCall('requestFullscreen')}else safeCall('expand')}else if(doc.fullscreenElement)await doc.exitFullscreen?.();else await doc.documentElement.requestFullscreen?.();emit()},
  state(){return {native,fullscreen:native?!!tg.isFullscreen:!!doc.fullscreenElement,modern}},
 };
}
