import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {shareBonusInvitation,createBonusShareConfirmation} from '../client/bonus-share.mjs';

function telegram(){
 const events=new Map();let callback,timer;
 const tg={onEvent:(name,fn)=>events.set(name,fn),offEvent:(name)=>events.delete(name),shareMessage:(_id,fn)=>{callback=fn}};
 return {tg,events,callback:sent=>callback(sent),emit:(name,data)=>events.get(name)?.(data),timeout:()=>timer(),options:{schedule:fn=>{timer=fn;return 1},cancel:()=>{timer=null}}};
}
test('native callback and event both confirm exactly once and remove listeners',async()=>{
 for(const first of ['event','callback']){
  const t=telegram(),result=shareBonusInvitation(t.tg,'prepared',t.options);
  if(first==='event'){t.emit('shareMessageSent');t.callback(true)}else{t.callback(true);t.emit('shareMessageSent')}
  assert.equal(await result,true);assert.equal(t.events.size,0);
 }
});
test('cancel, failure and timeout cannot count as a successful share',async()=>{
 const t=telegram(),cancelled=shareBonusInvitation(t.tg,'id',t.options);t.emit('shareMessageFailed',{error:'USER_DECLINED'});assert.equal(await cancelled,false);
 const f=telegram(),failed=shareBonusInvitation(f.tg,'id',f.options);f.emit('shareMessageFailed',{error:'MESSAGE_SEND_FAILED'});await assert.rejects(failed,/не смог/);
 const late=telegram(),timed=shareBonusInvitation(late.tg,'id',late.options);late.timeout();await assert.rejects(timed,/не подтвердил/);late.callback(true);assert.equal(late.events.size,0);
});
function fixture(){
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const f={values,storage,calls:[],current:null,userId:'tg:42',busy:true,waits:0,failures:0,adopted:0};
 f.create=()=>createBonusShareConfirmation({storage,owner:()=>f.userId,share:()=>f.current,busy:()=>f.busy,now:()=>1000,wait:async()=>{f.waits++;f.busy=false},request:async(action,data)=>{assert.equal(f.busy,false);f.calls.push({action,data});if(f.failures-- >0)throw Error('offline');return {user:{bn:{share:{nonce:data.nonce,confirmedAt:1000}}}}},adopt:reply=>{f.adopted++;f.current=reply.user.bn.share}});
 return f;
}
const prepared={nonce:'nonce',expiresAt:601000};
test('confirmation waits for an existing request and stores native success before networking',async()=>{
 const f=fixture(),c=f.create(),saving=c.confirm(true,prepared);assert(c.hasPending());assert.equal(f.values.size,1);await saving;
 assert.equal(f.waits,1);assert.equal(f.calls.length,1);assert.equal(f.calls[0].action,'bonus-share-complete');assert.equal(f.adopted,1);assert.equal(f.values.size,0);
});
test('lost response retries, and a longer outage can resume after reloading without another message',async()=>{
 const f=fixture();f.busy=false;f.failures=2;const c=f.create();await assert.rejects(c.confirm(true,prepared),/Повторить подтверждение/);assert(c.hasPending());assert.equal(f.calls.length,2);
 const restored=f.create();assert(restored.hasPending());await Promise.all([restored.resume(),restored.resume()]);assert.equal(f.calls.length,3);assert.equal(f.values.size,0);assert.equal(f.adopted,1);
});
test('cancelled sharing never writes a confirmation, and pending work cannot cross accounts',async()=>{
 const f=fixture(),c=f.create();assert.equal(await c.confirm(false,prepared),false);assert.equal(f.values.size,0);assert.equal(f.calls.length,0);
 f.busy=false;f.failures=2;await assert.rejects(c.confirm(true,prepared));f.userId='tg:99';assert.equal(await f.create().resume(),false);assert.equal(f.calls.length,2);
});
test('the real focus handler does not steal the request while Telegram sharing is active',async()=>{
 const source=await readFile(new URL('../client/case-tools.js',import.meta.url),'utf8');const a=source.indexOf('async function verifyActivationCase()'),b=source.indexOf('\nvar openBeforeActivationVerification',a);
 let requests=0;const context=vm.createContext({CW:{id:200001,busy:false,el:{classList:{contains:()=>true}}},cById:()=>({id:200001,bonus:1,bonusKey:'sub'}),S:{fc:{}},fcKey:String,verifyingActivationCase:false,bonusShareBusy:true,bonusShareConfirmation:{isSaving:()=>false},NET:{ready:true,busy:false,request(){requests++;throw Error('must not run')}},Date});
 vm.runInContext(source.slice(a,b),context);await context.verifyActivationCase();assert.equal(requests,0);
});
