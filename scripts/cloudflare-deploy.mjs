import {spawnSync} from 'node:child_process';
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
  const publicSite = new URL('/', config.vars.APP_ORIGIN);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(publicSite, {cache:'no-store', signal:AbortSignal.timeout(4_000)});
      if (response.ok && (await response.text()).includes('brainup-mobile')) {
        console.log('Поддомен BrainUp уже открывается: ' + publicSite.href);
        break;
      }
    } catch {
      // Allow the deployment to propagate before trying again.
    }
    if (attempt === 5) throw Error('Новый поддомен пока не обслуживает BrainUp.');
    await new Promise(resolve => setTimeout(resolve, 4_000));
  }
  run(['deploy', '--var', 'BRAINUP_MIGRATION_PENDING:false', '--var', 'MIGRATION_READ_ONLY:false']);
});
