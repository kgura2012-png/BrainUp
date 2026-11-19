import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import seed from '../server/seed.json' with {type:'json'};
import {fresh,account,execute,TOPUP_EXCLUDED_IDS} from '../server/model.mjs';
import {checkBonusSubscription,buildBotKeyboard} from '../server/telegram.mjs';
test('five specified brainrots cannot be submitted while the remaining catalog is unchanged',()=>{
 const catalogBefore=structuredClone(seed.items),s=fresh(seed,'owner'),u=account(s,'p');assert.deepEqual(TOPUP_EXCLUDED_IDS,[25,28,29,33,36]);
 for(const id of TOPUP_EXCLUDED_IDS)assert.throws(()=>execute(s,'p',seed,'simulation-topup',{items:[{id,q:1}]}),/недоступен для пополнения/);
 assert.equal(u.balance,0);assert.equal(s.simulationTopups,undefined);assert.deepEqual(seed.items,catalogBefore);assert(seed.items.some(item=>item.mutation));
 const allowed=seed.items.find(x=>x.name==='Rosey and Teddy');assert.equal(execute(s,'p',seed,'simulation-topup',{items:[{id:allowed.id,q:1}]}).topup.items[0].id,allowed.id);
});
test('subscription verification and bot news link default to the renamed channel',async()=>{
 const original=globalThis.fetch,calls=[];try{globalThis.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return Response.json({ok:true,result:{status:'member'}})};
  assert.equal(await checkBonusSubscription({TELEGRAM_BOT_TOKEN:'123:fake'},42),true);assert.equal(calls[0].chat_id,'@BrainUp_Official');assert.equal(calls[0].user_id,42);
  await checkBonusSubscription({TELEGRAM_BOT_TOKEN:'123:fake',TELEGRAM_NEWS_CHANNEL:'@CustomChannel'},42);assert.equal(calls[1].chat_id,'@CustomChannel');
  assert.match(JSON.stringify(buildBotKeyboard('https://test',{})),/https:\/\/t.me\/BrainUp_Official/);
 }finally{globalThis.fetch=original}
});
test('dice reference layout retains all controls, four result IDs and six color choices',async()=>{
 const source=await fs.readFile(new URL('../client/site-refresh.js',import.meta.url),'utf8');let language;
 const c=vm.createContext({dCube3:()=>'',dDie:()=>'',dicePage:()=>'',D:{res:[null,null,null,null],match:[0,0,0,0],color:null,rolling:false},DC:[['Red','#f00'],['Orange','#f90'],['Yellow','#ff0'],['Green','#0f0'],['Blue','#00f'],['Purple','#90f']],RAINBOW:'rainbow',DROPS:[],I:()=>null,av:()=>'',S:{dh:[],fast:false},dBetInfo:()=>null,dDot:()=>'',esc:String,fmt:String,secIcon:()=>'<svg></svg>',document:{addEventListener(){}},profilePage:()=>'<div><details class="profile-box profile-promo"><summary>Промокод</summary><input id="bu-pcode"></details></div>',tpOn:()=>true,DR:{},REV:{},setLang:value=>language=value,U:{sec:'upgrade'},renderDice:()=>{}});
 vm.runInContext(source,c);let html=c.dicePage();assert.equal((html.match(/id="bu-ds\d"/g)||[]).length,4);assert.equal((html.match(/data-dc="color"/g)||[]).length,6);for(const action of ['bet','roll'])assert.match(html,new RegExp('data-dc="'+action+'"'));assert.doesNotMatch(html,/data-dc="fast"/);assert.match(html,/data-dc="roll" disabled/);assert.match(html,/ДАЙСЫ/);assert.match(html,/Выплаты/);assert.match(html,/Последние выигрыши/);assert.match(html,/История раундов/);assert.doesNotMatch(html,/data-dc="(?:duel|mode)"/);assert.match(c.dCube3(4),/class="dcube3"/);assert.match(c.dCube3(4),/background:#00f/);
 c.D.color=4;c.dBetInfo=()=>({item:{name:'Lavaka'},value:5});html=c.dicePage();assert(!html.includes('data-dc="roll" disabled'));assert.match(html,/Lavaka/);
 const profile=c.profilePage();assert(!profile.includes('<details'));assert.match(profile,/<section class="profile-box profile-promo">/);assert.match(profile,/id="bu-pcode"/);
 for(const id of TOPUP_EXCLUDED_IDS)assert.equal(c.tpOn({id}),false);assert.equal(c.tpOn({id:50}),true);assert.equal(language,'ru');c.DROPS=[{game:'dice',itemId:1,user:'Player',price:15,qty:3}];c.I=()=>({name:'Lavaka'});c.COIN='<i class=coin></i>';assert.match(c.winsHtml(),/×3/);assert(!c.winsHtml().includes('undefined'));c.D.tab='duel';assert.match(c.dicePage(),/ДАЙСЫ/);assert.equal((c.dicePage().match(/id="bu-ds\d"/g)||[]).length,4);
});

test('dice reveal the server faces in order and release the timer when hidden', async () => {
  const source = await fs.readFile(new URL('../client/site-refresh.js', import.meta.url), 'utf8');
  const start = source.indexOf('function animateDiceResult(');
  const end = source.indexOf('dicePage=function()', start);
  let now = 0;
  let draw;
  let onVisibility;
  let cleared = false;
  const slots = Array.from({length:4}, () => {
    const classes = new Set();
    const orb = {style:{}};
    return {
      innerHTML: '',
      querySelector: () => orb,
      classList: {
        add: name => classes.add(name),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
        contains: name => classes.has(name)
      }
    };
  });
  const document = {
    hidden:false,
    addEventListener: (_event, callback) => { onVisibility = callback; },
    removeEventListener: () => { onVisibility = null; }
  };
  const context = vm.createContext({
    document,
    window:{matchMedia:()=>({matches:false})},
    performance:{now:()=>now},
    setInterval: callback => { draw = callback; return 1; },
    clearInterval: () => { cleared = true; },
    dDie: face => String(face),
    DC:[['red','#f00'],['orange','#f80'],['yellow','#ff0'],['green','#0f0'],['blue','#00f'],['purple','#80f']],
    sfx:()=>{}
  });
  vm.runInContext(source.slice(start,end),context);
  const running = context.animateDiceResult({isConnected:true,querySelectorAll:()=>slots},[4,3,2,1],4,true);
  now = 150;
  draw();
  assert(slots[0].classList.contains('dice-tumbling'));
  now = 1250;
  draw();
  assert.equal(slots[0].innerHTML,'4');
  assert(slots[0].classList.contains('m'));
  assert(slots[1].classList.contains('dice-tumbling'));
  now = 1800;
  draw();
  assert.equal(slots[1].innerHTML,'3');
  document.hidden = true;
  onVisibility();
  await running;
  assert.equal(cleared,true);
  assert.equal(onVisibility,null);
});
