// Neutralize legacy green surface declarations at their original specificity.
// Colour choices in dice and artwork stay intact; accents belong to one final sheet.
function neutralSurfaceColor(r,g,b,a){
 r=Number(r);g=Number(g);b=Number(b);
 if(g>r+6&&g>r*1.12&&g>=b*.9){var level=g<75?12:g<155?18:25;return a===undefined?'rgb('+level+','+level+','+level+')':'rgba('+level+','+level+','+level+','+a+')'}
 return null;
}
function neutralSurfaceValue(value){
 if(!value||/url\(/i.test(value))return value;
 value=value.replace(/rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/gi,function(match,r,g,b,a){return neutralSurfaceColor(r,g,b,a)||match});
 return value.replace(/#([\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b/gi,function(match,h){if(h.length<5)h=h.split('').map(function(c){return c+c}).join('');return neutralSurfaceColor(parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),h.length===8?parseInt(h.slice(6,8),16)/255:undefined)||match});
}
function neutralizeThemeSheet(sheet){
 try{Array.from(sheet.cssRules||[]).forEach(function(rule){if(rule.cssRules){neutralizeThemeSheet(rule);return}if(!rule.style||/\.bu-dpick|\.dice-orb|\.dface|\.dfc\b/.test(rule.selectorText||''))return;Array.from(rule.style).forEach(function(property){if(!/^(background(?:-color|-image)?|box-shadow|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|color|--.*(?:bg|background|panel|surface))$/.test(property))return;var value=rule.style.getPropertyValue(property),neutral=neutralSurfaceValue(value);if(property==='color'&&value!==neutral)neutral='#d0d0d0';if(value!==neutral)rule.style.setProperty(property,neutral,rule.style.getPropertyPriority(property))})})}catch(e){}
}
function applyBlackTheme(){Array.from(document.styleSheets).forEach(function(sheet){if(sheet.ownerNode&&sheet.ownerNode.id==='brainup-black-theme')return;neutralizeThemeSheet(sheet)})}
applyBlackTheme();
var blackThemePending=false;
new MutationObserver(function(records){if(!records.some(function(record){return record.target.nodeName==='STYLE'||record.target.parentNode&&record.target.parentNode.nodeName==='STYLE'||Array.from(record.addedNodes).some(function(node){return node.nodeName==='STYLE'||node.nodeName==='LINK'})}))return;if(blackThemePending)return;blackThemePending=true;requestAnimationFrame(function(){blackThemePending=false;applyBlackTheme()})}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
var blackTheme=document.createElement('style');blackTheme.id='brainup-black-theme';blackTheme.textContent=`
html:has(body.bu-winter),html body.bu-winter{background:#050505!important;color:#f2f2f2!important;--bg:#050505;--panel:#101010;--accent:#63ff42;--muted:#a1a1a8}
html body.bu-winter:before,html body.bu-winter:after{background:#050505!important;background-image:none!important;box-shadow:none!important}
html body.bu-winter :is(up-app-root,up-app-root>div,up-app-root>div>div,up-main,main,footer,.bu-app,#bu-soon,.cw,.cw-bg,#cw-box,.bu-mwrap){background:#050505!important;background-image:none!important}
html body.bu-winter :is(.bu-panel,.bu-slot,.bu-stat,.bu-mpanel,.dice-machine,.dice-side-panel,.fuse-console,.fuse-rules,.fuse-inventory,.bu-rfc,.profile-box,.bu-ac,.bu-mbox,.bu-am,.winter-hero,.winter-free-case){background:#101010!important;background-image:none!important;border-color:#303030!important;box-shadow:none!important}
html body.bu-winter :is(.bu-head,.winter-navigation,#bu-drawer,.bu-live,.bu-cfoot,.winter-search){background:#080808!important;background-image:none!important;border-color:#282828!important}
html body.bu-winter :is(.bu-card,.bu-ic,.bu-mi,.fuse-item,.bu-mcell,.bu-mchip,.bu-in,.bu-sr,.bu-dh-row,.bu-dwin,.bu-dslot,.dice-payrow,.bu-dbet,.bu-dfast,.bu-dfast.on,.bu-segs,.dice-mode-tabs,.bu-ccard){background:#171717!important;background-image:none!important;border-color:#353535!important;box-shadow:none!important}
html body.bu-winter .winter-catalog .bu-ccard,html body.bu-winter .winter-catalog .bu-cfoot,html body.bu-winter .cw #cw-box.winter-case-window .cw-pz,html body.bu-winter #bu-soon .dice-surface .bu-dslot{background:#111!important;background-image:none!important;border-color:#343434!important}
html body.bu-winter :is(.bu-btn,.bu-up,.bu-mplay,.bu-droll,.cw-open){background:#171717!important;background-image:none!important;color:#f4f4f4!important;border:1px solid #4d4d4d!important;box-shadow:none!important}
html body.bu-winter :is(.bu-btn,.bu-up,.bu-mplay,.bu-droll,.cw-open):enabled:hover{background:#242424!important;border-color:#63ff42!important;box-shadow:0 0 14px #63ff421c!important}
html body.bu-winter :is(.bu-up,.cw-open,.bu-mplay,.bu-droll):enabled{border-color:#63ff42!important;color:#89ff70!important}
html body.bu-winter :is(.bu-btn,.bu-up,.bu-mplay,.bu-droll,.cw-open):disabled{background:#151515!important;color:#686868!important;border-color:#303030!important;box-shadow:none!important}
html body.bu-winter :is(.bu-card.s,.bu-mi.on,.fuse-item.selected,.bu-mchip.nx,.bu-mq2.on,.bu-tab.on,.bu-segs .on,.tp-tabs .on,.bu-sw.on){background:#202020!important;border-color:#63ff42!important;outline-color:#63ff42!important;color:#caffbe!important;box-shadow:none!important}
html body.bu-winter .winter-navigation button.on{background:#171717!important;color:#8aff70!important}
html body.bu-winter .winter-navigation button.on:after{background:#63ff42!important;box-shadow:0 0 10px #63ff4244!important}
html body.bu-winter :is(.winter-navigation button.on i,.winter-hero h1 em,.winter-promo-clock b,.bu-mmsg.w){color:#7bff60!important}
html body.bu-winter .bu-mtitle .bu-bomb{color:#63ff42!important}
html body.bu-winter .cw .case-focus-ring{border-color:#72ff54!important;box-shadow:0 0 0 5px #090909aa,0 0 22px #63ff4224!important}
html body.bu-winter :is(input,select,textarea):focus-visible,html body.bu-winter button:focus-visible{outline-color:#63ff42!important}
html body.bu-winter .bu-live .bu-ld{background:#171717!important;background-image:none!important}
html body.bu-winter up-app-root [class*="bg-"]{background-color:#050505!important;background-image:none!important}

/* Exact fixes for the remaining legacy header/profile surfaces. */
html body.bu-winter :is(.bu-ph,.bu-pf,.bu-tabs,.profile-hero,.profile-wallet,.profile-overview,.profile-menu,.profile-nav,.profile-tabs){background:#111!important;background-image:none!important;border-color:#303030!important;box-shadow:none!important}
html body.bu-winter .profile-orbit{display:none!important}
html body.bu-winter .profile-avatar{border-color:#373737!important;box-shadow:0 0 0 1px #585858!important}
html body.bu-winter .bu-hlogo:after{content:none!important;display:none!important}
/* Preserve the winter artwork while using a black overlay for readable copy. */
html body.bu-winter .winter-hero{background-color:#080b10!important;background-image:linear-gradient(90deg,#080b10f5 0%,#080b10c9 44%,#080b1033 100%),var(--winter-backdrop)!important;background-size:cover!important;background-position:center 42%!important;background-repeat:no-repeat!important}
html body.bu-winter .fuse-backdrop{object-fit:cover!important;object-position:center!important;width:100%!important;height:100%!important;inset:0!important;image-rendering:auto!important}
html body.bu-winter .fuse-scene{background:#09121b!important;overflow:hidden!important}
@media(min-width:993px){html body.bu-winter .cw>#bu-live{position:fixed!important;top:0!important;left:0!important;bottom:0!important;height:100dvh!important;z-index:12!important}html body.bu-winter .cw:has(>#bu-live){padding-left:0!important}}

/* Grid tracks may shrink below the scene's aspect-ratio intrinsic width. */
html body.bu-winter .fuse-page{width:100%!important;max-width:1260px!important;min-width:0!important;box-sizing:border-box!important;container-type:inline-size;container-name:fuse-workshop}
html body.bu-winter .fuse-layout{display:grid!important;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)!important;gap:20px!important;align-items:start!important;width:100%!important;min-width:0!important}
html body.bu-winter .fuse-layout>*{min-width:0!important;max-width:100%!important;width:100%!important;box-sizing:border-box!important}
html body.bu-winter .fuse-scene{min-width:0!important;min-height:0!important;max-height:none!important;height:auto!important;aspect-ratio:1.15!important;isolation:isolate;contain:inline-size}
html body.bu-winter .fuse-machine{flex:0 1 100%!important;width:100%!important;max-width:100%!important;min-width:0!important;aspect-ratio:1.5!important;box-sizing:border-box!important}
html body.bu-winter .fuse-console{min-width:0!important;padding:20px!important}
html body.bu-winter .fuse-slots{grid-template-columns:repeat(4,minmax(0,1fr))!important;min-width:0!important}
html body.bu-winter .fuse-slots button{min-width:0!important;max-width:100%!important}
html body.bu-winter .fuse-auto{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}
html body.bu-winter .fuse-auto button{min-width:0!important;padding-inline:8px!important;white-space:normal!important}
html body.bu-winter .fuse-totals{min-width:0!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
html body.bu-winter .fuse-result{left:10px!important;right:10px!important;bottom:8px!important}
@container fuse-workshop (max-width:850px){html body.bu-winter .fuse-layout{grid-template-columns:minmax(0,1fr)!important}html body.bu-winter .fuse-scene{max-width:640px!important;justify-self:center!important}html body.bu-winter .fuse-console{max-width:640px!important;justify-self:center!important}}
@media(max-width:1100px){html body.bu-winter .fuse-layout{grid-template-columns:minmax(0,1fr)!important}html body.bu-winter .fuse-scene,html body.bu-winter .fuse-console{max-width:640px!important;justify-self:center!important}}

html body.bu-winter .tp-wrap .tp-tabs button.on{background:#222!important;border-color:#63ff42!important;color:#deffd0!important;box-shadow:none!important}
html body.bu-winter .tp-wrap #tp-nk:focus{border-color:#63ff42!important;outline:1px solid #63ff42!important;outline-offset:1px}

/* One responsive header: desktop sections or the compact drawer. */
html body.bu-winter .bu-head{width:100%!important;max-width:none!important;min-width:0!important;height:80px!important;box-sizing:border-box!important;gap:14px!important;padding:0 calc(70px + var(--miniapp-safe-right,0px)) 0 calc(20px + var(--miniapp-safe-left,0px))!important;top:var(--miniapp-safe-top,0px)!important;background:#090909!important}
html body.bu-winter .bu-head .bu-hl{flex:0 0 auto!important;gap:8px!important}
html body.bu-winter .bu-head .bu-hlogo{display:flex!important;align-items:center!important;gap:1px!important;flex:none;font-size:18px!important;line-height:1!important;letter-spacing:-.8px!important;cursor:pointer;user-select:none;color:#f3fff0!important;white-space:nowrap}
html body.bu-winter .bu-hlogo img{display:block;width:42px!important;height:45px!important;object-fit:contain!important;filter:drop-shadow(0 2px 5px #0006)!important;margin:0!important}
html body.bu-winter .bu-hlogo:focus-visible{outline:2px solid #63ff42;outline-offset:5px;border-radius:4px}
html body.bu-winter .bu-head .bu-hsec,html body.bu-winter .bu-head .bu-cnt{display:none!important}
html body.bu-winter .bu-head .bu-hr{flex:0 0 auto!important;gap:8px!important}
html body.bu-winter .wide-navigation{display:none!important;flex:1 1 auto;align-items:center;justify-content:center;gap:3px;min-width:0}
html body.bu-winter .wide-navigation button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:9px 10px;border:1px solid transparent;border-radius:10px;background:transparent;color:#8b978c;font:800 10px "BrainUp Sans",Arial,sans-serif;text-transform:uppercase;white-space:nowrap;cursor:pointer}
html body.bu-winter .wide-navigation button i{font-style:normal;font-size:18px;line-height:1;color:#9aa79a}
html body.bu-winter .wide-navigation button.on{background:#192014!important;border-color:#537a39!important;color:#b6ff83!important}
html body.bu-winter .wide-navigation button.on i{color:#97ff5a!important}
html body.bu-winter .wide-navigation button:hover{color:#efffe7;background:#191919}
html body.bu-winter .wide-navigation button:focus-visible{outline:2px solid #63ff42;outline-offset:2px}
html body.bu-winter #miniapp-size-toggle{position:fixed;top:calc(var(--miniapp-safe-top,0px) + 20px);right:calc(18px + var(--miniapp-safe-right,0px));z-index:2147482000;width:40px;height:40px;display:grid;place-items:center;box-sizing:border-box;border:1px solid #3b4c3c;border-radius:10px;background:#101810;color:#b6d7b7;cursor:pointer}
html body.bu-winter #miniapp-size-toggle[hidden]{display:none!important}
html body.bu-winter #miniapp-size-toggle svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
html body.bu-winter.tg-fullscreen{padding-top:var(--miniapp-safe-top,0px)!important}
html body.bu-winter.tg-fullscreen .cw{padding-top:var(--miniapp-safe-top,0px)!important}
@media(min-width:1200px){html body.bu-winter #wide-navigation{display:flex!important}html body.bu-winter #bu-burger{display:none!important}html body.bu-winter .bu-head .bu-tgl{display:none!important}}
@media(max-width:1199px){html body.bu-winter #bu-burger{display:flex!important;flex:none}html body.bu-winter #wide-navigation{display:none!important}html body.bu-winter .bu-head{justify-content:space-between!important}}
@media(max-width:560px){html body.bu-winter .bu-head{height:72px!important;gap:8px!important;padding:0 calc(10px + var(--miniapp-safe-right,0px)) 0 calc(10px + var(--miniapp-safe-left,0px))!important}html body.bu-winter .bu-head .bu-tgl{display:none!important}html body.bu-winter .bu-head .bu-hl,html body.bu-winter .bu-head .bu-hr{gap:5px!important}html body.bu-winter .bu-hlogo img{width:28px!important;height:34px!important}html body.bu-winter .bu-head .bu-hlogo{font-size:14px!important;letter-spacing:-.6px!important}html body.bu-winter #bu-burger{width:32px!important;min-width:32px!important;min-height:36px!important}html body.bu-winter .bu-head .bu-hav{width:30px!important;height:32px!important;min-width:30px!important;min-height:32px!important}html body.bu-winter #miniapp-size-toggle{width:34px;height:34px;right:9px;top:calc(var(--miniapp-safe-top,0px) + 13px)}html body.bu-winter .bu-bal{min-width:0!important;font-size:11px!important;padding:8px!important;gap:4px!important}}

@media(max-width:380px){html body.bu-winter .bu-head .bu-hlogo{font-size:12px!important}html body.bu-winter .bu-hlogo img{width:26px!important;height:32px!important}html body.bu-winter .bu-head .bu-bal{max-width:88px!important;padding:7px 5px!important}html body.bu-winter .bu-head .bu-bal b{display:block;min-width:0;max-width:46px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}

/* Header is outside the legacy padded app shell and above the feed. */
html body.bu-winter{padding-top:var(--bu-head,80px)!important}
html body.bu-winter.tg-fullscreen{padding-top:var(--bu-head,80px)!important}
html body.bu-winter up-app-root>div{padding-top:0!important}
html body.bu-winter #bu-head{position:fixed!important;top:var(--miniapp-safe-top,0px)!important;left:0!important;right:0!important;margin:0!important;z-index:5000!important;flex-wrap:nowrap!important;overflow:visible!important}
html body.bu-winter #bu-head .bu-hl{display:flex!important;visibility:visible!important;opacity:1!important;flex-shrink:0!important;position:relative!important;z-index:1!important}
html body.bu-winter #bu-head .brainup-brand{display:flex!important;visibility:visible!important;opacity:1!important;width:auto!important;max-width:none!important;overflow:visible!important;color:#f1ffea!important}
html body.bu-winter.tg-fullscreen #bu-head{padding-right:calc(70px + var(--miniapp-safe-right,0px))!important}
html body.bu-winter.tg-fullscreen #miniapp-size-toggle{right:calc(18px + var(--miniapp-safe-right,0px))!important}
@media(min-width:993px){html body.bu-winter:not(:has(.cw.on)) #bu-live{top:var(--bu-head,80px)!important;height:calc(100dvh - var(--bu-head,80px))!important;z-index:400!important}}
@media(max-width:560px){html body.bu-winter.tg-fullscreen #bu-head{padding-right:calc(10px + var(--miniapp-safe-right,0px))!important}html body.bu-winter.tg-fullscreen #miniapp-size-toggle{top:auto!important;bottom:max(16px,env(safe-area-inset-bottom))!important;right:12px!important}html body.bu-winter #bu-head .brainup-brand{max-width:none!important}}
@media(max-width:380px){}

/* Six equal quick choices; the removed settings slot reserves no width. */
html body.bu-winter .bu-app .bu-ctl2 .fast-amounts{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;width:100%!important;gap:8px!important}
html body.bu-winter .bu-app .bu-ctl2 .fast-amounts__button{box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;flex:1 1 0!important}
html body.bu-winter .bu-app .bu-ctl2 .fast-amounts__button:nth-child(7){display:none!important}
html body.bu-winter .bu-app .main-control-row__tabs,html body.bu-winter .bu-app up-fast-amounts{width:100%!important;min-width:0!important}
/* Wide Cyrillic/Latin type with body and display weights. */
html body.bu-winter{font-family:"BrainUp Wide",Arial,sans-serif!important;font-synthesis:none;font-weight:550;letter-spacing:-.025em}
html body.bu-winter.bu-winter :is(.bu-app,#bu-head,#bu-live,.cw,#bu-soon,.bu-mbox,.bu-am,#bu-drawer,#brainup-age-gate) *,html body.bu-winter :is(input,button,textarea,select){font-family:"BrainUp Wide",Arial,sans-serif!important;font-synthesis:none}
html body.bu-winter #bu-head .brainup-brand{gap:.2em!important;font-size:clamp(25px,1.6vw,30px)!important;font-weight:900!important;letter-spacing:-.065em!important;align-items:center!important;line-height:1!important}
html body.bu-winter #bu-head .brand-word{display:block;font-weight:900!important;line-height:1!important;padding:0!important;white-space:nowrap}
html body.bu-winter #bu-head .brand-word:last-child{margin-left:0!important}
html body.bu-winter #bu-head .brand-dragon{display:flex;align-items:center;justify-content:center;flex:0 0 36px;width:36px;height:42px;margin:0 1px;line-height:0}
html body.bu-winter #bu-head .brainup-brand:after{content:none!important;display:none!important}
html body.bu-winter #bu-head .brainup-brand img{width:36px!important;height:42px!important;margin:0!important;object-fit:contain!important;transform:translateY(-2px)}
html body.bu-winter #wide-navigation [data-header-more]{display:none!important}
html body.bu-winter #wide-navigation button{font-size:10px!important;font-weight:800!important;letter-spacing:-.035em;padding-inline:8px}
/* Tactile feedback stays on the controls; their layout never shifts. */
html body.bu-winter :is(#wide-navigation [data-header-section],#bu-drawer [data-sec],#bu-head .brainup-brand){transform-origin:center;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform .14s ease,color .18s ease,background-color .18s ease,border-color .18s ease,box-shadow .18s ease}
html body.bu-winter :is(#wide-navigation [data-header-section],#bu-drawer [data-sec],#bu-head .brainup-brand):is(:active,.navigation-pressed){transform:translateY(2px) scale(.94);filter:brightness(1.16)}
html body.bu-winter :is(#wide-navigation [data-header-section],#bu-drawer [data-sec]):is(:active,.navigation-pressed){box-shadow:inset 0 2px 8px #0008,0 0 12px #8cff6a12!important}
@media(hover:hover) and (prefers-reduced-motion:no-preference){html body.bu-winter #wide-navigation [data-header-section]:hover{transform:translateY(-1px);box-shadow:0 3px 12px #0004}html body.bu-winter #bu-head .brainup-brand:hover{filter:brightness(1.12)}}
@media(prefers-reduced-motion:reduce){html body.bu-winter :is(#wide-navigation [data-header-section],#bu-drawer [data-sec],#bu-head .brainup-brand){transition:color .1s,background-color .1s!important}html body.bu-winter :is(#wide-navigation [data-header-section],#bu-drawer [data-sec],#bu-head .brainup-brand):is(:active,.navigation-pressed){transform:none!important}}
html body.bu-winter #bu-live .bu-lh{border:0!important;background:transparent!important;box-shadow:none!important;color:#fff!important}
html body.bu-winter #bu-live .bu-lh b{color:#fff!important;font-size:12px!important;letter-spacing:.07em!important}
html body.bu-winter #bu-live .bu-lh:before,html body.bu-winter #bu-live .bu-lh:after{content:none!important;display:none!important}
html body.bu-winter #bu-live .bu-lh .bu-dot{display:none!important}
html body.bu-winter #bu-live .bu-recent{border-top:0!important;box-shadow:none!important}
html body.bu-winter.bu-winter :is(h1,h2,h3,h4,.bu-mt,.bu-dh b,.bu-nav button,#bu-drawer button,.winter-title){font-weight:900!important;letter-spacing:-.05em}
html body.bu-winter #bu-drawer{top:var(--bu-head,80px)!important;height:calc(100dvh - var(--bu-head,80px))!important;box-sizing:border-box}
html body.bu-winter #bu-drawer button[data-sec]{font-size:22px!important;line-height:1.3;letter-spacing:-.05em;min-height:54px}
@media(max-width:560px){html body.bu-winter #bu-head .brainup-brand{font-size:22px!important;letter-spacing:-.07em!important}html body.bu-winter #bu-head .brand-dragon{flex-basis:28px;width:28px;height:36px;margin:0}html body.bu-winter #bu-head .brainup-brand img{width:28px!important;height:36px!important}html body.bu-winter #miniapp-size-toggle{top:auto!important;bottom:max(16px,env(safe-area-inset-bottom))!important;right:12px!important;width:38px;height:38px}html body.bu-winter .bu-app .bu-ctl2 .fast-amounts{gap:5px!important}}
@media(max-width:380px){html body.bu-winter #bu-head .brainup-brand{font-size:19px!important}html body.bu-winter #bu-head .brand-dragon{flex-basis:25px;width:25px}html body.bu-winter #bu-head .brainup-brand img{width:25px!important}}


/* Telegram website sign-in follows the same dark and lime palette. */
html body.bu-winter #bu-connect.telegram-login{background:#050505!important;color:#f4f4f4!important;padding:24px!important;font-family:"BrainUp Wide",Arial,sans-serif!important;overflow-y:auto;box-sizing:border-box}
.telegram-login-card{width:min(100%,440px);padding:32px 24px;border:1px solid #303530;border-radius:22px;background:#101210;box-sizing:border-box;text-align:center;box-shadow:0 18px 70px #0008}
.telegram-login-brand{display:block;font-weight:900;font-size:26px;letter-spacing:-.06em;margin-bottom:30px;color:#f4ffe9}
.telegram-login-card h1{font-size:23px!important;line-height:1.3;margin:0 0 14px!important}.telegram-login-card p{font-size:13px;line-height:1.7;color:#aeb5aa!important;margin:0 0 22px;max-width:none!important}
.telegram-login-start{width:100%;padding:17px 12px;border:1px solid #8bff64;border-radius:12px;background:#81ff50;color:#102009;font:inherit;font-size:13px;font-weight:800;cursor:pointer}.telegram-login-start:hover{background:#a1ff7d}.telegram-login-start:active{transform:scale(.97)}.telegram-login-start:disabled{opacity:.6;cursor:wait}
.telegram-login-check{display:block;width:100%;margin:18px 0 0;padding:13px 10px;border:1px solid #567b47;border-radius:10px;background:#172114;color:#b9ffa0;font:inherit;font-size:12px;font-weight:750;cursor:pointer}
.telegram-login-card [hidden]{display:none!important}.telegram-login-wait{padding:20px 0 0}.telegram-login-code{display:block;font-size:36px;letter-spacing:.16em;color:#8bff64;margin:0 0 20px}.telegram-login-reopen{display:block;color:#8bff64!important;font-size:12px;margin-bottom:18px}.telegram-login-wait small{display:block;font-size:11px;line-height:1.8;color:#aeb5aa}.telegram-login-card .telegram-login-status{font-size:11px;margin:18px 0 0;min-height:20px}
/* Main content owns scrolling in every section, including Upgrade. */
html.content-pane{height:100dvh!important;overflow:hidden!important;overscroll-behavior:none}
html body.bu-winter.content-pane{position:fixed!important;inset:0!important;width:100%!important;height:100dvh!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;box-sizing:border-box;overscroll-behavior:none}
html body.bu-winter.content-pane up-main{position:fixed!important;top:var(--bu-head,80px)!important;bottom:0!important;left:var(--bu-rail,216px)!important;right:0!important;display:block!important;width:auto!important;max-width:none!important;min-height:0!important;height:auto!important;margin:0!important;padding:0!important;box-sizing:border-box!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior-y:contain;scroll-padding-top:20px;-webkit-overflow-scrolling:touch}
html body.bu-winter.content-pane #bu-soon{position:static!important;width:100%!important;max-width:none!important;min-height:0!important;height:auto!important;margin:0!important;padding:24px clamp(16px,3vw,42px) 44px!important;box-sizing:border-box!important;overflow:visible!important}
html body.bu-winter.content-pane .winter-catalog{width:100%!important;max-width:1500px!important;margin-inline:auto!important}
html body.bu-winter.content-pane:not(:has(.cw.on)) #bu-live{position:fixed!important;top:var(--bu-head,80px)!important;bottom:0!important;height:calc(100dvh - var(--bu-head,80px))!important}
html body.bu-winter.content-pane #bu-head:before{content:"";position:fixed;top:0;left:0;right:0;height:var(--miniapp-safe-top,0px);background:#080808;pointer-events:none}
@media(max-width:992px){html body.bu-winter.content-pane:not(:has(.cw.on)) #bu-live{top:var(--bu-head,80px)!important;bottom:auto!important;left:0!important;right:0!important;width:100%!important;height:150px!important;max-height:150px!important;min-height:150px!important;box-sizing:border-box!important;z-index:450!important}html body.bu-winter.content-pane up-main{left:0!important;top:calc(var(--bu-head,72px) + var(--content-live-height,150px))!important}html body.bu-winter.content-pane #bu-soon{padding:20px 14px 68px!important}}
/* Promo and free cases are distinct sections, with a clear gap between them. */
html body.bu-winter .winter-catalog .winter-hero{margin:0 0 32px!important;overflow:hidden!important;box-sizing:border-box}
html body.bu-winter .winter-free-section{margin:0 0 36px;padding:24px 0 0;border-top:1px solid #303030}
html body.bu-winter .winter-free-section>h2{margin:0 0 16px!important;font-size:19px!important;color:#f2f2f2!important}
html body.bu-winter .winter-free-section .winter-free-cases{margin:0!important;gap:14px!important}
html body.bu-winter .winter-free-case{min-height:86px!important;border:1px solid #343434!important;border-radius:12px!important;padding:16px!important}
html body.bu-winter .winter-free-case:hover{border-color:#63ff42!important;background:#151a13!important}
html body.bu-winter .bu-app .bet-amount__amount img{width:18px!important;height:18px!important;min-width:18px!important;object-fit:contain!important;vertical-align:middle!important;margin:0 4px!important}
/* One BU coin replaces the old letter-B currency and labels. */
html body.bu-winter :is(i.coin,.cw-coin){display:inline-block!important;flex-shrink:0!important;vertical-align:middle!important;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;margin:0 4px 0 0!important;background:var(--winter-token) center/contain no-repeat!important;border:0!important;border-radius:50%!important;box-shadow:none!important;font-size:0!important;line-height:0!important;filter:none!important}
html body.bu-winter :is(i.coin,.cw-coin):before,html body.bu-winter :is(i.coin,.cw-coin):after{content:none!important;display:none!important}
/* Top-ups use the same dark surfaces, green accents and wide type. */
html body.bu-winter .bu-mbox:has(.tp-wrap){background:#0b0b0b!important;border:1px solid #343434!important;border-radius:18px!important;box-shadow:0 24px 80px #0009!important}
html body.bu-winter .bu-mbox :is(.tp-wrap,.test-queue),html body.bu-winter .bu-mbox :is(.tp-wrap,.test-queue) *{font-family:"BrainUp Wide",Arial,sans-serif!important}
html body.bu-winter .tp-wrap>.bu-mt{font-size:25px!important;font-weight:900!important;letter-spacing:-.06em;color:#f3f3f3!important;margin-bottom:20px!important}
html body.bu-winter .tp-wrap .tp-tabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;padding:5px!important;gap:6px!important;background:#080808!important;border:1px solid #292929!important;border-radius:12px!important}
html body.bu-winter .tp-wrap .tp-tabs button{background:#121212!important;border:1px solid transparent!important;color:#929292!important;border-radius:8px!important;min-height:48px!important;font-size:11px!important;font-weight:800!important;white-space:normal!important;padding:10px 5px!important}
html body.bu-winter .tp-wrap .tp-tabs button.on{background:#172014!important;border-color:#63ff42!important;color:#9bff81!important}
html body.bu-winter .tp-wrap :is(input,#tp-st,#tp-nk,#tp-q,#tp-pr){background:#121212!important;border:1px solid #373737!important;color:#f2f2f2!important;border-radius:10px!important;font-family:"BrainUp Wide",Arial,sans-serif!important;font-weight:550!important;font-size:12px!important;min-height:46px!important;box-sizing:border-box}
html body.bu-winter .tp-wrap input:focus{outline:1px solid #63ff42!important;border-color:#63ff42!important;box-shadow:0 0 0 3px #63ff4214!important}
html body.bu-winter .tp-wrap :is(label,.stars-field-label){font-size:11px!important;font-weight:700!important;color:#c2c2c2!important;letter-spacing:-.03em;line-height:1.5}
html body.bu-winter .tp-wrap :is(.topup-player-card,.stars-amount-row,.stars-payment-total){background:#111!important;background-image:none!important;border:1px solid #303030!important;border-radius:12px!important}
html body.bu-winter .tp-wrap .stars-payment-total strong{color:#8aff70!important;font-weight:900!important;font-size:23px!important}
html body.bu-winter .tp-wrap .tp-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(118px,1fr))!important;gap:10px!important;padding:12px!important;border:1px solid #292929!important;border-radius:12px!important;background:#080808!important;max-height:330px;overflow:auto}
html body.bu-winter .tp-wrap .tp-it{background:#151515!important;background-image:none!important;border:1px solid #363636!important;border-radius:12px!important;padding:12px 8px!important;min-width:0!important;color:#f2f2f2!important}
html body.bu-winter .tp-wrap .tp-it.on{background:#171d14!important;border-color:#63ff42!important;outline:1px solid #63ff42!important}
html body.bu-winter .tp-wrap .tp-it img{height:88px!important;width:100%!important;object-fit:contain!important}
html body.bu-winter .tp-wrap .tp-it b{font-size:10px!important;font-weight:800!important;line-height:1.4!important;overflow-wrap:anywhere}
html body.bu-winter .tp-wrap :is(.tp-plus,.tp-qty button){background:#71f34f!important;color:#0a1206!important;border:0!important;border-radius:7px!important;font-weight:900!important}
html body.bu-winter .tp-wrap :is(.tp-qty,.stars-presets button){background:#191919!important;color:#e5e5e5!important;border:1px solid #3b3b3b!important;border-radius:8px!important}
html body.bu-winter .tp-wrap .stars-presets button.selected{border-color:#63ff42!important;color:#9cff80!important;background:#172014!important}
html body.bu-winter .tp-wrap .tp-get{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#121212!important;border:1px solid #333!important;border-radius:12px!important;padding:16px!important;color:#ddd!important}
html body.bu-winter .tp-wrap .tp-get b{display:flex;align-items:center;color:#91ff73!important;font-size:22px!important;font-weight:900!important}
html body.bu-winter .tp-wrap>button[data-tp2]{border:1px solid #63ff42!important;background:#172014!important;color:#b3ff9f!important;border-radius:11px!important;font-size:12px!important;font-weight:900!important;min-height:50px!important}
html body.bu-winter .tp-wrap>button[data-tp2]:enabled:hover{background:#23331c!important;box-shadow:0 0 20px #63ff421a!important}
html body.bu-winter .test-queue{background:#101010!important;color:#eee!important}
html body.bu-winter .test-queue :is(.test-queue-time,.test-queue-clock,.test-queue-estimate){background:#151a12!important;border-color:#3e5c32!important;color:#9cff80!important}
html body.bu-winter .test-queue .bu-btn{border-color:#63ff42!important;color:#b3ff9f!important;background:#172014!important}
/* Reel cards share their width and height, including idle and phone layouts. */
html body.bu-winter .cw #cw-box.winter-case-window .cw-reels{--iw:var(--rh,284px)!important}
html body.bu-winter .cw #cw-box.winter-case-window .cw-ri,html body.bu-winter .cw #cw-box.winter-case-window .cw-idle .cw-ri{width:var(--iw)!important;flex:0 0 var(--iw)!important;height:var(--rh,284px)!important;aspect-ratio:1!important;border-radius:14px!important}
html body.bu-winter .cw #cw-box.winter-case-window .cw-ri:before{border-radius:14px!important}
html body.bu-winter .cw #cw-box.winter-case-window .cw-pz{aspect-ratio:1!important;height:auto!important;min-height:0!important;min-width:0!important;box-sizing:border-box!important;padding:14px!important}
html body.bu-winter .cw #cw-box.winter-case-window .cw-idle .cw-ri img{height:calc(var(--rh,284px) - 60px)!important;width:85%!important;max-height:190px!important}
html body.bu-winter .cw .case-result-reels{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:24px!important}
html body.bu-winter .cw .case-reel-result{width:100%;min-width:0;box-sizing:border-box}
html body.bu-winter .cw .case-drop-actions{display:flex;justify-content:center;align-items:center;margin:12px auto 0;min-height:46px}
html body.bu-winter .cw .case-drop-sell{display:flex;align-items:center;justify-content:space-between;gap:12px;width:min(var(--rh,284px),calc(100% - 24px));min-height:46px;padding:12px 16px;border:1px solid #63ff42;border-radius:10px;background:#162012;color:#b2ff9c;font-family:"BrainUp Wide",Arial,sans-serif;font-size:12px;font-weight:800;cursor:pointer;transition:background .18s,transform .14s}
html body.bu-winter .cw .case-drop-sell>span{display:inline-flex;align-items:center;white-space:nowrap}
html body.bu-winter .cw .case-drop-sell:enabled:hover{background:#24371b;transform:translateY(-1px)}
html body.bu-winter .cw .case-drop-sell:disabled{cursor:default;opacity:.65;background:#181818;border-color:#444;color:#b3b3b3}
html body.bu-winter .cw .case-drop-credited{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:#9aff7f}
html body.bu-winter .cw .case-result-controls{display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:12px}
html body.bu-winter .cw .case-result-controls button{font-family:"BrainUp Wide",Arial,sans-serif!important;border:1px solid #414141!important;background:#151515!important;color:#eee!important;border-radius:10px!important;padding:14px 20px!important;font-size:11px!important}
@media(max-width:480px){html body.bu-winter .tp-wrap .tp-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}html body.bu-winter .tp-wrap>.bu-mt{font-size:22px!important}html body.bu-winter .winter-free-section>h2{font-size:16px!important}html body.bu-winter .winter-free-case{padding:12px!important}html body.bu-winter .cw .case-result-controls button{width:100%!important}}
html body.bu-winter .profile-settings-link{display:block;margin:0 0 16px auto;padding:10px 15px;border:1px solid #444;border-radius:8px;background:#171717;color:#ddd;font:inherit;font-size:12px;cursor:pointer}
html body.bu-winter .winter-promo-actions{flex-wrap:wrap!important}
html body.bu-winter .winter-code{max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
html body.bu-winter .winter-code b{min-width:0;font-size:clamp(11px,1.05vw,16px);overflow-wrap:anywhere;line-height:1.35}
@media(max-width:560px){html body.bu-winter .winter-promo-actions .winter-code{width:100%!important}html body.bu-winter .winter-promo-actions>.bu-btn{width:100%!important}}
/* Compact prize cards reveal their source without a floating tooltip. */
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-ld.live-reference-card{position:relative!important;appearance:none!important;display:block!important;width:100%!important;max-width:none!important;min-width:0!important;height:80px!important;min-height:80px!important;max-height:80px!important;flex:0 0 80px!important;margin:0!important;padding:10px!important;overflow:hidden!important;box-sizing:border-box!important;border:1px solid #303630!important;border-left:3px solid rgb(var(--tc))!important;border-radius:13px!important;background:#141714!important;background-image:none!important;box-shadow:none!important;color:#f3f7ef!important;text-align:left!important;font:inherit;cursor:pointer;transition:border-color .18s,background-color .18s}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-prize-face{display:flex;align-items:center;gap:10px;height:100%;min-width:0;transition:opacity .18s,transform .2s}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-reference-card .im{display:flex!important;align-items:center;justify-content:center;flex:0 0 48px!important;width:48px!important;height:56px!important;max-width:48px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-reference-card .im img{width:100%!important;height:100%!important;max-height:none!important;object-fit:contain!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-reference-card .tx{display:flex!important;flex:1!important;flex-direction:column;justify-content:center;min-width:0!important;gap:6px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-reference-card .n{display:-webkit-box!important;-webkit-line-clamp:2;-webkit-box-orient:vertical;white-space:normal!important;text-overflow:ellipsis;overflow:hidden;max-width:100%!important;font-size:10px!important;font-weight:800!important;line-height:1.35!important;color:#f3f7ef!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-reference-card .p{display:flex!important;align-items:center;gap:2px;font-size:11px!important;font-weight:850!important;line-height:1.2!important;color:#e4f3d9!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-reference-card .coin{width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;margin:0 2px 0 0!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-source-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:12px;padding:12px;background:#182019;color:#f4ffef;opacity:0;transform:translateY(9px);pointer-events:none;transition:opacity .18s,transform .2s;box-sizing:border-box}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-source-icon{display:flex;align-items:center;justify-content:center;flex:0 0 30px;width:30px;height:30px;border:1px solid #77dc62;border-radius:50%;color:#91ff73}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-source-icon svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-source-icon.is-case{flex-basis:48px;width:48px;height:48px;border:0;border-radius:0}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-source-icon img{width:48px;height:48px;object-fit:contain}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-source-copy{display:flex;flex-direction:column;gap:4px;max-width:125px;min-width:0}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-source-copy small{font-size:9px;color:#8f9d8b}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-source-copy b{font-size:11px;line-height:1.4;font-weight:850;color:#efffe9;overflow-wrap:anywhere}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-reference-card:is(:hover,:focus-visible,.show-source){border-color:#72a864!important;background:#182019!important;outline:none}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-reference-card:is(:hover,:focus-visible,.show-source) .live-prize-face{opacity:0;transform:translateY(-8px)}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-reference-card:is(:hover,:focus-visible,.show-source) .live-source-face{opacity:1;transform:none}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-ll{display:flex!important;flex-direction:column!important;gap:8px!important;padding:0 10px 12px!important;overscroll-behavior:contain}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best{position:relative!important;flex:0 0 auto!important;min-height:0!important;max-height:none!important;height:auto!important;margin:0!important;padding:10px!important;border:0!important;background:none!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best>b{position:absolute!important;left:18px;right:18px;top:23px;z-index:2;display:block!important;margin:0!important;text-align:center!important;font-size:10px!important;color:#e5c56b!important;pointer-events:none}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best #bu-best-card{width:100%!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-reference-card{height:226px!important;min-height:226px!important;max-height:226px!important;padding:32px 12px 14px!important;border:1px solid #796031!important;border-radius:16px!important;background:radial-gradient(ellipse at top,#34302a,#171a16 75%)!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-prize-face{flex-direction:column!important;justify-content:flex-end!important;gap:8px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-reference-card .im{flex:1 1 96px!important;width:100%!important;max-width:110px!important;min-height:76px!important;height:96px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-reference-card .tx{flex:0!important;align-items:center!important;width:100%!important;gap:7px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-reference-card .n{text-align:center!important;font-size:11px!important;max-width:170px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-reference-card .p{padding:5px 10px!important;border:1px solid #66532a!important;border-radius:30px!important;background:#302b17!important;color:#ffe49a!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-recent{flex:1 1 0!important;min-height:0!important;overflow:hidden!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-lh{min-height:35px!important;height:35px!important;flex:0 0 35px!important;justify-content:flex-start!important;padding:0 12px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-lh b{color:#fff!important;font-size:10px!important;letter-spacing:.08em!important}
html body.bu-winter #bu-rfwd>button{width:100%;margin-top:16px;font-size:12px}
html body.bu-winter #bu-rfwd>button:disabled{opacity:.45;cursor:not-allowed;transform:none}
@media(max-width:992px){
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best{padding:6px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best>b{top:12px;font-size:8px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-reference-card{height:136px!important;min-height:136px!important;max-height:136px!important;padding:24px 6px 6px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-prize-face{gap:3px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-reference-card .im{min-height:35px!important;height:42px!important;max-width:52px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-reference-card .n{font-size:8px!important;line-height:1.25!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-reference-card .tx{gap:3px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-reference-card .p{font-size:9px!important;padding:3px 7px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-lh{height:23px!important;min-height:23px!important;flex-basis:23px!important;padding:0 8px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-ll{flex-direction:row!important;gap:6px!important;padding:0 8px 6px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-ll .live-reference-card{width:168px!important;min-width:168px!important;height:117px!important;min-height:117px!important;max-height:117px!important;flex:0 0 168px!important}
}
@media(prefers-reduced-motion:reduce){html body.bu-winter :is(#bu-live,#cw-live-drops) :is(.live-prize-face,.live-source-face,.live-reference-card){transition:none!important;transform:none!important}}


html body.bu-winter .owner-profile-admin{display:none;clear:both;width:100%;margin:28px 0 0;padding:22px 0 0;border-top:1px solid #333}
html body.bu-winter .owner-profile-admin button{width:100%;min-height:52px;font-size:13px;background:#1c2817!important;color:#baff9f!important;border:1px solid #558840!important;border-radius:12px!important}
html:not(.bu-admin) body.bu-winter #bu-drawer [data-act="admin"]{display:none!important}
html body.bu-winter.tg-fullscreen .owner-profile-admin,:fullscreen .owner-profile-admin{display:block!important}
html body.bu-winter.tg-fullscreen #bu-drawer [data-act="admin"],:fullscreen #bu-drawer [data-act="admin"]{display:none!important}
@media(min-width:1200px){html body.bu-winter .owner-profile-admin{display:block!important}html body.bu-winter #bu-drawer [data-act="admin"]{display:none!important}}
html body.bu-winter .public-player-page{width:100%;max-width:1100px;text-align:left;color:#f4f4f4}
.public-profile-back{font-size:11px;margin-bottom:25px}.public-profile-heading{display:flex;align-items:center;gap:18px;margin-bottom:25px}.public-profile-heading>img{width:76px;height:76px;border-radius:50%}.public-profile-heading small{font-size:10px;color:#a3aa9e}.public-profile-heading h1{font-size:clamp(20px,3vw,32px);line-height:1.4;margin:6px 0 0;overflow-wrap:anywhere}
.public-profile-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:30px}.public-profile-stats .bu-stat{min-width:0;background:#141614;padding:18px;border:1px solid #303730;border-radius:12px}.public-profile-stats .bu-stat span{font-size:10px;color:#a6ada1}.public-profile-stats .bu-stat b{font-size:21px;color:#eaffe1}
.public-profile-inventory>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.public-profile-inventory h2{font-size:21px;margin:0}.public-profile-inventory>header>span{display:flex;align-items:center;font-size:13px}.public-inventory-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:12px}.public-inventory-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 10px 20px;border:1px solid #353a35;border-bottom:3px solid rgb(var(--tc));border-radius:13px;background:#151715;text-align:center;min-width:0}.public-inventory-card img,.public-item-placeholder{width:100%;height:110px;object-fit:contain}.public-inventory-card b{font-size:10px;line-height:1.5;overflow-wrap:anywhere}.public-inventory-card>span{display:flex;align-items:center;font-size:12px;color:#d9f7c7}.public-inventory-card>small{position:absolute;top:9px;right:9px;padding:4px 6px;border:1px solid #46613c;border-radius:7px;background:#1d2a17;color:#b5ff8a;font-size:10px}.public-profile-pagination{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:24px}.public-profile-empty{padding:45px 15px;text-align:center;font-size:13px;line-height:1.7;color:#b5bdad}.partner-telegram-link input{font-size:11px!important;min-width:0}.partner-telegram-link p{font-size:11px;line-height:1.6;margin:10px 0 16px;color:#adb3a9}
@media(max-width:560px){.public-profile-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.public-profile-heading>img{width:58px;height:58px}.public-inventory-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.public-profile-inventory>header{align-items:flex-start}.public-profile-inventory h2{font-size:18px}.public-profile-inventory>header>span{font-size:11px}.partner-telegram-link .bu-rfl{flex-wrap:wrap}.partner-telegram-link button{width:100%}}


html body.bu-winter :is(#bu-live,#cw-live-drops) .live-reference-card .tx{gap:3px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-drop-user{display:block!important;width:100%;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a5b99c!important;font-size:9px!important;line-height:1.25!important;font-weight:600!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .live-source-copy{gap:2px!important}
html body.bu-winter :is(#bu-live,#cw-live-drops) .bu-best .live-drop-user{text-align:center!important}

/* Compact layouts give the full content area to the current section. */
@media(max-width:992px){
html body.bu-winter :is(#bu-live,#cw-live-drops){display:none!important}
html body.bu-winter.content-pane up-main{left:0!important;top:var(--bu-head,72px)!important}
}

/* Partner tabs follow the same dark surfaces and lime accents as the site. */
.referrals-ui{width:100%;max-width:960px;margin:0 auto;padding:4px 0 28px;color:#f4f6f0;box-sizing:border-box}
.referrals-ui *,.referral-case-picker *{box-sizing:border-box}
.referral-header,.referral-case-picker>header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
.referral-header h1{font-size:26px;line-height:1.2;letter-spacing:-.04em;margin:0;font-weight:900}
.referrals-ui button,.referral-case-picker button{font:inherit;cursor:pointer;transition:background-color .16s,border-color .16s,transform .12s}
.referrals-ui button:active,.referral-case-picker button:active{transform:scale(.97)}
.referrals-ui button:disabled{opacity:.45;cursor:not-allowed;transform:none}
.referrals-ui button:focus-visible,.referral-case-picker button:focus-visible{outline:2px solid #9bff75;outline-offset:3px}
.referrals-ui svg,.referral-case-picker svg{width:17px;height:17px;flex:none;vertical-align:middle}
.referral-close{display:grid;place-items:center;flex:none;width:36px;height:36px;padding:8px;border:1px solid #405335;border-radius:11px;background:#182015;color:#a8d695}
.referral-tabs{display:flex;gap:7px;margin:0 0 20px;overflow-x:auto;padding:3px 1px 7px;scrollbar-width:thin;scrollbar-color:#46553d transparent}
.referral-tabs [role=tab]{display:flex;align-items:center;justify-content:center;gap:7px;flex:none;padding:11px 15px;border:1px solid #33382f;border-radius:30px;color:#9fa797;background:#191c17;font-size:11px;font-weight:800;white-space:nowrap}
.referral-tabs [role=tab][aria-selected=true]{color:#10170b;background:#94f966;border-color:#94f966}
.referral-tabs [role=tab]:hover{border-color:#8bc96d}
.referral-card{padding:24px;border:1px solid #343a2f;border-radius:20px;background:linear-gradient(145deg,#1b2018,#121510);margin-bottom:16px}
.referral-card h2{font-size:18px;line-height:1.5;text-align:center;margin:0 0 10px;font-weight:900;letter-spacing:-.035em}
.referral-caption{font-size:11px;line-height:1.8;text-align:center;color:#969f8f;margin:0 0 20px}
.referral-card label{display:block;font-size:11px;line-height:1.6;font-weight:750;color:#a4ad9c;margin:14px 0 7px}
.referral-card label small{font-size:10px;font-weight:500;color:#899382}
.referral-copy-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #30362b;border-radius:13px;background:#0d100c;min-width:0}
.referral-copy-row input{flex:1;min-width:0;width:100%;height:32px;border:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;color:#eff8e9!important;font:inherit;font-size:12px;font-weight:800}
.referral-copy-row button{display:grid;place-items:center;flex:none;min-height:34px;max-width:110px;padding:8px 10px;border:0;border-radius:9px;background:#26351e;color:#aff58c;font-size:10px;font-weight:800}
html body.bu-winter #bu-rfwd.partner-claim-card{display:flex!important;flex-direction:column!important;gap:16px!important;width:100%!important;min-width:0!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important;text-align:left!important}
html body.bu-winter #bu-rfwd .partner-balance-summary{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:20px;border:1px solid #6a5832;border-radius:14px;background:linear-gradient(115deg,#342c1b,#24251b);overflow:hidden}
html body.bu-winter #bu-rfwd .partner-balance-summary>small{display:block!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;color:#d9c08b!important;font-size:11px!important;font-weight:800!important;line-height:1.5!important;text-transform:none!important;letter-spacing:0!important;text-align:left!important}
html body.bu-winter #bu-rfwd .partner-balance-amount{display:flex;align-items:center;gap:10px;margin:0;padding:0;border:0;background:transparent;color:#fff;font-size:34px;font-weight:900;line-height:1.2;overflow-wrap:anywhere}
html body.bu-winter #bu-rfwd .partner-balance-amount .coin{width:25px!important;height:25px!important;flex:none}
html body.bu-winter #bu-rfwd .partner-claim-schedule{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;font-size:11px!important;line-height:1.8!important;color:#a1aa98!important;text-align:left!important}
html body.bu-winter #bu-rfwd .partner-claim-countdown{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px 16px;margin:0;padding:0;color:#a1aa98;font-size:11px;line-height:1.6}
html body.bu-winter #bu-rfwd .partner-claim-countdown>b{color:#e8f5df;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
html body.bu-winter #bu-rfwd .partner-claim-button{display:block;width:100%;min-height:46px;margin:0!important;padding:13px 16px;border:1px solid #94f966;border-radius:11px;background:#94f966;color:#10180b;font:inherit;font-size:12px;font-weight:900;line-height:1.5;text-align:center;cursor:pointer;white-space:normal}
html body.bu-winter #bu-rfwd .partner-claim-button:disabled{opacity:1!important;border-color:#363e2e!important;background:#1e2519!important;color:#8b9781!important;box-shadow:none!important;cursor:not-allowed;transform:none!important}
@media(max-width:560px){html body.bu-winter #bu-rfwd .partner-balance-summary{padding:17px}html body.bu-winter #bu-rfwd .partner-balance-amount{font-size:30px}html body.bu-winter #bu-rfwd .partner-claim-countdown{justify-content:flex-start}}
.referral-transferred{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0;font-size:10px;color:#a1ad98}
.referral-transferred strong{display:flex;align-items:center;gap:5px;font-size:15px;color:#e6f5dc;white-space:nowrap}
.referrals-ui .referral-primary{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:47px;padding:13px 16px;border:1px solid #94f966;border-radius:11px;background:#94f966;color:#10180b;font-size:12px;font-weight:900}
.referrals-ui .referral-primary:not(:disabled):hover{background:#b4ff8d;border-color:#b4ff8d}
.referral-section-title{font-size:14px;font-weight:850;margin:5px 0 14px;line-height:1.5;color:#f2f7ee}
.referral-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.referral-stat{display:flex;flex-direction:column;align-items:flex-start;gap:10px;min-width:0;padding:20px;border:1px solid #33392e;border-radius:16px;background:#181d15}
.referral-stat>span{color:#98a18e;font-size:11px;line-height:1.5}
.referral-stat>strong{display:flex;flex-wrap:wrap;align-items:center;gap:5px;font-size:23px;line-height:1.4;overflow-wrap:anywhere}
.referrals-ui .coin,.referral-case-picker .coin{display:inline-block;vertical-align:middle;width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;margin:0!important}
.referral-list-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
.referral-list-heading>span{color:#92ac80;font-size:11px}
.referral-users,.referral-promo-list{display:flex;flex-direction:column;gap:9px}
.referral-user{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #30372a;border-radius:14px;background:#171b14;min-width:0}
.referral-user-avatar{display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:50%;border:1px solid #66864c;background:linear-gradient(135deg,#507331,#25361b);font-size:16px;font-weight:800;color:#eaffe0}
.referral-user-info{display:flex;flex:1;flex-direction:column;gap:6px;min-width:0}
.referral-user-info b{font-size:12px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.referral-user-info small,.referral-user-earned small{font-size:9px;line-height:1.5;color:#8e9a84}
.referral-user-earned{display:flex;flex:none;flex-direction:column;align-items:flex-end;gap:5px;max-width:30%;overflow-wrap:anywhere;text-align:right}
.referral-user-earned>b{color:#9efc7a;font-size:13px}
.referral-empty{padding:28px 20px;border:1px dashed #3e4935;border-radius:14px;background:#141810;color:#9aa88e;font-size:12px;line-height:1.8;text-align:center}
.referral-secondary{padding:12px 18px;border:1px solid #46543a;border-radius:11px;background:#1d2517;color:#c4e7ae;font-size:11px;font-weight:750}
.referral-load-more{display:block;margin:18px auto 0}
.referral-promo-types{display:flex;gap:4px;padding:4px;margin:18px 0;border:1px solid #30392a;border-radius:12px;background:#0d110a}
.referral-promo-types button{flex:1;min-height:38px;padding:10px;border:0;border-radius:9px;background:transparent;color:#98a28e;font-size:11px;font-weight:800}
.referral-promo-types button[aria-pressed=true]{background:#94f966;color:#11190b}
#referral-promo-form>input{width:100%;height:45px;padding:12px 14px;border:1px solid #30372a;border-radius:11px;background:#0d100b;color:#f3f8ef;font:inherit;font-size:12px;outline:none}
#referral-promo-form>input:focus{border-color:#94f966;box-shadow:0 0 0 2px #94f96622}
#referral-promo-code{text-transform:uppercase}
.referral-case-select{display:flex;align-items:center;gap:10px;width:100%;min-height:56px;padding:10px 14px;border:1px solid #30372a;border-radius:11px;background:#0d100b;color:#f3f8ef;text-align:left;font-size:12px;font-weight:800}
.referral-case-select>img{width:38px;height:38px;object-fit:contain}
.referral-case-select>span:first-of-type{flex:1;min-width:0;overflow-wrap:anywhere}
.referral-case-select>small{font-size:10px;color:#a0be8b}
.referral-promo-summary{display:flex;flex-direction:column;gap:8px;padding:18px 0;color:#a1af93;font-size:11px}
.referral-promo-summary b{color:#e8f8dc;font-size:13px}
.referral-promo-summary small{font-size:10px}
.referral-promos-title{margin:24px 0 14px}
.referral-promo-row{display:flex;align-items:center;gap:9px;padding:14px;border:1px solid #30382a;border-radius:14px;background:#181d14;min-width:0}
.referral-promo-row>div{display:flex;flex:1;flex-direction:column;gap:7px;min-width:0}
.referral-promo-row b{font-size:13px;line-height:1.5;overflow-wrap:anywhere}
.referral-promo-row small{font-size:10px;color:#929e86;line-height:1.6}
.referral-promo-row small strong{color:#d0e4c1}
.referral-promo-row>button{display:grid;place-items:center;width:35px;height:35px;flex:none;padding:8px;border:0;border-radius:10px;background:#293820;color:#b2ef8e}
.referral-promo-row>.referral-delete{color:#ff8c8c;background:#352725}
.referral-case-picker{width:100%;padding:4px 0;color:#f1f8ec}
.referral-case-picker>header{margin-bottom:16px}
.referral-case-picker h3{font-size:20px!important;font-weight:900;margin:0!important;text-align:left!important}
.referral-case-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;max-height:65dvh;overflow-y:auto;padding:3px 3px 8px;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#4f633f #141a10}
.referral-case-option{display:flex;align-items:center;flex-direction:column;gap:12px;min-width:0;padding:16px 10px;border:1px solid #39452f;border-radius:15px;background:#181f12;color:#f2f9ed}
.referral-case-option:hover,.referral-case-option[aria-pressed=true]{border-color:#96ed69;background:#22331a}
.referral-case-option>img{width:100%;aspect-ratio:1;object-fit:contain}
.referral-case-option>b{font-size:10px;line-height:1.5;text-align:center;overflow-wrap:anywhere}
.referral-case-option>span{display:flex;align-items:center;gap:4px;margin-top:auto;color:#a7bd95;font-size:11px}
@media(max-width:600px){.referral-card{padding:18px 15px;border-radius:17px}.referral-header h1{font-size:23px}.referral-tabs{gap:5px}.referral-tabs [role=tab]{font-size:10px;padding:10px 11px;gap:5px}.referral-tabs svg{width:14px;height:14px}.referral-card h2{font-size:16px}.referral-stat{padding:17px 14px}.referral-stat>strong{font-size:20px}.referral-user{gap:9px;padding:12px 10px}.referral-user-info b{font-size:10px}.referral-user-info small{font-size:8px}.referral-user-avatar{width:36px;height:36px;font-size:14px}.referral-case-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.referral-copy-row{padding:9px}.referral-copy-row input{font-size:11px!important}.referral-copy-row button{font-size:9px;padding:8px}.referral-promo-row{padding:12px 10px;gap:7px}}
@media(max-width:400px){.referral-tabs [role=tab]{padding:9px 10px}.referral-case-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.referral-user-earned small{font-size:8px}.referral-stat>span{font-size:10px}}
@media(prefers-reduced-motion:reduce){.referrals-ui button,.referral-case-picker button{transition:none;transform:none!important}}

.case-section-manager{padding:20px;margin-bottom:24px;border:1px solid #3a4930;border-radius:14px;background:#141a10}
.case-section-manager h3{margin:0 0 10px;font-size:18px;color:#efffe4}.case-section-manager p{font-size:11px;line-height:1.7;color:#a4b496;margin:0 0 16px;max-width:none}
.case-section-create,.case-section-row{display:flex;align-items:center;gap:8px}.case-section-create{margin-bottom:16px}.case-section-create input{flex:1;min-width:0}
.case-section-list{display:flex;flex-direction:column;gap:9px}.case-section-row{padding:10px;border:1px solid #333d2b;border-radius:10px;background:#10160d;flex-wrap:wrap}
.case-section-row>input{flex:1 1 200px;min-width:140px}.case-section-row>span{font-size:10px;color:#9eaf90;white-space:nowrap}.case-section-row>button{flex:none}
.case-section-field{display:flex;flex-direction:column;gap:5px;font-size:10px;color:#a5bb94;min-width:145px}.case-section-field select{width:100%;min-height:38px;padding:8px;border:1px solid #445537;border-radius:8px;background:#10170c;color:#e9f7df;font:inherit;font-size:11px}
.case-edit-fields select{width:100%;min-height:42px}.winter-case-section>.winter-free-cases{margin-bottom:18px!important}
@media(max-width:600px){.case-section-manager{padding:14px}.case-section-create{flex-wrap:wrap}.case-section-create input{flex-basis:100%}.case-section-create button{width:100%}.case-section-row>input{flex-basis:calc(100% - 65px)}.case-section-field{width:100%}}

.mutation-filter-bar{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:1px solid #34452b;border-radius:11px;background:#131a10;margin:10px 0}
.mutation-filter-bar>img{width:38px;height:38px;object-fit:contain;flex:none}.mutation-filter-bar label{display:flex;flex:1;min-width:0;align-items:center;gap:12px;color:#adc49b;font-size:11px;font-weight:800}
.mutation-filter-bar select,.admin-mutation-toolbar select{flex:1;min-width:0;min-height:36px;padding:8px 10px;border:1px solid #405534;border-radius:8px;background:#0c1209;color:#e8f8dc;font:inherit;font-size:11px}
.mutation-target-card{position:relative;display:flex;min-width:0}.mutation-target-card>.bu-card{width:100%;flex:1}.mutation-open{position:absolute;z-index:3;right:5px;top:5px;display:grid;place-items:center;width:28px;height:28px;padding:0;border:1px solid #92ef68;border-radius:50%;background:#223b17;color:#ceffb3;font-size:21px;font-weight:800;line-height:1;cursor:pointer;box-shadow:0 3px 10px #0008}.mutation-open:hover{background:#355826}.mutation-open:focus-visible{outline:2px solid #b0ff8b;outline-offset:2px}
.mutation-picker{width:100%;max-width:520px;margin:0 auto}.mutation-picker>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.mutation-picker header small{color:#9eb38f;font-size:10px}.mutation-picker header h3{font-size:18px!important;line-height:1.5!important;text-align:left!important;margin:5px 0 0!important;color:#f1ffe7!important}.mutation-picker-close{flex:none;width:34px;height:34px;border:1px solid #63874d;border-radius:50%;background:#26391c;color:#d6ffbd;font:inherit;font-size:23px;cursor:pointer}
.mutation-choice-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;max-height:62dvh;overflow-y:auto;padding:3px;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#48623a #10150d}
.mutation-choice{display:flex;align-items:center;flex-direction:column;gap:6px;min-width:0;padding:11px 5px;border:1px solid #38462f;border-radius:12px;background:#161e12;color:#efffe2;font:inherit;cursor:pointer;transition:border-color .15s,background .15s,transform .15s}.mutation-choice:hover,.mutation-choice.selected{border-color:#92f565;background:#25391b}.mutation-choice:active{transform:scale(.97)}.mutation-choice:disabled{opacity:.35;cursor:not-allowed;transform:none}.mutation-choice:focus-visible{outline:2px solid #a7ff80;outline-offset:1px}
.mutation-choice-art{display:block;width:100%;height:85px;object-fit:contain}.mutation-choice-label{display:flex;align-items:center;justify-content:center;gap:4px;text-align:center;font-size:10px;font-weight:850;line-height:1.4}.mutation-choice-label>img{width:18px;height:18px;object-fit:contain}.mutation-choice>strong{display:flex;align-items:center;justify-content:center;gap:3px;flex-wrap:wrap;font-size:10px;line-height:1.4}.mutation-choice>strong .coin{width:13px!important;height:13px!important;min-width:13px!important;min-height:13px!important}.mutation-choice>small{font-size:8px;color:#9bb88a}.mutation-picker>p{font-size:10px!important;line-height:1.8!important;color:#8f9e85!important;margin:16px 0 0!important;max-width:none!important;text-align:left!important}
.admin-mutation-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;width:100%;margin:14px 0;padding:12px;border:1px solid #3b5030;border-radius:10px;background:#11190d}.admin-mutation-toolbar label{display:flex;align-items:center;gap:8px;min-width:180px;color:#b5caa2;font-size:11px}.admin-mutation-toolbar>input{flex:1;min-width:180px;min-height:36px}.admin-mutation-toolbar>span{font-size:10px;color:#a1b48f;white-space:nowrap}
html body.bu-winter :is(.bu-cklist,.case-edit-grid) .mutation-filtered-out{display:none!important}
@media(max-width:560px){.mutation-picker header h3{font-size:15px!important}.mutation-choice-grid{gap:6px}.mutation-choice{padding:9px 4px}.mutation-choice-art{height:65px}.mutation-choice-label{font-size:9px}.mutation-choice-label>img{width:14px;height:14px}.mutation-choice>strong{font-size:9px}.mutation-filter-bar{padding:8px}.mutation-filter-bar label{font-size:10px}.admin-mutation-toolbar>input{min-width:100%}}
@media(max-width:350px){.mutation-choice-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(prefers-reduced-motion:reduce){.mutation-choice{transition:none;transform:none!important}}

/* Material images contain their own texture, pattern and lighting. */
html body.bu-winter img[src*="/assets/mutations/"]{filter:none!important;image-rendering:auto!important;object-fit:contain!important;object-position:center!important}
.mutation-choice-art{height:96px}.mutation-choice-grid{gap:8px}.mutation-filter-bar{flex-shrink:0}
@media(max-width:560px){.mutation-choice-art{height:78px}}
/* Emerald accents on the main navigation, case catalog and live feed. */
html body.bu-winter{
 --brainup-glow:#73ff60;
 --brainup-glow-border:#527e40;
 --brainup-glow-soft:#73ff601f;
 --brainup-glow-strong:#73ff6052;
}
html body.bu-winter.bu-winter #wide-navigation button.on,
html body.bu-winter.bu-winter .winter-navigation button.on,
html body.bu-winter.bu-winter #bu-drawer [data-sec].on{
 background:#1b2b15!important;color:#c0ff9f!important;border-color:var(--brainup-glow-border)!important;
 box-shadow:inset 0 1px 0 var(--brainup-glow-soft),0 0 14px var(--brainup-glow-soft)!important;
}
html body.bu-winter.bu-winter #wide-navigation button.on::after,
html body.bu-winter.bu-winter .winter-navigation button.on::after{
 background:var(--brainup-glow)!important;box-shadow:0 0 10px var(--brainup-glow-strong)!important;
}
html body.bu-winter.bu-winter #bu-soon .winter-catalog .winter-hero{
 border-color:var(--brainup-glow-border)!important;
 box-shadow:inset 0 0 30px var(--brainup-glow-soft),0 0 26px var(--brainup-glow-soft)!important;
}
html body.bu-winter.bu-winter #bu-soon .winter-catalog .winter-hero::before{
 background:linear-gradient(110deg,#0a2114cb,#07120c70 70%,#0c311c94)!important;
}
html body.bu-winter.bu-winter #bu-soon .winter-catalog :is(.bu-ccard,.winter-free-case){
 box-shadow:inset 0 1px 0 var(--brainup-glow-soft),inset 0 0 18px var(--brainup-glow-soft)!important;
}
html body.bu-winter.bu-winter #bu-soon .winter-catalog :is(.bu-ccard,.winter-free-case):is(:hover,:focus-visible){
 border-color:var(--brainup-glow)!important;
 box-shadow:inset 0 0 22px var(--brainup-glow-soft),0 0 14px var(--brainup-glow-soft)!important;
}
html body.bu-winter.bu-winter #bu-soon .winter-hero-copy .winter-promo-actions>.bu-btn:enabled,
html body.bu-winter.bu-winter .cw #cw-box.winter-case-window #cw-ctl.case-reference-controls .cw-open:enabled:not(.lack){
 background:linear-gradient(180deg,#b2ff87,#6ed64d)!important;color:#11270e!important;
 border-color:var(--brainup-glow)!important;
 box-shadow:inset 0 1px 0 #e2ffd49c,0 0 18px var(--brainup-glow-strong)!important;
}
html body.bu-winter.bu-winter :is(#bu-live,#cw-live-drops) .live-reference-card:is(:hover,:focus-visible){
 border-color:var(--brainup-glow)!important;
 box-shadow:inset 0 0 16px var(--brainup-glow-soft)!important;
}
html body.bu-winter.bu-winter :is(.bu-btn,.cw-open,.bu-ccard,.winter-free-case,.live-reference-card):focus-visible{
 outline:2px solid var(--brainup-glow)!important;outline-offset:2px;
}
`;
document.head.appendChild(blackTheme);
