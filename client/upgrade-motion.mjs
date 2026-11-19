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

export function upgradePathBounds(roll){
 const value=Math.max(1e-9,Math.min(100-1e-9,roll)),edge=Math.min(7,value/2,(100-value)/2);
 return {roll:value,low:edge,high:100-edge};
}
export function buildUpgradeBouncePath(roll, random=Math.random){
  var bounds=upgradePathBounds(roll);roll=bounds.roll;
  var LO=bounds.low,HI=bounds.high,W=HI-LO,dd=2*roll-100,lo=Math.max(LO,LO+dd),hi=Math.min(HI,HI+dd),S0=[8,92],u0x=(S0[0]-LO)/W,u0y=(S0[1]-LO)/W,best=null,a,i;
  var fold=function(u){var m=((u%2)+2)%2;return m<=1?m:2-m},nrm=function(v){return(v-LO)/W};
  /* unfold the box: a straight line in the mirrored plane = a real bounce path; k = number of wall hits on that axis */
  var uf=function(tu,k,dir,u0){for(var m=-8;m<=8;m++)for(var s=-1;s<=1;s+=2){var U=2*m+s*tu,c=dir>0?(U>u0?Math.floor(U):-1):(U<u0?(U>=0?0:-Math.floor(U)):-1);if(c===k&&Math.abs(fold(U)-tu)<1e-9)return U}return null};
  for(a=0;a<120;a++){
    var n=3+Math.floor(random()*2),kx=1+Math.floor(random()*(n-1)),ky=n-kx,x=lo<=hi?lo+random()*(hi-lo):Math.min(HI,Math.max(LO,(lo+hi)/2)),y=Math.min(HI,Math.max(LO,x-dd)),
      Ux=uf(nrm(x),kx,1,u0x),Uy=uf(nrm(y),ky,-1,u0y);if(Ux==null||Uy==null)continue;
    var ev=[];for(i=1;i<=kx;i++)ev.push((i-u0x)/(Ux-u0x));for(i=0;i<ky;i++)ev.push((-i-u0y)/(Uy-u0y));ev.sort(function(p,q){return p-q});
    var pts=[S0].concat(ev.map(function(t){return[LO+fold(u0x+(Ux-u0x)*t)*W,LO+fold(u0y+(Uy-u0y)*t)*W]})).concat([[x,y]]),ok=true;
    // A corner touches two walls at the same instant, with one visible impact.
    pts=pts.filter(function(point,index){return !index||Math.hypot(point[0]-pts[index-1][0],point[1]-pts[index-1][1])>1e-7});
    for(i=0;i<pts.length-1;i++)if(Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1])<13)ok=false;
    best=pts;if(ok)return pts}
  return best||[S0,[Math.min(HI,Math.max(LO,roll)),Math.min(HI,Math.max(LO,100-roll))]]}
