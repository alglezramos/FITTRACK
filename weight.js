// r106: Pesadas de la semana y gráfico de trayectoria (antes dentro de program.js).
window.createFitWeight = function ({ getProgram, week, today, escape }) {
  const C = window.FitCore;
  const W = () => FitStore.weeks();
  const fmt = (n) => Number(n).toLocaleString("es-CR", { maximumFractionDigits: 1 });
  let program = getProgram();
  // r114: la pérdida esperada por déficit llega solo hasta la semana en curso (las semanas futuras aún no tienen déficit).
  // Desde el último peso real se proyecta hasta el final al ritmo del déficit promedio de los días cerrados.
  function withForecast(rows) {
    if (!rows.length) return rows;
    const days = Math.round((Date.parse(today() + "T12:00:00Z") - Date.parse(program.start + "T12:00:00Z")) / 86400000),
      cur = Math.max(0, Math.min(W(), Math.floor(days / 7) + 1));
    const out = rows.map((r) => ({ ...r, projected: r.week > cur ? null : r.projected, forecast: null }));
    const now = out[Math.min(cur, out.length - 1)] || {},
      rate = now.count ? now.deficit / now.count : null,
      anchor = out.filter((r) => r.week > 0 && r.week <= cur && r.actual !== null).at(-1);
    if (rate !== null && anchor && anchor.week < W())
      for (const r of out) if (r.week >= anchor.week) r.forecast = anchor.actual - (rate * 7 * (r.week - anchor.week)) / 7700;
    return out;
  }
  const sync = (f) => (...a) => {
    program = getProgram();
    return f(...a);
  };
  function weight() {
    const w = week(),
      d = program.weeks[w] || {},
      rows = withForecast(C.series(program)),
      ok = rows.length > 0;
    const dayOf = (wd) => {
      for (let i = 0; i < 7; i++) {
        const x = FitCalendar.date(program.start, w, i);
        if (x && new Date(x + "T12:00:00Z").getUTCDay() === wd) return x;
      }
      return "";
    };
    const short = (x) =>
      x
        ? new Date(x + "T12:00:00Z").toLocaleDateString("es-CR", {
            day: "2-digit",
            month: "2-digit",
            timeZone: "UTC",
          })
        : "";
    const tiles = [
      ["weight1", "Lunes", 1],
      ["weight4", "Martes", 2],
      ["weight2", "Miércoles", 3],
      ["weight5", "Jueves", 4],
      ["weight3", "Viernes", 5],
    ]
      .map(([k, l, wd]) => {
        const x = dayOf(wd),
          isToday = x === today(),
          future = x && x > today();
        return `<label class="weigh-tile${isToday ? " is-today" : ""}${C.has(d[k]) && Number(d[k]) > 0 ? " has-value" : ""}"><span>${l}${x ? " · " + short(x) : ""}${isToday ? " · hoy" : ""}</span><div><input data-weight-metric="${k}" type="number" min="20" max="400" step="0.1" inputmode="decimal" placeholder="—" value="${escape(d[k] ?? "")}" aria-label="Peso del ${l.toLowerCase()} en kg"><em>kg</em></div></label>`;
      })
      .join("");
    const waist = `<label class="weigh-tile"><span>Cintura</span><div><input data-weight-metric="waist" type="number" min="20" max="300" step="0.1" inputmode="decimal" placeholder="—" value="${escape(d.waist ?? "")}" aria-label="Cintura en cm"><em>cm</em></div></label>`;
    let stats = "";
    if (ok) {
      const cur = rows[w];
      let prev = null,
        prevLabel = "inicio";
      for (let k = w - 1; k >= 0; k--)
        if (rows[k].actual !== null) {
          prev = rows[k].actual;
          prevLabel = k ? "semana " + k : "inicio";
          break;
        }
      const diff = cur.actual !== null && prev !== null ? cur.actual - prev : null,
        gap = cur.actual !== null ? cur.actual - cur.target : null;
      stats = `<div class="weigh-stats"><div><span>Media semana ${w}</span><strong>${cur.actual === null ? "—" : fmt(cur.actual) + " kg"}</strong></div><div><span>vs ${prevLabel}</span><strong class="${diff === null ? "" : diff <= 0 ? "good" : "bad"}">${diff === null ? "—" : (diff > 0 ? "+" : "") + fmt(diff) + " kg"}</strong></div><div><span>Ruta semana ${w}</span><strong>${fmt(cur.target)} kg</strong><small>${gap === null ? "pésate para comparar" : Math.abs(gap) < 0.05 ? "en ruta" : gap > 0 ? fmt(gap) + " kg por encima" : fmt(-gap) + " kg por debajo"}</small></div></div>`;
    }
    return `<article class="weigh-card"><div class="challenge-heading"><h2>Pesadas · semana ${w}</h2><span>Lun a Vie</span></div>${ok ? "" : '<p class="subtle">Configura inicio y peso inicial en ⚙ Opciones para ver fechas y comparaciones.</p>'}<div class="weigh-grid">${tiles}${waist}</div>${stats}<p class="tiny subtle">Pésate en ayunas, después de ir al baño. La media de las pesadas de la semana es tu peso semanal; las semanas sin datos quedan vacías.</p></article>${ok ? `<article><h3>Trayectoria de ${W()} semanas</h3><div id="weightChart"></div><details><summary>Ver tabla por semana</summary><div class="scroll"><table><thead><tr><th>Sem.</th><th>Ruta</th><th>Real</th><th>Esperado por déficit</th><th>A tu ritmo</th><th>Días Whoop</th></tr></thead><tbody>${rows.map((r) => `<tr${r.week === w ? ' class="current-row"' : ""}><td>${r.week}</td><td>${fmt(r.target)}</td><td>${r.actual === null ? "—" : fmt(r.actual)}</td><td>${r.projected === null ? "—" : fmt(r.projected)}</td><td>${r.forecast === null ? "—" : fmt(r.forecast)}</td><td>${r.count}</td></tr>`).join("")}</tbody></table></div></details></article>` : ""}<article><details><summary>Inicio y peso inicial</summary><div class="fields"><p>Inicio del programa: <strong>${escape(program.start || "pendiente")}</strong></p><label class="weight-day">Peso inicial <input id="initialWeight" type="number" min="20" max="400" step="0.1" inputmode="decimal" value="${escape(program.initialWeight)}"><span>kg</span></label></div><p class="tiny subtle">La fecha de inicio se cambia en ⚙ Opciones.</p></details></article>`;
  }
  function chart() {
    const box = document.getElementById("weightChart");
    if (!box) return;
    const rows = withForecast(C.series(program));
    if (!rows.length) {
      box.innerHTML = '<p class="subtle">Configura el inicio y el peso inicial para ver la gráfica.</p>';
      return;
    }
    const width = Math.max(320, box.clientWidth || 650),
      height = 280,
      padL = 46,
      padR = 18,
      padT = 22,
      padB = 34;
    const values = rows.flatMap((r) => [r.target, r.actual, r.projected, r.forecast]).filter((v) => v !== null),
      lo = Math.floor(Math.min(...values) - 0.5),
      hi = Math.ceil(Math.max(...values) + 0.5),
      step = hi - lo > 8 ? 2 : 1,
      min = Math.floor(lo / step) * step,
      max = Math.ceil(hi / step) * step;
    const x = (i) => padL + (i * (width - padL - padR)) / W(),
      y = (v) => padT + ((max - v) / (max - min)) * (height - padT - padB);
    const ticks = [];
    for (let v = min; v <= max + 1e-9; v += step) ticks.push(v);
    const grid = ticks
      .map(
        (v) =>
          `<line x1="${padL}" y1="${y(v)}" x2="${width - padR}" y2="${y(v)}" stroke="#e3d4c1"/><text x="${padL - 8}" y="${y(v) + 4}" fill="#7b6a5b" font-size="11" text-anchor="end">${fmt(v)}</text>`,
      )
      .join("");
    const xs = Array.from({ length: W() + 1 }, (_, i) => i)
      .map(
        (i) =>
          `<line x1="${x(i)}" y1="${padT}" x2="${x(i)}" y2="${height - padB}" stroke="#eee4d6"/><text x="${x(i)}" y="${height - 12}" fill="#7b6a5b" text-anchor="middle" font-size="11">S${i}</text>`,
      )
      .join("");
    const series = [
      ["target", "#a3917f", "6 4", "Trayectoria objetivo"],
      ["projected", "#6f845e", "3 4", `Pérdida esperada por tu déficit (${(rows.filter((r) => r.projected !== null).at(-1) || {}).count || 0} días cerrados)`],
      ["forecast", "#d39a7c", "2 5", "Proyección a tu ritmo"],
      ["actual", "#bf6b47", "", "Peso real"],
    ];
    const lines = series
      .map(([k, color, dash, name]) => {
        const points = rows.filter((r) => r[k] !== null);
        return (
          `<polyline fill="none" stroke="${color}" stroke-width="${k === "actual" ? 2.5 : 2}" stroke-dasharray="${dash}" points="${points.map((r) => `${x(r.week)},${y(r[k])}`).join(" ")}"/>` +
          points
            .map(
              (r) =>
                `<circle cx="${x(r.week)}" cy="${y(r[k])}" r="${k === "actual" ? 4 : 3}" fill="${color}"><title>${name} · semana ${r.week}: ${fmt(r[k])} kg</title></circle>`,
            )
            .join("")
        );
      })
      .join("");
    const labels = rows
      .filter((r) => r.actual !== null && r.week > 0)
      .map(
        (r) =>
          `<text x="${x(r.week)}" y="${y(r.actual) - 9}" fill="#bf6b47" font-size="11" font-weight="700" text-anchor="middle">${fmt(r.actual)}</text>`,
      )
      .join("");
    const last = rows[rows.length - 1],
      ends = [
        ["target", "#a3917f"],
        ["forecast", "#bf6b47"],
      ]
        .filter(([k]) => last[k] !== null)
        .map(
          ([k, color]) =>
            `<text x="${x(W()) - 6}" y="${y(last[k]) + (k === "target" ? 16 : -8)}" fill="${color}" font-size="11" font-weight="700" text-anchor="end">${k === "forecast" ? "≈ " : ""}${fmt(last[k])} kg${k === "forecast" ? " a tu ritmo" : ""}</text>`,
        )
        .join("");
    const start = `<text x="${x(0) + 4}" y="${y(rows[0].actual) + 18}" fill="#bf6b47" font-size="11" font-weight="700">${fmt(rows[0].actual)}</text>`;
    box.innerHTML = `<div class="chart-legend">${series
      .map(
        ([, color, dash, name]) =>
          `<span><svg width="22" height="8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" stroke="${color}" stroke-width="2.5" stroke-dasharray="${dash}"/></svg>${name}</span>`,
      )
      .join(
        "",
      )}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Peso objetivo, peso registrado y proyección por déficit"><title>Comparación de peso en ${W()} semanas</title>${grid}${xs}<text x="4" y="12" fill="#7b6a5b" font-size="11">kg</text>${lines}${start}${labels}${ends}</svg><p class="tiny subtle">Eje vertical: peso en kg · Eje horizontal: semanas del programa (S0 = inicio). Peso real = promedio de las pesadas de la semana. Pérdida esperada = peso inicial − déficit acumulado de los días cerrados ÷ 7.700 kcal. Proyección = desde tu último peso real, al déficit diario promedio de tus días cerrados.</p>`;
  }
  return { weight: sync(weight), chart: sync(chart) };
};
