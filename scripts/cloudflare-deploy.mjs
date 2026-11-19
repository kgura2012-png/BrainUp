import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
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
  const marker = '"caseCatalogRecoveryRevision":' + catalog.revision;
  const query = `SELECT EXISTS(
    SELECT 1 FROM site_state WHERE id = 1 AND instr(data, '${marker}') > 0
    UNION ALL
    SELECT 1 FROM site_state s JOIN site_state_parts p ON p.state_key = substr(s.data, 18, 36)
    LEFT JOIN site_state_parts n ON n.state_key = p.state_key AND n.ordinal = p.ordinal + 1
    WHERE s.id = 1 AND (instr(p.data, '${marker}') > 0 OR
      instr(substr(p.data, -64) || coalesce(substr(n.data, 1, 64), ''), '${marker}') > 0)
  ) AS recovered`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const [check] = JSON.parse(run(['d1', 'execute', 'DB', '--remote', '--json', '--command', query], true));
    if (check?.success && check.results?.[0]?.recovered === 1) {
      console.log('Cloudflare D1 подтвердила восстановление каталога кейсов BrainUp.');
      return;
    }
    if (attempt < 9) await new Promise(resolve => setTimeout(resolve, 8000));
  }
  throw Error('Не получено подтверждение восстановления каталога в D1.');

});
