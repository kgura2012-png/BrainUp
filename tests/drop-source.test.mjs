import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fresh,account,execute} from '../server/model.mjs';
import seed from '../server/seed.json' with {type:'json'};
test('case drop stores its original case name even after rename',()=>{const s=fresh(seed,'owner'),u=account(s,'p','P'),c=s.config.cases[0];u.balance=100000;execute(s,'p',seed,'case',{id:c.id,n:1},1000,()=>.5);const original=c.name;c.name='Renamed';assert.equal(s.drops[0].caseId,c.id);assert.equal(s.drops[0].caseName,original)});
test('source hints identify a case, game mode, and legacy case without guessing',async()=>{const src=await fs.readFile(new URL('../client/fuse.js',import.meta.url),'utf8'),a=src.indexOf('function dropSourceLabel('),b=src.indexOf('\nvar cardBeforeSourceHint',a),ctx=vm.createContext({});vm.runInContext(src.slice(a,b),ctx);assert.equal(ctx.dropSourceLabel({game:'case',caseName:'Starter'}),'Кейс: Starter');assert.equal(ctx.dropSourceLabel({game:'fuse'}),'Режим: Fuse');assert.equal(ctx.dropSourceLabel({game:'case'}),'Кейс · название не сохранено')});
