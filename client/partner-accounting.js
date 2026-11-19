function partnerSignedAmount(value){var n=Number(value)||0;return (n>0?'+':'')+fmt(r2(n))}
var partnerWdBeforeGameShare=refWd;
refWd=function(partner){var html=partnerWdBeforeGameShare(partner);if(Number(partner.pending)<0)html=html.replace('class="partner-balance-amount"','class="partner-balance-amount negative"').replace('Перевести на баланс','Отрицательный баланс').replace('</section>','<p class="partner-negative-note">Минус учтётся в следующих начислениях.</p></section>');return html};
var refsAdminBeforeGameShare=refsAdminHtml;
refsAdminHtml=function(){
 var html=refsAdminBeforeGameShare.apply(this,arguments).replace('placeholder="Partner % of top-ups"','placeholder="Процент от результата игр"');
 if(!isOwner())return html;
 var rows=Object.values(A.refs||{}).map(function(partner){var entries=partner.gameLedger||[],negative=Number(partner.pending)<0;
  return '<section class="partner-accounting-card"><header><b>'+esc(partner.code)+'</b><strong class="'+(negative?'negative':'')+'">'+partnerSignedAmount(partner.pending)+' BU</strong></header><p>Процент: '+fmt(partner.pct)+'%. Начисление = (ставка − выплата) × процент.</p><details><summary>История расчёта · '+entries.length+'</summary>'+(entries.length?'<div class="partner-ledger-scroll"><table><thead><tr><th>Реферал / игра</th><th>Ставка</th><th>Выплата</th><th>%</th><th>Начисление</th></tr></thead><tbody>'+entries.slice(0,30).map(function(entry){var modes={case:'Кейс',upgrade:'Апгрейд',dice:'Дайсы',fuse:'Фьюз','fuse-hit':'Фьюз','mines-open':'Мины','mines-cash':'Мины'};return '<tr><td>'+esc(entry.user)+'<small>'+esc(modes[entry.game]||entry.game)+' · '+new Date(entry.at).toLocaleString('ru-RU',{timeZone:'Europe/Kyiv'})+'</small></td><td>'+fmt(entry.stake)+'</td><td>'+fmt(entry.payout)+'</td><td>'+fmt(entry.pct)+'</td><td class="'+(entry.amount<0?'negative':'')+'">'+partnerSignedAmount(entry.amount)+'</td></tr>'}).join('')+'</tbody></table></div>':'<p>Новые игры появятся здесь. Старые начисления сохранены.</p>')+'</details></section>';
 }).join('');return html+'<section class="bu-ac partner-accounting"><h4>Результат партнёров</h4>'+rows+'</section>';
};
