import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';

const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const database = config.d1_databases.find(db => db.binding === 'DB');
if (!database?.database_id || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(database.database_id)) {
  throw Error('Сначала создайте D1 и укажите настоящий database_id в wrangler.jsonc.');
}
const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

if (process.env.WORKERS_CI === '1') {
  const restoreName = 'brainup-restore';
  function wranglerJson(args) {
    const result = spawnSync(process.execPath, [cli, ...args, '--json'], {encoding: 'utf8'});
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error('Не удалось проверить отдельную базу восстановления D1.');
    return JSON.parse(result.stdout);
  }
  const findRestore = () => wranglerJson(['d1', 'list']).find(item => item.name === restoreName);
  let restore = findRestore();
  if (!restore) {
    run(['d1', 'create', restoreName]);
    restore = findRestore();
  }
  if (!restore?.uuid || restore.uuid === database.database_id) {
    throw Error('Не найден идентификатор отдельной базы восстановления.');
  }

  const scratch = await mkdtemp(path.join(tmpdir(), 'brainup-restore-'));
  const restoreConfig = path.join(scratch, 'wrangler.jsonc');
  const migrations = fileURLToPath(new URL('../cloudflare/migrations', import.meta.url));
  try {
    await writeFile(restoreConfig, JSON.stringify({d1_databases:[{
      binding:'RESTORE_DB', database_name:restoreName, database_id:restore.uuid, migrations_dir:migrations
    }]}));
    run(['d1', 'migrations', 'apply', 'RESTORE_DB', '--remote', '--config', restoreConfig]);
    const [check] = wranglerJson(['d1', 'execute', 'RESTORE_DB', '--remote', '--config', restoreConfig, '--command',
      'SELECT (SELECT COUNT(*) FROM site_state) AS players_state, (SELECT COUNT(*) FROM support_payments) AS payments, (SELECT COUNT(*) FROM support_receipts) AS receipts, (SELECT COUNT(*) FROM site_state_parts) AS parts']);
    if (!check?.success || !check.results?.[0]) throw Error('Проверка схемы базы восстановления не прошла.');
    console.log('База восстановления D1 подготовлена: ' + restoreName);
  } finally {
    await rm(scratch, {recursive:true, force:true});
  }
}

run(['d1', 'migrations', 'apply', 'DB', '--remote']);
run(['deploy', '--var', 'BRAINUP_MIGRATION_PENDING:false', '--var', 'MIGRATION_READ_ONLY:false']);

const publicSite = new URL('/', config.vars.APP_ORIGIN);
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const response = await fetch(publicSite, {cache: 'no-store', signal: AbortSignal.timeout(4_000)});
    if (response.ok && (await response.text()).includes('brainup-mobile')) {
      console.log('Страница BrainUp доступна: ' + publicSite.href);
      process.exit(0);
    }
  } catch {
    // The new deployment can take a few seconds to become available.
  }
  if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 4_000));
}
throw Error('Worker опубликован, но публичная страница BrainUp пока не открылась.');
