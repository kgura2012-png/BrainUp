import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const database = config.d1_databases.find(db => db.binding === 'DB');
if (!database?.database_id || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(database.database_id)) {
  throw Error('Сначала создайте D1 и укажите настоящий database_id в wrangler.jsonc.');
}
const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
function run(args, capture = false) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', encoding: 'utf8'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr || 'Проверка D1 не прошла.\n');
    process.exit(result.status || 1);
  }
  return result.stdout;
}
function resultsFor(statement) {
  const output = run(['d1', 'execute', 'DB', '--remote', '--json', '--command', statement], true);
  const result = JSON.parse(output)[0];
  if (!result?.success || !Array.isArray(result.results)) {
    throw Error('Не удалось проверить перенесённую базу D1.');
  }
  return result.results;
}

// The import applies the schema. A build before the import only reads D1.
const [tables] = resultsFor(
  "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND name IN ('site_state', 'site_state_parts')"
);
let stateCount = 0;
if (tables.count === 2) {
  const [state] = resultsFor([
    "SELECT COUNT(*) AS count FROM site_state s WHERE s.id = 1 AND CASE",
    "WHEN s.data LIKE 'brainup-segments:%' THEN",
    "(SELECT COUNT(*) FROM site_state_parts p WHERE p.state_key = substr(s.data, 18, 36)) = CAST(substr(s.data, 55) AS INTEGER) AND CAST(substr(s.data, 55) AS INTEGER) > 0",
    "WHEN json_valid(s.data) THEN json_type(s.data, '$.users') = 'object'",
    "ELSE FALSE END"
  ].join(' '));
  stateCount = state.count;
}
if (stateCount !== 0 && stateCount !== 1) {
  throw Error('Не удалось подтвердить состояние базы D1.');
}
const waitingForImport = stateCount === 0;
if (waitingForImport) {
  console.log('База ещё не готова. Публикуем страницу переноса.');
}
run(['deploy', '--var', 'BRAINUP_MIGRATION_PENDING:' + waitingForImport, '--var', 'MIGRATION_READ_ONLY:' + waitingForImport]);
