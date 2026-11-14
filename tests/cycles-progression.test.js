"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./harness");

const J = (v) => JSON.parse(JSON.stringify(v));
const ctx = () => load(["store.js", "macros.js", "core.js", "calendar.js", "cycles.js", "progression.js"]);
const T = { n: 3, reps: 10 };
const sets = (w, reps, done = true) => reps.map((r) => ({ w, r, done }));

test("progresión: todas las series completas → sube 5 lb (≥ 90 lb)", () => {
  const s = ctx().FitProgression.suggest([sets(100, [10, 10, 10])], T, "lb");
  assert.equal(s.action, "up");
  assert.equal(s.w, 105);
});

test("progresión: carga ligera sube 2,5 lb", () => {
  assert.equal(ctx().FitProgression.suggest([sets(30, [10, 10, 10])], T, "lb").w, 32.5);
});

test("progresión: registrando en kg sube 2,5 kg y guarda en lb", () => {
  const s = ctx().FitProgression.suggest([sets(110.2, [10, 10, 10])], T, "kg"); // ≈ 50 kg
  assert.equal(s.show, 52.5);
  assert.equal(s.w, Math.round(52.5 * 2.20462 * 10) / 10);
});

test("progresión: faltó una repetición → repite", () => {
  const s = ctx().FitProgression.suggest([sets(100, [10, 10, 8])], T, "lb");
  assert.equal(s.action, "same");
  assert.equal(s.w, 100);
});

test("progresión: dos sesiones fallidas con la misma carga → baja ~10 %", () => {
  const s = ctx().FitProgression.suggest([sets(100, [10, 8, 7]), sets(100, [10, 9, 8])], T, "lb");
  assert.equal(s.action, "down");
  assert.equal(s.w, 90);
});

test("progresión: sin series hechas → sin sugerencia", () => {
  assert.equal(ctx().FitProgression.suggest([sets(100, [10, 10, 10], false)], T, "lb"), null);
  assert.equal(ctx().FitProgression.suggest([], T, "lb"), null);
});

const program = () => ({
  start: "2026-01-05",
  initialWeight: 90,
  goals: { kg: 6 },
  weeks: { 1: { weight1: "89" }, 8: { weight1: "85", weight2: "84" } },
  sessions: [{ id: "s1", week: 2, date: "2026-01-13", mode: "Correr", distance: "5", unit: "km" }],
  diary: { "2026-01-06": { meals: [{ id: "m1", name: "Almuerzo", kcal: 1500, items: [] }], whoop: 2500, closed: true }, "2026-03-10": { meals: [{ id: "m2", name: "Cena", kcal: 1700, items: [] }] } },
  challenges: { 1: { goals: [], logs: [{ id: "l1" }] } },
  shopping: {},
  customFoods: [{ id: "arepa" }],
});
const strength = () => ({ week: 8, day: 3, inputUnit: "kg", weights: { "a-w1": 100, "a-w8": 120 }, completed: { "a-w8": true }, sets: { "a-w8": sets(120, [10, 10, 10]) }, archive: [] });

test("ciclo: archiva lo semanal y conserva diario, alimentos y metas", () => {
  const { FitCycles } = ctx();
  const r = FitCycles.close(program(), strength(), { start: "2026-03-09", initialWeight: 84.5, weeks: 12, now: "2026-03-08T10:00:00Z" });
  const p = J(r.program), s = J(r.strength), c = p.cycles[0];
  assert.equal(p.start, "2026-03-09");
  assert.equal(p.weeksCount, 12);
  assert.equal(p.initialWeight, 84.5);
  assert.deepEqual(p.weeks, {});
  assert.deepEqual(p.sessions, []);
  assert.equal(p.diary["2026-03-10"].meals[0].kcal, 1700);
  assert.equal(p.customFoods[0].id, "arepa");
  assert.equal(p.goals.kg, 6);
  assert.equal(s.week, 1);
  assert.deepEqual(s.weights, {});
  assert.equal(s.inputUnit, "kg");
  assert.equal(c.start, "2026-01-05");
  assert.equal(c.end, "2026-03-01");
  assert.equal(c.finalWeight, 84.5);
  assert.equal(c.summary.deficit, 1000);
  assert.equal(c.summary.km, 5);
  assert.equal(c.summary.best.a, 120);
  assert.equal(c.program.sessions.length, 1);
  assert.equal(c.strength.weights["a-w8"], 120);
});

test("ciclo: el resultado pasa la validación de copias", () => {
  const { FitCycles, FitCore } = ctx();
  const r = FitCycles.close(program(), strength(), { start: "2026-03-09", initialWeight: 84.5 });
  const p = J(r.program);
  p.customFoods = [];
  assert.doesNotThrow(() => FitCore.validate(p));
  assert.doesNotThrow(() => FitCore.validateStrength(J(r.strength)));
});

test("ciclo: rechaza fechas inválidas y no modifica el original", () => {
  const { FitCycles } = ctx();
  const p = program();
  assert.throws(() => FitCycles.close(p, strength(), { start: "2026-01-01" }), /después/);
  assert.throws(() => FitCycles.close(p, strength(), { start: "x" }), /fecha/);
  assert.equal(p.sessions.length, 1);
});

test("ciclo: la sugerencia del primer día usa la última sesión del ciclo anterior", () => {
  const { FitCycles } = ctx();
  const r = FitCycles.close(program(), strength(), { start: "2026-03-09", initialWeight: 84.5 });
  const prev = FitCycles.previousSession(r.program, "a");
  assert.equal(prev.week, 8);
  assert.equal(prev.sets[0].w, 120);
});

test("última semana con datos", () => {
  const { FitCycles } = ctx();
  assert.equal(FitCycles.lastWeekWithData(program(), strength()), 8);
  assert.equal(FitCycles.lastWeekWithData({ weeks: {}, sessions: [] }, {}), 0);
});
