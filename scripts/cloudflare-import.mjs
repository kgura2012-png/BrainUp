import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {withCloudflareConfig, wranglerCli} from './cloudflare-config.mjs';
import {brainupSegmentManifest, splitBrainupState} from '../server/state-storage.mjs';

const [file, sqlOnly, destination] = process.argv.slice(2);
if (!file || (sqlOnly && (sqlOnly !== '--sql-only' || !destination))) {
  throw Error('Использование: npm run cf:db:import -- <резервная-копия.json> [--sql-only <закрытый-файл.sql>]');
}
const backup = JSON.parse(await readFile(file, 'utf8'));
const columns = {
  site_state: ['id', 'revision', 'data'],
  support_payments: ['id', 'user_id', 'stars', 'status', 'invoice_url', 'checkout_query', 'created_at', 'expires_at'],
  support_receipts: ['charge_id', 'payment_id', 'user_id', 'stars', 'paid_at', 'refunded_at']
};
function hasFields(row, fields) {
  return row && Object.keys(row).sort().join() === [...fields].sort().join();
}
if (backup.format !== 'brainup-d1-backup' || backup.version !== 1 || !hasFields(backup.tables, Object.keys(columns))) {
  throw Error('Неподдерживаемый формат резервной копии.');
}
const [state] = backup.tables.site_state;
if (backup.tables.site_state.length !== 1 || !hasFields(state, columns.site_state) || state.id !== 1
    || !Number.isSafeInteger(state.revision) || state.revision < 0 || typeof state.data !== 'string') {
  throw Error('Состояние сайта повреждено.');
}
const users = JSON.parse(state.data)?.users;
if (!users || typeof users !== 'object' || Array.isArray(users)) throw Error('В состоянии сайта отсутствуют аккаунты.');

function literal(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && !value.includes('\x00')) return "'" + value.replaceAll("'", "''") + "'";
  throw Error('Недопустимое значение в резервной копии.');
}

const key = randomUUID();
const parts = splitBrainupState(state.data);
const manifest = brainupSegmentManifest(key, parts.length);
const sql = ['CREATE TABLE brainup_import_pieces (ordinal INTEGER PRIMARY KEY, data TEXT NOT NULL);'];
for (const [ordinal, part] of parts.entries()) {
  // Each source statement is limited to 100 KB, including quotes.
  for (const [position, piece] of part.match(/[\s\S]{1,16000}/gu).entries()) {
    sql.push(`INSERT INTO brainup_import_pieces VALUES (${position}, ${literal(piece)});`);
  }
  sql.push(
    `INSERT INTO site_state_parts (state_key, ordinal, data) SELECT '${key}', ${ordinal}, group_concat(data, '' ORDER BY ordinal) FROM brainup_import_pieces;`,
    'DELETE FROM brainup_import_pieces;'
  );
}
sql.push('DROP TABLE brainup_import_pieces;');
for (const [table, fields] of Object.entries(columns)) {
  if (table === 'site_state') continue;
  if (!Array.isArray(backup.tables[table])) throw Error('Таблица отсутствует: ' + table);
  for (const row of backup.tables[table]) {
    if (!hasFields(row, fields)) throw Error('Неверные столбцы: ' + table);
    sql.push('INSERT INTO ' + table + ' (' + fields.join(', ') + ') VALUES (' + fields.map(field => literal(row[field])).join(', ') + ');');
  }
}
sql.push(`INSERT INTO site_state (id, revision, data) VALUES (1, ${state.revision}, '${manifest}');`);
if (sql.some(statement => Buffer.byteLength(statement) > 100000)) {
  throw Error('Одна из строк резервной копии превышает допустимый размер SQL для D1.');
}
const payload = sql.join('\n') + '\n';
if (sqlOnly) {
  await writeFile(destination, payload, {mode: 0o600, flag: 'wx'});
  console.log('Подготовлен закрытый SQL-файл. Запись в Cloudflare не выполнялась.');
  process.exit(0);
}
await withCloudflareConfig(async (_config, configFile) => {
  function wrangler(args) {
    const response = spawnSync(process.execPath, [wranglerCli, ...args, '--config', configFile], {
      stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
    });
    if (response.error) throw response.error;
    if (response.status !== 0) throw Error('Wrangler не выполнил команду ' + args.slice(0, 2).join(' ') + '. Проверьте вход, настройки D1 и права доступа.');
    return response.stdout;
  }
  function query(statement) {
    return JSON.parse(wrangler(['d1', 'execute', 'DB', '--remote', '--json', '--command', statement]))[0]?.results;
  }
  wrangler(['d1', 'migrations', 'apply', 'DB', '--remote']);
  const counts = 'SELECT (SELECT COUNT(*) FROM site_state) AS state_count, (SELECT COUNT(*) FROM site_state_parts) AS part_count, (SELECT COUNT(*) FROM support_payments) AS payments_count, (SELECT COUNT(*) FROM support_receipts) AS receipts_count';
  const empty = query(counts)?.[0];
  if (!empty || Object.values(empty).some(n => n !== 0)) {
    throw Error('Импорт разрешён только в пустую базу. Существующие данные сохранены.');
  }
  const tempDir = await mkdtemp(path.join(tmpdir(), 'brainup-d1-import-'));
  try {
    const tempFile = path.join(tempDir, 'import.sql');
    await writeFile(tempFile, payload, {mode: 0o600});
    wrangler(['d1', 'execute', 'DB', '--remote', '--file', tempFile]);
  } finally {
    await rm(tempDir, {recursive: true, force: true});
  }
  const actual = query(counts)?.[0];
  if (actual?.state_count !== 1 || actual.part_count !== parts.length
      || actual.payments_count !== backup.tables.support_payments.length
      || actual.receipts_count !== backup.tables.support_receipts.length) {
    throw Error('Проверка числа записей после импорта не прошла.');
  }
  const imported = query('SELECT revision, data FROM site_state WHERE id = 1')?.[0];
  if (imported?.revision !== state.revision || imported.data !== manifest) throw Error('Ревизия после импорта не совпала.');
  const hash = data => createHash('sha256').update(data).digest('hex');
  for (const [ordinal, part] of parts.entries()) {
    const saved = query(`SELECT data FROM site_state_parts WHERE state_key = '${key}' AND ordinal = ${ordinal}`)?.[0]?.data;
    if (typeof saved !== 'string' || hash(saved) !== hash(part)) throw Error('Проверка содержимого состояния после импорта не прошла.');
  }
  console.log('Импорт проверен: данные аккаунтов совпали побайтно, платежи и чеки сверены по количеству.');
});
