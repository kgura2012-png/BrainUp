import {readBrainupState, saveBrainupState} from './state-storage.mjs';
import {supportSchema} from './support.mjs';
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

function brainupTransferReply(body, status = 200) {
  return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

export async function handleBrainupDatabaseTransfer(request, db, transfer) {
  if (!['GET','POST'].includes(request.method)) return new Response('Method not allowed',{status:405});
  if (!await mayAccessBrainupTransfer(request, transfer)) return new Response('Forbidden',{status:403});
  if (!db) return new Response('Unavailable',{status:503});
  const row = await readBrainupState(db);
  if (!row) return brainupTransferReply({ok:true,empty:true},request.method==='GET'?200:409);
  const current = JSON.parse(row.data);
  if (request.method === 'GET') return migrationBackup(db, {id:current.owner}, row);

  let payload;
  try {
    const body = await request.text();
    if (body.length > 8_000_000) return brainupTransferReply({ok:false,error:'payload_too_large'},413);
    payload = JSON.parse(body);
  } catch {
    return brainupTransferReply({ok:false,error:'invalid_payload'},400);
  }
  const {expectedRevision, sourceHash, state, support} = payload || {};
  if (!Number.isSafeInteger(expectedRevision) || !/^[a-f0-9]{64}$/.test(sourceHash || '')
      || !state?.users || Array.isArray(state.users) || !Array.isArray(state?.config?.cases)
      || !support || Object.keys(support).length !== Object.keys(BACKUP_TABLES).length) {
    return brainupTransferReply({ok:false,error:'invalid_payload'},400);
  }
  if (current.legacyImport?.hash === sourceHash) {
    return brainupTransferReply({ok:true,alreadyImported:true,players:Object.keys(current.users).length,revision:row.revision});
  }
  if (expectedRevision !== row.revision) return brainupTransferReply({ok:false,error:'revision_conflict'},409);
  if (state.owner !== current.owner || Object.keys(current.users).some(id => !Object.hasOwn(state.users,id))
      || Object.entries(state.users).some(([id,user]) => user?.id !== id ||
        user.balance !== 0 || !Array.isArray(user.inv) || user.inv.length !== 0)) {
    return brainupTransferReply({ok:false,error:'invalid_users'},422);
  }

  for (const [table,columns] of Object.entries(BACKUP_TABLES)) {
    if (!Array.isArray(support[table]) || support[table].some(row =>
        !row || Object.keys(row).length !== columns.length || columns.some(col => !Object.hasOwn(row,col)))) {
      return brainupTransferReply({ok:false,error:'invalid_support_rows'},422);
    }
  }

  await supportSchema(db);
  state.legacyImport = {hash:sourceHash, at:Date.now()};
  const saved = await saveBrainupState(db,row.revision,state,manifest =>
    Object.entries(BACKUP_TABLES).map(([table,columns]) => {
      const values = columns.map(column => "json_extract(value, '$." + column + "')").join(', ');
      const sql = 'INSERT OR IGNORE INTO ' + table + ' (' + columns.join(', ') + ') SELECT ' + values +
        ' FROM json_each(?) WHERE EXISTS (SELECT 1 FROM site_state WHERE id = 1 AND data = ?)';
      return db.prepare(sql).bind(JSON.stringify(support[table]),manifest);
    }));
  if (!saved.meta.changes) return brainupTransferReply({ok:false,error:'revision_conflict'},409);
  return brainupTransferReply({ok:true,players:Object.keys(state.users).length,revision:row.revision+1});
}
