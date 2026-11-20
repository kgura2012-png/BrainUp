import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const assetTypes = {
  'image/webp':'webp', 'image/png':'png', 'image/jpeg':'jpg',
  'font/woff':'woff', 'font/woff2':'woff2', 'font/ttf':'ttf'
};

// Small data URLs are cheaper inline. Large static artwork and fonts should be cached by URL.
const embeddedResource = /data:(image\/(?:webp|png|jpeg)|font\/(?:woff2?|ttf));base64,([A-Za-z0-9+/=]{1024,})(?=["')\s\\])/g;

export async function emitEmbeddedAssets(html, publicDirectory){
  const files = new Map();
  const page = html.replace(embeddedResource, (_url, mime, encoded) => {
    const bytes = Buffer.from(encoded,'base64');
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0,24);
    const filename = hash + '.' + assetTypes[mime];
    files.set(filename, bytes);
    return '/assets/embedded/' + filename;
  }).replace(/@font-face\s*\{[^{}]*\}/g, rule => {
    if (!rule.includes('/assets/embedded/') || /font-display\s*:/.test(rule)) return rule;
    return rule.replace('{','{font-display:swap;');
  });
  const target = path.join(publicDirectory,'assets','embedded');
  await mkdir(target,{recursive:true});
  await Promise.all([...files].map(([filename,bytes]) => writeFile(path.join(target,filename),bytes)));
  return page;
}
