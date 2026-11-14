// r106: sugerencia de carga para la próxima sesión (sobrecarga progresiva simple).
// - Completaste todas las series con las repeticiones objetivo → sube un escalón.
// - No las completaste → repite la carga.
// - Fallaste dos sesiones seguidas con la misma carga (o mayor) → baja ~10 %.
// Los pesos se guardan en libras; el escalón se calcula en la unidad que usas para registrar.
(function (g) {
  const KG_TO_LB = 2.20462;
  const round = (v, step) => Math.round(v / step) * step;
  const doneSets = (sets) => (sets || []).filter((z) => z && z.done && Number(z.w) > 0);
  const top = (sets) => doneSets(sets).reduce((m, z) => Math.max(m, Number(z.w)), 0);
  const hit = (sets, target) => {
    const d = doneSets(sets);
    return d.length >= target.n && d.every((z) => Number(z.r) >= target.reps);
  };
  // sessions: [más reciente, anterior, …]; cada una es la lista de series { w (lb), r, done }.
  function suggest(sessions, target, unit = "lb") {
    const last = sessions && sessions[0];
    const t = top(last);
    if (!(t > 0)) return null;
    const inKg = unit === "kg";
    const show = (lb) => (inKg ? lb / KG_TO_LB : lb);
    const toLb = (v) => (inKg ? v * KG_TO_LB : v);
    const cur = show(t);
    const step = inKg ? (cur >= 40 ? 2.5 : 1) : cur >= 90 ? 5 : 2.5;
    const minStep = inKg ? 0.5 : 2.5;
    let action, next;
    if (hit(last, target)) {
      action = "up";
      next = round(cur + step, minStep);
    } else {
      const prev = sessions[1];
      if (prev && !hit(prev, target) && top(prev) >= t) {
        action = "down";
        next = Math.max(minStep, round(cur * 0.9, minStep));
      } else {
        action = "same";
        next = round(cur, inKg ? 0.5 : 0.5);
      }
    }
    const lb = Math.round(toLb(next) * 10) / 10;
    const label = { up: "Sube", same: "Repite", down: "Baja" }[action];
    const why = {
      up: "completaste todas las series",
      same: "aún no completaste todas las series",
      down: "dos sesiones sin completar con esta carga",
    }[action];
    return { action, w: lb, show: Math.round(next * 10) / 10, r: target.reps, label, why };
  }
  g.FitProgression = { suggest };
})(typeof window !== "undefined" ? window : globalThis);
