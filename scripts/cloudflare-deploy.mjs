import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

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
