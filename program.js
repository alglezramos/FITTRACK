(() => {
  "use strict";
  const root = document.getElementById("programView"),
    strength = document.getElementById("strengthView");
  const C = window.FitCore;
  const today = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  let program = {
    cookedVersion: 1,
    view: "home",
    start: "",
    initialWeight: "",
    weekend: "Sábado",
    weeks: {},
    sessions: [],
    diary: {},
    meds: {},
    medStart: "",
    medFrequency: "",
    customFoods: [],
    customMenus: [],
  };
  const defaults = JSON.parse(JSON.stringify(program));
  try {
    const v = FitStore.get("program");
    if (v) {
      const migrated = C.validate(FitCalendar.migrate(v));
      program = { ...program, ...migrated };
    }
  } catch (err) {
    alert(
      "No se pudo leer la copia guardada: " +
        err.message +
        ". Los datos originales se conservan; importa una copia desde Opciones.",
    );
  }
  program.recordDay ??= 0;
  let pendingJump = null;
  program.medFrequency = "daily";
  if (["tracking", "summary", "wellness", "missions"].includes(program.view)) {
    program.progressTab =
      program.view === "wellness"
        ? "wellbeing"
        : program.view === "missions"
          ? "missions"
          : program.progressTab || "weight";
    program.view = "progress";
  }
  if (!["home", "food", "training", "progress", "history"].includes(program.view)) program.view = "home";
  if (program.trainingTab === "calendar") program.trainingTab = "strength";
  const escape = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const fmt = (n) => Number(n).toLocaleString("es-CR", { maximumFractionDigits: 1 });
  const week = () => Number(document.getElementById("week").value) || 1;
  const date = () => FitCalendar.date(program.start, week(), program.recordDay);
  window.fitSheetDate = date;
  const dayLabel = (i) => {
    const d = FitCalendar.date(program.start, week(), i);
    return d
      ? "Día " +
          (i + 1) +
          " · " +
          new Date(d + "T12:00:00Z").toLocaleDateString("es-CR", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            timeZone: "UTC",
          })
      : "Día " + (i + 1);
  };
  function goDate(d) {
    const pos = FitCalendar.position(program.start, d);
    if (!pos) {
      alert(
        "Ese registro está fuera de las 8 semanas actuales. Se conserva en el historial y en la copia exportada.",
      );
      return;
    }
    state.week = pos.week;
    program.recordDay = pos.day;
    program.menuDay = pos.day;
    save();
    render();
    persist();
    show();
  }
  function syncCalendar() {
    program.menuDay = program.recordDay;
    document.getElementById("programStart").value = program.start;
    document.getElementById("recordDay").innerHTML = Array.from(
      { length: 7 },
      (_, i) => `<option value="${i}" ${i === program.recordDay ? "selected" : ""}>${dayLabel(i)}</option>`,
    ).join("");
    document.getElementById("recordDate").textContent = date()
      ? "Registro: " + date() + " · fin: " + C.datePlus(program.start, 55)
      : "Elige el inicio para registrar tus avances.";
  }
  const persist = () => {
    try {
      FitStore.set("program", program);
    } catch {
      alert("No se pudieron guardar los datos. Exporta una copia antes de cerrar.");
    }
  };
  const nutrition = window.createFitNutrition({
    getProgram: () => program,
    persist,
    week,
    date,
    dayLabel,
    goDate,
    escape,
    root,
    rerender: show,
  });
  const challenges = window.createFitChallenges({
    getProgram: () => program,
    persist,
    week,
    date,
    escape,
    root,
    rerender: show,
  });
  const wellbeing = window.createFitWellbeing({
    getProgram: () => program,
    persist,
    date,
    today,
    escape,
    root,
    rerender: show,
  });
  const dashboard = window.createFitSummary({
    getProgram: () => program,
    today,
    escape,
    challenges,
    week,
    root,
    persist,
    rerender: show,
  });
  const coach = window.createFitCoach({
    getProgram: () => program,
    persist,
    date,
    today,
    escape,
    root,
    rerender: show,
    challenges,
  });
  const modes = ["Judo", "Caminar", "Nadar", "Rucking", "Correr", "Bicicleta", "Hiking"];
  const modeIcons = {
    Judo: "🥋",
    Caminar: "🚶",
    Nadar: "🏊",
    Rucking: "🎒",
    Correr: "🏃",
    Bicicleta: "🚴",
    Hiking: "🥾",
  };
  const modeDescriptions = {
    Judo: "Registra duración y esfuerzo de la sesión, incluyendo las pausas.",
    Caminar: "Registra duración y distancia si la conoces.",
    Nadar: "Usa metros para la distancia. Evita movimientos que provoquen dolor de hombro.",
    Rucking: "Caminata con mochila: registra distancia y carga. Posponer si hay inestabilidad de rodilla.",
    Correr: "Registra tiempo y distancia; posponer si hay dolor o falla de rodilla.",
    Bicicleta: "Registra tiempo, esfuerzo y distancia si está disponible.",
    Hiking: "Senderismo: tiempo, distancia y carga de mochila opcional.",
  };
  function medPanel() {
    const taken = !!program.meds[date()];
    const from = program.start;
    let eligible = [];
    if (C.validDate(from) && program.medFrequency === "daily") {
      const end = C.datePlus(from, 55);
      for (let d = from; d <= today() && d <= end; d = C.datePlus(d, 1)) eligible.push(d);
    }
    const n = eligible.filter((d) => program.meds[d]).length;
    return `<article><div class="eyebrow">SUPLEMENTOS</div><h3>Minoxidil + Dutasteride</h3><p>Tu pauta indicada: <strong>1 cápsula diaria de minoxidil + dutasteride</strong>. Marca «Tomado» después de tomarla.</p><button id="medTaken" class="${taken ? "primary" : ""}" aria-pressed="${taken}" ${date() > today() ? "disabled" : ""}>${taken ? "✓ Tomado · desmarcar" : "Marcar como tomado"}</button><p>${program.medFrequency === "daily" && eligible.length ? `${n}/${eligible.length} días transcurridos · ${Math.round((n / eligible.length) * 100)}% registrados` : "Configura la frecuencia prescrita para calcular el porcentaje."}</p><details><summary>Frecuencia e historial de 8 semanas</summary><p>Inicio del control: ${escape(from || "pendiente")}</p><p><strong>Frecuencia: 1 cápsula diaria.</strong></p><p class="tiny subtle">Pauta registrada según tu indicación. «Sin registro» no significa necesariamente que omitiste la toma.</p><div class="med-grid">${
      C.validDate(from)
        ? Array.from({ length: 56 }, (_, i) => {
            const d = C.datePlus(from, i);
            return `<button data-med-date="${d}" aria-label="${d}: ${program.meds[d] ? "tomado" : "sin registro"}" class="${program.meds[d] ? "taken" : ""}" ${d > today() ? "disabled" : ""}>${i + 1}${program.meds[d] ? " ✓" : ""}</button>`;
          }).join("")
        : "Selecciona una fecha de inicio."
    }</div></details></article>`;
  }
  function calendar() {
    const letters = ["L", "M", "X", "J", "V", "S", "D"],
      names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const plan = (i) =>
      i < 5
        ? "Pesas · día " + (i + 1) + " + " + ([0, 2, 4].includes(i) ? "Judo" : "Natación")
        : i === 5
          ? "Fondo o hiking"
          : "Recuperación";
    const icon = (i) => (i < 5 ? ([0, 2, 4].includes(i) ? "🥋" : "🏊") : i === 5 ? "🥾" : "😴");
    const cur = C.validDate(date()) ? (new Date(date() + "T12:00:00Z").getUTCDay() + 6) % 7 : -1;
    const dayDate = (i) => {
      for (let k = 0; k < 7; k++) {
        const x = FitCalendar.date(program.start, week(), k);
        if (x && (new Date(x + "T12:00:00Z").getUTCDay() + 6) % 7 === i) return x;
      }
      return "";
    };
    return `<article class="week-strip"><div class="card-head"><h3>Tu semana</h3><span>Semana ${week()} de 8</span></div><div class="strip">${letters
      .map((l, i) => {
        const x = dayDate(i);
        return `<div class="strip-day${i === cur ? " is-current" : ""}" title="${names[i]}: ${plan(i)}"><b>${l}</b><small>${x ? x.slice(8) : ""}</small><span aria-hidden="true">${icon(i)}</span></div>`;
      })
      .join(
        "",
      )}</div>${cur >= 0 ? `<p class="strip-today"><strong>${names[cur]}:</strong> ${plan(cur)}</p>` : ""}<p class="tiny subtle">Ajusta la carga a tu recuperación. Si hay dolor, bloqueo o inestabilidad, suspende la actividad que lo provoca.</p></article>`;
  }
  function niceDate(d) {
    if (!d) return "";
    const raw = new Date(d + "T12:00:00Z").toLocaleDateString("es-CR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  const weighKey = (d) =>
    ({ 1: "weight1", 2: "weight4", 3: "weight2", 4: "weight5", 5: "weight3" })[new Date(d + "T12:00:00Z").getUTCDay()] || null;
  function route(upTo) {
    /* déficit acumulado (días con Whoop) frente a la ruta de 10 kg */ let n = 0,
      def = 0;
    for (let i = 0; i < 56; i++) {
      const day = C.datePlus(program.start, i);
      if (day > upTo) break;
      const d = program.diary[day];
      if (d && C.balance(d) !== null) {
        n++;
        def += C.balance(d);
      }
    }
    return { n, def, gap: def - n * C.NEEDED };
  }
  // ── Dashboard «Hoy»: centro de control diario ─────────────────────────────
  const KCAL_TARGET = 1800;
  // Plan del día según el día de la semana (igual que «Tu semana»).
  function planFor(dt) {
    const i = (new Date(dt + "T12:00:00Z").getUTCDay() + 6) % 7;
    return i < 5
      ? { label: "Pesas · Día " + (i + 1) + " + " + ([0, 2, 4].includes(i) ? "Judo" : "Natación"), day: i + 1 }
      : i === 5
        ? { label: "Fondo o hiking", day: 0 }
        : { label: "Recuperación", day: 0 };
  }
  // Pesada de una fecha (lunes a viernes), en kg.
  function weightOn(day) {
    const pos = FitCalendar.position(program.start, day),
      k = weighKey(day);
    if (!pos || !k) return null;
    const v = Number((program.weeks[pos.week] || {})[k]);
    return v > 0 ? v : null;
  }
  // Día con actividad: cardio, fuerza (serie o ejercicio completado) o reto.
  function activeOn(day) {
    if (program.sessions.some((x) => x.date === day)) return true;
    if (Object.values(state.completedDates || {}).includes(day)) return true;
    if (Object.values(state.sets || {}).some((sets) => (sets || []).some((z) => z && z.done && z.d === day))) return true;
    return Object.values(program.challenges || {}).some((c) => (c.logs || []).some((l) => l.date === day));
  }
  function streak(dt) {
    let n = 0,
      day = activeOn(dt) ? dt : C.datePlus(dt, -1);
    while (day >= program.start && activeOn(day) && n < 400) {
      n++;
      day = C.datePlus(day, -1);
    }
    return n;
  }
  const bar = (v, max, cls = "") =>
    `<div class="weight-progress-track dash-bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.round(v)}"><div class="weight-progress-fill" style="width:${max ? Math.min(100, (v / max) * 100).toFixed(1) : 0}%"></div></div>`;
  function hoy() {
    const dt = date(),
      d = program.diary[dt] || { meals: [] },
      kcal = C.intake(d),
      b = C.balance(d),
      wk = C.validDate(dt) ? weighKey(dt) : null,
      wv = (program.weeks[week()] || {})[wk];
    const r = C.validDate(program.start) ? route(dt) : { n: 0, def: 0, gap: 0 };
    const sessions = program.sessions.filter((s) => s.date === dt);
    if (!C.validDate(dt))
      return `<article id="sec-day"><h2>Selecciona el inicio</h2><p>Configura el inicio del programa en ⚙ Opciones.</p></article>`;
    // Calorías
    const over = kcal > KCAL_TARGET,
      ok = !over && b !== null && b >= C.NEEDED,
      status = b === null ? ["", "Carga el Whoop para ver el balance"] : ok ? ["good", "✓ Día en objetivo"] : over ? ["bad", "Sobre el objetivo de consumo"] : ["warn", "Déficit por debajo de lo necesario"];
    const kcalCard = `<article class="dash-card"><div class="dash-head"><span>🔥 Calorías</span><strong class="${status[0]}">${status[1]}</strong></div><div class="dash-big"><strong>${fmt(kcal)}</strong><span>/ ${fmt(KCAL_TARGET)} kcal consumidas</span></div>${bar(kcal, KCAL_TARGET, over ? "is-over" : "")}<div class="dash-row"><div><span>Gastadas</span><strong>${C.has(d.whoop) ? fmt(d.whoop) : "—"}</strong></div><div><span>Balance</span><strong>${b === null ? "—" : (b >= 0 ? "−" : "+") + fmt(Math.abs(b))}</strong></div><div><span>Necesario</span><strong>−${fmt(C.NEEDED)}</strong></div></div><p class="tiny subtle">${r.n ? `Ruta −${C.GOAL_KG} kg: vas <b>${fmt(Math.abs(r.gap))} kcal ${r.gap >= 0 ? "por delante" : "por detrás"}</b> (${r.n} días con Whoop).` : "Cuando cargues el Whoop verás si vas en ruta."}</p></article>`;
    // Actividad
    const plan = planFor(dt),
      todaySets = Object.values(state.sets || {}).reduce((n, sets) => n + (sets || []).filter((z) => z && z.done && z.d === dt).length, 0),
      todayEx = Object.values(state.completedDates || {}).filter((x) => x === dt).length;
    const actCard = `<article class="dash-card"><div class="dash-head"><span>🏋️ Actividad</span><strong>${plan.label}</strong></div><div class="dash-row"><div><span>Ejercicios</span><strong>${todayEx || "—"}</strong></div><div><span>Series</span><strong>${todaySets || "—"}</strong></div><div><span>Pasos</span><strong>${C.has(d.steps) ? fmt(d.steps) : "—"}</strong></div></div>${sessions.length ? `<ul class="dash-list">${sessions.map((s) => `<li>${escape(s.mode)} · ${s.minutes} min${s.distance ? " · " + escape(s.distance) + " " + escape(s.unit || "km") : ""}</li>`).join("")}</ul>` : '<p class="tiny subtle">Sin actividades de cardio registradas.</p>'}</article>`;
    // Progreso: peso, variación 7 días y racha
    // Peso: promedio de las pesadas de la semana frente a la semana anterior con datos.
    const rows = C.series(program),
      wN = week(),
      avg = rows[wN] && rows[wN].actual !== null ? rows[wN].actual : null;
    let prevAvg = null,
      prevLabel = "";
    for (let k = wN - 1; k >= 0; k--)
      if (rows[k] && rows[k].actual !== null) {
        prevAvg = rows[k].actual;
        prevLabel = k ? "vs S" + k : "vs inicio";
        break;
      }
    const nWeigh = ["weight1", "weight4", "weight2", "weight5", "weight3"].filter((k) => Number((program.weeks[wN] || {})[k]) > 0).length,
      diff = avg !== null && prevAvg !== null ? avg - prevAvg : null,
      initial = Number(program.initialWeight) || null,
      target = initial ? initial - C.GOAL_KG : null,
      lost = avg !== null && initial ? initial - avg : 0,
      st = streak(dt);
    const progCard = `<article class="dash-card" id="dashWeight"><div class="dash-head"><span>📉 Progreso</span><strong>🔥 Racha: ${st} día${st === 1 ? "" : "s"}</strong></div><div class="dash-row"><div><span>Promedio S${wN}</span><strong>${avg !== null ? fmt(avg) + " kg" : "—"}</strong><small>${nWeigh} pesada${nWeigh === 1 ? "" : "s"}</small></div><div><span>${prevLabel || "Semana anterior"}</span><strong class="${diff === null ? "" : diff <= 0 ? "good" : "bad"}">${diff === null ? "—" : (diff > 0 ? "+" : "") + fmt(diff) + " kg"}</strong></div><div><span>Meta</span><strong>${target ? fmt(target) + " kg" : "—"}</strong></div></div>${target ? bar(Math.max(0, lost), C.GOAL_KG) + `<p class="tiny subtle">${fmt(Math.max(0, lost))} de ${C.GOAL_KG} kg bajados</p>` : ""}${wk ? `<label class="weight-day dash-weigh">Peso de hoy <input data-weight-metric="${wk}" type="number" min="20" max="400" step="0.1" inputmode="decimal" value="${escape(wv ?? "")}"><span>kg</span></label>` : '<p class="tiny subtle">Pesadas: de lunes a viernes.</p>'}</article>`;
    // Retos principales
    const goals = challenges.planProgress().slice(0, 4);
    const retoCard = `<article class="dash-card"><div class="dash-head"><span>🎯 Retos</span><button type="button" class="dash-link" data-home-go="training" data-jump-after="sec-retos">Ver todos →</button></div>${goals.map((g) => `<div class="dash-goal"><div><span>${escape(g.name)} ${challenges.badge(g)}</span><small>${fmt(Math.round(g.completed * 10) / 10)} / ${fmt(g.target)} ${escape(g.unit)}</small></div>${bar(g.completed, g.target)}</div>`).join("")}</article>`;
    const quick = `<nav class="dash-quick" aria-label="Accesos rápidos"><button type="button" data-quick-food>🍽<span>Comida</span></button><button type="button" data-jump="dashWeight">⚖️<span>Peso</span></button><button type="button" data-home-go="training">🏋️<span>Entrenar</span></button><button type="button" data-home-go="training" data-jump-after="cardioEntry">🏃<span>Actividad</span></button></nav>`;
    return `<article id="sec-day" class="dash-top"><div class="eyebrow">HOY · SEMANA ${week()} DE 8 · META −${C.GOAL_KG} KG</div><h2>${escape(niceDate(dt))}</h2>${dt !== today() ? "<p><button data-go-today>↩ Volver a hoy</button></p>" : ""}${quick}</article><div class="dash-grid">${kcalCard}${actCard}${progCard}${retoCard}</div>${nutrition.renderQuick()}<div class="sec" id="sec-checkin">${coach.render()}</div><div class="sec" id="sec-log">${nutrition.renderDiary()}</div>`;
  }
  // ── Historial: todos los registros, día por día ──────────────────────────
  const HIST_FILTERS = [
    ["all", "Todo"],
    ["food", "Comida"],
    ["train", "Entreno"],
    ["body", "Peso y Whoop"],
    ["goals", "Retos"],
  ];
  function historyView() {
    const f = program.historyFilter || "all",
      show_ = (k) => f === "all" || f === k,
      lb = (v) => fmt(Math.round(v * 10) / 10);
    const exName = (id) => (EXERCISES.find((x) => x.id === id) || {}).name || id;
    const goalName = { pushups: "Push-ups", abs: "Abdominales", pullups: "Pull-ups", squats: "Sentadillas" };
    // Fechas con algún registro.
    const days = new Set(Object.keys(program.diary || {}));
    program.sessions.forEach((s) => s.date && days.add(s.date));
    Object.values(state.completedDates || {}).forEach((d) => d && days.add(d));
    Object.values(state.sets || {}).forEach((sets) => (sets || []).forEach((z) => z && z.d && days.add(z.d)));
    Object.values(program.challenges || {}).forEach((c) => (c.logs || []).forEach((l) => l.date && days.add(l.date)));
    Object.keys(program.meds || {}).forEach((d) => program.meds[d] && days.add(d));
    if (C.validDate(program.start)) for (let i = 0; i < 56; i++) { const d = C.datePlus(program.start, i); if (weightOn(d)) days.add(d); }
    const list = [...days].filter((d) => C.validDate(d) && d <= today()).sort().reverse();
    const cards = list
      .map((day, idx) => {
        const d = program.diary[day] || {},
          meals = d.meals || [],
          kcal = C.intake(d),
          bal = C.balance(d),
          pos = C.validDate(program.start) ? FitCalendar.position(program.start, day) : null,
          w = weightOn(day),
          sess = program.sessions.filter((s) => s.date === day),
          logs = Object.values(program.challenges || {}).flatMap((c) => (c.logs || []).filter((l) => l.date === day)),
          coachD = (program.coachDays || {})[day];
        // Fuerza: series hechas ese día o ejercicios completados ese día.
        const strengthRows = [];
        for (const [k, sets] of Object.entries(state.sets || {})) {
          const done = (sets || []).filter((z) => z && z.done && z.d === day);
          if (done.length) strengthRows.push(`<li>${escape(exName(k.replace(/-w\d+$/, "")))} · ${done.map((z) => lb(z.w) + "×" + z.r).join(" · ")} lb</li>`);
        }
        for (const [k, dd] of Object.entries(state.completedDates || {})) {
          if (dd !== day || (state.sets || {})[k]) continue;
          const v = state.weights[k];
          strengthRows.push(`<li>${escape(exName(k.replace(/-w\d+$/, "")))}${v ? " · " + lb(v) + " lb" : ""} ✓</li>`);
        }
        const parts = [];
        if (show_("body") && (C.has(d.whoop) || C.has(d.steps) || w))
          parts.push(`<div class="hist-sec"><h4>⚖️ Peso y Whoop</h4><p>${w ? `Peso <b>${fmt(w)} kg</b> · ` : ""}Whoop <b>${C.has(d.whoop) ? fmt(d.whoop) : "—"}</b> kcal · Pasos <b>${C.has(d.steps) ? fmt(d.steps) : "—"}</b>${bal !== null ? ` · ${bal >= 0 ? "Déficit" : "Superávit"} <b>${fmt(Math.abs(bal))}</b>` : ""}</p></div>`);
        if (show_("food") && meals.length)
          parts.push(`<div class="hist-sec"><h4>🍽 Comida · ${fmt(kcal)} kcal</h4><ul>${meals.map((m) => `<li><span class="subtle">${escape(m.kind || "")}</span> ${escape(m.name)} · ${fmt(Math.round(Number(m.kcal)))} kcal</li>`).join("")}</ul></div>`);
        if (show_("train") && (sess.length || strengthRows.length))
          parts.push(`<div class="hist-sec"><h4>🏋️ Entreno</h4><ul>${sess.map((s) => `<li>${escape(s.mode)} · ${s.minutes} min${s.distance ? " · " + escape(s.distance) + " " + escape(s.unit || "km") : ""} · esfuerzo ${s.effort}/10</li>`).join("")}${strengthRows.join("")}</ul></div>`);
        if (show_("goals") && logs.length)
          parts.push(`<div class="hist-sec"><h4>🔥 Retos</h4><p>${logs.map((l) => `${escape(goalName[l.goal] || l.goal)} ${l.reps}`).join(" · ")}</p></div>`);
        if (f === "all" && (program.meds[day] || (coachD && coachD.checkin)))
          parts.push(`<div class="hist-sec"><h4>📝 Otros</h4><p>${program.meds[day] ? "Suplemento ✓" : ""}${program.meds[day] && coachD && coachD.checkin ? " · " : ""}${coachD && coachD.checkin ? `Check-in: energía ${coachD.energy}/5${coachD.pain && coachD.pain !== "none" ? " · molestia: " + escape(coachD.pain === "shoulder" ? "hombro" : coachD.pain) : ""}` : ""}</p></div>`);
        if (!parts.length) return "";
        return `<details class="hist-day" ${idx < 7 ? "open" : ""}><summary><span><b>${escape(niceDate(day))}</b>${pos ? ` <small>· Semana ${pos.week}</small>` : ""}</span><span class="hist-tags">${d.closed ? '<em class="ok">✓ Cerrado</em>' : meals.length || C.has(d.whoop) ? "<em>Provisional</em>" : ""}${meals.length ? `<em>${fmt(kcal)} kcal</em>` : ""}</span></summary>${parts.join("")}<p class="hist-open"><button type="button" data-hist-open="${day}">Abrir este día en Hoy →</button></p></details>`;
      })
      .filter(Boolean);
    return `<article class="hist-head"><div class="eyebrow">HISTORIAL</div><h2>Todos tus registros</h2><p class="tiny subtle">${cards.length} día${cards.length === 1 ? "" : "s"} con registros · los 7 más recientes abiertos.</p><nav class="subtabs" aria-label="Filtrar historial">${HIST_FILTERS.map(([k, l]) => `<button data-history-filter="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</nav></article>${cards.join("") || '<article><p class="subtle">No hay registros para este filtro.</p></article>'}`;
  }
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
      if (d && C.balance(d) !== null) {
        defSum += C.balance(d);
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
    const left = 56 - 7 * w;
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
            ? `Estás ${fmt(over)} kg por encima de la ruta y ya no queda margen: acepta el rango real (8–9 kg es un gran resultado).`
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
    const strengthDone = EXERCISES.filter((x) => state.completed[x.id + "-w" + w]).length;
    return { w, cur, expected, rate, n, avgDef, defSum, waist: wd.waist, en, reco, tone, strengthDone };
  }
  function reviewCard() {
    if (!C.validDate(program.start) || !C.has(program.initialWeight))
      return "<article><h3>Cierre semanal</h3><p>Configura inicio y peso inicial en ⚙ Opciones.</p></article>";
    const w = week(),
      r = weekReview(w);
    if (!r) return "";
    return `<article id="sec-review"><div class="eyebrow">CIERRE SEMANAL · SEMANA ${w}</div><h3>¿Vas en ruta a −${C.GOAL_KG} kg?</h3><div class="daily-numbers"><div><span>Déficit semanal</span><strong>${r.n ? fmt(r.defSum) + " kcal" : "—"}</strong><p class="tiny subtle">Ruta: ${fmt(C.NEEDED * 7)} · ${r.n} de 7 días con Whoop</p></div><div><span>Cintura · Fuerza</span><strong>${C.has(r.waist) ? fmt(r.waist) + " cm" : "—"} · ${r.strengthDone}/${EXERCISES.length}</strong></div></div><p class="coach-reco ${r.tone}">${escape(r.reco)}</p><details><summary>Cómo se calcula</summary><p class="tiny subtle">Estimación con 7.700 kcal/kg: tiende a sobreestimar la pérdida real y las primeras semanas incluyen agua. Úsala como guía, no como promesa. El peso real y la ruta de la semana están en Pesadas.</p></details></article>`;
  }
  function progress() {
    const initial = Number(program.initialWeight) || 85,
      target = initial - C.GOAL_KG;
    const rows = C.series(program),
      recent = rows.filter((r) => r.week > 0 && r.actual !== null).at(-1);
    const current = recent ? recent.actual : initial;
    const pct = Math.max(0, Math.min(100, ((initial - current) / (initial - target)) * 100));
    const sub = program.progressTab || "weight";
    const tabs = `<nav class="subtabs" aria-label="Progreso">${[
      ["weight", "Peso y balance"],
      ["missions", "Misiones"],
      ["wellbeing", "Bienestar"],
    ]
      .map(([k, l]) => `<button data-progress-tab="${k}" aria-pressed="${sub === k}">${l}</button>`)
      .join("")}</nav>`;
    if (sub === "missions") return tabs + challenges.missions();
    if (sub === "wellbeing")
      return (
        tabs +
        `<p class="quote">Cada día construyo una versión más fuerte, sana y equilibrada de mí mismo.</p><div class="sec" id="sec-habits">${wellbeing.render()}${medPanel()}</div>`
      );
    return (
      tabs +
      `<article><h3>Camino hacia ${fmt(target)} kg</h3><div class="weight-progress-labels"><span>${fmt(initial)} kg · inicio</span><strong>${fmt(current)} kg · ${recent ? "promedio semana " + recent.week : "punto de partida"}</strong><span>${fmt(target)} kg · meta</span></div><div class="weight-progress-track" role="progressbar" aria-label="Progreso hacia la meta de peso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><div class="weight-progress-fill" style="width:${pct.toFixed(2)}%"></div></div></article>${reviewCard()}<div class="sec" id="sec-weight">${weight()}</div><div class="sec" id="sec-summary">${dashboard.render()}</div><div class="sec" id="sec-backup">${backup()}</div>`
    );
  }
  // Hoja única del día: la fuerza (strengthView) va arriba; aquí van cardio y retos.
  function training() {
    return (
      `<h3 class="sheet-label">🏃 Cardio</h3>` +
      cardio() +
      `<h3 class="sheet-label" id="sec-retos">🔥 Retos</h3>` +
      challenges.render() +
      calendar()
    );
  }
  function cardio() {
    const selected = program.cardioMode || "Judo";
    const dt = date();
    const sessions = program.sessions.filter((s) => s.date === dt);
    const weekSessions = program.sessions.filter((s) => s.week === week());
    const planned = typeof DAY_CARDIO !== "undefined" ? DAY_CARDIO[(state.day || 1) - 1] : "";
    return `<article id="cardioEntry"><div class="challenge-heading"><h3>Registrar actividad</h3><span>${dt || "pendiente"}</span></div>${planned ? `<p class="tiny subtle">Plan del Día ${state.day}: <strong>${escape(planned)}</strong>. Puedes registrar cualquier otra actividad.</p>` : ""}<div class="cat-chips mode-chips" role="group" aria-label="Actividad">${modes.map((m) => `<button type="button" data-cardio-mode="${m}" aria-pressed="${m === selected}">${modeIcons[m]} ${m}</button>`).join("")}</div><p class="tiny subtle" id="cardioDesc">${modeDescriptions[selected]}</p><form id="cardioForm"><input type="hidden" name="mode" id="cardioModeValue" value="${selected}"><div class="fields"><label>Minutos <input name="minutes" type="number" min="1" max="600" required></label><label>Esfuerzo 1–10 <input name="effort" type="number" min="1" max="10" value="3" required></label><label>Distancia (opcional) <input name="distance" type="number" min="0" max="100000" step="any"></label><label>Unidad <select name="unit"><option value="km" ${selected !== "Nadar" ? "selected" : ""}>km</option><option value="m" ${selected === "Nadar" ? "selected" : ""}>m</option></select></label><label id="cardioLoad" ${["Rucking", "Hiking"].includes(selected) ? "" : "hidden"}>Mochila kg (opcional) <input name="load" type="number" min="0" max="50" step="0.1"></label><label>Kcal de actividad (opcional) <input name="calories" type="number" min="0" max="10000" step="1"></label></div><button class="primary">Guardar actividad</button></form><p class="tiny subtle">Las kcal de actividad son informativas. El balance usa únicamente Whoop total, sin sumar actividades ni pasos de nuevo.</p></article><article><h3>Actividades de este día</h3><p>${sessions.reduce((n, s) => n + s.minutes, 0)} min en ${sessions.length} sesiones · semana ${week()}: ${weekSessions.reduce((n, s) => n + s.minutes, 0)} min en ${weekSessions.length}</p>${sessions.map((s) => `<div class="food-log"><div><b>${escape(s.mode)}</b> · ${escape(s.date)}<p>${s.minutes} min · esfuerzo ${s.effort}/10${s.distance ? " · " + escape(s.distance) + " " + escape(s.unit || "km") : ""}${s.load ? " · " + escape(s.load) + " kg de mochila" : ""}${C.has(s.calories) ? " · " + escape(s.calories) + " kcal" : ""}</p></div><button data-remove-session="${escape(s.id)}">Eliminar</button></div>`).join("") || '<p class="subtle">Aún no hay actividades este día.</p>'}</article>`;
  }
  function weight() {
    const w = week(),
      d = program.weeks[w] || {},
      rows = C.series(program),
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
    return `<article class="weigh-card"><div class="challenge-heading"><h2>Pesadas · semana ${w}</h2><span>Lun a Vie</span></div>${ok ? "" : '<p class="subtle">Configura inicio y peso inicial en ⚙ Opciones para ver fechas y comparaciones.</p>'}<div class="weigh-grid">${tiles}${waist}</div>${stats}<p class="tiny subtle">Pésate en ayunas, después de ir al baño. La media de las pesadas de la semana es tu peso semanal; las semanas sin datos quedan vacías.</p></article>${ok ? `<article><h3>Trayectoria de 8 semanas</h3><div id="weightChart"></div><details><summary>Ver tabla por semana</summary><div class="scroll"><table><thead><tr><th>Sem.</th><th>Ruta</th><th>Real</th><th>Proyección</th><th>Días Whoop</th></tr></thead><tbody>${rows.map((r) => `<tr${r.week === w ? ' class="current-row"' : ""}><td>${r.week}</td><td>${fmt(r.target)}</td><td>${r.actual === null ? "—" : fmt(r.actual)}</td><td>${r.projected === null ? "—" : fmt(r.projected)}</td><td>${r.count}</td></tr>`).join("")}</tbody></table></div></details></article>` : ""}<article><details><summary>Inicio y peso inicial</summary><div class="fields"><p>Inicio del programa: <strong>${escape(program.start || "pendiente")}</strong></p><label class="weight-day">Peso inicial <input id="initialWeight" type="number" min="20" max="400" step="0.1" inputmode="decimal" value="${escape(program.initialWeight)}"><span>kg</span></label></div><p class="tiny subtle">La fecha de inicio se cambia en ⚙ Opciones.</p></details></article>`;
  }
  function chart() {
    const box = document.getElementById("weightChart");
    if (!box) return;
    const rows = C.series(program);
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
    const values = rows.flatMap((r) => [r.target, r.actual, r.projected]).filter((v) => v !== null),
      lo = Math.floor(Math.min(...values) - 0.5),
      hi = Math.ceil(Math.max(...values) + 0.5),
      step = hi - lo > 8 ? 2 : 1,
      min = Math.floor(lo / step) * step,
      max = Math.ceil(hi / step) * step;
    const x = (i) => padL + (i * (width - padL - padR)) / 8,
      y = (v) => padT + ((max - v) / (max - min)) * (height - padT - padB);
    const ticks = [];
    for (let v = min; v <= max + 1e-9; v += step) ticks.push(v);
    const grid = ticks
      .map(
        (v) =>
          `<line x1="${padL}" y1="${y(v)}" x2="${width - padR}" y2="${y(v)}" stroke="#34373d"/><text x="${padL - 8}" y="${y(v) + 4}" fill="#b8b8b8" font-size="11" text-anchor="end">${fmt(v)}</text>`,
      )
      .join("");
    const xs = Array.from({ length: 9 }, (_, i) => i)
      .map(
        (i) =>
          `<line x1="${x(i)}" y1="${padT}" x2="${x(i)}" y2="${height - padB}" stroke="#26282d"/><text x="${x(i)}" y="${height - 12}" fill="#b8b8b8" text-anchor="middle" font-size="11">S${i}</text>`,
      )
      .join("");
    const series = [
      ["target", "#9399a5", "6 4", "Objetivo"],
      ["projected", "#7ac7bd", "3 4", "Proyección"],
      ["actual", "#ffc33d", "", "Peso real"],
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
          `<text x="${x(r.week)}" y="${y(r.actual) - 9}" fill="#ffc33d" font-size="11" font-weight="700" text-anchor="middle">${fmt(r.actual)}</text>`,
      )
      .join("");
    const last = rows[rows.length - 1],
      ends = [
        ["target", "#9399a5"],
        ["projected", "#7ac7bd"],
      ]
        .filter(([k]) => last[k] !== null)
        .map(
          ([k, color]) =>
            `<text x="${x(8) - 6}" y="${y(last[k]) + (k === "target" ? 16 : -8)}" fill="${color}" font-size="11" font-weight="700" text-anchor="end">${fmt(last[k])} kg</text>`,
        )
        .join("");
    const start = `<text x="${x(0) + 4}" y="${y(rows[0].actual) + 18}" fill="#ffc33d" font-size="11" font-weight="700">${fmt(rows[0].actual)}</text>`;
    box.innerHTML = `<div class="chart-legend">${series
      .map(
        ([, color, dash, name]) =>
          `<span><svg width="22" height="8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" stroke="${color}" stroke-width="2.5" stroke-dasharray="${dash}"/></svg>${name}</span>`,
      )
      .join(
        "",
      )}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Peso objetivo, peso registrado y proyección por déficit"><title>Comparación de peso en 8 semanas</title>${grid}${xs}<text x="4" y="12" fill="#b8b8b8" font-size="11">kg</text>${lines}${start}${labels}${ends}</svg><p class="tiny subtle">Eje vertical: peso en kg · Eje horizontal: semanas del programa (S0 = inicio). Peso real = promedio de las pesadas de la semana.</p>`;
  }
  function backup() {
    return `<article><h3>Copias de seguridad</h3><p>Los datos se guardan en este navegador. Exporta una copia para cambiarlos de dispositivo o protegerlos si borras el almacenamiento.</p><div class="btn-row"><button id="exportAll" class="primary">Exportar todo</button><label class="file-btn">Importar copia<input id="importAll" type="file" accept="application/json" hidden></label></div></article>`;
  }
  let rendering = false;
  function show() {
    if (rendering) return;
    rendering = true;
    try {
      showNow();
    } finally {
      rendering = false;
    }
  }
  function showNow() {
    syncCalendar();
    const setupWeight = document.getElementById("setupInitialWeight");
    if (setupWeight) setupWeight.value = program.initialWeight ?? "";
    const view = program.view;
    document
      .querySelectorAll("[data-view]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    let content = "";
    if (view === "home") content = hoy();
    if (view === "food") {
      if (!program.foodTab) program.foodTab = "log";
      content = nutrition.renderFood();
    }
    if (view === "training") content = training();
    if (view === "progress") content = progress();
    if (view === "history") content = historyView();
    root.hidden = false;
    root.innerHTML = '<div class="program">' + content + "</div>";
    // Entreno = hoja única: fuerza arriba (strengthView), cardio y retos debajo.
    strength.hidden = view !== "training";
    document.body.classList.toggle("sheet-mode", view === "training");
    if (view === "training") render();
    chart();
    if (pendingJump) {
      const el = document.getElementById(pendingJump);
      pendingJump = null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  document.getElementById("appTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (b) {
      program.view = b.dataset.view;
      if (program.view === "food") program.foodTab = "log";
      persist();
      show();
    }
  });
  document.getElementById("week").addEventListener("change", () => setTimeout(show, 0));
  // Al elegir otro día de rutina (1–5), actualiza el cardio planeado de la hoja.
  document.getElementById("days").addEventListener("click", (e) => {
    if (e.target.closest("[data-day]") && program.view === "training") setTimeout(show, 0);
  });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.histOpen) {
      program.view = "home";
      goDate(b.dataset.histOpen);
      return;
    }
    if (b.dataset.historyFilter) {
      program.historyFilter = b.dataset.historyFilter;
      persist();
      show();
      return;
    }
    if (b.dataset.jump) {
      const el = document.getElementById(b.dataset.jump);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (b.hasAttribute("data-go-today")) {
      goDate(today());
      return;
    }
    if (b.dataset.progressTab) {
      program.progressTab = b.dataset.progressTab;
      persist();
      show();
      return;
    }
    if (b.hasAttribute("data-summary-setup")) {
      program.view = "progress";
      program.progressTab = "weight";
      pendingJump = "sec-weight";
      persist();
      show();
      return;
    }
    if (b.dataset.homeGo) {
      program.view = b.dataset.homeGo;
      if (b.dataset.jumpAfter) pendingJump = b.dataset.jumpAfter;
    }
    if (b.dataset.trainingTab) program.trainingTab = b.dataset.trainingTab;
    if (b.dataset.cardioMode) {
      const m = b.dataset.cardioMode;
      if (!modes.includes(m)) return;
      program.cardioMode = m;
      persist();
      root
        .querySelectorAll("[data-cardio-mode]")
        .forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.cardioMode === m)));
      const v = document.getElementById("cardioModeValue"),
        d = document.getElementById("cardioDesc"),
        l = document.getElementById("cardioLoad"),
        u = root.querySelector("#cardioForm [name=unit]");
      if (v) v.value = m;
      if (d) d.textContent = modeDescriptions[m];
      if (l) l.hidden = !["Rucking", "Hiking"].includes(m);
      if (u) u.value = m === "Nadar" ? "m" : "km";
      return;
    }
    if (b.id === "medTaken" && date() <= today()) {
      program.meds[date()] = program.meds[date()] ? null : new Date().toISOString();
    }
    if (b.dataset.medDate) {
      goDate(b.dataset.medDate);
      return;
    }
    if (b.dataset.removeSession)
      program.sessions = program.sessions.filter((s) => s.id !== b.dataset.removeSession);
    if (b.id === "exportAll") {
      // Mismo archivo que «💾 Guardar»: primero guarda lo que está en pantalla.
      persist();
      save();
      FitStore.exportBackup();
      return;
    }
    if (
      b.dataset.homeGo ||
      b.dataset.trainingTab ||
      b.id === "medTaken" ||
      b.dataset.medDate ||
      b.dataset.removeSession
    ) {
      persist();
      show();
    }
  });
  root.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.id === "programStart" && C.validDate(t.value)) program.start = t.value;
    if (t.id === "initialWeight") {
      if (!t.checkValidity()) return;
      t.value === "" ? (program.initialWeight = "") : (program.initialWeight = Number(t.value));
    }
    if (t.id === "cardioMode") {
      program.cardioMode = t.value;
      const unit = root.querySelector("[name=unit]");
      if (unit) unit.value = t.value === "Nadar" ? "m" : "km";
      persist();
      return;
    }
    if (t.dataset.weightMetric) {
      if (t.value !== "" && !t.checkValidity()) return;
      program.weeks[week()] ??= {};
      program.weeks[week()][t.dataset.weightMetric] = t.value;
    }
    if (t.id === "importAll") {
      try {
        const file = t.files[0];
        if (!file) return;
        if (file.size > 5000000) throw Error("La copia supera 5 MB");
        let o;
        try {
          o = JSON.parse(await file.text());
        } catch {
          throw Error("El archivo no es un JSON válido");
        }
        // Acepta el formato actual y los respaldos antiguos de «💾 Guardar».
        const backup = FitStore.readBackup(o);
        if (!backup.program) throw Error("La copia no contiene el programa");
        const incoming = C.validate(FitCalendar.migrate(backup.program));
        const s = backup.strength;
        if (
          !s ||
          !s.weights ||
          !s.completed ||
          !Number.isInteger(s.day) ||
          s.day < 1 ||
          s.day > 5 ||
          !Number.isInteger(s.week) ||
          s.week < 1 ||
          s.week > 8
        )
          throw Error("Fuerza no válida");
        if (!confirm("¿Reemplazar todos los registros con esta copia?")) return;
        program = {
          ...defaults,
          ...incoming,
          medFrequency: "daily",
          view: "progress",
          progressTab: "weight",
        };
        // Las copias antiguas guardaban los pesos en kg: se pasan a libras.
        state = normalizeStrengthUnits({ ...s });
        save();
        persist();
        render();
        pendingJump = "sec-backup";
        show();
        alert("Copia importada");
      } catch (err) {
        alert("No se pudo importar: " + err.message);
      } finally {
        // Permite volver a elegir el mismo archivo.
        t.value = "";
      }
      return;
    }
    if (
      ["programStart", "initialWeight"].includes(
        t.id,
      ) ||
      t.dataset.weightMetric
    ) {
      persist();
      show();
    }
  });
  root.addEventListener("submit", (e) => {
    if (e.target.id !== "cardioForm") return;
    e.preventDefault();
    if (!e.target.checkValidity()) return;
    const d = new FormData(e.target),
      s = {
        id: Date.now().toString(36),
        week: week(),
        mode: d.get("mode"),
        date: date(),
        minutes: Number(d.get("minutes")),
        effort: Number(d.get("effort")),
        distance: d.get("distance"),
        unit: d.get("unit"),
        load: ["Rucking", "Hiking"].includes(d.get("mode")) ? d.get("load") : "",
        calories: d.get("calories") === "" ? "" : Number(d.get("calories")),
      };
    program.sessions.push(s);
    persist();
    show();
  });
  const settings = document.getElementById("settings");
  document.getElementById("backupBtn").onclick = () => {
    settings.hidden = !settings.hidden;
    if (!settings.hidden) {
      syncCalendar();
      settings.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  // Opciones: inicio y peso inicial, sin mezclar configuración con registros.
  document.getElementById("setupInitialWeight").addEventListener("change", (e) => {
    if (!e.target.checkValidity()) return;
    program.initialWeight = e.target.value === "" ? "" : Number(e.target.value);
    persist();
    show();
  });
  document.getElementById("programStart").addEventListener("change", (e) => {
    if (!C.validDate(e.target.value)) {
      syncCalendar();
      return;
    }
    if (
      program.start &&
      program.start !== e.target.value &&
      !confirm("¿Cambiar el inicio? Los registros existentes conservan sus fechas originales.")
    ) {
      syncCalendar();
      return;
    }
    program.start = e.target.value;
    persist();
    show();
  });
  document.getElementById("recordDay").addEventListener("change", (e) => {
    program.recordDay = Number(e.target.value);
    persist();
    show();
  });
  root.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest("[data-menu-day]");
      if (b) {
        program.recordDay = Number(b.dataset.menuDay);
      }
    },
    true,
  );
  const guard = (e) => {
    let write = false;
    if (e.type === "submit")
      write =
        ["cardioForm", "weeklyDistanceForm", "dailyForm", "coachCheckin", "manualMealForm", "foodLogForm"].includes(
          e.target.id,
        ) || e.target.hasAttribute("data-challenge-log");
        else if (e.type === "click")
      write = !!e.target.closest("[data-log-recipe],[data-quick-log],[data-quick-undo],#medTaken,[data-wellbeing]");
    if (write && (!C.validDate(date()) || date() > today())) {
      e.preventDefault();
      e.stopImmediatePropagation();
      alert(
        !date()
          ? "Selecciona primero el inicio del programa."
          : "Puedes planificar días futuros; registra lo realizado cuando llegue esa fecha.",
      );
    }
  };
  strength.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("[data-done],[data-set-done]") && (!C.validDate(date()) || date() > today())) {
        e.preventDefault();
        e.stopImmediatePropagation();
        alert("Selecciona el inicio y un día de hoy o anterior para registrar el entrenamiento.");
      }
    },
    true,
  );
  strength.addEventListener(
    "change",
    (e) => {
      if ((e.target.dataset.weight || e.target.dataset.setW || e.target.dataset.setR) && (!C.validDate(date()) || date() > today())) {
        e.preventDefault();
        e.stopImmediatePropagation();
        alert("Selecciona el inicio y un día de hoy o anterior para registrar el peso.");
        render();
      }
    },
    true,
  );
  root.addEventListener("change", guard, true);
  root.addEventListener("submit", guard, true);
  root.addEventListener("click", guard, true);
  {
    const pos0 = FitCalendar.position(program.start, today());
    if (pos0) {
      state.week = pos0.week;
      program.recordDay = pos0.day;
      program.menuDay = pos0.day;
      save();
      render();
    }
  }
  show();
})();
