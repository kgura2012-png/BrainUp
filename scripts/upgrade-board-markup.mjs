import {readFile} from 'node:fs/promises';

export async function withUpgradeBoard(html) {
  const source = await readFile(new URL('../client/upgrade-board.js',import.meta.url),'utf8');
  const [chance,flight] = source.split(/^\/\* upgrade-board-flight \*\/\r?\n/m);
  const chanceSlot = /^function (?:setRoll\(t\)|upgradeBoardPosition\(value\))\{[\s\S]*?(?=^function ctlUpdate\()/m;
  const flightSlot = /^var resEls=\[\],hitN=0[^\r\n]*[\s\S]*?(?=^function upgrade\(\)\{)/m;
  if (!flight || !chanceSlot.test(html) || !flightSlot.test(html)) {
    throw Error('Could not locate the upgrade board in site.html');
  }
  return html.replace(chanceSlot,()=>chance.trimEnd()+'\n')
    .replace(flightSlot,()=>flight.trimEnd()+'\n');
}
