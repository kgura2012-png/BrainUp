import {gzipSync,gunzipSync} from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {synchronizeMutations} from './sync-mutations.mjs';
const root=process.cwd();
const catalogArtwork=JSON.parse(await fs.readFile(path.join(root,'assets/catalog-artwork/manifest.json'),'utf8'));
for(const entry of Object.values(catalogArtwork)){if(entry.file){const bytes=await fs.readFile(path.join(root,'assets/catalog-artwork',entry.file));if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.digest)throw Error('Catalog image does not match manifest: '+entry.file);entry.data=bytes.toString('base64');delete entry.file}}
const catalogArtworkSource=(await fs.readFile(path.join(root,'server/catalog-artwork.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const cloudflare=process.argv.includes('--target=cloudflare');
await synchronizeMutations(root);
let html=await fs.readFile(path.join(root,'site.html'),'utf8');
const seed=await fs.readFile(path.join(root,'server/seed.json'),'utf8');
const catalogSeed=JSON.parse(seed);
// One catalog supplies both the browser and the authoritative server prices.
const catalogBlock='/* catalog-base:start */\nvar BASE='+JSON.stringify(catalogSeed.items)+';\n/* catalog-base:end */';
if(html.includes('/* catalog-base:start */'))html=html.replace(/\/\* catalog-base:start \*\/[\s\S]*?\/\* catalog-base:end \*\//,()=>catalogBlock);
else{
 const legacy="var BASE=RAW.split(';').map(function(s,i){var p=s.split('|');return{id:i,name:p[0],price:+p[1]}});";
 if(!html.includes(legacy))throw Error('Client catalog marker missing');
 html=html.replace(legacy,()=>catalogBlock);
}
html=html.replace(/var RAW=.*?;\r?\n/,()=> 'var RAW='+JSON.stringify(catalogSeed.items.map(item=>item.name+'|'+item.price).join(';'))+';\n');
const wikiItems=JSON.parse(await fs.readFile(path.join(root,'assets/brainrots/wiki-expansion/items.json'),'utf8'));
const wikiArt={};
for(const item of wikiItems){
 const entry=catalogSeed.items.find(entry=>entry.id===item.id);
 if(!entry||entry.name!==item.name||entry.price!==item.price||entry.rarity!==item.rarity)throw Error('Wiki catalog entry does not match server seed: '+item.name);
 const bytes=await fs.readFile(path.join(root,'assets/brainrots/wiki-expansion',item.imageFile));
 if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Wiki artwork is not a PNG: '+item.name);
 wikiArt[item.name]='data:image/png;base64,'+bytes.toString('base64');
}
const mutationBases=JSON.parse(await fs.readFile(path.join(root,'assets/mutations/bases.json'),'utf8'));
const newBaseArt=JSON.parse(await fs.readFile(path.join(root,'assets/mutations/new-base-art.json'),'utf8'));
for(const item of newBaseArt){if(item.missing)throw Error('Missing base artwork: '+item.name);const bytes=await fs.readFile(path.join(root,'assets/mutations',item.imageFile));wikiArt[item.name]='data:image/png;base64,'+bytes.toString('base64');}
const mutationArt=JSON.parse(await fs.readFile(path.join(root,'assets/mutations/art.json'),'utf8'));
const mutationAssetManifest={};
for(const item of mutationArt){if(item.missing)continue;const bytes=await fs.readFile(path.join(root,'assets/mutations',item.imageFile));if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid mutation PNG');mutationAssetManifest[item.id]={url:item.imageSource,digest:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};}
const mutationMaterialSource=(await fs.readFile(path.join(root,'server/mutation-materials.mjs'),'utf8')).replace(/^export /gm,'');
const mutationModels={},mutationModelDigests={};
for(const base of mutationBases){const bytes=await fs.readFile(path.join(root,'assets/mutations/normal-images',base.id+'.png'));if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid original model');mutationModels[base.id]='data:image/png;base64,'+bytes.toString('base64');mutationModelDigests[base.id]=createHash('sha256').update(bytes).digest('hex');}
const mutationMaterialManifest=Object.fromEntries(catalogSeed.items.filter(item=>item.mutation).map(item=>[item.id,{baseId:item.baseId,mutation:item.mutation,digest:createHash('sha256').update(mutationMaterialSource+(catalogArtwork[item.baseId]?.digest||mutationModelDigests[item.baseId])+item.mutation).digest('hex')}]));
const mutationOriginalAssets={};
for(const item of mutationArt.filter(item=>!item.missing&&!catalogArtwork[item.id]&&['radioactive','yin-yang','cursed','divine'].includes(item.mutation))){const bytes=await fs.readFile(path.join(root,'assets/mutations/original-webp',item.id+'.webp'));if(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP')throw Error('Invalid original mutation image');mutationOriginalAssets[item.id]={data:bytes.toString('base64'),digest:createHash('sha256').update(bytes).digest('hex')};}
const mutationIconKeys=['default','gold','diamond','rainbow','candy','lava','galaxy','yin-yang','radioactive','cursed','divine'],mutationIcons={};
if(!cloudflare)for(const key of mutationIconKeys)mutationIcons[key]=(await fs.readFile(path.join(root,'assets/mutations/icons',key+'.png'))).toString('base64');
for(const item of catalogSeed.items){const art=catalogArtwork[item.id];if(art?.data&&wikiArt[item.name])wikiArt[item.name]='/assets/catalog/'+item.id+'.'+(art.mime==='image/png'?'png':'webp')+'?v='+art.digest.slice(0,16)}
const wikiArtBlock='/* wiki-catalog-art:start */\nObject.assign(IMG,'+JSON.stringify(wikiArt)+');\n/* wiki-catalog-art:end */';
if(html.includes('/* wiki-catalog-art:start */'))html=html.replace(/\/\* wiki-catalog-art:start \*\/[\s\S]*?\/\* wiki-catalog-art:end \*\//,()=>wikiArtBlock);
else{const end=html.lastIndexOf('\n})();');html=html.slice(0,end)+'\n'+wikiArtBlock+html.slice(end);}
const mutationsShared=(await fs.readFile(path.join(root,'shared/mutations.mjs'),'utf8')).replace(/^export /gm,'');
const upgradeChanceShared=mutationsShared+'\n'+(await fs.readFile(path.join(root,'shared/upgrade-chance.mjs'),'utf8')).replace(/^export /gm,'')+'\n'+(await fs.readFile(path.join(root,'shared/shop-price.mjs'),'utf8')).replace(/^export /gm,'')+'\n'+(await fs.readFile(path.join(root,'shared/catalog-prices.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const syncSource=upgradeChanceShared+'\n'+(await Promise.all(['client/browser-auth.mjs','client/bonus-share.mjs','client/upgrade-sync.mjs','client/upgrade-motion.mjs','client/ui-feedback.mjs','client/session-tools.mjs','client/target-chances.mjs','client/upgrade-target.mjs','client/upgrade-label.mjs','client/miniapp-window.mjs','client/case-results.mjs','client/case-opening.mjs','client/case-layout.mjs','client/live-drop-origin.mjs'].map(file=>fs.readFile(path.join(root,file),'utf8')))).join('\n').replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const syncBlock='/* demo-upgrade-sync:start */\n'+syncSource+'\n/* demo-upgrade-sync:end */';
if(html.includes('/* demo-upgrade-sync:start */'))html=html.replace(/\/\* demo-upgrade-sync:start \*\/[\s\S]*?\/\* demo-upgrade-sync:end \*\//,()=>syncBlock);
else html=html.replace("<script id=\"bu-script\">(function(){'use strict';",match=>match+'\n'+syncBlock);
const caseTools=await fs.readFile(path.join(root,'client/case-tools.js'),'utf8');
html=html.replace(/\/\* case-tools:start \*\/[\s\S]*?\/\* case-tools:end \*\//,()=> '/* case-tools:start */\n'+caseTools+'\n/* case-tools:end */');
const fuseSource=await fs.readFile(path.join(root,'client/fuse.js'),'utf8');
const fuseAsset=await fs.readFile(path.join(root,'assets/fuse/machine.png'));
const fuseBackground=await fs.readFile(path.join(root,'assets/fuse/background.webp'));
const fuseBlock='/* fuse-mode:start */\n'+
  'var FUSE_MACHINE_IMAGE="data:image/png;base64,'+fuseAsset.toString('base64')+'";\n'+
  'var FUSE_BACKGROUND_IMAGE="data:image/webp;base64,'+fuseBackground.toString('base64')+'";\n'+
  fuseSource+'\n/* fuse-mode:end */';
if(html.includes('/* fuse-mode:start */'))html=html.replace(/\/\* fuse-mode:start \*\/[\s\S]*?\/\* fuse-mode:end \*\//,()=>fuseBlock);else {const end=html.lastIndexOf('\n})();');html=html.slice(0,end)+'\n'+fuseBlock+html.slice(end);}
const simulationBlock='/* simulation:start */\n'+await fs.readFile(path.join(root,'client/simulation.js'),'utf8')+'\n/* simulation:end */';
if(html.includes('/* simulation:start */'))html=html.replace(/\/\* simulation:start \*\/[\s\S]*?\/\* simulation:end \*\//,()=>simulationBlock);else{const end=html.lastIndexOf('\n})();');html=html.slice(0,end)+'\n'+simulationBlock+html.slice(end);}
const refreshBlock='/* site-refresh:start */\n'+await fs.readFile(path.join(root,'client/site-refresh.js'),'utf8')+'\n/* site-refresh:end */';
if(html.includes('/* site-refresh:start */'))html=html.replace(/\/\* site-refresh:start \*\/[\s\S]*?\/\* site-refresh:end \*\//,()=>refreshBlock);else{const end=html.lastIndexOf('\n})();');html=html.slice(0,end)+'\n'+refreshBlock+html.slice(end);}
const refreshCss='<style id="site-refresh-css">'+await fs.readFile(path.join(root,'client/site-refresh.css'),'utf8')+'</style>';
if(html.includes('<style id="site-refresh-css">'))html=html.replace(/<style id="site-refresh-css">[\s\S]*?<\/style>/,()=>refreshCss);else html=html.replace('</head>',refreshCss+'</head>');
const buffsSource=(await fs.readFile(path.join(root,'shared/buffs.mjs'),'utf8')).replace(/^export /gm,'');
const caseOddsSource=(await fs.readFile(path.join(root,'shared/case-odds.mjs'),'utf8')).replace(/^export /gm,'');
const caseSectionsSource=(await fs.readFile(path.join(root,'shared/case-sections.mjs'),'utf8')).replace(/^export /gm,'');
const mutationIconVersion=createHash('sha256').update(await fs.readFile(path.join(root,'assets/mutations/icons/lava.png'))).digest('hex').slice(0,16);
const mutationClientData='const MUTATION_ICON_VERSION='+JSON.stringify(mutationIconVersion)+';\nconst MUTATION_BASES='+JSON.stringify(mutationBases)+';\nconst MUTATION_ART='+JSON.stringify(Object.fromEntries(Object.entries(mutationMaterialManifest).map(([id,item])=>[id,{digest:(mutationOriginalAssets[id]?.digest||item.digest).slice(0,16),ext:mutationOriginalAssets[id]?'webp':'svg'}])))+';\n';
const nunitoCss=(await Promise.all([700,900].map(async weight=>'@font-face{font-family:Nunito;font-style:normal;font-weight:'+weight+';font-display:swap;src:url(data:font/woff;base64,'+(await fs.readFile(path.join(root,'assets/fonts/nunito/nunito-'+weight+'.woff'))).toString('base64')+') format("woff")}'))).join('\n');
const montserratCss='@font-face{font-family:Montserrat;font-style:normal;font-weight:700;font-display:swap;src:url(data:font/woff;base64,'+(await fs.readFile(path.join(root,'assets/fonts/montserrat/montserrat-700.woff'))).toString('base64')+') format("woff")}';
const sitePolishSource='var sitePolishStyle=document.createElement("style");sitePolishStyle.id="brainup-site-polish";sitePolishStyle.textContent='+JSON.stringify(nunitoCss+'\n'+montserratCss+'\n'+await fs.readFile(path.join(root,'client/site-polish.css'),'utf8'))+';document.head.appendChild(sitePolishStyle);\n'+await fs.readFile(path.join(root,'client/site-polish.js'),'utf8');
const buffIconManifest=JSON.parse(await fs.readFile(path.join(root,'assets/buffs/sources.json'),'utf8')),buffIconImages={};
for(const [key,entry] of Object.entries(buffIconManifest))buffIconImages[key]='data:image/webp;base64,'+(await fs.readFile(path.join(root,'assets/buffs',entry.file))).toString('base64');
const wordmarkBytes=await fs.readFile(path.join(root,'assets/brand/brainup-wordmark.webp'));
const wordmarkImage='/assets/brainup-wordmark.webp?v='+createHash('sha256').update(wordmarkBytes).digest('hex').slice(0,16);
const winterSource='var BRAINUP_WORDMARK_IMAGE='+JSON.stringify(wordmarkImage)+';\nvar BUFF_ICON_IMAGES='+JSON.stringify(buffIconImages)+';\n'+(await Promise.all(['client/winter.js','client/age-gate.js','client/black-theme.js','client/interface-fixes.js','client/free-queue-ui.js','client/collaboration.js','client/header-navigation.js','client/migration-tools.js','client/case-presentation.js','client/telegram-login.js','client/partner-claims.js','client/live-drop-reference.js','client/profile-social.js','client/stars-donation.js','client/referral-tabs.js','client/bulk-sales.js','client/partner-accounting.js'].map(file=>fs.readFile(path.join(root,file),'utf8')))).join('\n')+'\n'+caseSectionsSource+'\n'+caseOddsSource+'\n'+await fs.readFile(path.join(root,'client/case-sections.js'),'utf8')+'\n'+mutationClientData+'\n'+await fs.readFile(path.join(root,'client/mutations.js'),'utf8')+'\n'+await fs.readFile(path.join(root,'client/topup-updates.js'),'utf8')+'\n'+await fs.readFile(path.join(root,'client/admin-repairs.js'),'utf8')+'\n'+await fs.readFile(path.join(root,'client/admin-workspace.js'),'utf8')+'\n'+await fs.readFile(path.join(root,'client/notification-layout-fixes.js'),'utf8')+'\n'+buffsSource+'\n'+await fs.readFile(path.join(root,'client/buffs.js'),'utf8')+'\n'+await fs.readFile(path.join(root,'client/startup-loading.js'),'utf8')+'\n'+await fs.readFile(path.join(root,'client/admin-item-art.js'),'utf8')+'\nvar CATALOG_ARTWORK='+JSON.stringify(Object.fromEntries(Object.entries(catalogArtwork).filter(([,entry])=>!entry.originalSource).map(([id,entry])=>[id,{ext:entry.mime==='image/png'?'png':'webp',digest:entry.digest.slice(0,16)}])))+';\n'+await fs.readFile(path.join(root,'client/catalog-artwork.js'),'utf8')+'\n'+sitePolishSource+'\n'+await fs.readFile(path.join(root,'client/case-distribution.js'),'utf8')+'\n'+await fs.readFile(path.join(root,'client/case-layout.js'),'utf8')+'\n'+await fs.readFile(path.join(root,'client/upgrade-layout.js'),'utf8')+'\n'+await fs.readFile(path.join(root,'client/free-case-opening.js'),'utf8')+'\n'+await fs.readFile(path.join(root,'client/upgrade-shop.js'),'utf8')+'\n'+await fs.readFile(path.join(root,'client/admin-item-prices.js'),'utf8');
const winterBlock='/* winter:start */\n'+winterSource+'\n/* winter:end */';
if(html.includes('/* winter:start */'))html=html.replace(/\/\* winter:start \*\/[\s\S]*?\/\* winter:end \*\//,()=>winterBlock);else{const end=html.lastIndexOf('\n})();');html=html.slice(0,end)+'\n'+winterBlock+html.slice(end);}
const winterCss='<style id="brainup-winter-css">'+await fs.readFile(path.join(root,'client/winter.css'),'utf8')+'</style>';
if(html.includes('<style id="brainup-winter-css">'))html=html.replace(/<style id="brainup-winter-css">[\s\S]*?<\/style>/,()=>winterCss);else html=html.replace('</head>',winterCss+'</head>');
const startupMarkup=(await fs.readFile(path.join(root,'client/startup-loading.html'),'utf8')).replace('{{WORDMARK_URL}}',wordmarkImage);
html=html.replace(/<!-- brainup-startup:start -->[\s\S]*?<!-- brainup-startup:end -->\s*/, '');
html=html.replace(/<body\b[^>]*>/,match=>match+'\n'+startupMarkup);
if(!cloudflare)await fs.writeFile(path.join(root,'site.html'),html);
const notificationJobsSource=(await fs.readFile(path.join(root,'server/notification-jobs.mjs'),'utf8')).replace(/^export /gm,'');
const uahTopupsSource=(await fs.readFile(path.join(root,'server/uah-topups.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const partnerAccountingSource=(await fs.readFile(path.join(root,'server/partner-accounting.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const playerProfiles=(await fs.readFile(path.join(root,'server/player-profile.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'');
const model=(await fs.readFile(path.join(root,'server/model.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'');
const service=(await fs.readFile(path.join(root,'server/service.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'');
const telegram=(await fs.readFile(path.join(root,'server/telegram.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'');
const browserAuthSource=await fs.readFile(path.join(root,'server/browser-telegram.mjs'),'utf8');
const identitySource=(await fs.readFile(path.join(root,'server/request-identity.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'');
const migrationSource=await fs.readFile(path.join(root,'server/migration-backup.mjs'),'utf8');
const support=(await fs.readFile(path.join(root,'server/support.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'');
const mutationAssetsSource=(await fs.readFile(path.join(root,'server/mutation-assets.mjs'),'utf8')).replace(/^export /gm,'');
const welcomePhoto=(await fs.readFile(path.join(root,'assets/bot/welcome.jpg'))).toString('base64');
const htmlGzip=cloudflare?null:gzipSync(Buffer.from(html),{level:9});
if(htmlGzip&&gunzipSync(htmlGzip).toString()!==html)throw Error('HTML compression round trip failed');
const worker=`${notificationJobsSource}\n${partnerAccountingSource}\n${uahTopupsSource}\n${support}\n${telegram}\n${browserAuthSource}\n${identitySource}\n${migrationSource}\n${mutationAssetsSource}\n${mutationMaterialSource}\n${catalogArtworkSource}\nconst catalogArtwork=${JSON.stringify(catalogArtwork)};\nconst mutationMaterialManifest=${JSON.stringify(mutationMaterialManifest)};\nconst mutationModels=${JSON.stringify(mutationModels)};\nconst mutationOriginalAssets=${JSON.stringify(mutationOriginalAssets)};\nconst mutationAssetManifest=${JSON.stringify(mutationAssetManifest)};\nconst mutationIcons=${JSON.stringify(mutationIcons)};\nconst standaloneCloudflare=${cloudflare};\nconst brandWordmark=${JSON.stringify(cloudflare?null:wordmarkBytes.toString('base64'))};\nconst htmlGzip=${JSON.stringify(htmlGzip?.toString('base64')||null)};\nfunction htmlResponseBody(){return new Blob([Uint8Array.from(atob(htmlGzip),ch=>ch.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))}\nconst welcomePhoto=${JSON.stringify(cloudflare?null:welcomePhoto)};\nconst seed=${seed};\n${playerProfiles}\n${caseSectionsSource}\n${caseOddsSource}\n${buffsSource}\n${upgradeChanceShared}\n${model}\n${service}\n`+`
export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url);
    if(url.pathname==='/internal/notifications/tick')return handleNotificationTick(request,env);
    if(url.pathname.startsWith('/assets/catalog/'))return handleCatalogArtwork(request,env,catalogArtwork);
    if(url.pathname==='/assets/brainup-wordmark.webp'){
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
      if(standaloneCloudflare)return env.ASSETS.fetch(request);
      return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(brandWordmark),ch=>ch.charCodeAt(0)),{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
    }
    if(/^\\/assets\\/mutations\\/\\d+\\.svg$/.test(url.pathname))return handleRefreshedMutationMaterial(request,env,mutationMaterialManifest,mutationModels,catalogArtwork);
    if(/^\\/assets\\/mutations\\/\\d+\\.webp$/.test(url.pathname))return handleOriginalMutation(request,mutationOriginalAssets);
    if(url.pathname.startsWith('/assets/mutations/'))return standaloneCloudflare?env.ASSETS.fetch(request):handleMutationAsset(request,env,mutationAssetManifest);
    if(url.pathname.startsWith('/assets/mutation-icons/')){
      if(standaloneCloudflare)return env.ASSETS.fetch(request);
      const key=url.pathname.match(/^\\/assets\\/mutation-icons\\/([a-z-]+)\\.png$/)?.[1],data=key&&mutationIcons[key];if(!data)return new Response('Not found',{status:404});
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
      return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(data),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
    }
    if(standaloneCloudflare&&url.pathname==='/healthz'){
      try{if(!env.DB||!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_WEBHOOK_SECRET)throw Error('Not configured');const row=await env.DB.prepare('SELECT revision FROM site_state WHERE id = 1').first();if(!row)throw Error('State not imported');return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({ok:false},{status:503,headers:{'Cache-Control':'no-store'}})}
    }
    if(standaloneCloudflare&&url.pathname==='/assets/telegram-welcome.jpg')return env.ASSETS.fetch(request);
    const welcomePath='/assets/telegram-welcome.jpg';
    if(url.pathname===welcomePath&&request.method==='GET') {
      return new Response(Uint8Array.from(atob(welcomePhoto),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=300'}});
    }
    if(url.pathname.startsWith('/auth/telegram/'))return handleBrowserTelegramAuth(request,env);
    if(url.pathname==='/telegram/webhook') {if(env.MIGRATION_READ_ONLY==='true')return new Response('Migration in progress',{status:503,headers:{'Retry-After':'60'}});return telegramWebhook(request,env,new URL(welcomePath,url).href);}
    if(url.pathname==='/api/action'||url.pathname==='/api/feed'||url.pathname==='/api/topups'||url.pathname==='/api/rocket'||url.pathname==='/api/support') {
      if(!['GET','POST'].includes(request.method))return new Response('Method not allowed',{status:405});
      let identity;
      try{identity=await requestIdentity(request,env,false)}catch(e){return Response.json({ok:false,error:e.message},{status:401,headers:{'Cache-Control':'no-store'}})}
      if(!identity)return Response.json({ok:false,error:'Войдите через Telegram',telegramLogin:true},{status:401,headers:{'Cache-Control':'no-store'}});
      try{if(url.pathname==='/api/support')return await handleSupport(request,env,identity);if(url.pathname==='/api/rocket')return Response.json({ok:false,error:'Режим удалён'},{status:410});if(url.pathname==='/api/topups')return await readTopups(request,env.DB,identity);if(url.pathname==='/api/feed'){const response=await readFeed(request,env.DB,identity);if(response.ok)processNotificationsFromTraffic(env,url.origin,ctx);return response;}return await handle(request,env.DB,identity,{migrationReadOnly:env.MIGRATION_READ_ONLY==='true',getBotUsername:()=>browserBotUsername(env),getTelegramName:userId=>getBonusTelegramName(env,userId),prepareBonusShare:userId=>prepareBonusInvitation(env,userId,new URL(welcomePath,url).href),checkSubscription:userId=>checkBonusSubscription(env,userId),onCollaborationDecision:application=>notifyCollaborationDecision(env,application),onUahTopupCreated:record=>{const work=processNotificationJobs(env,url.origin).catch(()=>console.error('UAH notification remains queued'));if(ctx?.waitUntil)ctx.waitUntil(work);return work},onSimulationTopupCreated:record=>{const work=notifySimulationTopupCreated(env,record).catch(()=>console.error('Free-request notification was not delivered'));if(ctx?.waitUntil)ctx.waitUntil(work);return work}});}
      catch(error){console.error('Database operation failed',error);return Response.json({ok:false,error:'Ошибка базы данных. Попробуйте позже.'},{status:503});}
    }
    if(url.pathname!=='/'&&url.pathname!=='/index.html')return new Response('Not found',{status:404});
    if(standaloneCloudflare){const asset=await env.ASSETS.fetch(new Request(new URL('/index.html',request.url),request));const headers=new Headers(asset.headers);headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');return new Response(asset.body,{status:asset.status,headers})}
    return new Response(htmlResponseBody(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
  },
  async scheduled(event,env,ctx){ctx.waitUntil(processNotificationJobs(env,env.APP_ORIGIN||'https://brainup-mobile-nov26.regalpeach22.chatgpt.site'))}
};`;
const out=path.join(root,cloudflare?'dist-cloudflare':'dist');
if(cloudflare)await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(path.join(out,'server'),{recursive:true});
await fs.writeFile(path.join(out,'server/index.js'),worker);
if(cloudflare){
  await fs.mkdir(path.join(out,'public/assets'),{recursive:true});
  await fs.writeFile(path.join(out,'public/index.html'),html);
  await fs.copyFile(path.join(root,'assets/bot/welcome.jpg'),path.join(out,'public/assets/telegram-welcome.jpg'));
  await fs.copyFile(path.join(root,'assets/brand/brainup-wordmark.webp'),path.join(out,'public/assets/brainup-wordmark.webp'));
  await fs.cp(path.join(root,'assets/mutations/images'),path.join(out,'public/assets/mutations'),{recursive:true});
  await fs.cp(path.join(root,'assets/mutations/icons'),path.join(out,'public/assets/mutation-icons'),{recursive:true});
}else{
  await fs.mkdir(path.join(out,'.openai'),{recursive:true});
  await fs.copyFile(path.join(root,'.openai/hosting.json'),path.join(out,'.openai/hosting.json'));
  await fs.cp(path.join(root,'drizzle'),path.join(out,'.openai/drizzle'),{recursive:true});
}
for(const [i,s] of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].entries())new vm.Script(s[1],{filename:'inline-'+i});
const mod=await import('data:text/javascript;base64,'+Buffer.from(worker).toString('base64'));
if(typeof mod.default?.fetch!=='function')throw Error('Worker entry point missing');
const anonymous=await mod.default.fetch(new Request('https://brainup.test/api/action',{headers:{'oai-authenticated-user-id':'unverified-browser'}}),{});
if(anonymous.status!==401||(await anonymous.json()).telegramLogin!==true)throw Error('Telegram website sign-in gate failed');
if((await mod.default.fetch(new Request('https://brainup.test/auth/telegram/start'),{})).status!==405)throw Error('Telegram website auth route missing');
if(cloudflare){
  const {verifyCloudflareBuild}=await import('../scripts/verify-cloudflare.mjs');
  await verifyCloudflareBuild(mod.default,out);
  console.log('Built and verified standalone Cloudflare Worker and static assets.');
  process.exit(0);
}
const page=await mod.default.fetch(new Request('https://brainup.test/'),{});
if(page.status!==200||!(await page.text()).includes('brainup-mobile'))throw Error('Page smoke check failed');
const logoResponse=await mod.default.fetch(new Request('https://brainup.test/assets/brainup-wordmark.webp'),{});
if(logoResponse.status!==200||logoResponse.headers.get('Content-Type')!=='image/webp'||!Buffer.from(await logoResponse.arrayBuffer()).equals(wordmarkBytes))throw Error('Wordmark asset smoke check failed');
const logoHead=await mod.default.fetch(new Request('https://brainup.test/assets/brainup-wordmark.webp',{method:'HEAD'}),{});
if(logoHead.status!==200||(await logoHead.arrayBuffer()).byteLength)throw Error('Wordmark HEAD smoke check failed');
const photoResponse=await mod.default.fetch(new Request('https://brainup.test/assets/telegram-welcome.jpg'),{});
if(photoResponse.status!==200||photoResponse.headers.get('Content-Type')!=='image/jpeg'||Buffer.from(await photoResponse.arrayBuffer()).toString('base64')!==welcomePhoto)throw Error('Welcome photo smoke check failed');
console.log('Built and verified BrainUp Worker; inline JavaScript is valid.');

if((await mod.default.fetch(new Request('https://brainup.test/assets/last-christmas.mp3'),{})).status!==404)throw Error('Removed soundtrack must not be served');
