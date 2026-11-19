import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createFrameScheduler} from '../client/ui-feedback.mjs';
import {localDatabase} from '../server/sqlite-adapter.mjs';
import {handle} from '../server/service.mjs';
test('rapid input schedules one render and reads the latest value',()=>{let value=0;const frames=[],rendered=[];const schedule=createFrameScheduler(()=>rendered.push(value),fn=>frames.push(fn));for(let i=1;i<=100;i++){value=i;schedule()}assert.equal(frames.length,1);frames.shift()();assert.deepEqual(rendered,[100]);value=101;schedule();assert.equal(frames.length,1);frames.shift()();assert.deepEqual(rendered,[100,101])});
test('idle polling reads persisted inventory without repeatedly writing the state',async()=>{const db=localDatabase();db.sqlite.exec(await fs.readFile(new URL('../drizzle/0000_site_state.sql',import.meta.url),'utf8'));const who={id:'tg:1116312381',name:'Owner'};const request=()=>handle(new Request('https://brainup.test/api/action'),db,who);assert.equal((await request()).status,200);const before=db.sqlite.prepare('SELECT revision,data FROM site_state WHERE id=1').get();for(let i=0;i<10;i++){const r=await request();const j=await r.json();assert.equal(r.status,200);assert.equal(j.userId,who.id);assert.equal(j.admin,true);assert(Array.isArray(j.players))}const after=db.sqlite.prepare('SELECT revision,data FROM site_state WHERE id=1').get();assert.deepEqual(after,before);db.sqlite.close()});
