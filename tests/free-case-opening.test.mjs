import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../client/free-case-opening.js',import.meta.url),'utf8');
function fixture(){
 const calls=[],messages=[],button={disabled:false,isConnected:true,setAttribute(){},removeAttribute(){}};
 const c=vm.createContext({CW:{id:200001,tok:7,busy:false,el:{classList:{contains:()=>true}}},S:{fc:{200001:1}},fcKey:String,cById:id=>({id,bonus:1}),NET:{ready:true,busy:false},U:{busy:false},D:{rolling:false},document:{querySelector:()=>button},toast:message=>messages.push(message),sleep:async()=>{c.NET.busy=false},cwGo:async function(free){assert.equal(c.NET.busy,false);calls.push(free);c.S.fc[c.CW.id]--;return 'opened'}});
 vm.runInContext(source,c);return {c,calls,messages,button};
}
test('an issued free opening waits for the check, then opens once without another click',async()=>{
 const f=fixture();f.c.NET.busy=true;const first=f.c.cwGo(true),second=f.c.cwGo(true);assert.equal(f.button.disabled,true);
 assert.equal(await first,'opened');await second;assert.deepEqual(f.calls,[true]);assert.equal(f.c.S.fc[200001],0);assert.equal(f.button.disabled,false);assert.equal(f.c.issuedFreeCasePending,false);
});
test('a queued opening cannot consume the token after closing or changing the case',async()=>{
 for(const change of [c=>c.CW.id=2,c=>c.CW.tok++,c=>c.CW.el.classList.contains=()=>false]){
  const f=fixture();f.c.NET.busy=true;f.c.sleep=async()=>{change(f.c);f.c.NET.busy=false};await f.c.cwGo(true);assert.deepEqual(f.calls,[]);assert.equal(f.c.S.fc[200001],1);assert.equal(f.button.disabled,false);
 }
});
test('a stalled check restores the button and reports the wait instead of discarding a click',async()=>{
 const f=fixture();f.c.NET.busy=true;f.c.sleep=async()=>{};await f.c.cwGo(true);assert.deepEqual(f.calls,[]);assert.equal(f.c.S.fc[200001],1);assert.equal(f.button.disabled,false);assert.match(f.messages[0],/Сервер ещё занят/);
});
test('the real activation verifier makes no Telegram request when an opening is already issued',async()=>{
 const text=await readFile(new URL('../client/case-tools.js',import.meta.url),'utf8'),a=text.indexOf('async function verifyActivationCase()'),b=text.indexOf('\nvar openBeforeActivationVerification',a);const f=fixture();let requests=0;
 Object.assign(f.c,{cById:()=>({id:200001,bonus:1,bonusKey:'sub'}),verifyingActivationCase:false,bonusShareBusy:false,bonusShareConfirmation:{isSaving:()=>false},NET:{ready:true,busy:false,request:()=>requests++}});
 vm.runInContext(text.slice(a,b),f.c);await f.c.verifyActivationCase();assert.equal(requests,0);
});
