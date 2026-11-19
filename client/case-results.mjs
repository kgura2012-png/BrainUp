// A batch addresses inventory instances, never all copies of a catalog item.
export function createCasePrizeSeller({inventory, request, adopt}) {
  const pending = new Set();
  async function sellMany(ids) {
    ids = ids.map(Number);
    const owned = new Set(inventory().map(item => item.uid));
    if (!ids.length || new Set(ids).size !== ids.length || ids.some(uid => !Number.isSafeInteger(uid) || uid <= 0 || !owned.has(uid))) {
      throw Error('Этот предмет уже использован или продан');
    }
    if (ids.some(uid => pending.has(uid))) return null;
    ids.forEach(uid => pending.add(uid));
    try {
      const reply = await request('sell', {ids});
      adopt(reply);
      return reply.result.total;
    } finally { ids.forEach(uid => pending.delete(uid)); }
  }
  const sellPrize = uid => sellMany([uid]);
  sellPrize.sellMany = sellMany;
  return sellPrize;
}
