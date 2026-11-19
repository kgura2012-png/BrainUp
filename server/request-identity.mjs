import {telegramIdentity} from './telegram.mjs';
import {browserTelegramIdentity} from './browser-telegram.mjs';

// Only the Sites reverse proxy can attest these headers. Never enable this
// option for a Worker deployed directly to a public Cloudflare origin.
export async function requestIdentity(request, env, trustSitesIdentity = false) {
  const init = request.headers.get('X-Telegram-Init-Data');
  if (init) return telegramIdentity(init, env.TELEGRAM_BOT_TOKEN);
  const browser = await browserTelegramIdentity(request, env);
  if (browser) return browser;
  if (!trustSitesIdentity) return null;
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id) return null;
  let name = request.headers.get('oai-authenticated-user-full-name') ||
    request.headers.get('oai-authenticated-user-email')?.split('@')[0] || 'Player';
  if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { name = decodeURIComponent(name); } catch {}
  }
  return {id, name};
}
