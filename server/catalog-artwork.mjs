import {handleMutationMaterial} from './mutation-materials.mjs';
const CATALOG_IMAGE_HOSTS=new Set(['wikiassets.net','static.wikia.nocookie.net','steal-a-brainrot.wiki','steal-a-brainrot.org','stealabrainrot.wiki','www.u7buy.com','rblxguide.com','tgaylapgankrdavwpebz.supabase.co']);
function catalogMime(bytes){if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';if(bytes.length>=16&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP')return 'image/webp';throw Error('Invalid image')}
export async function readCatalogArtwork(entry,env,fetcher=fetch){
 const key='catalog-artwork/'+entry.digest;try{const cached=await env.BUCKET?.get(key);if(cached)return await new Response(cached.body).arrayBuffer()}catch{}
 if(entry.data)return Uint8Array.from(atob(entry.data),ch=>ch.charCodeAt(0)).buffer;
 const url=new URL(entry.url);if(url.protocol!=='https:'||!CATALOG_IMAGE_HOSTS.has(url.hostname)||url.username||url.password)throw Error('Unapproved source');
 const r=await fetcher(url.href,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Mozilla/5.0','Accept':'image/png,image/webp,*/*'}});if(!r.ok)throw Error('Source unavailable');
 if(Number(r.headers.get('content-length'))>8000000)throw Error('Image too large');
 // Stream with a hard cap, including upstreams without a Content-Length header.
 const reader=r.body.getReader(),chunks=[];let length=0;try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>8000000)throw Error('Image too large');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}const body=bytes.buffer;
 if(catalogMime(bytes)!==entry.mime||(!entry.originalSource&&length!==entry.bytes))throw Error('Invalid image');
 if(!entry.originalSource){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',body)),n=>n.toString(16).padStart(2,'0')).join('');if(digest!==entry.digest)throw Error('Source changed')}
 try{await env.BUCKET?.put(key,body,{httpMetadata:{contentType:entry.mime,cacheControl:'public, max-age=31536000, immutable'}})}catch{}return body;
}
export async function handleCatalogArtwork(request,env,manifest,fetcher=fetch){
 const id=new URL(request.url).pathname.match(/^\/assets\/catalog\/(\d+)\.(?:png|webp)$/)?.[1],entry=id&&manifest[id];if(!entry)return new Response('Not found',{status:404});if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const headers={'Content-Type':entry.mime,'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800','ETag':'"'+entry.digest+'"','X-Content-Type-Options':'nosniff'};
 if(request.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers});
 try{const body=await readCatalogArtwork(entry,env,fetcher);headers['Content-Length']=String(body.byteLength);return new Response(request.method==='HEAD'?null:body,{headers})}catch{return new Response('Image temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store'}})}
}
export async function handleRefreshedMutationMaterial(request,env,manifest,models,catalog,fetcher=fetch){const id=new URL(request.url).pathname.match(/^\/assets\/mutations\/(\d+)\.svg$/)?.[1],entry=id&&manifest[id],base=entry&&catalog[entry.baseId];if(!base||base.originalSource||request.method!=='GET'||request.headers.get('if-none-match')==='"'+entry.digest+'"')return handleMutationMaterial(request,manifest,models);try{const bytes=new Uint8Array(await readCatalogArtwork(base,env,fetcher));let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return handleMutationMaterial(request,manifest,{...models,[entry.baseId]:'data:'+base.mime+';base64,'+btoa(binary)})}catch{return handleMutationMaterial(request,manifest,models)}}
