// Reference dice layout, using the existing result and stake handlers.
function diceReferenceIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/><circle cx="17" cy="7" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="7" cy="17" r="1.5" fill="currentColor"/><circle cx="17" cy="17" r="1.5" fill="currentColor"/></svg>'}
var DICE_RU_COLORS=['Красный','Оранжевый','Жёлтый','Зелёный','Синий','Фиолетовый'];
dCube3=function(color){var selected=color==null?4:color,bg=selected==='bonus'?RAINBOW:selected==='ghost'?'#d9fff0':DC[selected][1];return '<div class="dfly"><div class="dcube3"><i class="dice-orb" style="background:'+bg+'">'+(selected==='ghost'?'✦':'')+'</i></div></div>'};
dDie=function(color){return dCube3(color)};

function animateDiceResult(stage, faces, selectedColor, fast) {
  fast = false;
  if (!stage?.isConnected || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve();
  }

  const slots = Array.from(stage.querySelectorAll('.bu-dslot'));
  const firstStop = fast ? 150 : 1250;
  const stopGap = fast ? 45 : 550;
  const endTime = firstStop + stopGap * (slots.length - 1) + (fast ? 90 : 200);
  const started = performance.now();
  const stopped = new Set();

  for (const [index, slot] of slots.entries()) {
    slot.innerHTML = '<div class="dice-perspective"><div class="dice-rotor" style="--roll-duration:'+(fast?180:360)+'ms;--roll-delay:-'+index*65+'ms">'+[0,1,2,3].map(function(face){
      return '<span class="dice-face" style="--face:'+face+'"><i class="dice-orb" style="background:'+DC[(index+face*2)%DC.length][1]+'"></i></span>';
    }).join('')+'</div></div>';
    slot.classList.remove('m', 'nm', 'dice-landed');
    slot.classList.add('dice-tumbling');
  }
  sfx('dr_shake');

  return new Promise(resolve => {
    const timer = setInterval(draw, 24);
    document.addEventListener('visibilitychange', onVisibility);
    draw();

    function finish() {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      resolve();
    }

    function onVisibility() {
      if (document.hidden) finish();
    }

    function draw() {
      if (!stage.isConnected || document.hidden) {
        finish();
        return;
      }
      const elapsed = performance.now() - started;

      slots.forEach((slot, index) => {
        if (stopped.has(index)) return;
        if (elapsed >= firstStop + stopGap * index) {
          stopped.add(index);
          slot.innerHTML = dDie(faces[index]);
          slot.classList.remove('dice-tumbling');
          slot.classList.add('dice-landed');
          slot.classList.toggle('m', faces[index] === selectedColor);
          sfx('hit', index + 1);
        }
      });
      if (elapsed >= endTime) finish();
    }
  });
}

dicePage=function(){
 var info=dBetInfo(),disabled=D.rolling||D.color==null||!info,stakeLabel=info?(info.item?esc(info.item.name):fmt(info.value)+' токенов'):'Выбрать ставку';
 var slots=[0,1,2,3].map(function(index){return '<div class="bu-dslot'+(D.match[index]?' m':'')+'" id="bu-ds'+index+'">'+dDie(D.res[index])+'</div>'}).join('');
 var colors=DC.map(function(color,index){return '<button class="bu-dpick'+(D.color===index?' on':'')+'" data-dc="color" data-v="'+index+'" style="--dice-color:'+color[1]+';background:'+color[1]+'" title="'+DICE_RU_COLORS[index]+'" aria-label="'+DICE_RU_COLORS[index]+'" aria-pressed="'+(D.color===index)+'"></button>'}).join('');
 var history=(S.dh||[]).slice(0,12).map(function(round){return '<div class="bu-dh-row"><span class="dots">'+round.r.map(dDot).join('')+'</span><span class="tx">'+esc(round.n||fmt(round.v)+' токенов')+' · '+DICE_RU_COLORS[round.c]+'</span><em class="'+(round.x?'w':'l')+'">'+(round.x?'×'+round.x:'Проигрыш')+'</em></div>'}).join('');
 return '<div class="bu-dwrap dice-surface"><section class="dice-machine"><header class="dice-reference-heading">'+diceReferenceIcon()+'<h1>ДАЙСЫ</h1>'+diceReferenceIcon()+'<button class="dice-rules-button" data-dice-reference-rules aria-label="Правила дайсов">?</button></header><p class="dice-reference-subtitle">4 кубика, угадай цвет</p><div class="bu-dbar"><button class="bu-dbet" data-dc="bet"><span>'+stakeLabel+'</span><i>⌄</i></button></div><div class="bu-dslots">'+slots+'</div><div class="bu-dpal">'+colors+'</div><button class="bu-droll" data-dc="roll"'+(disabled?' disabled':'')+'>'+(D.rolling?'БРОСАЕМ…':'БРОСИТЬ')+'</button><p class="bu-dhint">'+(disabled&&!D.rolling?'Выбери цвет и предмет для ставки':'Выбран цвет: '+(DICE_RU_COLORS[D.color]||'—'))+'</p></section>'+(history?'<details class="dice-reference-history"><summary>История бросков</summary>'+history+'</details>':'')+'</div>';
};
document.addEventListener('click',function(event){if(!event.target.closest('[data-dice-reference-rules]'))return;event.preventDefault();openModal('<h3 class="bu-mt">Правила дайсов</h3><p>Выбери предмет и один из шести цветов. Затем брось четыре кубика.</p><p>Одно совпадение — ×2. Четыре совпадения — ×3. Ноль, два или три совпадения — проигрыш.</p>')});

