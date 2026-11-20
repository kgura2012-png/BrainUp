// Screen angles: zero points up, positive rotation turns clockwise.
export function upgradeLaunchAngle(points){
 const [start,next]=points;
 return (Math.atan2(next[0]-start[0],start[1]-next[1])*180/Math.PI+360)%360;
}

// A single abortable spin ends exactly on the first flight segment.
export function spinUpgradeAim({points,writeAngle,duration=1500,signal,random=Math.random,
 requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame,now=()=>performance.now()}){
 return new Promise(resolve=>{
  if(signal?.aborted)return resolve(false);
  const target=360*(3+Math.floor(random()*3))+upgradeLaunchAngle(points),started=now();
  let frame,finished=false;
  function finish(completed){
   if(finished)return;
   finished=true;
   if(frame!=null)cancelFrame(frame);
   signal?.removeEventListener('abort',abort);
   resolve(completed);
  }
  function abort(){finish(false)}
  function step(time){
   if(signal?.aborted)return finish(false);
   const progress=Math.max(0,Math.min(1,(time-started)/duration));
   writeAngle(target*(1-Math.pow(1-progress,3)));
   if(progress===1)return finish(true);
   frame=requestFrame(step);
  }
  signal?.addEventListener('abort',abort,{once:true});
  writeAngle(0);
  frame=requestFrame(step);
 });
}

export const UPGRADE_LAUNCH_POINT = [50, 50];

export function upgradePathBounds(roll){
  return {roll:Math.max(1e-9,Math.min(100-1e-9,roll)), low:0, high:100};
}

function foldUpgradeCoordinate(value){
  const wrapped = ((value % 200) + 200) % 200;
  return wrapped <= 100 ? wrapped : 200 - wrapped;
}

// Unfolding the room into mirrored copies preserves the angle at each wall.
function reflectedUpgradePath(end, hits, directions){
  const target = end.map((value, axis) => hits[axis] * directions[axis] * 100 +
    (hits[axis] % 2 ? 100 - value : value));
  const impacts = [];
  for (let axis = 0; axis < 2; axis++) {
    const direction = directions[axis];
    for (let i = 0; i < hits[axis]; i++) {
      const wall = (direction > 0 ? i + 1 : -i) * 100;
      impacts.push((wall - 50) / (target[axis] - 50));
    }
  }
  impacts.sort((a, b) => a - b);
  const path = [UPGRADE_LAUNCH_POINT.slice()];
  let previous = 0;
  for (const time of impacts) {
    // A corner counts as one visible contact, and the end must stay on the rolled diagonal.
    if (time - previous < 1e-9 || time >= 1 - 1e-9) continue;
    path.push(target.map(value => foldUpgradeCoordinate(50 + (value - 50) * time)));
    previous = time;
  }
  return path.concat([end]);
}

function shortestUpgradeSegment(points){
  let shortest = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i], [previousX, previousY] = points[i - 1];
    shortest = Math.min(shortest, Math.hypot(x - previousX, y - previousY));
  }
  return shortest;
}

export function buildUpgradeBouncePath(roll, random = Math.random){
  const diagonal = 2 * upgradePathBounds(roll).roll - 100;
  const low = Math.max(0, diagonal), high = Math.min(100, 100 + diagonal);
  const finishAt = fraction => {
    const x = low + (high - low) * fraction;
    return [x, x - diagonal];
  };
  const midpoint = finishAt(.5);
  // These directions separate the final two contacts even when the roll lands in a corner.
  let best = reflectedUpgradePath(midpoint, [2,1], [midpoint[0] >= 50 ? 1 : -1, midpoint[1] <= 50 ? 1 : -1]);
  let bestLength = shortestUpgradeSegment(best);
  for (let attempt = 0; attempt < 32; attempt++) {
    const impacts = 3 + Math.floor(random() * 2);
    const horizontal = 1 + Math.floor(random() * (impacts - 1));
    const directions = [random() < .5 ? -1 : 1, random() < .5 ? -1 : 1];
    const points = reflectedUpgradePath(finishAt(.1 + .8 * random()), [horizontal, impacts - horizontal], directions);
    if (points.length < 5) continue;
    const length = shortestUpgradeSegment(points);
    if (length >= 13) return points;
    if (length > bestLength) { best = points; bestLength = length; }
  }
  return best;
}
