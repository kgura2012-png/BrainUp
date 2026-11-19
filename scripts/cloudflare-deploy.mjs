import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
  const webhook = new URL('/telegram/webhook', publicSite);
  const token = process.env.WORKERS_CI === '1' ? process.env.TELEGRAM_BOT_TOKEN?.trim() : undefined;
  const deploy = ['deploy', '--var', 'BRAINUP_MIGRATION_PENDING:false', '--var', 'MIGRATION_READ_ONLY:false'];

  async function botApi(method, body = {}) {
    try {
      const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
        redirect:'error', signal:AbortSignal.timeout(12_000)
      });
      const result = await response.json();
      if (response.ok && result.ok) return result.result;
      console.error('Telegram отклонил ' + method + '. HTTP ' + response.status);
    } catch {
      console.error('Telegram недоступен при вызове ' + method + '.');
    }
    throw Error('Не удалось выполнить Telegram ' + method + '.');
  }

  if (process.env.WORKERS_CI === '1' && !token) throw Error('В сборке отсутствует секрет TELEGRAM_BOT_TOKEN.');
  let webhookSecret;
  let previousWebhook;
  if (token) {
    if (!/^[0-9]+:[A-Za-z0-9_-]+$/.test(token)
      || publicSite.origin !== 'https://brainup.brainupofficial.workers.dev') {
      throw Error('Проверьте секрет бота Telegram и адрес BrainUp.');
    }
    const bot = await botApi('getMe');
    if (String(bot.id) !== config.vars.TELEGRAM_BOT_ID || bot.username?.toLowerCase() !== 'brainupofficial_bot') {
      throw Error('Секрет принадлежит другому боту Telegram.');
    }
    previousWebhook = await botApi('getWebhookInfo');
    if (previousWebhook.url && ![
      'https://brainup-mobile-nov26.regalpeach22.chatgpt.site/telegram/webhook',
      'https://brainup.kgura2012.workers.dev/telegram/webhook',
      webhook.href
    ].includes(previousWebhook.url)) {
      throw Error('Бот подключён к неожиданному адресу Telegram webhook.');
    }

    webhookSecret = randomBytes(32).toString('hex');
    const directory = await mkdtemp(join(tmpdir(),'brainup-telegram-'));
    try {
      const file = join(directory, 'secrets.json');
      await writeFile(file, JSON.stringify({
        TELEGRAM_BOT_TOKEN:token,
        TELEGRAM_WEBHOOK_SECRET:webhookSecret
      }), {mode:0o600, flag:'wx'});
      run([...deploy, '--secrets-file', file]);
    } finally {
      await rm(directory, {recursive:true, force:true});
    }
  } else {
    run(deploy);
  }

  let verified = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(publicSite, {cache:'no-store', signal:AbortSignal.timeout(4_000)});
      if (response.ok && (await response.text()).includes('brainup-mobile')) {
        const invalidSignature = new URLSearchParams({hash:'0'.repeat(64),signature:'A'.repeat(86)});
        const auth = await fetch(new URL('/api/action', publicSite), {
          headers:{'X-Telegram-Init-Data':invalidSignature.toString()}, signal:AbortSignal.timeout(4_000)
        });
        if (auth.status === 401 && (await auth.json()).error === 'Неверная подпись Telegram') {
          if (token) {
            // Probe the Worker without impersonating a user or moving live updates yet.
            const ready = await fetch(new URL('/healthz', publicSite), {signal:AbortSignal.timeout(4_000)});
            if (ready.status !== 200) throw Error('Сервер ещё не готов принимать запросы Telegram.');
            const unsigned = await fetch(webhook, {
              method:'POST',headers:{'Content-Type':'application/json'},body:'{}',
              signal:AbortSignal.timeout(4_000)
            });
            const probe = await fetch(webhook, {
              method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':webhookSecret},
              body:'{}',signal:AbortSignal.timeout(4_000)
            });
            if (unsigned.status !== 403 || probe.status !== 200) throw Error('Проверка webhook BrainUp не прошла.');
          }
          console.log('Страница BrainUp доступна, сервер проверяет подпись Telegram: ' + publicSite.href);
          verified = true;
          break;
        }
      }
    } catch {
      // Allow the deployment to propagate before trying again.
    }
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 4_000));
  }
  if (!verified) throw Error('Проверка публичной страницы или серверного входа через Telegram не прошла.');
  if (token) {
    const allowedUpdates = [...new Set([
      ...(previousWebhook.allowed_updates || []), 'message', 'callback_query', 'pre_checkout_query'
    ])];
    await botApi('setWebhook', {
      url:webhook.href, secret_token:webhookSecret, allowed_updates:allowedUpdates,
      drop_pending_updates:false
    });
    if ((await botApi('getWebhookInfo')).url !== webhook.href) {
      throw Error('Telegram не подтвердил новый адрес BrainUp.');
    }
    console.log('Telegram подтвердил новый адрес webhook BrainUp.');
  }
});
