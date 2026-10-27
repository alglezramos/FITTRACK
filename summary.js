window.FitSummaryModel = function (p, today) {
  const C = FitCore;
  if (!C.validDate(p.start)) return null;
  const elapsed = Math.max(
    0,
    Math.min(
      56,
      Math.floor((Date.parse(today + "T12:00:00Z") - Date.parse(p.start + "T12:00:00Z")) / 86400000) + 1,
    ),
  );
  const rows = Array.from({ length: 8 }, (_, i) => ({ week: i + 1, days: 0, deficit: 0, actual: null }));
  let steps = 0,
    stepDays = 0;
  for (let i = 0; i < elapsed; i++) {
    const d = p.diary?.[C.datePlus(p.start, i)];
    if (!d) continue;
    const b = C.balance(d),
      r = rows[Math.floor(i / 7)];
    if (b !== null) {
      r.days++;
      r.deficit += b;
    }
    if (C.has(d.steps)) {
      steps += Number(d.steps);
      stepDays++;
    }
  }
  for (const r of rows) {
    if ((r.week - 1) * 7 >= elapsed) continue;
    const w = p.weeks?.[r.week] || {},
      v = ["weight1", "weight4", "weight2", "weight5", "weight3"]
        .map((k) => w[k])
        .filter((x) => C.has(x) && Number(x) > 0)
        .map(Number);
    if (v.length) r.actual = v.reduce((a, b) => a + b, 0) / v.length;
  }
  const count = rows.reduce((n, r) => n + r.days, 0),
    deficit = rows.reduce((n, r) => n + r.deficit, 0),
    average = count ? deficit / count : null,
    initial = C.has(p.initialWeight) && Number(p.initialWeight) > 0 ? Number(p.initialWeight) : null;
  return {
    elapsed,
    rows,
    count,
    deficit,
    average,
    initial,
    steps,
    stepDays,
    target: initial === null ? null : initial - FitCore.GOAL_KG,
    projection: initial !== null && count ? initial - (average * 56) / 7700 : null,
  };
};
window.createFitSummary = function ({
  getProgram,
  today,
  escape,
  challenges,
  week,
  root,
  persist,
  rerender,
}) {
  const fmt = (n, d = 1) => Number(n).toLocaleString("es-CR", { maximumFractionDigits: d });
  function graph(m) {
    if (m.initial === null) return "<p>Registra el peso inicial en Progreso → Peso para ver el gráfico.</p>";
    const values = [
        m.initial,
        m.target,
        ...m.rows.map((r) => r.actual).filter((v) => v !== null),
        ...(m.projection === null ? [] : [m.projection]),
      ],
      lo = Math.min(...values) - 1,
      hi = Math.max(...values) + 1,
      x = (w) => 42 + w * 34,
      y = (v) => 190 - ((v - lo) / (hi - lo)) * 155;
    const points = m.rows.filter((r) => r.actual !== null);
    return `<svg viewBox="0 0 350 225" role="img" aria-label="Peso inicial, medias semanales registradas, objetivo y escenario estimado a semana ocho" style="width:100%;max-width:700px"><title>Peso durante ocho semanas</title>${[
      3,
    ]
      .map((i) => {
        const v = lo + ((hi - lo) * i) / 3;
        return `<line x1="42" x2="314" y1="${y(v)}" y2="${y(v)}" stroke="#41444b"/><text x="2" y="${y(v) + 4}" fill="#b8b8b8" font-size="12">${fmt(v)}</text>`;
      })
      .join(
        "",
      )}<text x="5" y="18" fill="#b8b8b8" font-size="12">kg</text>${[0, 2, 4, 6, 8].map((w) => `<text x="${x(w)}" y="214" fill="#b8b8b8" font-size="12" text-anchor="middle">S${w}</text>`).join("")}<line x1="${x(0)}" y1="${y(m.initial)}" x2="${x(8)}" y2="${y(m.target)}" stroke="#a4a8b0" stroke-width="2" stroke-dasharray="6 4"/>${m.projection === null ? "" : `<line x1="${x(0)}" y1="${y(m.initial)}" x2="${x(8)}" y2="${y(m.projection)}" stroke="#7ac7bd" stroke-width="2" stroke-dasharray="2 4"/>`}${points.map((r) => `<circle cx="${x(r.week)}" cy="${y(r.actual)}" r="4" fill="#ffc33d"><title>Semana ${r.week}: ${fmt(r.actual)} kg</title></circle>`).join("")}<circle cx="${x(0)}" cy="${y(m.initial)}" r="4" fill="#ffc33d"/></svg><p class="tiny">● Amarillo: peso real · Línea gris: objetivo · Línea verde punteada: escenario por déficit promedio.</p>`;
  }
  function energyChart(m) {
    const p = getProgram(),
      daily = p.balanceView !== "weekly",
      w = week(),
      NEED = FitCore.NEEDED,
      t = today(),
      letters = ["D", "L", "M", "X", "J", "V", "S"];
    const pos = FitCalendar.position(p.start, t);
    const rows = daily
      ? Array.from({ length: 7 }, (_, i) => {
          const date = FitCore.datePlus(p.start, (w - 1) * 7 + i),
            d = p.diary?.[date],
            future = date > t,
            value = !future && d ? FitCore.balance(d) : null,
            dt = new Date(date + "T12:00:00Z");
          return {
            top: letters[dt.getUTCDay()],
            sub: date.slice(8),
            value,
            future,
            now: date === t,
            prov: value !== null && !d?.closed,
            title: `${dt.toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}: ${value === null ? (future ? "fecha futura" : "sin Whoop") : (value > 0 ? "+" : "") + fmt(value, 0) + " kcal" + (d?.closed ? "" : " (provisional)")}`,
          };
        })
      : m.rows.map((r) => ({
          top: "S" + r.week,
          sub: r.days + "/7",
          value: r.days ? r.deficit : null,
          future: pos ? r.week > pos.week : false,
          now: pos ? r.week === pos.week : false,
          prov: false,
          title: `Semana ${r.week}: ${r.days ? (r.deficit > 0 ? "+" : "") + fmt(r.deficit, 0) + " kcal" : "sin datos"} · ${r.days} de 7 días con Whoop`,
        }));
    const goal = daily ? NEED : NEED * 7,
      vals = rows.map((r) => r.value).filter((v) => v !== null),
      hi = Math.max(goal * 1.15, ...vals.map((v) => v * 1.14), 1),
      lo = Math.min(0, ...vals.map((v) => v * 1.3)),
      span = hi - lo,
      zero = (-lo / span) * 100,
      short = (v) => (daily ? fmt(v, 0) : fmt(v / 1000, 1) + "k"),
      signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + short(Math.abs(v));
    const cols = rows
      .map((r) => {
        if (r.value === null)
          return `<div class="ec-col${r.future ? " is-future" : ""}" title="${escape(r.title)}"><i class="ec-empty" style="bottom:${zero}%"></i></div>`;
        const h = (Math.abs(r.value) / span) * 100,
          neg = r.value < 0;
        return `<div class="ec-col" title="${escape(r.title)}"><b class="${neg ? "is-sur" : "is-def"}" style="bottom:${neg ? zero - h : zero + h}%">${signed(r.value)}</b><i class="ec-bar${neg ? " is-sur" : ""}${r.prov ? " is-prov" : ""}" style="${neg ? `top:${100 - zero}%` : `bottom:${zero}%`};height:${Math.max(h, 1)}%"></i></div>`;
      })
      .join("");
    const total = vals.reduce((a, b) => a + b, 0),
      count = daily ? vals.length : m.count,
      goalTotal = daily ? NEED * 7 : NEED * 56,
      pct = Math.max(0, Math.min(100, (total / goalTotal) * 100));
    return `<article class="energy-card"><div class="card-head"><h3>Balance energético</h3><span>${daily ? "Semana " + w : "8 semanas"}</span></div><div class="food-tabs"><button data-balance-view="daily" aria-pressed="${daily}">Diario</button><button data-balance-view="weekly" aria-pressed="${!daily}">Semanal</button></div><div class="ec" role="img" aria-label="Balance ${daily ? "diario de la semana " + w : "por semana"} frente a la meta de ${fmt(goal, 0)} kcal"><div class="ec-goal" style="bottom:${zero + (goal / span) * 100}%"><span>Meta ${short(goal)}</span></div><div class="ec-zero" style="bottom:${zero}%"></div><div class="ec-cols" style="grid-template-columns:repeat(${rows.length},1fr)">${cols}</div></div><div class="ec-axis" style="grid-template-columns:repeat(${rows.length},1fr)">${rows.map((r) => `<div class="${r.now ? "is-now" : ""}${r.future ? " is-future" : ""}">${r.top}<small>${r.sub}</small></div>`).join("")}</div><div class="ec-sum"><div class="ec-sum-row"><span>Déficit ${daily ? "de la semana" : "del programa"}</span><strong>${total > 0 ? "+" : ""}${fmt(total, 0)} / ${fmt(goalTotal, 0)} kcal</strong></div><div class="ec-sum-bar"><i style="width:${pct.toFixed(1)}%"></i></div><div class="ec-sum-row"><span>${count} de ${daily ? 7 : 56} días con Whoop</span><span>${Math.round(pct)}% de la meta</span></div></div><div class="ec-legend"><span style="--c:#7ac7bd">Déficit</span><span style="--c:#ed9b76">Superávit</span>${daily ? '<span class="prov">Provisional</span>' : ""}<span style="--c:#ffc33d">Meta ${daily ? "diaria" : "semanal"}</span></div><p class="tiny subtle">Whoop total − calorías consumidas. Provisional: día con Whoop sin marcar como «Día completo».</p></article>`;
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-balance-view]");
    if (!b) return;
    getProgram().balanceView = b.dataset.balanceView;
    persist();
    rerender();
  });
  function render() {
    const p = getProgram(),
      m = FitSummaryModel(p, today());
    if (!m)
      return "<article><h2>Balance energético</h2><p>Configura la fecha inicial del programa para consultar tu progreso.</p></article>";
    const habits = ["water", "screen", "breathing", "sleep"];
    let done = 0,
      skip = 0;
    for (let i = 0; i < m.elapsed; i++) {
      const d = p.wellbeing?.[FitCore.datePlus(p.start, i)] || {};
      done += habits.filter((k) => d[k] === "done").length;
      skip += habits.filter((k) => d[k] === "skip").length;
    }
    return (
      energyChart(m) +
      `<article><h3>Pasos y bienestar</h3><div class="daily-numbers"><div><span>Pasos registrados</span><strong>${fmt(m.steps, 0)}</strong><p>${m.stepDays} días con datos</p></div><div><span>Hábitos hechos</span><strong>${done}</strong><p>${skip} omitidos</p></div></div></article>`
    );
  }
  return { render };
};
