// r106: Panel de Progreso y cierre semanal (antes dentro de program.js).
// Usa «state» (fuerza) de app.js, que es global como en el resto de módulos.
window.createFitPanel = function ({ getProgram, week, today, escape, weightOn, bar, kcalTarget }) {
  const C = window.FitCore;
  const W = () => FitStore.weeks();
  const fmt = (n) => Number(n).toLocaleString("es-CR", { maximumFractionDigits: 1 });
  // Cargas en la unidad elegida en Entreno (se guardan en libras).
  const L = window.fitLoad || { unit: () => "lb", show: (v) => v };
  let program = getProgram();
  let shareText = "";
  // Compartir: hoja nativa del móvil; si no existe, copia al portapapeles; si tampoco, descarga un .txt.
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-share-week]");
    if (!b || !shareText) return;
    const done = (t) => {
      b.textContent = t;
      setTimeout(() => (b.textContent = "Compartir resumen"), 2500);
    };
    try {
      if (navigator.share) {
        await navigator.share({ title: "EVÓ · resumen semanal", text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      done("✓ Copiado");
    } catch (err) {
      if (err && err.name === "AbortError") return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([shareText], { type: "text/plain" }));
      a.download = "evo-resumen-semana.txt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      done("⬇️ Descargado");
    }
  });
  const sync = (f) => (...a) => {
    program = getProgram();
    return f(...a);
  };
  function weekReview(w) {
    const initial = Number(program.initialWeight) || 85;
    const rows = C.series(program);
    const cur = rows[w],
      prev = rows[w - 1];
    if (!cur) return null;
    const days = [];
    let defSum = 0,
      n = 0;
    for (let i = (w - 1) * 7; i < w * 7; i++) {
      const d = program.diary[C.datePlus(program.start, i)];
      if (d && C.confirmed(d) !== null) {
        defSum += C.confirmed(d);
        n++;
      }
    }
    const avgDef = n ? defSum / n : null,
      expected = cur.target;
    const lastActual = (() => {
      for (let k = w - 1; k >= 1; k--) if (rows[k].actual !== null) return rows[k].actual;
      return initial;
    })();
    const rate = cur.actual === null ? null : lastActual - cur.actual;
    const wd = program.weeks[w] || {};
    let reco = "",
      tone = "";
    const left = W() * 7 - 7 * w;
    if (cur.actual === null) {
      reco = "Pésate de lunes a viernes para evaluar esta semana.";
      tone = "info";
    } else {
      const over = cur.actual - expected;
      if (rate > 1.25) {
        reco = `Bajaste ${fmt(rate)} kg: más rápido de lo recomendable (≈1,25 kg/sem ya es agresivo). Si la fuerza o la energía bajan, come un poco más.`;
        tone = "warn";
      } else if (over > 0.4) {
        const extra = left > 0 ? Math.round((over * 7700) / left) : null;
        reco =
          extra === null
            ? `Estás ${fmt(over)} kg por encima de la ruta y ya no queda margen: acepta el rango real (quedar cerca de la meta ya es un gran resultado).`
            : `Estás ${fmt(over)} kg por encima de la ruta. Para alcanzarla necesitas ≈${fmt(extra)} kcal más de déficit al día durante ${left} días${extra > 500 ? " — es mucho: mejor repartir con más actividad y aceptar un rango de 8–10 kg" : ""}.`;
        tone = extra > 500 ? "warn" : "info";
      } else
        reco =
          over < -0.4
            ? `Vas ${fmt(-over)} kg por delante de la ruta. Mantén; no recortes más calorías.`
            : "En ruta. Sigue igual.";
    }
    if (avgDef !== null && avgDef > 1800) {
      reco += " Ojo: tu déficit promedio supera 1.800 kcal/día; vigila energía y fuerza.";
      tone = "warn";
    }
    const ci = Object.entries(program.coachDays || {}).filter(
      ([day, d]) =>
        d.checkin &&
        day >= C.datePlus(program.start, (w - 1) * 7) &&
        day <= C.datePlus(program.start, w * 7 - 1),
    );
    const en = ci.length ? ci.reduce((a, [, d]) => a + d.energy, 0) / ci.length : null;
    if (en !== null && en < 2.5) {
      reco += " Tu energía promedio fue baja: considera comer más antes de recortar más.";
      tone = "warn";
    }
    const wkIds = window.fitRoutineIds ? window.fitRoutineIds(w) : EXERCISES.map((x) => x.id),
      strengthDone = wkIds.filter((id) => state.completed[id + "-w" + w]).length,
      strengthTotal = wkIds.length;
    return { w, cur, expected, rate, n, avgDef, defSum, waist: wd.waist, en, reco, tone, strengthDone, strengthTotal };
  }
  // ── Panel de Progreso: análisis con filtros de 7/30/90 días ────────────────
  const RANGES = [7, 30, 90];
  const DOW = ["L", "M", "X", "J", "V", "S", "D"];
  const note = (t) => `<p class="tiny subtle panel-empty">${t}</p>`;
  const stat = (label, value, sub = "") =>
    `<div class="panel-stat"><span>${label}</span><strong>${value}</strong>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const signed = (n, unit = "") => (n > 0 ? "+" : n < 0 ? "−" : "±") + fmt(Math.abs(n)) + unit;
  function rangeDays(n) {
    const end = today(),
      first = C.datePlus(end, -(n - 1)),
      from = C.validDate(program.start) && program.start > first ? program.start : first,
      out = [];
    for (let d = from; d <= end && out.length < 400; d = C.datePlus(d, 1)) out.push(d);
    return out;
  }
  const weekOf = (d) => (C.validDate(program.start) ? (FitCalendar.position(program.start, d) || {}).week || null : null);
  const isWeekday = (d) => new Date(d + "T12:00:00Z").getUTCDay() % 6 !== 0;
  function strengthDates() {
    const s = new Set(Object.values(state.completedDates || {}).filter((d) => C.validDate(d)));
    Object.values(state.sets || {}).forEach((sets) => (sets || []).forEach((z) => z && z.done && C.validDate(z.d) && s.add(z.d)));
    (state.archive || []).forEach((a) => a.sets.some((z) => z.done) && C.validDate(a.date) && s.add(a.date));
    return s;
  }
  // Todas las series registradas: las de cada semana y las de sesiones archivadas.
  const allSets = () => [...Object.values(state.sets || {}), ...(state.archive || []).map((a) => a.sets)];
  // Fechas en que se completó una rutina entera (todos los ejercicios de un día).
  // Una sola serie o un ejercicio suelto cuenta como «día con fuerza», no como rutina.
  function routineDates(days) {
    const byDate = {};
    Object.entries(state.completedDates || {}).forEach(([k, d]) => {
      if (!state.completed?.[k] || !C.validDate(d)) return;
      const m = /^(.*)-w\d+$/.exec(k);
      if (m) (byDate[d] ||= new Set()).add(m[1]);
    });
    (state.archive || []).forEach((a) => {
      if (a.sets.length && a.sets.every((z) => z.done) && C.validDate(a.date)) (byDate[a.date] ||= new Set()).add(a.id);
    });
    return days.filter((d) => {
      const ids = byDate[d];
      if (!ids) return false;
      return [1, 2, 3, 4, 5].some((n) => {
        const ex = EXERCISES.filter((e) => e.day === n);
        return ex.length && ex.every((e) => ids.has(e.id));
      });
    });
  }
  // Gráfico de línea SVG (escala propia; null = sin dato).
  function lineChart(days, lines, ref) {
    // r93: se dibuja al ancho real de la tarjeta (texto a tamaño normal), eje en pasos redondos y semanas marcadas.
    const host = document.getElementById("programView"),
      W = Math.max(300, Math.min(960, (host && host.clientWidth ? host.clientWidth : 360) - 40)),
      H = W < 480 ? 190 : 230,
      P = { l: 40, r: 50, t: 14, b: 34 };
    const vals = lines.flatMap((l) => l.values.filter((v) => v != null));
    let lo = Math.min(...vals),
      hi = Math.max(...vals);
    const span = Math.max(hi - lo, 1.2),
      step = span > 6 ? 2 : span > 3 ? 1 : 0.5;
    lo = Math.floor((lo - span * 0.12) / step) * step;
    hi = Math.ceil((hi + span * 0.12) / step) * step;
    const x = (i) => P.l + (days.length < 2 ? (W - P.l - P.r) / 2 : (i / (days.length - 1)) * (W - P.l - P.r));
    const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
    const pts = (vs) => vs.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    const smooth = (p) => {
      if (!p.length) return "";
      let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
      for (let i = 1; i < p.length; i++) {
        const [x1, y1] = p[i];
        d += ` L${x1.toFixed(1)} ${y1.toFixed(1)}`;
      }
      return d;
    };
    let grid = "";
    for (let v = lo; v <= hi + 1e-9; v += step)
      grid += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="pc-grid"/><text x="${P.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="pc-axis">${fmt(Math.round(v * 10) / 10)}</text>`;
    // Separadores y etiquetas por semana del programa.
    let weeksAx = "";
    days.forEach((d, i) => {
      const off = Math.round((new Date(d + "T12:00") - new Date(program.start + "T12:00")) / 864e5);
      if (off % 7 !== 0) return;
      const xx = x(i).toFixed(1);
      weeksAx += `<line x1="${xx}" x2="${xx}" y1="${P.t}" y2="${H - P.b}" class="pc-week"/><text x="${xx}" y="${H - P.b + 15}" text-anchor="${i === 0 ? "start" : "middle"}" class="pc-axis pc-wk">S${off / 7 + 1}</text><text x="${xx}" y="${H - P.b + 28}" text-anchor="${i === 0 ? "start" : "middle"}" class="pc-axis">${d.slice(8)}/${d.slice(5, 7)}</text>`;
    });
    const refLine =
      ref != null && ref >= lo && ref <= hi
        ? `<line x1="${P.l}" x2="${W - P.r}" y1="${y(ref).toFixed(1)}" y2="${y(ref).toFixed(1)}" class="pc-ref"/><text x="${W - P.r}" y="${(y(ref) - 5).toFixed(1)}" text-anchor="end" class="pc-axis pc-ref-t">meta ${fmt(ref)}</text>`
        : "";
    let body = "", last = null;
    for (const l of lines) {
      if (l.dots) {
        const p = pts(l.values);
        if (p.length > 1) body += `<polyline points="${p.map((q) => q.map((n) => n.toFixed(1)).join(",")).join(" ")}" class="pc-link"/>`;
        body += l.values.map((v, i) => (v == null ? "" : `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" class="${l.cls}"><title>${days[i].slice(8)}/${days[i].slice(5, 7)} · ${fmt(v)} kg</title></circle>`)).join("");
        const li = l.values.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0).at(-1);
        if (li != null) last = { i: li, v: l.values[li] };
      } else {
        const p = pts(l.values);
        if (p.length > 1) body += `<path d="${smooth(p)}" class="${l.cls}"/>`;
        else if (p.length === 1) body += `<circle cx="${p[0][0].toFixed(1)}" cy="${p[0][1].toFixed(1)}" r="3" class="pc-line-pt"/>`;
      }
    }
    const lastLab = last
      ? `<circle cx="${x(last.i).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="6.5" class="pc-last"/><text x="${(x(last.i) + 10).toFixed(1)}" y="${(y(last.v) + 4).toFixed(1)}" class="pc-last-t">${fmt(last.v)}</text>`
      : "";
    return `<svg class="panel-chart pc-weight" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de peso diario y tendencia">${grid}${weeksAx}${refLine}${body}${lastLab}</svg>`;
  }
  // Barras horizontales simples (etiqueta · barra · valor).
  function bars(rows, unit = "", max) {
    const m = max || Math.max(1, ...rows.map((r) => Math.abs(r.value)));
    return `<div class="panel-bars">${rows
      .map(
        (r) =>
          `<div class="panel-bar"><span>${r.label}</span><div class="panel-bar-track"><i class="${r.cls || ""}" style="width:${Math.min(100, (Math.abs(r.value) / m) * 100).toFixed(1)}%"></i></div><b>${r.text ?? fmt(r.value) + unit}</b></div>`,
      )
      .join("")}</div>`;
  }
  // Progreso semanal (r99): tarjeta compacta con 5 pilares de 20 %.
  const WP_ICONS = {
    deficit: '<path d="M12 3c.5 3.2 4.5 5.6 4.5 10a4.5 4.5 0 0 1-9 0c0-2.2 1.2-3.6 2.3-4.8.4 1.4 1.1 2.3 2 2.6C11.4 8.6 11 5.6 12 3z"/>',
    strength: '<path d="M2.5 10v4M5.5 7v10M18.5 7v10M21.5 10v4M5.5 12h13"/>',
    cardio: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M10 2.5h4M18.4 6.6l1.4-1.4"/>',
    judo: '<path d="M4 4l16 16M20 4L4 20M6 11l-2 2M18 11l2 2M11 6l2-2M11 18l2 2"/>',
    steps: '<path d="M8 3.5c1.8 0 2.8 2 2.8 4.6 0 2.3-.9 3.4-2.8 3.4S5.2 10.4 5.2 8.1C5.2 5.5 6.2 3.5 8 3.5zM6 14h4v2a2 2 0 0 1-4 0zM16 7.5c1.8 0 2.8 2 2.8 4.6 0 2.3-.9 3.4-2.8 3.4s-2.8-1.1-2.8-3.4c0-2.6 1-4.6 2.8-4.6zM14 18h4v.5a2 2 0 0 1-4 0z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const wpIcon = (k, cls = "wp-ico") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${WP_ICONS[k]}</svg>`;
  const wpPrev = {};
  // Barra animada: parte del valor anterior y crece hasta el nuevo (sin animación si se pide movimiento reducido).
  const wpBar = (key, pct, label, cls = "") => {
    const to = Math.max(0, Math.min(100, pct)),
      from = wpPrev[key] ?? 0;
    wpPrev[key] = to;
    return `<div class="wp-track ${cls}" role="progressbar" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(to)}" aria-valuetext="${Math.round(to)} %"><div class="wp-fill" style="--wp-from:${(from / 100).toFixed(4)};--wp-to:${(to / 100).toFixed(4)}"></div></div>`;
  };
  function weeklyProgress() {
    if (!C.validDate(program.start)) return "";
    const w = week();
    if (!w) return "";
    const r = weekReview(w);
    if (!r) return "";
    const start = C.datePlus(program.start, (w - 1) * 7),
      end = C.datePlus(program.start, w * 7 - 1);
    const sess = program.sessions.filter((x) => x.date >= start && x.date <= end);
    const judoDays = new Set(sess.filter((x) => x.mode === "Judo").map((x) => x.date)).size,
      cardioMinutes = sess.filter((x) => x.mode !== "Judo").reduce((sum, x) => {
        const minutes = Number(x.minutes);
        return sum + (Number.isFinite(minutes) && minutes > 0 ? minutes : 0);
      }, 0);
    const hoursText = (minutes) => {
      const rounded = Math.round(minutes), h = Math.floor(rounded / 60), m = rounded % 60;
      return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
    };
    const weekDays = Array.from({ length: 7 }, (_, i) => program.diary[C.datePlus(start, i)]);
    const stepsGoal = Math.round((C.goals().steps || 800000) / W()),
      steps = weekDays.reduce((n, d) => n + (d && C.has(d.steps) ? Number(d.steps) || 0 : 0), 0);
    const completeDays = weekDays.filter((d) => d && C.confirmed(d) !== null).length;
    const goal = C.NEEDED * 7,
      cap = (v) => Math.max(0, Math.min(100, v));
    const parts = [
      { key: "deficit", name: "Déficit", pct: goal ? cap((r.defSum / goal) * 100) : 0, done: `${fmt(Math.round(r.defSum))} / ${fmt(goal)} kcal` },
      { key: "strength", name: "Fuerza", pct: r.strengthTotal ? cap((r.strengthDone / r.strengthTotal) * 100) : 0, done: `${r.strengthDone} / ${r.strengthTotal} ejercicios` },
      { key: "cardio", name: "Cardio", pct: cap((cardioMinutes / 180) * 100), done: `${hoursText(cardioMinutes)} / 3 h` },
      { key: "judo", name: "Judo", pct: cap((judoDays / 3) * 100), done: `${judoDays} / 3 días` },
      { key: "steps", name: "Pasos", pct: stepsGoal ? cap((steps / stepsGoal) * 100) : 0, done: `${fmt(steps)} / ${fmt(stepsGoal)} pasos` },
    ];
    const total = parts.reduce((a, x) => a + x.pct, 0) / parts.length;
    // Meta de peso: misma fórmula que la tarjeta de peso (promedio semanal más reciente).
    const initial = Number(program.initialWeight) || 85,
      target = initial - C.GOAL_KG,
      rows = C.series(program),
      curW = rows[w] && rows[w].actual != null ? rows[w] : rows.filter((x) => x.week > 0 && x.actual != null).at(-1),
      current = curW ? curW.actual : initial,
      weightPct = Math.max(0, Math.min(100, ((initial - current) / (initial - target)) * 100));
    const pad = (n) => String(n).padStart(2, "0");
    // r106: resumen de texto para compartir (WhatsApp, correo o notas).
    const dm = (d) => d.slice(8) + "/" + d.slice(5, 7);
    const prevW = rows.slice(0, w).filter((x) => x.actual != null).at(-1);
    const weightLine = rows[w] && rows[w].actual != null
      ? `⚖️ Peso: ${fmt(rows[w].actual)} kg promedio${prevW ? ` (${rows[w].actual - prevW.actual <= 0 ? "−" : "+"}${fmt(Math.abs(rows[w].actual - prevW.actual))} kg vs ${prevW.week ? "S" + prevW.week : "inicio"})` : ""} · meta ${fmt(target)} kg`
      : `⚖️ Peso: sin pesadas esta semana · meta ${fmt(target)} kg`;
    shareText = [
      `EVÓ · Semana ${w} de ${W()} (${dm(start)}–${dm(end)})`,
      weightLine,
      `🔥 Déficit: ${parts[0].done} (${completeDays}/7 días cerrados)`,
      `🏋️ Fuerza: ${parts[1].done}`,
      `🏃 Cardio: ${hoursText(cardioMinutes)} · 🥋 Judo: ${judoDays} día${judoDays === 1 ? "" : "s"}`,
      `👣 Pasos: ${parts[4].done}`,
      `Avance de la semana: ${Math.round(total)} %`,
    ].join("\n");
    const cards = parts
      .map((x) => {
        const ok = x.pct >= 100;
        return `<li class="wp-card${ok ? " is-done" : ""}${x.key === "steps" ? " wp-wide" : ""}" aria-label="${x.name}: ${Math.round(x.pct)} %, ${escape(x.done)}${ok ? ", completado" : ""}"><div class="wp-card-head">${wpIcon(x.key)}<span>${x.name}</span></div><div class="wp-pct"><b>${Math.round(x.pct)}</b><small>%</small></div><p class="wp-done">${escape(x.done)}</p>${ok ? `<p class="wp-ok">${wpIcon("check", "wp-ico wp-check")}Completado</p>` : ""}${wpBar(x.key, x.pct, x.name + ": progreso semanal", "wp-thin")}</li>`;
      })
      .join("");
    const rules = `<details class="wp-how"><summary>Cómo se calcula</summary><ul class="tiny subtle"><li>Cada pilar aporta 20 % al avance semanal; su aporte se limita a 100 %, aunque se muestra la cantidad real.</li><li>Déficit: balance neto (Whoop − comidas) de los días cerrados con todas las comidas y el Whoop final; los superávits restan. Meta: ${fmt(goal)} kcal por semana.</li><li>Fuerza: ejercicios completados de la rutina de la semana.</li><li>Cardio: minutos de actividades registradas sin judo; varias sesiones del mismo día se suman. Meta: 3 h.</li><li>Judo: días distintos con judo. Meta: 3 días.</li><li>Pasos: suma de los pasos diarios. Meta: el reto total de pasos repartido en ${W()} semanas.</li></ul></details>`;
    return `<article class="wp" aria-labelledby="wpTitle"><header class="wp-top"><span class="wp-brand">EVÓ</span><div class="wp-goal"><span>Meta de peso</span><b>${Math.round(weightPct)} %</b>${wpBar("weight", weightPct, "Progreso hacia la meta de peso", "wp-mini")}</div></header>
      <div class="wp-body"><div class="wp-title"><div><p class="wp-eyebrow">TU AVANCE</p><h3 id="wpTitle">Semana ${pad(w)} <small>/ ${pad(W())}</small></h3></div><p class="wp-total" aria-label="Avance semanal ${Math.round(total)} %"><b>${Math.round(total)}</b><small>%</small></p></div>
      ${wpBar("total", total, `Avance de la semana ${w}`, "wp-main")}
      <ul class="wp-grid">${cards}</ul>
      <footer class="wp-foot"><p><span class="wp-dot${completeDays >= 7 ? " is-full" : ""}" aria-hidden="true"></span>${completeDays >= 7 ? "Balance completo · 7/7 días" : `Balance parcial · ${completeDays}/7 días completos`}</p><button type="button" class="wp-share" data-share-week>Compartir resumen</button>${rules}</footer></div></article>`;
  }
  function panelWeight(days) {
    const initial = Number(program.initialWeight) || 85,
      target = initial - C.GOAL_KG;
    const rows = C.series(program),
      wk = week(),
      cur = rows[wk] && rows[wk].actual != null ? rows[wk] : rows.filter((r) => r.week > 0 && r.actual != null).at(-1),
      prev = cur ? rows.slice(0, cur.week).filter((r) => r.actual != null).at(-1) : null;
    const current = cur ? cur.actual : initial,
      pct = Math.max(0, Math.min(100, ((initial - current) / (initial - target)) * 100));
    const daily = days.map((d) => weightOn(d));
    const ma = days.map((d, i) => {
      const v = [];
      for (let k = 0; k < 7; k++) {
        const w = weightOn(C.datePlus(d, -k));
        if (w) v.push(w);
      }
      return v.length >= 2 && d <= today() ? v.reduce((a, b) => a + b, 0) / v.length : null;
    });
    const n = daily.filter((v) => v).length;
    const chart =
      n >= 1
        ? lineChart(days, [{ values: ma, cls: "pc-line" }, { values: daily, cls: "pc-dot", dots: true }], target) +
          `<p class="panel-legend"><span class="lg-dot"></span>Pesada diaria <span class="lg-line"></span>Tendencia · promedio de 7 días${daily.some((v) => v && v - target < 4) ? ' <span class="lg-ref"></span>Meta' : ""}</p>`
        : note(n ? "Solo hay una pesada en este periodo. Con dos o más verás la curva y el promedio móvil." : "No hay pesadas en este periodo. Registra tu peso en Hoy → Registrar peso.");
    const weeks = rows.filter((r) => r.week > 0 && r.actual != null && days.some((d) => weekOf(d) === r.week));
    const weekly = weeks.length ? `<div class="scroll"><table class="weight-week-table"><thead><tr><th>Semana</th><th>Promedio</th><th>Pesajes</th><th>Cambio</th></tr></thead><tbody>${weeks.map((r,i)=>{
      const before=i?weeks[i-1].actual:initial;
      const count=Array.from({length:7},(_,j)=>weightOn(C.datePlus(program.start,(r.week-1)*7+j))).filter(v=>v!=null).length;
      return `<tr><td>S${r.week}</td><td>${fmt(r.actual)} kg</td><td>${count}</td><td>${signed(r.actual-before,' kg')}</td></tr>`;
    }).join('')}</tbody></table></div>` : '';
    return `<article class="panel-card"><div class="dash-head"><span>⚖️ Peso corporal</span><strong>${cur ? "Promedio S" + cur.week : "Inicio"}</strong></div>
      <div class="panel-stats">${stat("Inicial", fmt(initial) + " kg")}${stat("Actual", fmt(current) + " kg", cur ? "promedio semanal" : "")}${stat("Meta", fmt(target) + " kg")}${stat(
        "vs. semana anterior",
        cur && prev ? signed(cur.actual - prev.actual, " kg") : "—",
        cur && prev ? (prev.week ? "S" + prev.week : "peso inicial") : "",
      )}</div>
      <div class="dash-row"><span>Progreso hacia la meta</span><b>${Math.round(pct)} %</b></div>${bar(pct, 100)}
      <h4 class="panel-sub">Evolución diaria · kg</h4>${chart}<p class="tiny subtle">${n} pesajes en ${days.length} días. Los huecos indican días sin registro. La tendencia es el promedio de los pesajes de los últimos 7 días (mínimo 2) y suaviza las variaciones de agua y comida.</p>${weekly ? `<h4 class="panel-sub">Promedio semanal</h4>${weekly}<p class="tiny subtle">Cambio respecto a la anterior semana con datos; la primera se compara con el peso inicial. Más pesajes hacen el promedio más representativo.</p>` : ""}</article>`;
  }
  function panelTraining(days) {
    const set = new Set(days),
      sDates = [...strengthDates()].filter((d) => set.has(d)),
      sess = program.sessions.filter((s) => set.has(s.date));
    const weeks = [...new Set(days.map(weekOf).filter(Boolean))];
    const perWeek = weeks.map((w) => {
      const st = sDates.filter((d) => weekOf(d) === w).length,
        ca = sess.filter((s) => s.week === w || weekOf(s.date) === w).length;
      return { label: "S" + w, value: st + ca, text: `${st + ca} <em class="subtle">${st} pesas · ${ca} cardio</em>` };
    });
    const types = {};
    if (sDates.length) types["🏋️ Pesas"] = sDates.length;
    sess.forEach((s) => (types[s.mode] = (types[s.mode] || 0) + 1));
    const total = Object.values(types).reduce((a, b) => a + b, 0);
    // Evolución de cargas: mejor peso por semana (lb) de cada ejercicio con ≥ 2 semanas.
    const byEx = {};
    Object.entries(state.weights || {}).forEach(([k, v]) => {
      const m = /^(.*)-w(\d+)$/.exec(k),
        n = Number(v);
      if (!m || !(n > 0) || (weeks.length && !weeks.includes(Number(m[2])))) return;
      if ((EXERCISES.find((e) => e.id === m[1]) || {}).unit) return; // minutos o repeticiones, no carga
      (byEx[m[1]] ||= []).push([Number(m[2]), n]);
    });
    const loads = Object.entries(byEx)
      .filter(([, a]) => a.length >= 2)
      .map(([id, a]) => {
        a.sort((x, y) => x[0] - y[0]);
        const ex = EXERCISES.find((e) => e.id === id);
        return { name: ex ? ex.name : id, first: a[0], last: a.at(-1), delta: a.at(-1)[1] - a[0][1], pts: a };
      })
      .sort((a, b) => b.delta - a.delta);
    const one = Object.keys(byEx).length;
    const loadHtml = loads.length
      ? `<ul class="panel-loads">${loads
          .slice(0, 8)
          .map(
            (l) =>
              `<li><span>${escape(l.name)}</span><b>${fmt(L.show(l.first[1]))} → ${fmt(L.show(l.last[1]))} ${L.unit()}</b><em class="${l.delta > 0 ? "good" : l.delta < 0 ? "bad" : "subtle"}">${signed(L.show(l.last[1]) - L.show(l.first[1]))} · S${l.first[0]}→S${l.last[0]}</em></li>`,
          )
          .join("")}</ul>`
      : note(one ? `Tienes cargas de ${one} ejercicio${one > 1 ? "s" : ""} en una sola semana. La evolución aparece cuando repitas el ejercicio otra semana.` : "Aún no hay cargas registradas en este periodo.");
    // Volumen = Σ peso × repeticiones de las series completadas.
    const vol = {};
    allSets().forEach((sets) =>
      (sets || []).forEach((z) => {
        if (z && z.done && set.has(z.d) && Number(z.w) > 0 && Number(z.r) > 0) {
          const w = weekOf(z.d);
          vol[w] = (vol[w] || 0) + Number(z.w) * Number(z.r);
        }
      }),
    );
    const volRows = weeks.filter((w) => vol[w]).map((w) => ({ label: "S" + w, value: vol[w], text: fmt(Math.round(L.show(vol[w]))) + " " + L.unit() }));
    return `<article class="panel-card"><div class="dash-head"><span>🏋️ Entrenamiento</span><strong>${sDates.length + sess.length} sesiones</strong></div>
      <h4 class="panel-sub">Entrenamientos por semana</h4>${perWeek.some((r) => r.value) ? bars(perWeek) : note("No hay entrenamientos registrados en este periodo.")}
      <h4 class="panel-sub">Distribución por tipo</h4>${total ? `<div class="panel-split">${Object.entries(types)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<span style="flex:${v}" title="${escape(k)}">${escape(k)} · ${v}</span>`)
        .join("")}</div>` : note("Sin sesiones para repartir por tipo.")}
      <h4 class="panel-sub">Evolución de cargas</h4>${loadHtml}
      <h4 class="panel-sub">Volumen semanal</h4>${volRows.length ? bars(volRows) : note("El volumen (peso × repeticiones) aparece cuando completes series con peso y repeticiones en Entreno.")}</article>`;
  }
  function panelFood(days) {
    const logged = days.map((d) => [d, program.diary[d]]).filter(([, d]) => d && (d.meals || []).length),
      whoop = days.map((d) => program.diary[d]).filter((d) => d && C.has(d.whoop));
    if (!logged.length && !whoop.length)
      return `<article class="panel-card"><div class="dash-head"><span>🍽 Alimentación</span></div>${note("No hay comidas ni calorías de Whoop en este periodo.")}</article>`;
    const closed = logged.filter(([, d]) => d.closed),
      avgIn = closed.length ? closed.reduce((n, [, d]) => n + C.intake(d), 0) / closed.length : null,
      avgOut = whoop.length ? whoop.reduce((n, d) => n + Number(d.whoop), 0) / whoop.length : null,
      inside = closed.filter(([, d]) => C.intake(d) <= kcalTarget()).length,
      open = logged.length - closed.length;
    const weeks = [...new Set(days.map(weekOf).filter(Boolean))];
    const bal = weeks
      .map((w) => {
        const ds = days.filter((d) => weekOf(d) === w).map((d) => program.diary[d]).filter((d) => C.confirmed(d) !== null);
        const s = ds.reduce((n, d) => n + C.confirmed(d), 0);
        return ds.length ? { label: "S" + w, value: s, cls: s >= 0 ? "good" : "bad", text: `${signed(Math.round(s))} kcal <em class="subtle">${ds.length} d · meta ${fmt(ds.length * C.NEEDED)}</em>` } : null;
      })
      .filter(Boolean);
    return `<article class="panel-card"><div class="dash-head"><span>🍽 Alimentación</span><strong>${logged.length} días con comidas</strong></div>
      <div class="panel-stats">${stat("Consumo medio", avgIn != null ? fmt(Math.round(avgIn)) + " kcal" : "Datos insuficientes", closed.length + " días cerrados")}${stat("Gasto medio (Whoop)", avgOut != null ? fmt(Math.round(avgOut)) + " kcal" : "—", whoop.length + " días")}${stat(
        "Dentro del objetivo",
        closed.length ? `${inside}/${closed.length}` : "—",
        `días cerrados · ≤ ${fmt(kcalTarget())} kcal${open ? ` · ${open} sin cerrar` : ""}`,
      )}</div>${closed.length ? bar(inside, closed.length) : ""}
      <h4 class="panel-sub">Balance energético semanal</h4>${bal.length ? bars(bal) + `<p class="tiny subtle">Positivo = déficit (gasto Whoop − consumo). Solo días cerrados con Whoop.</p>` : note("Datos insuficientes: el balance necesita días cerrados con Whoop.")}</article>`;
  }
  function panel() {
    if (!C.validDate(program.start)) return note("Elige la fecha de inicio del programa para ver el panel.");
    const n = RANGES.includes(Number(program.insightRange)) ? Number(program.insightRange) : 30,
      days = rangeDays(n);
    const filter = `<nav class="subtabs panel-range" aria-label="Periodo">${RANGES.map((r) => `<button data-insight-range="${r}" aria-pressed="${r === n}">${r} días</button>`).join("")}</nav>`;
    const span = `<p class="tiny subtle">${days[0]} → ${days.at(-1)} · ${days.length} día${days.length > 1 ? "s" : ""}${days.length < n ? " (desde el inicio del programa)" : ""}</p>`;
    return `<div class="panel">${weeklyProgress()}${filter}${span}${panelWeight(days)}${panelTraining(days)}${panelFood(days)}</div>`;
  }
  return { panel: sync(panel), weekReview: sync(weekReview), weeklyProgress: sync(weeklyProgress) };
};
