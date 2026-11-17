"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./harness");

const KEY = "fittrack.data.v2";
const J = (v) => JSON.parse(JSON.stringify(v));
const app = (program = {}) =>
  load(["store.js", "macros.js", "core.js", "calendar.js"], {
    storage: { [KEY]: JSON.stringify({ program, strength: {}, rev: 1 }) },
  });
const base = (extra = {}) => ({ start: "2026-01-05", initialWeight: 85, weeks: {}, sessions: [], diary: {}, ...extra });

test("r110: la meta es 1 kg por semana aunque haya una meta guardada (85 kg, 8 semanas → 77 kg)", () => {
  const p = base({ goals: { kg: 5 } });
  const { FitCore } = app(p);
  const rows = FitCore.series(p);
  assert.equal(rows.length, 9);
  assert.equal(rows.at(-1).target, 77);
  assert.equal(FitCore.goals().kg, 8);
});

test("trayectoria con 12 semanas termina en la meta en la semana 12", () => {
  const p = base({ goals: { kg: 6 }, weeksCount: 12 });
  const { FitCore } = app(p);
  const rows = FitCore.series(p);
  assert.equal(rows.length, 13);
  assert.equal(rows[6].target, 79);
  assert.equal(rows[12].target, 73);
});

test("r110: con 1 kg por semana el déficit diario necesario es 1.100 kcal en cualquier duración", () => {
  assert.equal(app(base({ goals: { kg: 10 } })).FitCore.NEEDED, 1100);
  assert.equal(app(base({ weeksCount: 12 })).FitCore.NEEDED, 1100);
});

test("r110: perfil → IMC, gasto en reposo (Mifflin-St Jeor), consumo sugerido y proteína", () => {
  const p = base({ weeksCount: 8, profile: { sex: "M", birth: "1990-06-01", height: 180, activity: 1.725 } });
  const { FitCore } = app(p);
  const r = FitCore.profileCalc(p, { today: "2026-11-17" });
  assert.equal(r.age, 36);
  assert.equal(r.goalWeight, 77);
  assert.equal(r.bmi, 26.2);
  assert.equal(r.bmr, 10 * 85 + 6.25 * 180 - 5 * 36 + 5);
  assert.equal(r.tdee, Math.round(r.bmr * 1.725));
  assert.equal(r.suggestedKcal, Math.round((r.tdee - 1100) / 50) * 50);
  assert.deepEqual(J(r.protein), [123, 154]);
  assert.ok(r.warnings.some((w) => /agresivo/.test(w)));
  // Sin consumo guardado, la meta diaria usa el sugerido; con uno guardado, manda el guardado.
  assert.equal(FitCore.goals().kcal, r.suggestedKcal);
  assert.equal(app(base({ ...p, goals: { kcal: 1800 } })).FitCore.goals().kcal, 1800);
});

test("r110: perfil incompleto → sin cálculos ni cambio de consumo", () => {
  const p = base({ profile: { sex: "M" } });
  const { FitCore } = app(p);
  assert.equal(FitCore.profileCalc(p).bmr, null);
  assert.equal(FitCore.goals().kcal, 1800);
});

test("r110: semana tipo por defecto y validación", () => {
  const { FitCore } = app(base());
  assert.deepEqual(J(FitCore.weekPlan({}).map((d) => d.r)), [1, 2, 3, 1, 2, 0, 0]);
  const custom = FitCore.DEFAULT_WEEK.map((d, i) => ({ ...d, r: i === 3 ? 2 : d.r }));
  assert.equal(FitCore.weekPlan({ weekPlan: custom })[3].r, 2);
  assert.doesNotThrow(() => FitCore.validate(base({ weekPlan: custom, profile: { sex: "F", height: 165 } })));
  assert.throws(() => FitCore.validate(base({ weekPlan: [{ r: 9 }] })), /Semana tipo/);
  assert.throws(() => FitCore.validate(base({ profile: { height: 20 } })), /Estatura/);
});

