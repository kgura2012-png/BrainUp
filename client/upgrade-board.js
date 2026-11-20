// The ball and sector boundary share the same inset coordinate system.
function upgradeBoardPosition(value){
  const inset = 4;
  return inset + Math.min(100, Math.max(0, value)) * (100 - 2 * inset) / 100;
}

function paintUpgradeChance(chance){
  const loss = 100 - chance;
  roll_.style.width = '10%';
  skins.style.transform = 'none';
  root.style.setProperty('--loss-progress', upgradeBoardPosition(loss) + '%');
  root.style.setProperty('--chance-progress', chance + '%');
  root.style.setProperty('--win-frac', chance / 100);
  root.style.setProperty('--loss-frac', loss / 100);
  lw.textContent = chance.toFixed(2) + '%';
  ll.textContent = loss.toFixed(2) + '%';
  root.classList.toggle('upgrade-percent--loss-danger', chance < 10);
  root.classList.toggle('upgrade-percent--loss-warning', chance >= 10 && chance < 30);
}

function ringUpdate(chance){
  if (U.busy) return;
  const noTarget = chance == null;
  empty.style.display = noTarget ? '' : 'none';
  skins.style.display = noTarget ? 'none' : '';
  root.classList.toggle('upgrade-percent--empty', noTarget);
  if (noTarget) return;
  paintUpgradeChance(chance);
  placeBall(...UPGRADE_LAUNCH_POINT);
}

/* upgrade-board-flight */
var resEls=[],hitN=0;
let wallFlash, ballImpact;

function placeBallOnBoard(left, top){
  roll_.style.left = left + '%';
  roll_.style.top = top + '%';
}

function placeBall(x, y){
  placeBallOnBoard(upgradeBoardPosition(x), upgradeBoardPosition(y));
}

function stopUpgradeImpact(){
  wallFlash?.cancel();
  ballImpact?.cancel();
  wallFlash = ballImpact = null;
}

function fxClean(){
  stopUpgradeImpact();
  skins.style.transform = 'none';
  skins.style.removeProperty('--loss-progress');
  roll_.style.width = '10%';
  lw.style.opacity = ll.style.opacity = '';
  resEls.forEach(element => element.remove());
  resEls = [];
  root.classList.remove('upgrade-percent--aim-result', 'upgrade-percent--highlight-win',
    'upgrade-percent--highlight-loss', 'upgrade-percent--lost');
  roll_.classList.remove('upgrade-percent__roll--flying', 'upgrade-percent__roll--charging',
    'upgrade-percent__roll--arrow-hidden');
  placeBall(...UPGRADE_LAUNCH_POINT);
}

function drawUpgradeLanding(x, y, progress, chance){
  const approach = 1 - (1 - Math.min(1, progress / .75)) ** 3;
  const scale = 1 + .8 * approach;
  const left = upgradeBoardPosition(x), top = upgradeBoardPosition(y);
  const focusX = left + (50 - left) * approach;
  const focusY = top + (50 - top) * approach;

  // Project the sector divider into the new view while the background still covers the whole square.
  const loss = upgradeBoardPosition(100 - chance);
  const ballDiagonal = (left - top + 100) / 2;
  const focusDiagonal = (focusX - focusY + 100) / 2;
  const divider = focusDiagonal + (loss - ballDiagonal) * scale;
  skins.style.setProperty('--loss-progress', Math.min(100, Math.max(0, divider)) + '%');
  roll_.style.width = 10 * scale + '%';
  lw.style.opacity = ll.style.opacity = String(1 - approach);
  placeBallOnBoard(focusX, focusY);
}

function wallHit(){
  stopUpgradeImpact();
  const inner = root.querySelector('.upgrade-percent__inner');
  wallFlash = inner?.animate?.([
    {boxShadow:'inset 0 0 2.4rem #1fe8b4', borderColor:'#3fe0b4'},
    {boxShadow:'inset 0 0 0 transparent', borderColor:'#1a3a31'}
  ],{duration:280, easing:'ease-out'});
  ballImpact = roll_.animate?.([
    {transform:'translate(-50%,-66.7%) scale(.92,.90)'},
    {transform:'translate(-50%,-66.7%) scale(.98,.98)', offset:.55},
    {transform:'translate(-50%,-66.7%)'}
  ],{duration:240, easing:'ease-out'});
  sfx('hit', hitN++);
}