// Keep the promo input visible on every profile render, including tab changes.
var profileBeforeVisiblePromo=profilePage;
profilePage=function(){return profileBeforeVisiblePromo().replace(/<details class="profile-box profile-promo"><summary>[\s\S]*?<\/summary>([\s\S]*?)<\/details>/,'<section class="profile-box profile-promo"><h2>Промокод</h2>$1</section>')};
var TOPUP_HIDDEN_BRAINROTS=[25,28,29,33,36],topupAllowedBeforeRefresh=tpOn;
tpOn=function(item){return !TOPUP_HIDDEN_BRAINROTS.includes(Number(item.id))&&topupAllowedBeforeRefresh(item)};

// Apply the requested site language to new and previously saved sessions.
[['Color Dice','Дайсы'],['Fuse Machine','Фьюз'],['Fuse','Фьюз'],['LIVE DROPS','ЛАЙВ-ДРОП'],['Select','Выбрать'],['Common','Обычный'],['Uncommon','Необычный'],['Rare','Редкий'],['Epic','Эпический'],['Mythic','Мифический'],['Legendary','Легендарный'],['Secret','Секретный']].forEach(function(pair){DR[pair[0]]=pair[1];REV[pair[1]]=pair[0]});
setLang('ru');

function diceModeTabs(){return ''}
function dicePayoutPanel(){var rows=[['0 из 4','Проигрыш',false],['1 из 4','×2',true],['2 из 4','Проигрыш',false],['3 из 4','Проигрыш',false],['4 из 4','×3',true]];return '<aside class="dice-side-panel dice-payout-panel"><h2>Выплаты</h2><div class="dice-paytable">'+rows.map(function(row){return '<div class="dice-payrow '+(row[2]?'win':'loss')+'"><span>'+row[0]+'</span><b>'+row[1]+'</b></div>'}).join('')+'</div></aside>'}
winsHtml=function(){var rows=DROPS.filter(function(drop){return drop.game==='dice'&&drop.itemId!=null}).slice(0,8);if(!rows.length)return '<p class="dice-panel-empty">Выигрышей пока нет</p>';return rows.map(function(drop){var item=I(drop.itemId),quantity=Number(drop.qty||drop.mult)||0;return '<div class="bu-dwin">'+(item?'<img src="'+av(item)+'" alt="'+esc(item.name)+'">':'')+'<span class="nm" title="'+esc(drop.user)+'">'+esc(drop.user)+'</span><span class="pr">'+fmt(drop.price)+COIN+'</span>'+(quantity?'<em>×'+quantity+'</em>':'')+'</div>'}).join('')};
function diceLatestPanel(){return '<aside class="dice-side-panel dice-latest-panel"><h2>Последние выигрыши</h2><div id="bu-dwins">'+winsHtml()+'</div></aside>'}
var diceBeforeSidePanels=dicePage;
dicePage=function(){
 D.tab='dice';
 var html=diceBeforeSidePanels().replace('<div class="bu-dwrap dice-surface">','<div class="bu-dwrap dice-surface dice-layout">'+diceModeTabs()+dicePayoutPanel()).replace('</section>','</section>'+diceLatestPanel());
 if(html.includes('<details class="dice-reference-history">'))return html.replace('<details class="dice-reference-history"><summary>История бросков</summary>','<section class="dice-reference-history"><h2>История раундов</h2>').replace('</details>','</section>');
 var end=html.lastIndexOf('</div>');return html.slice(0,end)+'<section class="dice-reference-history"><h2>История раундов</h2><p class="dice-panel-empty">Бросков пока нет</p></section>'+html.slice(end);
};

if(U.sec==='dice')renderDice();
