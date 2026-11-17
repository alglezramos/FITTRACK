"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./harness");

const J = (v) => JSON.parse(JSON.stringify(v));
const K = () => load(["strength-keys.js"]).FitStrengthKeys;
const START = "2026-10-19"; // lunes
const sets = (w, d, done = true) => [1, 2, 3].map(() => ({ w, r: 10, done, d }));

test("migración: cada registro pasa a su día según la fecha de las series", () => {
  const s = {
    week: 5, day: 1,
    weights: { "a-w5": 110, "b-w2": 90 },
    completed: { "a-w5": true, "b-w2": true },
    completedDates: { "a-w5": "2026-11-16", "b-w2": "2026-10-29" },
    sets: { "a-w5": sets(110, "2026-11-16"), "b-w2": sets(90, "2026-10-29") },
    archive: [],
  };
  const { strength: m } = K().migrate(s, { start: START, fromWeek: 5 });
  assert.deepEqual(Object.keys(m.weights).sort(), ["a-w5-d0", "b-w2-d3"]);
  assert.equal(m.weights["a-w5-d0"], 110);
  assert.equal(m.completed["b-w2-d3"], true);
  assert.equal(m.completedDates["b-w2-d3"], "2026-10-29");
  assert.deepEqual(J(m.sets["a-w5-d0"]), J(s.sets["a-w5"]));
  assert.equal(m.keysV2, true);
  assert.equal(m.fullBodyFrom, 5);
  // No modifica el original.
  assert.ok("a-w5" in s.weights);
});

test("migración: sin fecha usa el día de la rutina vieja", () => {
  const s = { week: 3, day: 1, weights: { "x-w3": 50 }, completed: { "x-w3": true }, sets: {} };
  const { strength: m } = K().migrate(s, { start: START, legacyDay: { x: 3 }, fromWeek: 5 });
  assert.equal(m.weights["x-w3-d2"], 50);
  assert.equal(m.completed["x-w3-d2"], true);
});

test("migración: una sesión archivada pasa a su propio día y no se pierde", () => {
  const s = {
    week: 4, day: 1,
    weights: { "a-w4": 120 },
    completed: { "a-w4": true },
    completedDates: { "a-w4": "2026-11-09" },
    sets: { "a-w4": [{ w: 120, r: 10, done: true, d: "2026-11-12" }, { w: 120, r: 8, done: false }] },
    archive: [{ id: "a", week: 4, date: "2026-11-09", sets: sets(115, "2026-11-09") }],
  };
  const { strength: m } = K().migrate(s, { start: START, fromWeek: 5 });
  assert.equal(m.archive.length, 0);
  // Lunes 9: la sesión archivada, completa.
  assert.equal(m.weights["a-w4-d0"], 115);
  assert.equal(m.completed["a-w4-d0"], true);
  assert.equal(m.completedDates["a-w4-d0"], "2026-11-09");
  // Jueves 12: la sesión en curso, incompleta (antes contaba como hecha por la archivada).
  assert.equal(m.weights["a-w4-d3"], 120);
  assert.equal(m.completed["a-w4-d3"], false);
  assert.ok(!("a-w4-d3" in m.completedDates));
});

test("migración: segunda vez no cambia nada", () => {
  const k = K();
  const once = k.migrate({ weights: { "a-w1": 10 }, completed: {}, sets: {} }, { start: START }).strength;
  const twice = k.migrate(once, { start: START }).strength;
  assert.deepEqual(J(twice), J(once));
});

test("avance semanal: semanas nuevas = completados / (5 sesiones × ejercicios por rutina)", () => {
  const s = { fullBodyFrom: 5, completed: { "a-w5-d0": true, "a-w5-d3": true, "b-w5-d1": true, "c-w5-d1": false, "a-w4-d0": true } };
  assert.deepEqual(J(K().weekStats(s, 5, { perSession: 10, sessions: 5 })), { done: 3, total: 50 });
});

test("avance semanal: semanas viejas usan su lista guardada y ejercicios distintos", () => {
  const s = { fullBodyFrom: 5, completed: { "a-w4-d0": true, "a-w4-d3": true, "b-w4-d1": true } };
  assert.deepEqual(J(K().weekStats(s, 4, { perSession: 10, legacyIds: ["a", "b", "c", "d"] })), { done: 2, total: 4 });
});

test("ciclo anterior: encuentra la última sesión con claves por día", () => {
  const ctx = load(["store.js", "macros.js", "core.js", "calendar.js", "cycles.js"]);
  const p = { cycles: [{ weeks: 8, strength: { sets: { "a-w7-d0": sets(100, "x"), "a-w8-d1": sets(105, "y"), "a-w8-d3": sets(110, "z") } } }] };
  const r = ctx.FitCycles.previousSession(p, "a");
  assert.equal(r.week, 8);
  assert.equal(r.sets[0].w, 110);
  const legacy = { cycles: [{ weeks: 8, strength: { sets: { "a-w6": sets(90, "x") } } }] };
  assert.equal(ctx.FitCycles.previousSession(legacy, "a").sets[0].w, 90);
});
