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
// A migration must never silently launch a fresh, empty set of user accounts.
const output = run(['d1', 'execute', 'DB', '--remote', '--json', '--command',
  'SELECT COUNT(*) AS state_count FROM site_state WHERE id = 1 AND json_valid(data) AND json_type(data, \'$.users\') = \'object\''], true);
let result;
try { result = JSON.parse(output); } catch { throw Error('Не удалось проверить перенесённую базу D1.'); }
if (result?.[0]?.results?.[0]?.state_count !== 1) {
  throw Error('В D1 нет перенесённого состояния сайта. Импортируйте полный production-бэкап перед публикацией.');
}
run(['deploy']);
