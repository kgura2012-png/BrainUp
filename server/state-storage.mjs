const brainupSegmentPrefix = 'brainup-segments:';
const brainupSegmentSize = 200_000;
const segmentedSiteDatabases = new WeakSet();

export function enableBrainupSegments(db) {
  if (db) segmentedSiteDatabases.add(db);
}

export function splitBrainupState(data) {
  const parts = [];
  for (let start = 0; start < data.length;) {
    let end = Math.min(start + brainupSegmentSize, data.length);
    const last = data.charCodeAt(end - 1);
    if (end < data.length && last >= 0xd800 && last <= 0xdbff) end--;
    parts.push(data.slice(start, end));
    start = end;
  }
  return parts;
}

export function brainupSegmentManifest(key, count) {
  return brainupSegmentPrefix + key + ':' + count;
}

export async function readBrainupState(db) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const row = await db.prepare('SELECT id, revision, data FROM site_state WHERE id = 1').first();
    if (!row || !row.data.startsWith(brainupSegmentPrefix)) return row;

    const [key, count] = row.data.slice(brainupSegmentPrefix.length).split(':');
    if (!/^[a-f0-9-]{36}$/.test(key) || !/^[1-9][0-9]*$/.test(count)) {
      throw Error('Некорректный указатель состояния BrainUp');
    }
    // The join reads the parts only if the same revision is still current.
    // A concurrent save releases the previous parts in the same transaction.
    const read = await db.prepare(
      'SELECT p.ordinal, p.data FROM site_state_parts p JOIN site_state s ON s.id = 1 AND s.data = ? WHERE p.state_key = ? ORDER BY p.ordinal'
    ).bind(row.data, key).all();
    if (read.results.length === Number(count) && read.results.every((part, i) => part.ordinal === i)) {
      return {...row, data: read.results.map(part => part.data).join('')};
    }
  }
  throw Error('Не удалось прочитать все части данных BrainUp');
}

export async function saveBrainupState(db, revision, state, relatedWrites) {
  const data = JSON.stringify(state);
  const update = 'UPDATE site_state SET revision = revision + 1, data = ? WHERE id = 1 AND revision = ?';
  if (!segmentedSiteDatabases.has(db)) return db.prepare(update).bind(data, revision).run();

  const parts = splitBrainupState(data);
  const key = crypto.randomUUID();
  const manifest = brainupSegmentManifest(key, parts.length);
  const commands = [db.prepare(update).bind(manifest, revision)];
  for (const [ordinal, part] of parts.entries()) {
    commands.push(db.prepare(
      'INSERT INTO site_state_parts (state_key, ordinal, data) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM site_state WHERE id = 1 AND data = ?)'
    ).bind(key, ordinal, part, manifest));
  }
  commands.push(db.prepare(
    'DELETE FROM site_state_parts WHERE state_key <> ? AND EXISTS (SELECT 1 FROM site_state WHERE id = 1 AND data = ?)'
  ).bind(key, manifest));
  if (relatedWrites) commands.push(...relatedWrites(manifest));
  const [saved] = await db.batch(commands);
  return saved;
}
