import http from 'node:http';
import fs from 'node:fs/promises';
import {handle} from '../server/service.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import {withUpgradeBoard} from './upgrade-board-markup.mjs';
import {withCaseReel} from './case-reel-markup.mjs';
await fs.mkdir('.sites-runtime',{recursive:true});
const db=localDatabase('.sites-runtime/preview.sqlite');
const exists=db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_state'").get();
if(!exists)db.sqlite.exec(await fs.readFile('drizzle/0000_site_state.sql','utf8'));
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:4173');
    if(url.pathname==='/api/action'){
      let body='';for await(const chunk of req)body+=chunk;
      const request=new Request(url,{method:req.method,headers:req.headers,...(body?{body}:{} )});
      const response=await handle(request,db,{id:'preview-owner',name:'Owner'});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    if(url.pathname==='/signin-with-chatgpt'){res.writeHead(302,{Location:'/'});res.end();return;}
    if(!['/','/index.html'].includes(url.pathname)){res.writeHead(404);res.end();return;}
    const html=await withCaseReel(await withUpgradeBoard(await fs.readFile('site.html','utf8')));
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);
  }catch(e){res.writeHead(500);res.end(e.message);}
});
server.listen(4173,'127.0.0.1',()=>console.log('BrainUp preview: http://127.0.0.1:4173 (local test account)'));
