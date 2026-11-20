import {readFile} from 'node:fs/promises';

export async function withUpgradeBoard(html) {
  const source = await readFile(new URL('../client/upgrade-board.js',import.meta.url),'utf8');
  const motion = await readFile(new URL('../client/upgrade-motion.mjs',import.meta.url),'utf8');
  const probability = await readFile(new URL('../shared/upgrade-chance.mjs',import.meta.url),'utf8');
  const session = await readFile(new URL('../client/session-tools.mjs',import.meta.url),'utf8');
  const probabilitySlot = /^\/\/ The displayed probability and the authoritative roll share this policy\.\r?\n[\s\S]*?(?=^function shopPurchasePrice\()/m;
  const presetSlot = /^(?:const DEFAULT_UPGRADE_PERCENTAGES|function validateQuickPercentages\()[\s\S]*?(?=^function targetUpgradeChance\()/m;
  const motionSlot = /^\/\/ Screen angles: zero points up, positive rotation turns clockwise\.\r?\n[\s\S]*?(?=^\/\/ Coalesce high-frequency input into one paint)/m;
  const [chance,flight] = source.split(/^\/\* upgrade-board-flight \*\/\r?\n/m);
  const chanceSlot = /^(?:\/\/ The ball and sector boundary share the same inset coordinate system\.\r?\n)?function (?:setRoll\(t\)|upgradeBoardPosition\(value\))\{[\s\S]*?(?=^function ctlUpdate\()/m;
  const flightSlot = /^var resEls=\[\],hitN=0[^\r\n]*[\s\S]*?(?=^function upgrade\(\)\{)/m;
  const presetSource = session.slice(session.indexOf('export const DEFAULT_UPGRADE_PERCENTAGES'));
  if (!flight || !probabilitySlot.test(html) || !presetSlot.test(html) || !motionSlot.test(html) || !chanceSlot.test(html) || !flightSlot.test(html)) {
    throw Error('Could not locate the upgrade board in site.html');
  }
  return html.replace(motionSlot,()=>motion.replace(/^export /gm,'').trimEnd()+'\n')
    .replace(chanceSlot,()=>chance.trimEnd()+'\n')
    .replace(flightSlot,()=>flight.trimEnd()+'\n')
    .replace(probabilitySlot,()=>probability.replace(/^export /gm,'').trimEnd()+'\n\n')
    .replace(presetSlot,()=>presetSource.replace(/^export /gm,'').trimEnd()+'\n\n')
    .replace(/^var quickPercentages=.*$/m,
      'var quickPercentages=DEFAULT_UPGRADE_PERCENTAGES.slice();try{quickPercentages=loadQuickPercentages(localStorage)}catch(e){}')
    .replace("localStorage.setItem('bu-upgrade-percentages',", "localStorage.setItem(UPGRADE_PERCENTAGES_KEY,")
    .replace("pick(b*100/quickPercentages[index-3])", "pick(b*UPGRADE_PERCENT_SCALE/quickPercentages[index-3])")
    .replace("от 0,01 до 80%. Настройки", "от 0,01 до ' + MAX_UPGRADE_CHANCE + '%. Настройки")
    .replace(`id="quick-percent-'+i+'" type="number" min="0.01" max="80"`,
      `id="quick-percent-'+i+'" type="number" min="0.01" max="'+MAX_UPGRADE_CHANCE+'"`)
    .replace("return toast('Максимальный шанс апгрейда — 80%')", "return toast('Максимальный шанс апгрейда — '+MAX_UPGRADE_CHANCE+'%')");
}
