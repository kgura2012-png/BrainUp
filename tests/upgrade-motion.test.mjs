import test from 'node:test';
import assert from 'node:assert/strict';
import {buildUpgradeBouncePath,upgradeLaunchAngle,spinUpgradeAim,upgradePathBounds} from '../client/upgrade-motion.mjs';

function seededRandom(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} differs from ${expected}`);

test('flight stays inside the box and reflects at each wall before reaching the rolled diagonal',()=>{
 for(const roll of [.0001,.5,7,12,25,50,74,88,93,99.5,99.9999])for(let seed=1;seed<=30;seed++){
  const points=buildUpgradeBouncePath(roll,seededRandom(seed)),bounds=upgradePathBounds(roll);
  // A corner reflection can combine both axes into one contact.
  assert.ok(points.length>=3);
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
