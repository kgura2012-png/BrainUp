import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFile, writeFile, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const source = new URL('../wrangler.jsonc', import.meta.url);
export const wranglerCli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const uuidPattern = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export async function withCloudflareConfig(action) {
  const config = JSON.parse(await readFile(source, 'utf8'));
  const db = config.d1_databases?.find(database => database.binding === 'DB');
  if (!db?.database_name) throw Error('Укажите имя D1 для binding DB.');
  if (db.database_id) {
    if (!uuidPattern.test(db.database_id) || /^0+$/.test(db.database_id.replaceAll('-', ''))) {
      throw Error('Укажите действительный database_id для binding DB.');
    }
    return action(config, fileURLToPath(source));
  }

  const result = spawnSync(process.execPath, [wranglerCli, 'd1', 'list', '--json', '--config', fileURLToPath(source)], {encoding:'utf8'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error('Не удалось получить список баз D1.');
  const databases = JSON.parse(result.stdout);
  const target = databases.find(candidate => candidate.name === db.database_name);
  if (!target || !uuidPattern.test(target.uuid)) throw Error('В аккаунте нет базы D1 ' + db.database_name + '.');

  db.database_id = target.uuid;
  const resolved = new URL('../.wrangler-brainup-' + randomUUID() + '.jsonc', import.meta.url);
  await writeFile(resolved, JSON.stringify(config), {flag:'wx'});
  try {
    return await action(config, fileURLToPath(resolved));
  } finally {
    await rm(resolved, {force:true});
  }
}
