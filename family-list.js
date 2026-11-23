// Each selection owns its listeners. A removed item gets a new entry on re-add,
// so even an already-queued callback from its old subscription is harmless.
export function watchFamilyList({ watchItems, watchGivers, publish, failed }) {
  const entries = new Map();
  let order = [];
  let active = true;
  let reconciling = false;

  function publishCurrent() {
    if (!active || reconciling) return;
    const rows = order.map(id => entries.get(id));
    if (rows.some(row => row.givers === null)) {
      publish(null);
      return;
    }
    publish(rows.map(({ item, givers }) => ({ ...item, givers })));
  }

  const stopItems = watchItems(items => {
    if (!active) return;
    reconciling = true;
    order = items.map(item => item.id);
    const keep = new Set(order);
    for (const [id, entry] of entries) {
      if (!keep.has(id)) {
        entries.delete(id);
        entry.stop();
      }
    }
    for (const item of items) {
      const existing = entries.get(item.id);
      if (existing) {
        existing.item = item;
        continue;
      }
      const entry = { item, givers: null, stop: () => {} };
      entries.set(item.id, entry);
      entry.stop = watchGivers(item.id, givers => {
        if (!active || entries.get(item.id) !== entry) return;
        entry.givers = givers;
        publishCurrent();
      }, error => {
        if (active && entries.get(item.id) === entry) failed(error);
      });
    }
    reconciling = false;
    publishCurrent();
  }, error => { if (active) failed(error); });

  return () => {
    active = false;
    stopItems();
    for (const entry of entries.values()) entry.stop();
    entries.clear();
  };
}

export function selectGifts(items, filter, availableFirst) {
  const purchased = item => item.givers.some(giver => giver.purchased === true);
  const shown = items.filter(item => filter === "all" || purchased(item) === (filter === "purchased"));
  if (availableFirst) shown.sort((a, b) => Number(purchased(a)) - Number(purchased(b)));
  return shown;
}
