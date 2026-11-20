import {readFile} from 'node:fs/promises';

export async function withUpgradeBoard(html) {
  const source = await readFile(new URL('../client/upgrade-board.js',import.meta.url),'utf8');
  const motion = await readFile(new URL('../client/upgrade-motion.mjs',import.meta.url),'utf8');
  const motionSlot = /^\/\/ Screen angles: zero points up, positive rotation turns clockwise\.\r?\n[\s\S]*?(?=^\/\/ Coalesce high-frequency input into one paint)/m;
  const [chance,flight] = source.split(/^\/\* upgrade-board-flight \*\/\r?\n/m);
  const chanceSlot = /^(?:\/\/ The ball and sector boundary share the same inset coordinate system\.\r?\n)?function (?:setRoll\(t\)|upgradeBoardPosition\(value\))\{[\s\S]*?(?=^function ctlUpdate\()/m;
  const flightSlot = /^var resEls=\[\],hitN=0[^\r\n]*[\s\S]*?(?=^function upgrade\(\)\{)/m;
  if (!flight || !motionSlot.test(html) || !chanceSlot.test(html) || !flightSlot.test(html)) {
    throw Error('Could not locate the upgrade board in site.html');
  }
  return html.replace(motionSlot,()=>motion.replace(/^export /gm,'').trimEnd()+'\n')
    .replace(chanceSlot,()=>chance.trimEnd()+'\n')
    .replace(flightSlot,()=>flight.trimEnd()+'\n');
}
