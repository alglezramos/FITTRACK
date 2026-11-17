// r106: ciclos del programa. Cerrar un ciclo archiva todo lo que se cuenta por semana
// (pesadas, cardio, retos, compras y fuerza) y deja el programa listo para empezar otro.
// El diario, las comidas, los alimentos, las recetas, el bienestar y las metas no se tocan:
// van por fecha y siguen visibles en el Historial.
(function (g) {
  const C = () => g.FitCore;
  const WEEK_PROGRAM = ["weeks", "sessions", "challenges", "shopping", "shoppingHave"];
  const WEEK_STRENGTH = ["weights", "completed", "completedDates", "sets", "archive", "routineByWeek", "routineByDate"];
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

  // Última semana con algún registro (para no acortar la duración por debajo de ella).
  function lastWeekWithData(p, s) {
    let max = 0;
    const bump = (w) => {
      const n = Number(w);
      if (Number.isInteger(n) && n > max) max = n;
    };
    for (const [w, d] of Object.entries(p.weeks || {}))
      if (Object.values(d || {}).some((v) => v !== "" && v != null)) bump(w);
    (p.sessions || []).forEach((x) => bump(x.week));
    for (const [w, d] of Object.entries(p.challenges || {})) if ((d.logs || []).length) bump(w);
    for (const [w, d] of Object.entries(p.shopping || {})) if (Object.keys(d || {}).length) bump(w);
    for (const k of [...Object.keys((s || {}).weights || {}), ...Object.keys((s || {}).sets || {})]) {
      const m = /-w(\d+)(?:-d\d)?$/.exec(k);
      if (m) bump(m[1]);
    }
    ((s || {}).archive || []).forEach((a) => bump(a.week));
    return max;
  }

  function summarize(p, s) {
    const F = C(),
      W = F.weeksOf(p),
      end = F.datePlus(p.start, W * 7 - 1);
    const rows = F.series(p);
    const last = rows.filter((r) => r.week > 0 && r.actual != null).at(-1);
    let deficit = 0,
      closedDays = 0;
    for (let i = 0; i < W * 7; i++) {
      const b = F.confirmed((p.diary || {})[F.datePlus(p.start, i)]);
      if (b !== null) {
        deficit += b;
        closedDays++;
      }
    }
    const km = (p.sessions || []).reduce((n, x) => {
      const d = Number(String(x.distance || "").replace(",", "."));
      return n + (Number.isFinite(d) && d > 0 ? (x.unit === "m" ? d / 1000 : d) : 0);
    }, 0);
    // Mejor carga (lb) por ejercicio en el ciclo.
    const best = {};
    for (const [k, v] of Object.entries((s || {}).weights || {})) {
      const id = k.replace(/-w\d+(?:-d\d)?$/, ""),
        n = Number(v);
      if (n > 0 && (!best[id] || n > best[id])) best[id] = n;
    }
    return {
      end,
      finalWeight: last ? Math.round(last.actual * 10) / 10 : null,
      summary: {
        deficit: Math.round(deficit),
        closedDays,
        sessions: (p.sessions || []).length,
        km: Math.round(km * 10) / 10,
        exercisesDone: Object.values((s || {}).completed || {}).filter(Boolean).length,
        best,
        goalKg: F.goals ? Number((p.goals || {}).kg) || F.DEFAULT_GOALS.kg : null,
      },
    };
  }

  // Devuelve { program, strength } nuevos; no modifica los originales.
  function close(p, s, { start, initialWeight, weeks, now = new Date().toISOString() } = {}) {
    const F = C();
    if (!F.validDate(p.start)) throw Error("El ciclo actual no tiene fecha de inicio.");
    if (!F.validDate(start)) throw Error("Elige la fecha de inicio del nuevo ciclo.");
    if (start <= p.start) throw Error("El nuevo ciclo debe empezar después del inicio del actual.");
    const iw = initialWeight === "" || initialWeight == null ? "" : Number(initialWeight);
    if (iw !== "" && !(iw >= 20 && iw <= 400)) throw Error("Peso inicial no válido.");
    const W = weeks == null ? F.weeksOf(p) : Number(weeks);
    if (!(Number.isInteger(W) && W >= 4 && W <= 16)) throw Error("Duración no válida.");
    const info = summarize(p, s);
    const entry = {
      id: "c" + Date.now().toString(36),
      start: p.start,
      end: info.end,
      weeks: F.weeksOf(p),
      initialWeight: p.initialWeight === "" ? "" : Number(p.initialWeight),
      finalWeight: info.finalWeight,
      closedAt: now,
      summary: info.summary,
      program: Object.fromEntries(WEEK_PROGRAM.map((k) => [k, clone(p[k])]).filter(([, v]) => v !== undefined)),
      strength: Object.fromEntries(WEEK_STRENGTH.map((k) => [k, clone((s || {})[k])]).filter(([, v]) => v !== undefined)),
    };
    const program = {
      ...clone(p),
      start,
      initialWeight: iw,
      weeksCount: W,
      weeks: {},
      sessions: [],
      challenges: {},
      shopping: {},
      shoppingHave: {},
      recordDay: 0,
      menuDay: 0,
      cycles: [...(p.cycles || []), entry],
    };
    const strength = { ...clone(s || {}), week: 1, day: 1, weights: {}, completed: {}, completedDates: {}, sets: {}, archive: [], routineByWeek: {}, routineByDate: {}, keysV2: true, fullBodyFrom: 1 };
    return { program, strength, entry };
  }

  // Última sesión de un ejercicio en el ciclo anterior (para sugerir la carga al empezar otro).
  function previousSession(p, id) {
    const c = (p.cycles || []).at(-1);
    if (!c || !c.strength) return null;
    const sets = c.strength.sets || {};
    // r109: claves «id-wN» (antiguas) o «id-wN-dD»; la sesión más reciente primero.
    for (let w = c.weeks; w >= 1; w--) {
      const keys = [id + "-w" + w, ...[6, 5, 4, 3, 2, 1, 0].map((d) => id + "-w" + w + "-d" + d)];
      const cand = keys.map((k) => sets[k]).filter((rows) => Array.isArray(rows) && rows.some((z) => z && (z.done || z.w > 0)));
      if (cand.length) return { week: w, sets: cand.find((rows) => rows !== sets[id + "-w" + w]) || cand[0], cycle: c };
    }
    return null;
  }

  g.FitCycles = { close, summarize, lastWeekWithData, previousSession };
})(typeof window !== "undefined" ? window : globalThis);
