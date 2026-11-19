import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../client/case-presentation.js',import.meta.url),'utf8');
function fixture(){
 const tones=[],noise=[],fallback=[];
 const context=vm.createContext({S:{sound:true},document:{hidden:false},sfx:(...args)=>fallback.push(args),ac0:()=>10,wv:(...args)=>tones.push(args),nz2:(...args)=>noise.push(args)});
 vm.runInContext(source.slice(source.indexOf('var soundBeforeCasePresentation='),source.indexOf('// Each strip keeps')),context);return {context,tones,noise,fallback};
}
test('case roll uses a short mechanical click; drop uses a separate rising chime',()=>{
 const {context:c,tones,noise,fallback}=fixture();c.sfx('ctick',50);assert.equal(noise.length,1);assert.equal(noise[0][1],.014);assert.equal(tones.length,1);assert.equal(tones[0][0],175);assert(tones[0][2]<.03);
 tones.length=0;noise.length=0;c.sfx('cwin');assert.equal(noise.length,0);assert.equal(tones.length,9);assert.deepEqual(tones.filter(x=>x[3]==='triangle').map(x=>x[0]),[698.46,880,1046.5,1396.91]);assert.equal(fallback.length,0);
});
test('case sounds honor mute and background state; unrelated game audio is preserved',()=>{
 const {context:c,tones,noise,fallback}=fixture();c.S.sound=false;c.sfx('ctick');c.sfx('cwin');c.S.sound=true;c.document.hidden=true;c.sfx('ctick');c.sfx('cwin');assert.equal(tones.length,0);assert.equal(noise.length,0);
 c.document.hidden=false;c.sfx('win',4);assert.deepEqual(fallback,[['win',4]]);
});
test('drop sound is played once for the opening token, including repeated settlement renders',()=>{
 const events=[],context=vm.createContext({CW:{tok:10},sfx:x=>events.push(x),wins:[{uid:1}]});
 const cue=source.match(/if\(wins\.length&&CW\.dropSoundToken!==CW\.tok\)\{[^}]+\}/)?.[0];assert(cue);vm.runInContext(cue,context);vm.runInContext(cue,context);assert.deepEqual(events,['cwin']);context.CW.tok++;vm.runInContext(cue,context);assert.deepEqual(events,['cwin','cwin']);
});
