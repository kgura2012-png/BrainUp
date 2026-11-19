import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const html=await fs.readFile(new URL('../site.html',import.meta.url),'utf8');
const cue=html.split('/* lightweight sound cues:start */')[1].split('/* lightweight sound cues:end */')[0];
test('opening and prize cues are distinct and respect the mute preference',()=>{let notes=[],fallback=[];const context=vm.createContext({S:{sound:true},ac0:()=>0,wv:(...x)=>notes.push(x),sfx:(...x)=>fallback.push(x)});vm.runInContext(cue,context);context.sfx('copen');assert.equal(notes.length,3);const opening=notes.map(x=>x[0]);notes=[];context.sfx('cwin');assert.equal(notes.length,6);assert.notDeepEqual(notes.map(x=>x[0]),opening);context.sfx('gem',2);assert.deepEqual(fallback,[['gem',2]]);context.S.sound=false;notes=[];context.sfx('cwin');assert.equal(notes.length,0)});
