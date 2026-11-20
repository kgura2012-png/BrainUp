import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
  const deployment=['deploy','--var','BRAINUP_MIGRATION_PENDING:false','--var','MIGRATION_READ_ONLY:false'];
  if(process.env.WORKERS_CI==='1'){
    const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
    const keyFolder=mkdtempSync(join(tmpdir(),'brainup-transfer-'));
    try{
      const keyFile=join(keyFolder,'secret.json');
      writeFileSync(keyFile,JSON.stringify({
        BRAINUP_TRANSFER_PRIVATE:privateKey.export({type:'pkcs8',format:'der'}).toString('base64')
      }),{mode:0o600});
      deployment.push('--var','BRAINUP_TRANSFER_PUBLIC:'+publicKey.export({type:'spki',format:'der'}).toString('base64'),
        '--secrets-file',keyFile);
      run(deployment);
    }finally{rmSync(keyFolder,{recursive:true,force:true});}
  }else run(deployment);

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
