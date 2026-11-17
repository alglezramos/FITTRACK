// r109: registros de fuerza por ejercicio, semana y día («id-wN-dD»).
// Antes eran por ejercicio y semana («id-wN»): repetir una rutina en la misma semana
// archivaba la sesión anterior. La migración solo renombra claves: no borra registros.
(function (g) {
  "use strict";
  const RE = /^(.*)-w(\d+)(?:-d(\d))?$/;
  const parse = (k) => {
    const m = RE.exec(k);
    return m ? { id: m[1], w: Number(m[2]), d: m[3] == null ? null : Number(m[3]) } : null;
  };
  const key = (id, w, d) => id + "-w" + w + "-d" + d;
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const dayDiff = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
  const validDate = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  // Día (0–6) dentro de la semana w del programa para una fecha; null si no cae en esa semana.
  function dayIn(start, w, date) {
    if (!validDate(start) || !validDate(date)) return null;
    const d = dayDiff(start, date) - (w - 1) * 7;
    return d >= 0 && d < 7 ? d : null;
  }
  const doneDates = (sets) => (sets || []).filter((z) => z && z.done && validDate(z.d)).map((z) => z.d);
  const topOf = (sets) => (sets || []).reduce((m, z) => Math.max(m, z && z.done && z.w > 0 ? z.w : 0), 0);
  const anyW = (sets) => (sets || []).reduce((m, z) => Math.max(m, (z && z.w) || 0), 0);

  // Convierte las claves antiguas. legacyDay: { id: día de la rutina vieja (1–5) } para
  // registros sin fecha. fromWeek: primera semana con las rutinas nuevas.
  function migrate(input, { start, legacyDay = {}, fromWeek = 1 } = {}) {
    const s = clone(input || {});
    if (s.keysV2) return { strength: s, moved: 0 };
    for (const f of ["weights", "completed", "completedDates", "sets"]) s[f] ??= {};
    s.archive ??= [];
    const old = new Set();
    for (const f of ["weights", "completed", "completedDates", "sets"])
      for (const k of Object.keys(s[f])) {
        const p = parse(k);
        if (p && p.d === null) old.add(k);
      }
    let moved = 0;
    for (const k of old) {
      const { id, w } = parse(k);
      const dates = doneDates(s.sets[k]);
      if (validDate(s.completedDates[k])) dates.push(s.completedDates[k]);
      let d = null;
      for (const dt of dates.sort().reverse()) if ((d = dayIn(start, w, dt)) !== null) break;
      if (d === null) d = Math.max(0, Math.min(6, (Number(legacyDay[id]) || 1) - 1));
      const nk = key(id, w, d);
      for (const f of ["weights", "completed", "completedDates", "sets"])
        if (k in s[f]) {
          if (!(nk in s[f])) s[f][nk] = s[f][k];
          delete s[f][k];
        }
      moved++;
    }
    // Sesiones archivadas (misma rutina repetida en la semana): pasan a su propio día si está libre.
    const keep = [];
    for (const a of s.archive) {
      const d = a && dayIn(start, a.week, a.date);
      const nk = d === null || !a ? null : key(a.id, a.week, d);
      if (nk && !(nk in s.sets) && !(nk in s.weights)) {
        s.sets[nk] = a.sets;
        const top = topOf(a.sets) || anyW(a.sets);
        if (top > 0) s.weights[nk] = top;
        const all = a.sets.length > 0 && a.sets.every((z) => z && z.done);
        s.completed[nk] = all;
        if (all) s.completedDates[nk] = a.date;
        moved++;
      } else keep.push(d === null || !a ? a : { ...a, d });
    }
    s.archive = keep;
    // Con las sesiones archivadas separadas, «completado» refleja solo las series de esa clave.
    for (const [k, sets] of Object.entries(s.sets)) {
      if (!Array.isArray(sets) || !sets.length) continue;
      const all = sets.every((z) => z && z.done);
      if (s.completed[k] && !all) {
        s.completed[k] = false;
        delete s.completedDates[k];
      }
    }
    s.keysV2 = true;
    s.fullBodyFrom = fromWeek;
    return { strength: s, moved };
  }

  // Avance semanal de fuerza. Semanas con la rutina vieja: ejercicios distintos completados
  // sobre la lista guardada de esa semana. Semanas nuevas: ejercicios completados en las
  // sesiones de lunes a viernes sobre 5 sesiones × ejercicios de una rutina.
  function weekStats(s, w, { perSession, sessions = 5, legacyIds } = {}) {
    const st = s || {},
      from = Number(st.fullBodyFrom) || 1,
      done = Object.keys(st.completed || {}).filter((k) => st.completed[k]).map(parse).filter((p) => p && p.w === w);
    if (w < from && Array.isArray(legacyIds) && legacyIds.length) {
      const ids = new Set(done.map((p) => p.id));
      return { done: legacyIds.filter((id) => ids.has(id)).length, total: legacyIds.length };
    }
    const total = sessions * (perSession || 0);
    return { done: Math.min(total, done.length), total };
  }

  g.FitStrengthKeys = { RE, parse, key, migrate, weekStats, dayIn };
})(typeof window !== "undefined" ? window : globalThis);
