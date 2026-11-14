"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, memoryStorage } = require("./harness");

const KEY = "fittrack.data.v2";
const J = (v) => JSON.parse(JSON.stringify(v)); // objetos de otro contexto vm
const saved = (program, strength, rev = 1) => ({ [KEY]: JSON.stringify({ program, strength, rev }) });

test("merge3: cambios en partes distintas se combinan", () => {
  const { FitStore } = load(["store.js"]);
  const m = FitStore._merge3;
  const base = { diary: { a: 1 }, weeks: {} };
  const r = m(base, { diary: { a: 1, b: 2 }, weeks: {} }, { diary: { a: 1 }, weeks: { 1: { w: 80 } } });
  assert.equal(r.ok, true);
  assert.deepEqual(J(r.value), { diary: { a: 1, b: 2 }, weeks: { 1: { w: 80 } } });
});

test("merge3: listas con id se combinan elemento por elemento", () => {
  const { FitStore } = load(["store.js"]);
  const base = [{ id: "a", n: 1 }];
  const r = FitStore._merge3(base, [{ id: "a", n: 1 }, { id: "b", n: 2 }], [{ id: "a", n: 1 }, { id: "c", n: 3 }]);
  assert.equal(r.ok, true);
  assert.deepEqual(J(r.value.map((x) => x.id)), ["a", "c", "b"]);
});

test("merge3: borrar en una pestaña y no tocar en la otra elimina", () => {
  const { FitStore } = load(["store.js"]);
  const r = FitStore._merge3([{ id: "a" }, { id: "b" }], [{ id: "a" }], [{ id: "a" }, { id: "b" }]);
  assert.deepEqual(J(r.value), [{ id: "a" }]);
});

test("merge3: el mismo dato cambiado distinto es conflicto", () => {
  const { FitStore } = load(["store.js"]);
  const r = FitStore._merge3({ whoop: 2000 }, { whoop: 2100 }, { whoop: 2300 });
  assert.equal(r.ok, false);
  assert.equal(r.path, "/whoop");
});

test("dos pestañas: A registra comida, B fuerza → no se pierde nada", () => {
  const shared = memoryStorage(saved({ diary: {}, weeks: {}, sessions: [] }, { week: 1, weights: {} }));
  const A = load(["store.js"], { storage: shared });
  const B = load(["store.js"], { storage: shared }); // B abrió antes del cambio de A
  const pa = A.FitStore.get("program");
  pa.diary["2026-11-14"] = { meals: [{ id: "m1", kcal: 500 }] };
  A.FitStore.set("program", pa);
  const sb = B.FitStore.get("strength");
  sb.weights["x-w1"] = 100;
  assert.doesNotThrow(() => B.FitStore.set("strength", sb));
  const final = JSON.parse(shared.getItem(KEY));
  assert.equal(final.program.diary["2026-11-14"].meals[0].kcal, 500);
  assert.equal(final.strength.weights["x-w1"], 100);
  assert.equal(B.reloaded, 1, "B recarga para mostrar lo de A");
});

test("dos pestañas: las dos añaden comidas el mismo día → se guardan ambas", () => {
  const shared = memoryStorage(saved({ diary: { d: { meals: [] } }, weeks: {}, sessions: [] }, {}));
  const A = load(["store.js"], { storage: shared });
  const B = load(["store.js"], { storage: shared });
  const pa = A.FitStore.get("program");
  pa.diary.d.meals.push({ id: "a1", kcal: 300 });
  A.FitStore.set("program", pa);
  const pb = B.FitStore.get("program");
  pb.diary.d.meals.push({ id: "b1", kcal: 400 });
  B.FitStore.set("program", pb);
  assert.deepEqual(J(JSON.parse(shared.getItem(KEY)).program.diary.d.meals.map((m) => m.id)), ["a1", "b1"]);
});

test("dos pestañas: mismo dato distinto → no sobrescribe", () => {
  const shared = memoryStorage(saved({ diary: { d: { whoop: 2000 } }, weeks: {}, sessions: [] }, {}));
  const A = load(["store.js"], { storage: shared });
  const B = load(["store.js"], { storage: shared });
  const pa = A.FitStore.get("program");
  pa.diary.d.whoop = 2100;
  A.FitStore.set("program", pa);
  const pb = B.FitStore.get("program");
  pb.diary.d.whoop = 2300;
  assert.throws(() => B.FitStore.set("program", pb), (e) => e.conflict === true);
  assert.equal(JSON.parse(shared.getItem(KEY)).program.diary.d.whoop, 2100);
});

test("weeks(): 8 por defecto, respeta 4–16", () => {
  assert.equal(load(["store.js"]).FitStore.weeks(), 8);
  assert.equal(load(["store.js"], { storage: saved({ weeksCount: 12 }, {}) }).FitStore.weeks(), 12);
  assert.equal(load(["store.js"], { storage: saved({ weeksCount: 30 }, {}) }).FitStore.weeks(), 8);
});

test("datos dañados: se bloquea la escritura y se guarda cuarentena", () => {
  const ctx = load(["store.js"], { storage: { [KEY]: "{no es json" } });
  assert.equal(ctx.FitStore.isLocked(), true);
  assert.equal(ctx.localStorage.getItem(KEY + ".cuarentena"), "{no es json");
  assert.throws(() => ctx.FitStore.set("program", { a: 1 }));
});