test("peso real semanal = promedio de las pesadas", () => {
  const p = base({ weeks: { 2: { weight1: "84", weight2: "83", weight3: "" } } });
  const rows = app(p).FitCore.series(p);
  assert.equal(rows[2].actual, 83.5);
  assert.equal(rows[1].actual, null);
});

test("balance confirmado solo con día cerrado y Whoop", () => {
  const { FitCore } = app();
  assert.equal(FitCore.confirmed({ closed: true, whoop: 2500, meals: [{ kcal: 1800 }] }), 700);
  assert.equal(FitCore.confirmed({ closed: false, whoop: 2500, meals: [{ kcal: 1800 }] }), null);
  assert.equal(FitCore.confirmed({ closed: true, meals: [{ kcal: 1800 }] }), null);
  assert.equal(FitCore.confirmed({ closed: true, whoop: 2500, meals: [] }), null);
});

test("calendario: semanas según la duración", () => {
  const c8 = app(base());
  assert.equal(J(c8.FitCalendar.position("2026-01-05", "2026-03-01")).week, 8);
  assert.equal(c8.FitCalendar.position("2026-01-05", "2026-03-02"), null);
  const c12 = app(base({ weeksCount: 12 }));
  assert.equal(J(c12.FitCalendar.position("2026-01-05", "2026-03-02")).week, 9);
  assert.equal(c12.FitCalendar.date("2026-01-05", 2, 3), "2026-01-15");
});

test("validación: rechaza Whoop no numérico, IDs inseguros y semanas fuera de rango", () => {
  const { FitCore } = app();
  assert.throws(() => FitCore.validate(base({ diary: { "2026-01-05": { meals: [], whoop: "basura" } } })), /Valor diario/);
  assert.throws(() => FitCore.validate(base({ customFoods: [{ id: 'x" onpointerenter="a', name: "x", category: "c", unit: "g", base: 100, kcal: 1 }] })), /Alimento/);
  assert.throws(() => FitCore.validate(base({ weeksCount: 20 })), /Duración/);
  assert.throws(() => FitCore.validate(base({ challenges: { 17: { goals: [], logs: [] } } })), /retos/);
  assert.doesNotThrow(() => FitCore.validate(base({ weeksCount: 12, challenges: { 12: { goals: [], logs: [] } } })));
});

test("validación: suplemento y ciclos", () => {
  const { FitCore } = app();
  assert.doesNotThrow(() => FitCore.validate(base({ supplement: { name: "Vitamina D", dose: "1 al día", show: true } })));
  assert.throws(() => FitCore.validate(base({ supplement: { name: 3 } })), /Suplemento/);
  const cycle = { id: "c1", start: "2025-10-01", end: "2025-11-25", weeks: 8, initialWeight: 90, finalWeight: 86, program: {}, strength: {} };
  assert.doesNotThrow(() => FitCore.validate(base({ cycles: [cycle] })));
  assert.throws(() => FitCore.validate(base({ cycles: [{ ...cycle, start: "ayer" }] })), /Ciclo/);
});

test("metas: proteína 0 por defecto (sin meta) y se puede configurar", () => {
  assert.equal(app(base()).FitCore.goals().protein, 0);
  assert.equal(app(base({ goals: { protein: 150 } })).FitCore.goals().protein, 150);
});

test("macros: escalado proporcional y desconocido ≠ cero", () => {
  const { FitMacros } = app();
  const food = { base: 100, protein: 20, carbs: null, fat: 5, fiber: 0 };
  assert.deepEqual(J(FitMacros.scaled(food, 150)), { protein: 30, carbs: null, fat: 7.5, fiber: 0 });
  assert.deepEqual(J(FitMacros.sum([{ protein: 10, carbs: 1, fat: 1, fiber: 1 }, { protein: 5, carbs: null, fat: 1, fiber: 0 }])), { protein: 15, carbs: null, fat: 2, fiber: 1 });
});
