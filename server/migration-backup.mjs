const BACKUP_TABLES={
  support_payments:['id','user_id','stars','status','invoice_url','checkout_query','created_at','expires_at'],
  support_receipts:['charge_id','payment_id','user_id','stars','paid_at','refunded_at']
};
export async function migrationBackup(db, identity) {
  const row=await db.prepare('SELECT id, revision, data FROM site_state WHERE id = 1').first();
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
