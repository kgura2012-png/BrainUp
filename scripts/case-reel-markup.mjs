import {readFile} from 'node:fs/promises';

export async function withCaseReel(html) {
  const source = await readFile(new URL('../client/case-reel.js', import.meta.url), 'utf8');
  const slot = /^\/\/ Animate the already settled prizes; the server remains the source of the result\.[\s\S]*?(?=^var originalCwGo=cwGo;)/m;
  if (!slot.test(html)) throw Error('Could not locate the case reel in site.html');
  return html.replace(slot, () => source.trimEnd() + '\n').replace(
    "strip.querySelector('.win')||strip.children[44]",
    "strip.querySelector('.win,[data-case-winner]')||strip.children[44]"
  );
}
