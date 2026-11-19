import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {withCloudflareConfig, wranglerCli} from './cloudflare-config.mjs';

await withCloudflareConfig(async (config, file) => {
  function run(args, capture = false) {
    const result = spawnSync(process.execPath, [wranglerCli, ...args, '--config', file], {
      encoding:'utf8', stdio:capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error('Wrangler не выполнил команду ' + args.slice(0, 2).join(' '));
    return result.stdout;
  }

  run(['d1', 'migrations', 'apply', 'DB', '--remote']);
  if (process.argv.includes('--migrate-only')) return;
  const [check] = JSON.parse(run(['d1', 'execute', 'DB', '--remote', '--json', '--command',
    'SELECT id FROM site_state LIMIT 1'], true));
  if (!check?.success) throw Error('Новая база BrainUp не готова.');
  run(['deploy', '--var', 'BRAINUP_MIGRATION_PENDING:false', '--var', 'MIGRATION_READ_ONLY:false']);

  const publicSite = new URL('/', config.vars.APP_ORIGIN);
  let siteReady = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(publicSite, {cache:'no-store', signal:AbortSignal.timeout(4_000)});
      if (response.ok && (await response.text()).includes('brainup-mobile')) {
        const invalidSignature = new URLSearchParams({hash:'0'.repeat(64),signature:'A'.repeat(86)});
        const auth = await fetch(new URL('/api/action', publicSite), {
          headers:{'X-Telegram-Init-Data':invalidSignature.toString()}, signal:AbortSignal.timeout(4_000)
        });
        if (auth.status === 401 && (await auth.json()).error === 'Неверная подпись Telegram') {
          console.log('Страница BrainUp доступна, сервер проверяет подпись Telegram: ' + publicSite.href);
          siteReady = true;
          break;
        }
      }
    } catch {
      // Allow the deployment to propagate before trying again.
    }
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 4_000));
  }
  if (!siteReady) throw Error('Worker опубликован, но проверка публичной страницы или серверного входа через Telegram не прошла.');

  const catalog = JSON.parse(await readFile(new URL('../server/restored-cases.json', import.meta.url), 'utf8'));
  const artwork = await fetch(new URL(catalog.cases[0].img, publicSite), {signal:AbortSignal.timeout(5_000)});
  if (!artwork.ok || !artwork.headers.get('Content-Type')?.startsWith('image/webp')) {
    throw Error('Восстановленные изображения кейсов недоступны.');
  }
  const target = new URL('/internal/case-catalog-recovery', publicSite);
  if (target.origin !== 'https://brainup.brainupofficial.workers.dev') throw Error('Неверный адрес каталога BrainUp.');
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw Error('Секрет для проверки записи каталога отсутствует в сборке.');
  const timestamp = String(Math.floor(Date.now()/1000));
  const signature = createHmac('sha256',token).update('brainup-case-catalog:' + catalog.revision + ':' + timestamp).digest('hex');
  const response = await fetch(target, {
    method:'POST', headers:{'X-BrainUp-Catalog-Proof':timestamp + '.' + signature},
    signal:AbortSignal.timeout(15_000), redirect:'error'
  });
  if (!response.ok) throw Error('Cloudflare не подтвердил восстановление каталога. HTTP ' + response.status);
  const checkCatalog = await response.json();
  if (!checkCatalog.ok || checkCatalog.revision !== catalog.revision) throw Error('Неверная ревизия каталога в D1.');
  console.log('Cloudflare D1 подтвердила восстановление каталога кейсов BrainUp.');
});
