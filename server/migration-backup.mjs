import {readBrainupState, saveBrainupState, splitBrainupState} from './state-storage.mjs';
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

function brainupTransferReply(body, status = 200) {
  return { ...body, status };
}

export async function applyRestoredBrainupTransfer(db,row,current,payload,checkpoint) {
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
  state.legacyImport = {
    hash:sourceHash, at:Date.now(), transferId:checkpoint.id, sourceRevision:checkpoint.sourceRevision,
    players:Object.keys(state.users).length
  };
  const checkpointParts=splitBrainupState(checkpoint.snapshot);
  const saved = await saveBrainupState(db,row.revision,state,manifest => [
    ...Object.entries(BACKUP_TABLES).map(([table,columns]) => {
      const values = columns.map(column => "json_extract(value, '$." + column + "')").join(', ');
      const sql = 'INSERT OR IGNORE INTO ' + table + ' (' + columns.join(', ') + ') SELECT ' + values +
        ' FROM json_each(?) WHERE EXISTS (SELECT 1 FROM site_state WHERE id = 1 AND data = ?)';
      return db.prepare(sql).bind(JSON.stringify(support[table]),manifest);
    }),
    ...checkpointParts.map((part,ordinal)=>db.prepare(
      'INSERT INTO brainup_transfer_checkpoint (transfer_id, ordinal, data) SELECT ?, ?, ? ' +
      'WHERE EXISTS (SELECT 1 FROM site_state WHERE id = 1 AND data = ?)'
    ).bind(checkpoint.id,ordinal,part,manifest))
  ]);
  if (!saved.meta.changes) return brainupTransferReply({ok:false,error:'revision_conflict'},409);
  return brainupTransferReply({ok:true,players:Object.keys(state.users).length,revision:row.revision+1});
}
