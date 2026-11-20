// Animate the already settled prizes; the server remains the source of the result.
function buildFullCaseReel(items, prize, padding, random = Math.random) {
  const pool = [...new Map(items.map(item => [item.id, item])).values()];
  if (!pool.length) pool.push(prize);
  for (let i = pool.length - 1; i > 0; i--) {
    const swap = Math.floor(random() * (i + 1));
    [pool[i], pool[swap]] = [pool[swap], pool[i]];
  }
  const winner = Math.max(44, padding + pool.length);
  const cards = Array.from({length:winner + padding + 1}, (_, index) => {
    const poolIndex = ((index - padding) % pool.length + pool.length) % pool.length;
    return index === winner ? prize : pool[poolIndex];
  });
  return {cards, winner};
}

function caseReelProgress(progress) {
  // Keep a readable speed through the catalog, then slow down on the final stretch.
  return progress < .75 ? progress / .875 : 1 - 2 * (1 - progress) ** 2 / .875;
}

function renderFullCaseReel(track, padding) {
  return track.cards.map((item, index) => {
    const winner = index === track.winner;
    const loading = winner || index < padding + 10 ? 'eager' : 'lazy';
    const card = riHtml(item).replace(/<img\b/, '<img decoding="async" loading="' + loading + '"');
    return winner ? card.replace(/^<div\b/, '<div data-case-winner="true"') : card;
  }).join('');
}

cwPlay=function(c, items, wins) {
  const token = ++CW.tok;
  const reels = $('#cw-reels'), controls = $('#cw-ctl'), result = $('#cw-res'), stage = $('#cw-stage');
  if (!reels) { CW.busy = 0; caseBusy = false; return; }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fast = S.fast, cardWidth = 112;
  const total = wins.reduce((sum, win) => sum + win.w.price, 0);
  controls.classList.add('off');
  result.innerHTML = '';
  stage.className = 'cw-stage' + (!fast && !reduced ? ' case-lifting' : '');
  reels.className = 'cw-reels on brainup-cinematic n' + wins.length;
  reels.style.setProperty('--iw', cardWidth + 'px');
  reels.style.setProperty('--rh','184px');
  const padding = Math.max(6, Math.ceil(reels.clientWidth / cardWidth) + 1);
  const tracks = wins.map(prize => buildFullCaseReel(items, prize.w, padding));
  reels.innerHTML = tracks.map(track =>
    '<div class="cw-reel"><div class="cw-mark"></div><div class="case-focus-ring" aria-hidden="true"></div><div class="cw-strip">' +
    renderFullCaseReel(track, padding) + '</div></div>').join('');
  for (const reel of reels.children) {
    const strip = reel.querySelector('.cw-strip'), first = strip.children[padding];
    strip.style.transform = 'translate3d(' + (reel.clientWidth / 2 - first.offsetLeft - first.offsetWidth / 2) + 'px,0,0)';
  }
  if (!fast && !reduced) reels.classList.add('case-entering');

  setTimeout(function() {
    if (token !== CW.tok) return;
    stage.classList.remove('case-lifting');
    reels.classList.remove('case-entering');
    Promise.all(Array.from(reels.children, (reel, reelIndex) => {
      const strip = reel.querySelector('.cw-strip');
      const cards = Array.from(strip.children);
      const winnerIndex = tracks[reelIndex].winner;
      const winner = cards[winnerIndex];
      const first = cards[padding];
      const duration = reduced ? 0 : Math.max(fast ? 650 : 4400,
        (winnerIndex - padding) * (fast ? 19 : 38)) + reelIndex * 220;

      return new Promise(resolve => {
        let started, previousCard = -1, lastSound = -100, focused = [];
        let reelWidth, stride, cardCenters, firstCenter, winnerCenter, width;
        function measure() {
          reelWidth = reel.clientWidth;
          width = winner.offsetWidth || cardWidth;
          stride = cards[1].offsetLeft - cards[0].offsetLeft || width;
          firstCenter = first.offsetLeft + first.offsetWidth / 2;
          winnerCenter = winner.offsetLeft + winner.offsetWidth / 2;
          cardCenters = cards[0].offsetLeft + cards[0].offsetWidth / 2;
        }
        function frame(now) {
          if (token !== CW.tok) return resolve();
          if (started === undefined) started = now;
          if (reel.clientWidth !== reelWidth) measure();
          const progress = document.hidden || reduced ? 1 : Math.min(1, (now - started) / duration);
          const center = firstCenter + (winnerCenter - firstCenter) * caseReelProgress(progress);
          strip.style.transform = 'translate3d(' + (reelWidth / 2 - center) + 'px,0,0)';

          if (progress >= 1) {
            focused.forEach(card => card.style.setProperty('--case-focus','0'));
            winner.style.setProperty('--case-focus','1');
            winner.classList.add('win');
            reel.classList.add('done');
            return resolve();
          }

          const nearest = Math.max(0, Math.min(cards.length - 1, Math.round((center - cardCenters) / stride)));
          const next = cards.slice(Math.max(0, nearest - 1), nearest + 2);
          focused.forEach(card => { if (!next.includes(card)) card.style.setProperty('--case-focus','0'); });
          next.forEach((card, index) => {
            const cardIndex = Math.max(0, nearest - 1) + index;
            const distance = Math.abs(cardCenters + cardIndex * stride - center);
            card.style.setProperty('--case-focus', String(Math.max(0, 1 - distance / width)));
          });
          focused = next;
          if (reelIndex === 0 && nearest !== previousCard && now - lastSound > 55) {
            previousCard = nearest;
            lastSound = now;
            sfx('ctick', nearest);
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    })).then(function() {
      if (token !== CW.tok) return;
      setTimeout(function() { if (token === CW.tok) cwDone(c, wins, total); }, reduced ? 0 : fast ? 100 : 650);
    });
  }, reduced || fast ? 0 : 550);
};
