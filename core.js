(function (g) {
  const validDate = (s) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !isNaN(Date.parse(s + "T12:00:00Z")) &&
    new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
  const datePlus = (s, n) => {
    const d = new Date(s + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const has = (v) => v !== "" && v != null && Number.isFinite(Number(v));
  const intake = (d) => (d.meals || []).reduce((n, m) => n + Number(m.kcal), 0) + (Number(d.extras) || 0);
  const balance = (d) => (has(d.whoop) ? Number(d.whoop) - intake(d) : null);
  function series(p) {
    if (!validDate(p.start) || !has(p.initialWeight)) return [];
    let total = 0,
      count = 0;
    const rows = [
      {
        week: 0,
        target: Number(p.initialWeight),
        actual: Number(p.initialWeight),
        projected: Number(p.initialWeight),
        count: 0,
        deficit: 0,
      },
    ];
    for (let w = 1; w <= 8; w++) {
      for (let i = (w - 1) * 7; i < w * 7; i++) {
        const d = (p.diary || {})[datePlus(p.start, i)];
        if (d && balance(d) !== null) {
          total += balance(d);
          count++;
        }
      }
      const a = p.weeks[w] || {};
      const values = ["weight1", "weight2", "weight3"]
        .map((k) => a[k])
        .filter((v) => has(v) && Number(v) > 0)
        .map(Number);
      rows.push({
        week: w,
        target: Number(p.initialWeight) - (10 * w) / 8,
        actual: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
        projected: count ? Number(p.initialWeight) - total / 7700 : null,
        count,
        deficit: total,
      });
    }
    return rows;
  }
  function validate(p) {
    const object = (v) => v && typeof v === "object" && !Array.isArray(v);
    const number = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
    if (!object(p) || !object(p.weeks) || !Array.isArray(p.sessions))
      throw Error("Estructura de copia no válida");
    for (const key of ["diary", "meds", "foodKcal", "foodEdits", "recipeEdits", "menuPlan"])
      if (p[key] !== undefined && !object(p[key])) throw Error("Datos inválidos: " + key);
    if (p.medStart && !validDate(p.medStart)) throw Error("Inicio de medicación inválido");
    if (p.start && !validDate(p.start)) throw Error("Fecha inicial no válida");
    if (has(p.initialWeight) && !number(Number(p.initialWeight), 20, 400))
      throw Error("Peso inicial no válido");
    for (const s of p.sessions)
      if (
        !object(s) ||
        !["Judo", "Caminar", "Nadar", "Rucking", "Correr", "Bicicleta", "Hiking"].includes(s.mode) ||
        !validDate(s.date) ||
        !number(s.minutes, 1, 600) ||
        !number(s.effort, 1, 10) ||
        !Number.isInteger(s.week) ||
        s.week < 1 ||
        s.week > 8
      )
        throw Error("Actividad no válida");
    for (const [date, d] of Object.entries(p.diary || {})) {
      if (!validDate(date) || !object(d) || !Array.isArray(d.meals)) throw Error("Diario no válido");
      for (const k of ["whoop", "steps", "extras"])
        if (has(d[k]) && !number(Number(d[k]), 0, k === "steps" ? 200000 : 20000))
          throw Error("Valor diario no válido");
      for (const m of d.meals)
        if (
          !object(m) ||
          typeof m.name !== "string" ||
          !number(m.kcal, 0, 20000) ||
          !Array.isArray(m.items) ||
          m.items.some(
            (i) =>
              !object(i) ||
              !number(i.qty, 0, 100000) ||
              typeof i.name !== "string" ||
              typeof i.unit !== "string",
          )
        )
          throw Error("Comida no válida");
    }
    if (
      p.customFoods &&
      (!Array.isArray(p.customFoods) ||
        p.customFoods.some(
          (f) =>
            !object(f) ||
            typeof f.id !== "string" ||
            typeof f.name !== "string" ||
            typeof f.category !== "string" ||
            typeof f.unit !== "string" ||
            !number(f.base, 0.01, 100000) ||
            !number(f.kcal, 0, 5000),
        ))
    )
      throw Error("Alimento no válido");
    if (
      p.customMenus &&
      (!Array.isArray(p.customMenus) ||
        p.customMenus.some(
          (m) =>
            !object(m) ||
            typeof m.id !== "string" ||
            typeof m.name !== "string" ||
            !["Desayuno", "Almuerzo", "Cena", "Merienda"].includes(m.kind) ||
            !Array.isArray(m.items),
        ))
    )
      throw Error("Receta no válida");
    const ids = new Set([...(g.FIT_FOODS || []), ...(p.customFoods || [])].map((f) => f.id));
    for (const rows of [...Object.values(p.recipeEdits || {}), ...(p.customMenus || []).map((m) => m.items)])
      if (!Array.isArray(rows) || rows.some((i) => !object(i) || !ids.has(i.food) || !number(i.qty, 0, 5000)))
        throw Error("Ingrediente no válido");
    for (const f of Object.values(p.foodEdits || {}))
      if (
        !object(f) ||
        typeof f.name !== "string" ||
        typeof f.unit !== "string" ||
        typeof f.category !== "string" ||
        !number(f.base, 0.01, 100000) ||
        !number(f.kcal, 0, 5000)
      )
        throw Error("Edición de alimento inválida");
    for (const v of Object.values(p.foodKcal || {}))
      if (!number(v, 0, 5000)) throw Error("Calorías de alimento no válidas");
    if (p.challenges !== undefined) {
      if (!object(p.challenges)) throw Error("Retos inválidos");
      for (const [w, d] of Object.entries(p.challenges)) {
        if (!/^[1-8]$/.test(w) || !object(d) || !Array.isArray(d.goals) || !Array.isArray(d.logs))
          throw Error("Semana de retos inválida");
        const ids = new Set();
        for (const g of d.goals) {
          if (
            !object(g) ||
            typeof g.id !== "string" ||
            ids.has(g.id) ||
            typeof g.name !== "string" ||
            !g.name.trim() ||
            !Number.isInteger(g.target) ||
            !number(g.target, 1, 10000)
          )
            throw Error("Meta de reto inválida");
          ids.add(g.id);
        }
        for (const l of d.logs)
          if (
            !object(l) ||
            typeof l.id !== "string" ||
            !ids.has(l.goal) ||
            !validDate(l.date) ||
            !Number.isInteger(l.reps) ||
            !number(l.reps, 1, 10000)
          )
            throw Error("Registro de reto inválido");
      }
    }
    if (p.wellbeing !== undefined) {
      if (!object(p.wellbeing)) throw Error("Bienestar inválido");
      for (const [day, row] of Object.entries(p.wellbeing)) {
        if (
          !validDate(day) ||
          !object(row) ||
          Object.entries(row).some(
            ([id, v]) =>
              !["water", "screen", "breathing", "sleep"].includes(id) || !["done", "skip"].includes(v),
          )
        )
          throw Error("Registro de bienestar inválido");
      }
    }
    if (p.coachDays !== undefined) {
      if (!object(p.coachDays)) throw Error("Coach inválido");
      for (const [day, d] of Object.entries(p.coachDays)) {
        if (!validDate(day) || !object(d)) throw Error("Registro coach inválido");
        if (d.checkin) {
          if (
            !number(d.energy, 1, 5) ||
            !Number.isInteger(d.energy) ||
            !["none", "shoulder", "knee", "back", "neck", "leg", "other"].includes(d.pain)
          )
            throw Error("Estado diario inválido");
          if (d.fatigue !== undefined && (!number(d.fatigue, 1, 5) || !Number.isInteger(d.fatigue)))
            throw Error("Estado diario inválido");
          if (d.painOther !== undefined && (typeof d.painOther !== "string" || d.painOther.length > 120))
            throw Error("Estado diario inválido");
        }
        if (
          d.acceptedFood &&
          (!object(d.acceptedFood) ||
            typeof d.acceptedFood.name !== "string" ||
            !number(d.acceptedFood.kcal, 0, 500))
        )
          throw Error("Propuesta inválida");
        if (d.acceptedTraining !== undefined && typeof d.acceptedTraining !== "string")
          throw Error("Actividad propuesta inválida");
      }
    }
    if (p.shopping !== undefined) {
      if (!object(p.shopping)) throw Error("Lista del súper inválida");
      for (const [week, rows] of Object.entries(p.shopping)) {
        if (!/^[1-8]$/.test(week) || !object(rows)) throw Error("Semana de compras inválida");
        for (const row of Object.values(rows))
          if (
            !object(row) ||
            !number(row.qty, 0, 10000000) ||
            typeof row.unit !== "string" ||
            typeof row.name !== "string"
          )
            throw Error("Producto de compras inválido");
      }
    }
    return p;
  }
  const GOAL_KG = 10,
    NEEDED = Math.round((GOAL_KG * 7700) / 56);
  g.FitCore = { validDate, datePlus, has, intake, balance, series, validate, GOAL_KG, NEEDED };
})(typeof window !== "undefined" ? window : globalThis);
