import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {buildUpgradeBouncePath,upgradeLaunchAngle,spinUpgradeAim,upgradePathBounds} from '../client/upgrade-motion.mjs';
import {withUpgradeBoard} from '../scripts/upgrade-board-markup.mjs';

function seededRandom(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} differs from ${expected}`);

test('flight stays inside the box and reflects at each wall before reaching the rolled diagonal',()=>{
 for(const roll of [.0001,.5,7,12,25,50,74,88,93,99.5,99.9999])for(let seed=1;seed<=30;seed++){
  const points=buildUpgradeBouncePath(roll,seededRandom(seed)),bounds=upgradePathBounds(roll);
  // A corner reflection can combine both axes into one contact.
  assert.deepEqual(points[0],[50,50]);
  assert.ok(points.length>=5);
  for(const point of points)for(const coordinate of point)assert.ok(coordinate>=bounds.low-1e-7&&coordinate<=bounds.high+1e-7);
  const end=points.at(-1);
  near((end[0]-end[1]+100)/2,roll);
  for(let i=1;i<points.length-1;i++){
   const [previous,hit,next]=points.slice(i-1,i+2);
   const incoming=[hit[0]-previous[0],hit[1]-previous[1]],outgoing=[next[0]-hit[0],next[1]-hit[1]];
   const a=Math.hypot(...incoming),b=Math.hypot(...outgoing);
   const vertical=Math.abs(hit[0]-bounds.low)<1e-7||Math.abs(hit[0]-bounds.high)<1e-7;
   const horizontal=Math.abs(hit[1]-bounds.low)<1e-7||Math.abs(hit[1]-bounds.high)<1e-7;
   assert.ok(vertical||horizontal);
   near(outgoing[0]/b,incoming[0]/a*(vertical?-1:1));
   near(outgoing[1]/b,incoming[1]/a*(horizontal?-1:1));
  }
 }
});

test('spin makes four turns and stops facing the actual launch segment',async()=>{
 const points=buildUpgradeBouncePath(45,seededRandom(16)),angles=[];
 let queued,id=0;
 const result=spinUpgradeAim({points,writeAngle:angle=>angles.push(angle),duration:1500,random:()=>.5,now:()=>0,
  requestFrame:callback=>{queued=callback;return ++id},cancelFrame:()=>{queued=null}});
 for(const time of [0,250,500,750,1000,1250,1500]){const frame=queued;assert.ok(frame);queued=null;frame(time)}
 assert.equal(await result,true);
 near(angles.at(-1),1440+upgradeLaunchAngle(points));
 for(let i=1;i<angles.length;i++)assert.ok(angles[i]>=angles[i-1]);
 const radians=angles.at(-1)*Math.PI/180;
 const dx=points[1][0]-points[0][0],dy=points[1][1]-points[0][1],length=Math.hypot(dx,dy);
 near(Math.sin(radians),dx/length);near(-Math.cos(radians),dy/length);
 assert.equal(queued,null);
});

test('background cancellation stops the spinning frame and prevents launch',async()=>{
 const controller=new AbortController();let queued,cancelled=0;
 const result=spinUpgradeAim({points:[[8,92],[93,35]],signal:controller.signal,writeAngle:()=>{},now:()=>0,
  requestFrame:callback=>{queued=callback;return 1},cancelFrame:()=>{cancelled++;queued=null}});
 controller.abort();
 assert.equal(await result,false);assert.equal(cancelled,1);assert.equal(queued,null);
});

const html=await withUpgradeBoard(await readFile(new URL('../site.html',import.meta.url),'utf8'));

test('edge rolls leave room for the visible ball and land on the correct side of the displayed threshold',()=>{
 const context=vm.createContext({});
 vm.runInContext(html.slice(html.indexOf('function upgradeBoardPosition(value)'),html.indexOf('function paintUpgradeChance(')),context);
 const {upgradeBoardPosition}=context;
 for(const chance of [10,25,30,80])for(const roll of [0,100-chance-.0001,100-chance+.0001,100]){
  const [x,y]=buildUpgradeBouncePath(roll,seededRandom(5)).at(-1).map(upgradeBoardPosition);
  // Impacts use the ball's radius, so its outer edge reaches the wall.
  assert.ok(x>=4&&x<=96&&y>=4&&y<=96);
  assert.equal(upgradeBoardPosition(0),4);
  assert.equal(upgradeBoardPosition(100),96);
  const diagonal=(x-y+100)/2;
  assert.equal(diagonal>upgradeBoardPosition(100-chance),roll>100-chance);
 }
});

test('flight cancels scheduled work and skips old impact effects after a dropped frame',async()=>{
 const frames=new Map(),positions=[];
 let nextId=0,hits=0;
 const context=vm.createContext({
  performance:{now:()=>0},requestAnimationFrame:callback=>{frames.set(++nextId,callback);return nextId},
  cancelAnimationFrame:id=>frames.delete(id),placeBall:(...point)=>positions.push(point),wallHit:()=>hits++
 });
 vm.runInContext(html.slice(html.indexOf('function fly(pts,total,signal)'),html.indexOf('async function anim(d,win,roll,options)')),context);
 const path=[[50,50],[100,50],[0,50],[60,50]];
 const controller=new AbortController();
 const interrupted=context.fly(path,2900,controller.signal);
 controller.abort();
 await interrupted;
 assert.equal(frames.size,0);
 assert.deepEqual(positions,[[50,50]]);
 const bounceController=new AbortController();
 const bouncing=context.fly(path,2900,bounceController.signal);
 const advance=()=>{
  const callback=frames.get(nextId);
  frames.delete(nextId);
  return callback;
 };
 advance()(700);
 assert.deepEqual(positions.at(-1),path[1]);
 assert.equal(hits,1);
 bounceController.abort();
 await bouncing;
 hits=0;
 const full=context.fly(path,2900);
 const callback=frames.get(nextId);
 frames.delete(nextId);
 callback(5000);
 await full;
 assert.equal(frames.size,0);
 assert.equal(hits,0);
 assert.deepEqual(positions.at(-1),path.at(-1));
});
