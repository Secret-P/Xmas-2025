import test from "node:test";
import assert from "node:assert/strict";
import { watchFamilyList, selectGifts } from "../family-list.js";
import { safeLink } from "../gift-row.js";

function fixture() {
  let parent, errors = 0;
  const children = new Map(), results = [];
  const stop = watchFamilyList({
    watchItems(next, error) { parent = { next, error }; return () => {}; },
    watchGivers(id, next, error) {
      const sub = { next, error, stopped: false };
      children.set(id, sub);
      return () => { sub.stopped = true; };
    },
    publish: value => results.push(value), failed: () => errors++
  });
  return { parent, children, results, stop, get errors() { return errors; } };
}

test("rapid switches reject late items, purchases, notes and errors from earlier selections", () => {
  let previous;
  for (let i = 0; i < 300; i++) {
    const list = fixture();
    list.parent.next([{ id: "gift-" + i }]);
    if (previous) {
      const count = previous.results.length;
      previous.parent.next([{ id: "stale" }]);
      previous.children.values().next().value.next([{ note: "wrong list" }]);
      previous.parent.error(new Error());
      assert.equal(previous.results.length, count);
      assert.equal(previous.errors, 0);
    }
    if (i % 2 === 0) {
      list.children.get("gift-" + i).next([]);
      assert.deepEqual(list.results.at(-1), [{ id: "gift-" + i, givers: [] }]);
    } else assert.equal(list.results.at(-1), null);
    list.stop();
    previous = list;
  }
});

test("overlapping same-recipient snapshots use the latest parent and active child generation", () => {
  const f = fixture();
  f.parent.next([{ id: "a" }, { id: "b" }]);
  const oldA = f.children.get("a");
  f.parent.next([{ id: "b", name: "updated" }]);
  assert.ok(oldA.stopped);
  f.parent.next([{ id: "b", name: "latest" }, { id: "a", name: "re-added" }]);
  f.children.get("b").next([{ id: "kim", purchased: true }]);
  oldA.next([{ id: "stale" }]);
  oldA.error(new Error());
  assert.equal(f.results.at(-1), null);
  assert.equal(f.errors, 0);
  f.children.get("a").next([]);
  assert.deepEqual(f.results.at(-1).map(i => [i.name, i.givers.length]), [["latest",1],["re-added",0]]);
  f.children.get("b").next([{ id: "kim", note: "changed" }]);
  assert.equal(f.results.at(-1)[0].givers[0].note, "changed");
  f.parent.next([]);
  assert.deepEqual(f.results.at(-1), []);
  f.stop();
});

test("active child failure never publishes a false available row", () => {
  const f = fixture();
  f.parent.next([{id:"a"}]);
  f.children.get("a").error(new Error("permission denied"));
  assert.equal(f.errors, 1);
  assert.equal(f.results.at(-1), null);
  f.stop();
});

test("purchase filters and ordering preserve source order and legacy multiple buyers", () => {
  const p = { id:"p", givers:[{purchased:false},{purchased:true}] };
  const a = { id:"a", givers:[{note:"order later"}] };
  assert.deepEqual(selectGifts([p,a], "all", true), [a,p]);
  assert.deepEqual(selectGifts([p,a], "all", false), [p,a]);
  assert.deepEqual(selectGifts([p,a], "available", true), [a]);
  assert.deepEqual(selectGifts([p,a], "purchased", true), [p]);
});

test("legacy missing, malformed and unsafe product links are omitted", () => {
  for (const value of [undefined, null, "", "example.com/bad", "javascript:void(0)", "data:text/plain,test"]) assert.equal(safeLink(value), "");
  assert.equal(safeLink("https://example.com/gift"), "https://example.com/gift");
});