function fly(pts,total,signal,drawLanding = placeBall){
  return new Promise(resolve => {
    if (signal?.aborted) return resolve();
    const last = pts.length - 2;
    const weights = pts.slice(1).map(([x,y], index) => {
      const [fromX,fromY] = pts[index];
      const length = Math.hypot(x - fromX, y - fromY);
      return length * 1.3 ** index * (index === last ? 1.8 : 1);
    });
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const durations = weights.map(weight => Math.max(140, weight / weightSum * total));
    let segment = 0, segmentStart = performance.now(), frame;

    function finish(){
      cancelAnimationFrame(frame);
      signal?.removeEventListener('abort', finish);
      resolve();
    }

    function step(now){
      let elapsed = Math.max(0, now - segmentStart);
      const previous = segment;
      while (segment < durations.length && elapsed >= durations[segment]) {
        elapsed -= durations[segment];
        segmentStart += durations[segment];
        segment++;
      }
      if (segment >= durations.length) {
        drawLanding(...pts[segment], 1);
        return finish();
      }
      if (previous !== segment) {
        placeBall(...pts[segment]);
        wallHit();
      } else {
        const progress = elapsed / durations[segment];
        const distance = segment === last ? 1 - (1 - progress) ** 2 : progress;
        const [fromX,fromY] = pts[segment], [toX,toY] = pts[segment + 1];
        const x = fromX + (toX - fromX) * distance;
        const y = fromY + (toY - fromY) * distance;
        if (segment === last) drawLanding(x, y, progress);
        else placeBall(x, y);
      }
      frame = requestAnimationFrame(step);
    }

    signal?.addEventListener('abort', finish, {once:true});
    placeBall(...pts[0]);
    frame = requestAnimationFrame(step);
  });
}

async function anim(d,win,roll,options){
  const signal = options?.signal;
  if (!Number.isFinite(roll)) {
    if (options?.snapshot) throw Error('Сервер не вернул бросок апгрейда');
    const loss = 100 - d.chance;
    roll = win ? loss + Math.random() * d.chance : Math.random() * loss;
  }
  if (options?.snapshot) paintUpgradeChance(d.chance);
  else render();
  fxClean();

  const path = buildUpgradeBouncePath(roll);
  placeBall(...path[0]);
  roll_.classList.add('upgrade-percent__roll--charging');
  const aimed = await spinUpgradeAim({points:path, duration:1500, signal,
    writeAngle:angle => roll_.style.setProperty('--aim-angle', angle + 'deg')});
  if (!aimed || signal?.aborted) return;
  await sleep(180);
  if (signal?.aborted) return;

  roll_.classList.remove('upgrade-percent__roll--charging');
  roll_.classList.add('upgrade-percent__roll--arrow-hidden', 'upgrade-percent__roll--flying');
  hitN = 0;
  sfx('whoosh');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  await fly(path, 2900, signal, (x, y, progress) =>
    drawUpgradeLanding(x, y, reducedMotion ? Math.floor(progress) : progress, d.chance));
  if (signal?.aborted) return;

  root.classList.add('upgrade-percent--aim-result', 'upgrade-percent--highlight-' + (win ? 'win' : 'loss'));
  if (!win) root.classList.add('upgrade-percent--lost');
  const overlay = E('upgrade-percent__result-overlay');
  const resultText = E('upgrade-percent__result-text' + (win ? '' : ' upgrade-percent__result-text--lose'));
  resultText.style.top = '62%';
  resultText.append(E('upgrade-percent__result-title', win ? 'WIN' : 'LOSS'),
    E('upgrade-percent__result-subtitle', win ? d.target.name : 'Upgrade failed'));
  root.append(overlay, resultText);
  resEls.push(overlay, resultText);
  sfx(win ? 'win' : 'lose');
  toast(win ? 'You won ' + d.target.name + '!' : 'Upgrade failed');
  await sleep(1100);
  if (!signal?.aborted) fxClean();
}
