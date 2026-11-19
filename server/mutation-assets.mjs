// Only manifest-owned public image URLs are fetchable; requests cannot choose a URL.
export async function handleMutationAsset(request,env,manifest){
 const match=new URL(request.url).pathname.match(/^\/assets\/mutations\/(\d+)\.png$/);
 const entry=match&&manifest[match[1]];
 if(!entry)return new Response('Not found',{status:404});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const headers=new Headers({'Content-Type':'image/png','Cache-Control':'public, max-age=86400, stale-while-revalidate=604800','X-Content-Type-Options':'nosniff','ETag':'"'+entry.digest+'"'});
 if(request.headers.get('if-none-match')===headers.get('etag'))return new Response(null,{status:304,headers});
 const key='mutation-art/'+entry.digest+'.png';
 try{
  const cached=await env.BUCKET?.get(key);
  if(cached){headers.set('Content-Length',String(cached.size));return new Response(request.method==='HEAD'?null:cached.body,{headers})}
 }catch(error){console.warn('Mutation image cache read unavailable')}
 if(request.method==='HEAD'){headers.set('Content-Length',String(entry.bytes));return new Response(null,{headers})}
 try{
  const source=new URL(entry.url);
  if(source.protocol!=='https:'||source.hostname!=='static.wikia.nocookie.net'||source.username||source.password)throw Error('Invalid image source');
  const response=await fetch(source.href,{redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Error('Image unavailable');
  const body=await response.arrayBuffer(),bytes=new Uint8Array(body);
  if(bytes.length>1500000||bytes.length<24||[137,80,78,71,13,10,26,10].some((value,index)=>bytes[index]!==value))throw Error('Invalid image');
  try{if(env.BUCKET)await env.BUCKET.put(key,body,{httpMetadata:{contentType:'image/png',cacheControl:'public, max-age=31536000, immutable'}})}catch(error){console.warn('Mutation image cache write unavailable')}
  headers.set('Content-Length',String(bytes.length));return new Response(body,{headers});
 }catch(error){return new Response('Image temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store'}})}
}
