import {fresh} from './model.mjs';
import {readBrainupState, saveBrainupState} from './state-storage.mjs';

export function applyCaseCatalogRecovery(config, recovery, seed) {
  if (!recovery || config.caseCatalogRecoveryRevision === recovery.revision) return false;
  const current = config.cases;
  const byId = new Map(current.map(entry => [entry.id, entry]));
  const presets = new Map(seed.cases.map(entry => [entry.id, entry]));
  const archived = new Set(recovery.deletedCaseIds);
  const replaced = new Set();
  const normalizeName = name => String(name).trim().toLocaleLowerCase('ru');
  const lastUsedId = Math.max(...byId.keys(), ...archived, ...recovery.cases.map(entry => entry.id));
  let nextId = Math.max(config.cnid || 0, recovery.nextCaseId, lastUsedId + 1);

  const recovered = recovery.cases.map(entry => {
    const occupying = byId.get(entry.id);
    const sameCase = occupying && (entry.bonusKey && entry.bonusKey === occupying.bonusKey ||
      normalizeName(entry.name) === normalizeName(occupying.name));
    if (!sameCase) {
      const existing = current.find(other => normalizeName(other.name) === normalizeName(entry.name));
      if (existing && !replaced.has(existing.id)) {
        replaced.add(existing.id);
        return existing;
      }
      return {...structuredClone(entry), id:occupying ? nextId++ : entry.id};
    }
    replaced.add(occupying.id);
    const copy = structuredClone(entry);
    if (occupying.rewardOdds && occupying.bonusKey === entry.bonusKey &&
        occupying.drops.length === entry.drops.length && entry.drops.every(id => occupying.drops.includes(id))) {
      copy.rewardOdds = occupying.rewardOdds;
    }
    return copy;
  });

  const remaining = current.filter(entry => {
    if (replaced.has(entry.id)) return false;
    const preset = presets.get(entry.id);
    return !(archived.has(entry.id) && preset && !entry.imageOverride && !entry.rewardOdds &&
      entry.name === preset.name && entry.price === preset.price &&
      (entry.sectionId == null || entry.sectionId === preset.sectionId) &&
      JSON.stringify(entry.drops) === JSON.stringify(preset.drops));
  });
  config.cases = [...recovered, ...remaining];
  const activeIds = new Set(config.cases.map(entry => entry.id));
  config.delp = [...new Set([...(config.delp || []), ...archived])].filter(id => !activeIds.has(id));
  config.cnid = nextId;
  const sections = new Map(recovery.caseSections.map(section => [section.id, section]));
  for (const section of config.caseSections || []) {
    if (!sections.has(section.id)) sections.set(section.id, section);
  }
  config.caseSections = Array.from(sections.values());
  config.caseCatalogRecoveryRevision = recovery.revision;
  return true;
}

export async function restoreBrainupCaseCatalog(db, recovery, seed) {
  if (!db || !recovery) return;
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await readBrainupState(db);
    const state = row ? JSON.parse(row.data) : fresh(seed, 'telegram-admin-pending');
    if (!applyCaseCatalogRecovery(state.config, recovery, seed)) return;
    const result = row
      ? await saveBrainupState(db, row.revision, state)
      : await db.prepare('INSERT OR IGNORE INTO site_state (id, revision, data) VALUES (1, 0, ?)').bind(JSON.stringify(state)).run();
    if (result.meta.changes) return;
  }
  throw Error('Не удалось применить восстановление каталога BrainUp.');
}

export async function handleCaseCatalogRecovery(request, env, recovery, seed) {
  if (request.method !== 'POST') return new Response('Method not allowed', {status:405});
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN || env.MIGRATION_READ_ONLY === 'true') {
    return new Response('Unavailable', {status:503});
  }
  const proof = /^([0-9]{10})\.([a-f0-9]{64})$/.exec(request.headers.get('X-BrainUp-Catalog-Proof') || '');
  if (!proof || Math.abs(Date.now() / 1000 - Number(proof[1])) > 60) return new Response('Forbidden', {status:403});
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.TELEGRAM_BOT_TOKEN),
    {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
  const signature = Uint8Array.from(proof[2].match(/../g), byte => parseInt(byte,16));
  const message = encoder.encode('brainup-case-catalog:' + recovery.revision + ':' + proof[1]);
  if (!await crypto.subtle.verify('HMAC', key, signature, message)) return new Response('Forbidden', {status:403});

  await restoreBrainupCaseCatalog(env.DB, recovery, seed);
  return Response.json({ok:true, revision:recovery.revision}, {headers:{'Cache-Control':'no-store'}});
}
