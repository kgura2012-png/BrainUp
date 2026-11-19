import {readBrainupState} from './state-storage.mjs';
const BACKUP_TABLES={
  support_payments:['id','user_id','stars','status','invoice_url','checkout_query','created_at','expires_at'],
  support_receipts:['charge_id','payment_id','user_id','stars','paid_at','refunded_at']
};
export async function migrationBackup(db, identity, row) {
  row ??= await readBrainupState(db);
  if (!row || !identity?.id || JSON.parse(row.data).owner !== identity.id) {
    return Response.json({ok:false,error:'Доступ запрещён'},{status:403,headers:{'Cache-Control':'no-store'}});
  }
  const tables={site_state:[row]};
  for (const [table,columns] of Object.entries(BACKUP_TABLES)) {
    const exists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").bind(table).first();
    if (!exists) {tables[table]=[];continue;}
    // All SQL identifiers are internal constants, never request data.
    const fields=columns.map(column=>"'"+column+"',"+column).join(',');
    const rows=await db.prepare('SELECT json_group_array(json_object('+fields+')) AS data FROM '+table).first();
    tables[table]=JSON.parse(rows?.data||'[]');
  }
  return Response.json({ok:true,backup:{format:'brainup-d1-backup',version:1,createdAt:new Date().toISOString(),tables}},
    {headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

async function mayAccessBrainupTransfer(request, transfer) {
  const auth = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') || '');
  if (!auth || Date.now() > transfer.expires) return false;
  const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(auth[1])));
  let difference = 0;
  for (let index = 0; index < actual.length; index++) {
    difference |= actual[index] ^ parseInt(transfer.hash.slice(index * 2, index * 2 + 2),16);
  }
  return difference === 0;
}

export async function readBrainupDatabaseTransfer(request, db, transfer) {
  if (request.method !== 'GET') return new Response('Method not allowed',{status:405});
  if (!await mayAccessBrainupTransfer(request, transfer)) return new Response('Forbidden',{status:403});
  if (!db) return new Response('Unavailable',{status:503});
  const row = await readBrainupState(db);
  if (!row) return Response.json({ok:true,empty:true},{headers:{'Cache-Control':'no-store'}});
  return migrationBackup(db, {id:JSON.parse(row.data).owner}, row);
}
