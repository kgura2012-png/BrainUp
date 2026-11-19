// Render the owner's reference materials on each character's original model.
// Raster model textures and silhouettes stay intact; materials are SVG layers.
const MATERIAL_PALETTES={
 gold:['#211303','#805009','#c48b18','#f8c942','#fff2b3'],
 diamond:['#071d31','#16617e','#32aaca','#78dcf0','#d5f9ff'],
 candy:['#431235','#9e217b','#ef54bf','#ff98db','#ffe3f5'],
 lava:['#350b03','#c82a00','#ff5800','#ff8b09','#ffc547'],
 galaxy:['#10051f','#34105f','#7011b8','#c43df8','#f6d4ff'],
 'yin-yang':['#050508','#0c0d10','#34373e','#eeeeee','#ffffff'],
 radioactive:['#103306','#427b00','#84d20a','#baf526','#eaff91'],
 cursed:['#080405','#5b0710','#e62129','#5f0710','#10060a'],
 divine:['#5b4809','#b79416','#e9d142','#fff5a9','#ffffff']
};
function materialChannel(hex,index){return Number.parseInt(hex.slice(1+index*2,3+index*2),16)/255}
function transfer(palette){return ['R','G','B'].map((channel,index)=>'<feFunc'+channel+' type="table" tableValues="'+palette.map(hex=>materialChannel(hex,index).toFixed(5)).join(' ')+'"/>').join('')}
function materialPatterns(type){
 if(type==='candy')return '<pattern id="pattern" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><path d="M8 0Q28 12 8 24T8 48" fill="none" stroke="#fff3fd" stroke-width="10" opacity=".31"/></pattern>';
 if(type==='galaxy')return '<pattern id="pattern" width="78" height="83" patternUnits="userSpaceOnUse"><path d="M19 15l2 8 8 2-8 2-2 8-2-8-8-2 8-2zM61 49l1 5 5 1-5 1-1 5-1-5-5-1 5-1z" fill="#fce9ff" opacity=".8"/><circle cx="42" cy="71" r="1.2" fill="#e5bcff"/><circle cx="55" cy="14" r="1" fill="#fff"/></pattern>';
 if(type==='radioactive')return '<pattern id="pattern" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0 0h2v7H0z" fill="#234b04" opacity=".6"/></pattern>';
 if(type==='cursed')return '<pattern id="pattern" width="31" height="35" patternUnits="userSpaceOnUse"><path d="M7 4l4 5-4 5-4-5zM23 19l3 4-3 4-3-4zM21 4l5 2-2 5-4-2zM8 25l-2 6 6-3" fill="none" stroke="#ff282f" stroke-width="1.4" opacity=".9"/></pattern>';
 if(type==='divine')return '<pattern id="pattern" width="33" height="39" patternUnits="userSpaceOnUse"><g fill="none" stroke="#ffffff" stroke-width="1.5" opacity=".9"><circle cx="8" cy="8" r="4"/><path d="M8 12v7m-4-3h8M23 23a5 5 0 1 0 0 9 7 7 0 0 1 0-9zM25 3v13m-4-9h8m-8 6h8"/></g></pattern>';
 if(type==='lava')return '<pattern id="pattern" width="82" height="87" patternUnits="userSpaceOnUse"><path d="M16 0v16q0 11 10 13t10 18v12M69 19v30q0 9-8 9t-8 14v15" fill="none" stroke="#ffda3b" stroke-width="3" opacity=".34"/></pattern>';
 return '';
}
export function renderMutationMaterial(type,model){
 if(!model?.startsWith('data:image/'))throw Error('Missing original model');
 if(type!=='rainbow'&&!MATERIAL_PALETTES[type])throw Error('Unknown material');
 const image='<use href="#model"/>';
 const gradient='<linearGradient id="rainbow" gradientUnits="userSpaceOnUse" x1="80" y1="20" x2="185" y2="225"><stop stop-color="#ff5147"/><stop offset=".19" stop-color="#ffc93b"/><stop offset=".37" stop-color="#9bec3b"/><stop offset=".55" stop-color="#29dfcf"/><stop offset=".73" stop-color="#4289fc"/><stop offset=".9" stop-color="#a84ff2"/><stop offset="1" stop-color="#f962d3"/></linearGradient>';
 const defs='<defs><image id="model" href="'+model+'" x="12" y="8" width="232" height="240" preserveAspectRatio="xMidYMid meet"/>'+gradient+'<mask id="body" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256" style="mask-type:alpha">'+image+'</mask><filter id="material" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer>'+transfer(MATERIAL_PALETTES[type]||['#15171b','#737981','#c1c6cc','#f0f3f5','#ffffff'])+'</feComponentTransfer></filter>'+materialPatterns(type)+'</defs>';
 let rendered;
 if(type==='rainbow')rendered='<g style="isolation:isolate"><rect width="256" height="256" fill="url(#rainbow)" mask="url(#body)"/>'+image.replace('/>',' filter="url(#material)" style="mix-blend-mode:multiply"/>')+'</g>';
 else rendered=image.replace('/>',' filter="url(#material)"/>');
 if(materialPatterns(type))rendered+='<rect width="256" height="256" fill="url(#pattern)" mask="url(#body)"/>';
 if(['gold','diamond','galaxy','divine'].includes(type))rendered+='<g mask="url(#body)" fill="#fff" opacity=".78"><path d="M77 51l2 8 8 2-8 2-2 8-2-8-8-2 8-2zM179 167l1 5 5 1-5 1-1 5-1-5-5-1 5-1z"/></g>';
 const glow=['diamond','lava','galaxy','radioactive','cursed','divine'].includes(type);
 const glowDef=glow?'<defs><filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.3"/><feComponentTransfer><feFuncA type="linear" slope=".3"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>':'';
 return '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 256 256" role="img">'+defs+glowDef+(glow?'<g filter="url(#glow)">'+rendered+'</g>':rendered)+'</svg>';
}

export function handleMutationMaterial(request,manifest,models){
 const match=new URL(request.url).pathname.match(/^\/assets\/mutations\/(\d+)\.svg$/),entry=match&&manifest[match[1]];
 if(!entry||!models[entry.baseId])return new Response('Not found',{status:404});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const headers={'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'public, max-age=86400, stale-while-revalidate=604800','X-Content-Type-Options':'nosniff','ETag':'"'+entry.digest+'"'};
 if(request.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:renderMutationMaterial(entry.mutation,models[entry.baseId]),{headers});
}

export function handleOriginalMutation(request,assets){
 const match=new URL(request.url).pathname.match(/^\/assets\/mutations\/(\d+)\.webp$/),entry=match&&assets[match[1]];
 if(!entry)return new Response('Not found',{status:404});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const headers={'Content-Type':'image/webp','Cache-Control':'public, max-age=86400, stale-while-revalidate=604800','X-Content-Type-Options':'nosniff','ETag':'"'+entry.digest+'"'};
 if(request.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(entry.data),c=>c.charCodeAt(0)),{headers});
}
