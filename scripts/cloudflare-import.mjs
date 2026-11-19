import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const file=process.argv[2];
if(!file)throw Error('Использование: npm run cf:db:import -- /закрытый/путь/brainup-backup.json');
const backup=JSON.parse(await readFile(file,'utf8'));
const columns={site_state:['id','revision','data'],support_payments:['id','user_id','stars','status','invoice_url','checkout_query','created_at','expires_at'],support_receipts:['charge_id','payment_id','user_id','stars','paid_at','refunded_at']};
if(backup.format!=='brainup-d1-backup'||backup.version!==1||Object.keys(backup.tables||{}).sort().join()!==Object.keys(columns).sort().join())throw Error('Неподдерживаемый формат резервной копии.');
const stateRows=backup.tables.site_state;
if(!Array.isArray(stateRows)||stateRows.length!==1||stateRows[0].id!==1||!Number.isSafeInteger(stateRows[0].revision)||stateRows[0].revision<0||typeof JSON.parse(stateRows[0].data).users!=='object')throw Error('Состояние сайта повреждено.');
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
if(config.d1_databases[0].database_id==='00000000-0000-0000-0000-000000000000')throw Error('Укажите database_id новой базы.');
const cli=new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url).pathname;
function run(args,capture=false){const r=spawnSync(process.execPath,[cli,...args],{stdio:capture?['ignore','pipe','pipe']:'inherit',encoding:'utf8'});if(r.error)throw r.error;if(r.status!==0){if(capture)process.stderr.write(r.stderr||'Проверка D1 не прошла.\n');process.exit(r.status||1)}return r.stdout;}
const counts='SELECT (SELECT COUNT(*) FROM site_state) AS state_count, (SELECT COUNT(*) FROM support_payments) AS payments_count, (SELECT COUNT(*) FROM support_receipts) AS receipts_count';
const empty=JSON.parse(run(['d1','execute','DB','--remote','--json','--command',counts],true))[0]?.results?.[0];
if(!empty||Object.values(empty).some(n=>n!==0))throw Error('Импорт разрешён только в пустую подготовленную базу. Существующие данные не перезаписаны.');
const literal=value=>{if(value===null)return 'NULL';if(typeof value==='number'&&Number.isFinite(value))return String(value);if(typeof value==='string')return "'"+value.replaceAll("'","''")+"'";throw Error('Недопустимое значение в резервной копии.');};
const statements=[];
for(const [table,fields] of Object.entries(columns)){
  if(!Array.isArray(backup.tables[table]))throw Error('Таблица отсутствует: '+table);
  for(const row of backup.tables[table]){
    if(Object.keys(row).sort().join()!==[...fields].sort().join())throw Error('Неверные столбцы: '+table);
    statements.push('INSERT INTO '+table+' ('+fields.join(',')+') VALUES ('+fields.map(f=>literal(row[f])).join(',')+');');
  }
}
const dir=path.resolve('.cloudflare-local');await mkdir(dir,{recursive:true,mode:0o700});
const sql=path.join(dir,'import.sql');await writeFile(sql,statements.join('\n')+'\n',{mode:0o600});
run(['d1','execute','DB','--remote','--file',sql]);
const actual=JSON.parse(run(['d1','execute','DB','--remote','--json','--command',counts],true))[0]?.results?.[0];
if(actual?.state_count!==1||actual.payments_count!==backup.tables.support_payments.length||actual.receipts_count!==backup.tables.support_receipts.length)throw Error('Количество записей после импорта не совпало. Переключать сайт пока нельзя.');
const state=JSON.parse(run(['d1','execute','DB','--remote','--json','--command','SELECT revision, length(data) AS data_length FROM site_state WHERE id=1'],true))[0]?.results?.[0];
// SQLite length counts Unicode code points, whereas JS length counts UTF-16 units.
if(state?.revision!==stateRows[0].revision||state.data_length!==[...stateRows[0].data].length)throw Error('Проверка ревизии и размера состояния не прошла.');
console.log('Импорт проверен: все три таблицы перенесены, ревизия и размер состояния совпали.');
