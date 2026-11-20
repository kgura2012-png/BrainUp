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
  // The old backup format predated the per-invoice exchange rate. Site version 134
  // switched stars top-ups to 125 cents per star before the first invoice in this window.
  const historicalInvoices="substr(id,1,6) = 'topup:' AND created_at BETWEEN 1794843946768 AND 1795095260217 AND bu_rate = 135";
  const [pendingRates]=JSON.parse(run(['d1','execute','DB','--remote','--json','--command',
    'SELECT COUNT(*) AS count FROM support_payments WHERE '+historicalInvoices],true));
  if(!pendingRates?.success||pendingRates.results[0].count>9)throw Error('Unexpected legacy invoice rate count');
  if(pendingRates.results[0].count>0){
    const [fixedRates]=JSON.parse(run(['d1','execute','DB','--remote','--json','--command',
      'UPDATE support_payments SET bu_rate = 125 WHERE '+historicalInvoices],true));
    if(!fixedRates?.success)throw Error('Legacy invoice rates were not restored');
    console.log('Restored legacy invoice rates:',fixedRates.meta.changes);
  }
  run(['deploy', '--var', 'BRAINUP_MIGRATION_PENDING:false', '--var', 'MIGRATION_READ_ONLY:false',
    '--var','BRAINUP_TRANSFER_PUBLIC:retired']);

  if(process.env.WORKERS_CI==='1'&&process.env.CLOUDFLARE_API_TOKEN){
    const endpoint='https://api.cloudflare.com/client/v4/accounts/'+config.account_id+
      '/workers/scripts/'+config.name+'/secrets/BRAINUP_TRANSFER_PRIVATE';
    const removed=await fetch(endpoint,{method:'DELETE',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}});
    if(!removed.ok&&removed.status!==404)console.warn('Temporary secret cleanup returned HTTP',removed.status);
  }

  const publicSite = new URL('/', config.vars.APP_ORIGIN);
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
          return;
        }
      }
    } catch {
      // Allow the deployment to propagate before trying again.
    }
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 4_000));
  }
  throw Error('Worker опубликован, но проверка публичной страницы или серверного входа через Telegram не прошла.');
});
