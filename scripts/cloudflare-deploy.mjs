import {spawnSync} from 'node:child_process';
import {withCloudflareConfig, wranglerCli} from './cloudflare-config.mjs';

async function renameVerifiedAccountSubdomain(accountId) {
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  if (!token) throw Error('В сборке отсутствует API-токен Cloudflare для изменения поддомена.');
  if (accountId !== '681b5cc027d6e7615c140c6e2d6b2358') throw Error('Указан другой аккаунт Cloudflare.');
  const url = 'https://api.cloudflare.com/client/v4/accounts/' + accountId + '/workers/subdomain';
  async function subdomain(method, value) {
    const response = await fetch(url, {
      method,
      headers:{Authorization:'Bearer ' + token, 'Content-Type':'application/json'},
      body:value === undefined ? undefined : JSON.stringify({subdomain:value}),
      redirect:'error',
      signal:AbortSignal.timeout(12_000)
    });
    const result = await response.json();
    if (!response.ok || !result.success || typeof result.result?.subdomain !== 'string') {
      const code = result.errors?.[0]?.code;
      throw Error('Cloudflare не подтвердил поддомен. HTTP ' + response.status + (code ? ', API ' + code : ''));
    }
    return result.result.subdomain;
  }

  const target = 'brainup-app';
  const current = await subdomain('GET');
  if (current === target) return;
  if (current !== 'kgura2012') throw Error('Текущий поддомен аккаунта изменился.');
  if (await subdomain('PUT', target) !== target) throw Error('Cloudflare вернул другой поддомен.');
}

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
  if (process.env.WORKERS_CI === '1') await renameVerifiedAccountSubdomain(config.account_id);
  run(['deploy', '--var', 'BRAINUP_MIGRATION_PENDING:false', '--var', 'MIGRATION_READ_ONLY:false']);

  const publicSite = new URL('/', config.vars.APP_ORIGIN);
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = await fetch(publicSite, {cache:'no-store', signal:AbortSignal.timeout(4_000)});
      if (response.ok && (await response.text()).includes('brainup-mobile')) {
        console.log('Страница BrainUp доступна: ' + publicSite.href);
        return;
      }
    } catch {
      // Allow the deployment to propagate before trying again.
    }
    if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 4_000));
  }
  throw Error('Worker опубликован, но публичная страница BrainUp пока не открылась.');
});
