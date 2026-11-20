import {readBrainupState} from './state-storage.mjs';
import {applyRestoredBrainupTransfer,migrationBackup} from './migration-backup.mjs';
import {mergeRestoredBrainupState} from './merge-restored-state.mjs';
const sealedBackupPlan={"sign":"MCowBQYDK2VwAyEANDkW/B4lJq5so9W8DXdjAtmpJdw4hBrhJE33Roohhyk=","id":"591da1345276b0886495f4bf","expires":1795171172682};
const sealedLegacyUrl='https://brainup-mobile-nov26.regalpeach22.chatgpt.site/internal/database-transfer/sealed';
function transferBytes(encoded){return Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));}

async function brainupSealedTransferStatus(env) {
  const row=await readBrainupState(env.DB);
  const state=row?JSON.parse(row.data):null;
  const marker=state?.legacyImport;
  const imported=marker?.transferId===sealedBackupPlan.id;
  return Response.json({
    publicKey:imported?null:env.BRAINUP_TRANSFER_PUBLIC||null,imported,
    players:imported?marker.players:null,sourceRevision:imported?marker.sourceRevision:null,
    resetPlayers:imported?Object.values(state.users).filter(user=>user.balance===0&&!user.inv.length).length:null,
    revision:imported?row.revision:null
  },{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
}

async function importBrainupSealedBackup(env,incoming) {
  if(!env.DB||!env.BRAINUP_TRANSFER_PRIVATE||Date.now()>sealedBackupPlan.expires||env.MIGRATION_READ_ONLY==='true')return false;
  const row=await readBrainupState(env.DB);
  if(!row)return false;
  const current=JSON.parse(row.data);
  if(current.legacyImport?.transferId===sealedBackupPlan.id)return true;
  const response=incoming||await fetch(sealedLegacyUrl,{redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)return false;
  const text=await response.text();
  if(text.length>9_000_000)return false;
  const envelope=JSON.parse(text);
  if(envelope.id!==sealedBackupPlan.id)return false;
  const verifier=await crypto.subtle.importKey('spki',transferBytes(sealedBackupPlan.sign),'Ed25519',false,['verify']);
  const signed=new TextEncoder().encode([envelope.id,envelope.wrapped,envelope.iv,envelope.cipher].join('\n'));
  if(!await crypto.subtle.verify('Ed25519',verifier,transferBytes(envelope.signature),signed))return false;
  const unwrap=await crypto.subtle.importKey('pkcs8',transferBytes(env.BRAINUP_TRANSFER_PRIVATE),
    {name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
  const aes=await crypto.subtle.decrypt({name:'RSA-OAEP'},unwrap,transferBytes(envelope.wrapped));
  const key=await crypto.subtle.importKey('raw',aes,'AES-GCM',false,['decrypt']);
  const gzip=await crypto.subtle.decrypt({name:'AES-GCM',iv:transferBytes(envelope.iv)},key,transferBytes(envelope.cipher));
  const body=await new Response(new Blob([gzip]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  const backup=body.backup;
  if(!body.ok||backup?.format!=='brainup-d1-backup'||backup.version!==1)return false;
  const source=backup.tables.site_state[0];
  const state=mergeRestoredBrainupState(JSON.parse(source.data),current);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source.data));
  const sourceHash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  const original=await migrationBackup(env.DB,{id:current.owner},row);
  if(!original.ok)return false;
  const snapshot=await original.text();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS brainup_transfer_checkpoint (transfer_id TEXT, ordinal INTEGER, data TEXT NOT NULL, PRIMARY KEY (transfer_id, ordinal)) WITHOUT ROWID').run();
  const result=await applyRestoredBrainupTransfer(env.DB,row,current,{
    expectedRevision:row.revision,sourceHash,state,
    support:{support_payments:backup.tables.support_payments,support_receipts:backup.tables.support_receipts}
  },{id:sealedBackupPlan.id,sourceRevision:source.revision,snapshot});
  if(!result.ok&&result.status!==409)throw Error(result.error);
  return result.ok;
}
