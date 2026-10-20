window.FitCalendar = {
  date(start, week, day) {
    return FitCore.validDate(start) ? FitCore.datePlus(start, (week - 1) * 7 + day) : "";
  },
  position(start, date) {
    if (!FitCore.validDate(start) || !FitCore.validDate(date)) return null;
    const n = Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(start + "T12:00:00Z")) / 86400000);
    return n >= 0 && n < 56 ? { week: Math.floor(n / 7) + 1, day: n % 7 } : null;
  },
  migrate(input) {
    const p = JSON.parse(JSON.stringify(input));
    p.diary ??= {};
    p.meds ??= {};
    p.challenges ??= {};
    const goals = () => [
      { id: "pushups", name: "Push-ups", target: 125 },
      { id: "abs", name: "Abdominales", target: 125 },
      { id: "pullups", name: "Pull-ups", target: 25 },
      { id: "squats", name: "Sentadillas", target: 125 },
    ];
    for (const m of p.meals || []) {
      const d = (p.diary[m.date] ??= { meals: [], closed: false });
      const id = "claude-" + m.id;
      if (!d.meals.some((x) => x.id === id))
        d.meals.push({
          id,
          name: m.name,
          kind: m.slot,
          kcal: Number(m.kcal),
          items: [],
          proteinEstimate: m.prot,
        });
    }
    for (const l of p.challenge || []) {
      const d = (p.challenges[l.week] ??= { goals: goals(), logs: [] });
      const goal = { abdominales: "abs", sentadillas: "squats", pushups: "pushups", pullups: "pullups" }[
        l.ex
      ];
      const id = "claude-" + l.id;
      if (goal && !d.logs.some((x) => x.id === id))
        d.logs.push({ id, goal, reps: Number(l.n), date: l.date });
    }
    if (p.mergeVersion !== 2) for (const d of Object.values(p.challenges)) d.goals = goals();
    for (const s of p.sessions || []) s.unit ??= "km";
    if (["strength", "cardio", "challenges"].includes(p.view)) {
      p.trainingTab = p.view;
      p.view = "training";
    }
    if (p.view === "meals") p.view = "food";
    if (p.view === "plan") p.view = "home";
    if (["wellness", "missions", "tracking"].includes(p.view)) {
      p.progressTab = p.view === "wellness" ? "wellbeing" : p.view === "missions" ? "missions" : "weight";
      p.view = "progress";
    }
    delete p.meals;
    delete p.challenge;
    delete p.challengeDate;
    delete p.diaryDate;
    if (!p.cookedVersion) {
      const raw = new Set(["res", "cerdo", "pastor"]);
      for (const rows of [
        ...Object.values(p.recipeEdits || {}),
        ...(p.customMenus || []).map((m) => m.items),
      ])
        for (const i of rows) if (raw.has(i.food)) i.qty = Math.round(i.qty * 0.75 * 1000) / 1000;
      for (const id of raw) {
        const f = p.foodEdits?.[id];
        if (f) {
          f.base *= 0.75;
          f.unit = "g cocinados";
          f.name += " · cocinada (estimación)";
          f.pending = true;
        }
      }
      p.cookedVersion = 1;
    }
    if (p.meatConfirmed !== 1) {
      for (const id of ["res", "cerdo"]) {
        const f = p.foodEdits?.[id];
        if (f) {
          f.pending = false;
          f.name = String(f.name).replace(" · cocinada (estimación)", " · cocinada");
        }
      }
      p.meatConfirmed = 1;
    }
    p.recordDay = Number.isInteger(p.recordDay) && p.recordDay >= 0 && p.recordDay < 7 ? p.recordDay : 0;
    p.menuDay = p.recordDay;
    p.mergeVersion = 2;
    return p;
  },
};
