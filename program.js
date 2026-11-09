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
  if (!program.panelIntro) {
    program.panelIntro = true;
    program.progressTab = "panel";
  }
  if (program.trainingTab === "calendar") program.trainingTab = "strength";
  const escape = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const fmt = (n) => Number(n).toLocaleString("es-CR", { maximumFractionDigits: 1 });
  // Duración y esfuerzo pueden faltar (registro rápido desde Retos): nunca se inventan.
  const minTxt = (s) => (C.has(s.minutes) && Number(s.minutes) > 0 ? s.minutes + " min" : "sin duración");
  const effTxt = (s) => (C.has(s.effort) && Number(s.effort) > 0 ? ` · esfuerzo ${s.effort}/10` : "");
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
    const rd = document.getElementById("recordDate"),
      dt = date(),
      w = week(),
      canToday = !!FitCalendar.position(program.start, today()),
      canYest = !!FitCalendar.position(program.start, C.datePlus(today(), -1));
    // r90: tira semanal L–D con estado de cada día.
    const letters = ["L", "M", "M", "J", "V", "S", "D"];
    const status = (day) => {
      const d = program.diary[day];
      if (d && d.closed) return "done";
      if ((d && ((d.meals || []).length || C.has(d.whoop) || C.has(d.steps))) || activeOn(day)) return "part";
      return "none";
    };
    const strip = dt
      ? `<span class="wk-strip"><button type="button" class="wk-arrow" data-wk-shift="-1" ${w <= 1 ? "disabled" : ""} aria-label="Semana anterior">‹</button>${letters
          .map((l, i) => {
            const day = FitCalendar.date(program.start, w, i),
              st = status(day),
              fut = day > today();
            return `<button type="button" class="wk-day is-${st}${i === program.recordDay ? " is-sel" : ""}${day === today() ? " is-today" : ""}${fut ? " is-future" : ""}" data-wk-day="${i}" aria-pressed="${i === program.recordDay}" aria-label="${escape(niceDate(day))}${st === "done" ? " · completo" : st === "part" ? " · pendiente" : " · sin registro"}"><small>${l}</small><b>${Number(day.slice(8))}</b><i></i></button>`;
          })
          .join("")}<button type="button" class="wk-arrow" data-wk-shift="1" ${w >= 8 ? "disabled" : ""} aria-label="Semana siguiente">›</button></span><span class="wk-meta"><span>Semana ${w} de 8 · <b>${escape(niceDate(dt))}</b></span>${canToday && dt !== today() ? ' <button type="button" class="go-today" data-go-today>Hoy</button>' : ""}${canYest && dt !== C.datePlus(today(), -1) ? ' <button type="button" class="go-today" data-go-yesterday>Ayer</button>' : ""}</span><span class="wk-legend"><span><i class="is-done"></i>Completo</span><span><i class="is-part"></i>Pendiente</span><span><i class="is-none"></i>Sin registro</span></span>`
      : "";
    rd.innerHTML = dt
      ? strip
      : 'Elige el inicio del programa. <button type="button" class="go-today" data-open-settings>Configurar programa</button>';
    rd.onclick = (e) => {
      const day = e.target.closest("[data-wk-day]"),
        shift = e.target.closest("[data-wk-shift]");
      if (day) goDate(FitCalendar.date(program.start, week(), Number(day.dataset.wkDay)));
      else if (shift) {
        const nw = Math.min(8, Math.max(1, week() + Number(shift.dataset.wkShift)));
        goDate(FitCalendar.date(program.start, nw, program.recordDay));
      } else if (e.target.closest("[data-go-yesterday]")) goDate(C.datePlus(today(), -1));
      else if (e.target.closest("[data-go-today]")) goDate(today());
      else if (e.target.closest("[data-open-settings]")) document.getElementById("backupBtn").click();
    };
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
    /* déficit acumulado (días con Whoop) frente a la ruta de la meta */ let n = 0,
      def = 0;
    for (let i = 0; i < 56; i++) {
      const day = C.datePlus(program.start, i);
      if (day > upTo) break;
      const d = program.diary[day];
      if (d && C.confirmed(d) !== null) {
        n++;
        def += C.confirmed(d);
      }
    }
    return { n, def, gap: def - n * C.NEEDED };
  }
  // ── Dashboard «Hoy»: centro de control diario ─────────────────────────────
  const kcalTarget = () => C.goals().kcal;
  // Plan del día según el día de la semana (igual que «Tu semana»).
  function planFor(dt) {
    const i = (new Date(dt + "T12:00:00Z").getUTCDay() + 6) % 7;
    const names = ["BASE CAMP", "PUSH MODE", "PULL POWER", "ENGINE DAY", "ARM FORCE", "WILD MILES", "RESET & RECHARGE"];
    return i < 5
      ? i === 3
        ? { label: names[i] + " · Solo cardio · Natación", day: 4 }
        : { label: names[i] + " · Pesas + " + ([0, 2, 4].includes(i) ? "Judo" : "Natación"), day: i + 1 }
      : i === 5
        ? { label: names[i] + " · Fondo o hiking", day: 0 }
        : { label: names[i] + " · Recuperación", day: 0 };
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
    if ((state.archive || []).some((a) => a.date === day)) return true;
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
      return `<article id="sec-day"><h2>Selecciona el inicio</h2><p>Configura el inicio y tu peso inicial, o restaura tu copia si ya usabas la app.</p><p><button type="button" class="primary" data-open-settings>Configurar programa</button> <button type="button" data-open-backup>Restaurar copia</button></p></article>`;
    // Calorías
    const over = kcal > kcalTarget(),
      ok = !over && b !== null && b >= C.NEEDED,
      status = b === null ? ["", "Carga el Whoop para ver el balance"] : ok ? ["good", "✓ Día en objetivo"] : over ? ["bad", "Sobre el objetivo de consumo"] : ["warn", "Déficit por debajo de lo necesario"];
    const kcalCard = `<article class="dash-card"><div class="dash-head"><span>🔥 Calorías</span><strong class="${status[0]}">${status[1]}</strong></div><div class="dash-big"><strong>${fmt(kcal)}</strong><span>/ ${fmt(kcalTarget())} kcal consumidas</span></div>${bar(kcal, kcalTarget(), over ? "is-over" : "")}<div class="dash-row"><div><span>Gastadas</span><strong>${C.has(d.whoop) ? fmt(d.whoop) : "—"}</strong></div><div><span>Balance</span><strong>${b === null ? "—" : (b >= 0 ? "−" : "+") + fmt(Math.abs(b))}</strong></div><div><span>Necesario</span><strong>−${fmt(C.NEEDED)}</strong></div></div><p class="tiny subtle">${r.n ? `Ruta −${C.GOAL_KG} kg: vas <b>${fmt(Math.abs(r.gap))} kcal ${r.gap >= 0 ? "por delante" : "por detrás"}</b> (${r.n} días cerrados con Whoop).` : "Datos insuficientes: cierra días con Whoop y comidas para ver si vas en ruta."}${b !== null && !d.closed ? " Balance de hoy provisional hasta cerrar el día." : ""}</p></article>`;
    // Actividad
    const plan = planFor(dt),
      todaySets = Object.values(state.sets || {}).reduce((n, sets) => n + (sets || []).filter((z) => z && z.done && z.d === dt).length, 0),
      todayEx = Object.values(state.completedDates || {}).filter((x) => x === dt).length;
    const actCard = `<article class="dash-card"><div class="dash-head"><span>🏋️ Actividad</span><strong>${plan.label}</strong></div><div class="dash-row"><div><span>Ejercicios</span><strong>${todayEx || "—"}</strong></div><div><span>Series</span><strong>${todaySets || "—"}</strong></div><div><span>Pasos</span><strong>${C.has(d.steps) ? fmt(d.steps) : "—"}</strong></div></div>${sessions.length ? `<ul class="dash-list">${sessions.map((s) => `<li>${escape(s.mode)} · ${minTxt(s)}${s.distance ? " · " + escape(s.distance) + " " + escape(s.unit || "km") : ""}</li>`).join("")}</ul>` : '<p class="tiny subtle">Sin actividades de cardio registradas.</p>'}</article>`;
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
    // r90: «Tu día» — pendientes del día con acceso directo para registrar.
    const meals = d.meals || [],
      mk = ["Desayuno", "Almuerzo", "Cena"].filter((k) => meals.some((m) => m.kind === k)),
      routineN = plan.day ? (window.fitRoutineIds ? window.fitRoutineIds(week()) : EXERCISES.map((x) => x.id)).filter((id) => (EXERCISES.find((x) => x.id === id) || {}).day === plan.day).length : 0;
    const items = [
      { ok: mk.length === 3 || (d.closed && meals.length > 0), icon: "🍽", name: "Comidas", info: mk.length ? mk.join(" · ") + ` · ${fmt(kcal)} kcal` : "Desayuno, almuerzo y cena", act: "data-quick-food", btn: "+ Comida" },
    ];
    if (wk) items.push({ ok: Number(wv) > 0, icon: "⚖️", name: "Peso", info: Number(wv) > 0 ? fmt(Number(wv)) + " kg" : "Pesada de lunes a viernes", act: 'data-jump="dashWeight" data-focus="weight"', btn: "Pesar" });
    if (plan.day && plan.day !== 4)
      items.push({ ok: routineN > 0 && todayEx >= routineN, icon: "🏋️", name: "Entreno", info: `${todayEx} de ${routineN || "—"} ejercicios`, act: 'data-home-go="training"', btn: "Entrenar" });
    items.push({ ok: sessions.length > 0, icon: "🏃", name: plan.day === 4 ? "Cardio · natación" : plan.day ? "Cardio" : "Actividad", info: sessions.length ? sessions.map((s) => escape(s.mode)).join(" · ") : plan.day ? "Judo, natación o la que hagas" : "Fondo, hiking o recuperación", act: 'data-home-go="training" data-jump-after="cardioEntry"', btn: "Registrar" });
    items.push({ ok: C.has(d.whoop), icon: "⌚", name: "Whoop", info: C.has(d.whoop) ? fmt(d.whoop) + " kcal gastadas" : "Calorías gastadas", act: 'data-jump="sec-quick" data-focus="whoop"', btn: "Anotar" });
    items.push({ ok: C.has(d.steps), icon: "👣", name: "Pasos", info: C.has(d.steps) ? fmt(d.steps) : "Pasos del día", act: 'data-jump="sec-quick" data-focus="steps"', btn: "Anotar" });
    items.push({ ok: !!d.closed, icon: "✅", name: "Cerrar día", info: d.closed ? "Día completo" : "Cuando tengas la comida y el Whoop final", act: 'data-jump="sec-quick" data-focus="closed"', btn: "Cerrar" });
    const doneN = items.filter((x) => x.ok).length;
    const todoCard = `<article class="dash-card todo-card"><div class="dash-head"><span>📋 Tu día</span><strong class="${doneN === items.length ? "good" : ""}">${doneN} de ${items.length} listos</strong></div>${bar(doneN, items.length)}<ul class="todo-list">${items.map((x) => `<li class="${x.ok ? "is-ok" : ""}"><span class="todo-check" aria-hidden="true">${x.ok ? "✓" : ""}</span><span class="todo-txt"><b>${x.icon} ${x.name}</b><small>${x.info}</small></span>${x.ok ? `<button type="button" class="todo-btn quiet" ${x.act}>Ver</button>` : `<button type="button" class="todo-btn" ${x.act}>${x.btn}</button>`}<span class="sr-only">${x.ok ? "Hecho" : "Pendiente"}</span></li>`).join("")}</ul></article>`;
    return `<article id="sec-day" class="dash-top"><div class="eyebrow">HOY · SEMANA ${week()} DE 8 · META −${C.GOAL_KG} KG</div><h2>${escape(niceDate(dt))}</h2>${dt !== today() ? "<p><button data-go-today>↩ Volver a hoy</button></p>" : ""}</article>${FitStore.backupNotice()}${todoCard}${window.FitMacros.dailyHtml(d)}<div class="dash-grid">${kcalCard}${actCard}${progCard}</div>${nutrition.renderQuick()}<div class="sec" id="sec-checkin">${coach.render()}</div>`;
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
    (state.archive || []).forEach((a) => a.date && days.add(a.date));
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
        for (const a of state.archive || []) {
          const done = a.sets.filter((z) => z && z.done && (z.d || a.date) === day);
          if (done.length) strengthRows.push(`<li>${escape(exName(a.id))} · ${done.map((z) => lb(z.w) + "×" + z.r).join(" · ")} lb</li>`);
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
          parts.push(`<div class="hist-sec"><h4>🏋️ Entreno</h4><ul>${sess.map((s) => `<li class="hist-item"><span>${escape(s.mode)} · ${minTxt(s)}${s.distance ? " · " + escape(s.distance) + " " + escape(s.unit || "km") : ""}${effTxt(s)}</span><button type="button" class="hist-del" data-delete-distance="${escape(s.id)}" aria-label="Eliminar ${escape(s.mode)} del ${day}">Eliminar</button></li>`).join("")}${strengthRows.join("")}</ul></div>`);
        if (show_("goals") && logs.length)
          parts.push(`<div class="hist-sec"><h4>🔥 Retos</h4><ul>${logs.map((l) => `<li class="hist-item"><span>${escape(goalName[l.goal] || l.goal)} · ${l.reps} repeticiones</span><button type="button" class="hist-del" data-delete-challenge-log="${escape(l.id)}" aria-label="Eliminar ${escape(goalName[l.goal] || l.goal)} del ${day}">Eliminar</button></li>`).join("")}</ul></div>`);
        if (f === "all" && (program.meds[day] || (coachD && coachD.checkin)))
          parts.push(`<div class="hist-sec"><h4>📝 Otros</h4><p>${program.meds[day] ? "Suplemento ✓" : ""}${program.meds[day] && coachD && coachD.checkin ? " · " : ""}${coachD && coachD.checkin ? `Check-in: energía ${coachD.energy}/5${coachD.pain && coachD.pain !== "none" ? " · molestia: " + escape(coachD.pain === "shoulder" ? "hombro" : coachD.pain) : ""}` : ""}</p></div>`);
        if (!parts.length) return "";
        return `<details class="hist-day" ${idx < 7 ? "open" : ""}><summary><span><b>${escape(niceDate(day))}</b>${pos ? ` <small>· Semana ${pos.week}</small>` : ""}</span><span class="hist-tags">${d.closed && (meals.length || Number(d.extras) > 0) ? '<em class="ok">✓ Cerrado</em>' : d.closed ? "<em>Cerrado sin comidas · no cuenta</em>" : meals.length || C.has(d.whoop) ? "<em>Provisional</em>" : ""}${meals.length ? `<em>${fmt(kcal)} kcal</em>` : ""}</span></summary>${parts.join("")}<p class="hist-open"><button type="button" data-hist-open="${day}">Abrir este día en Hoy →</button></p></details>`;
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
    const wkIds = window.fitRoutineIds ? window.fitRoutineIds(w) : EXERCISES.map((x) => x.id),
      strengthDone = wkIds.filter((id) => state.completed[id + "-w" + w]).length,
      strengthTotal = wkIds.length;
    return { w, cur, expected, rate, n, avgDef, defSum, waist: wd.waist, en, reco, tone, strengthDone, strengthTotal };
  }
  function reviewCard() {
    if (!C.validDate(program.start) || !C.has(program.initialWeight))
      return "<article><h3>Cierre semanal</h3><p>Configura inicio y peso inicial en ⚙ Opciones.</p></article>";
    const w = week(),
      r = weekReview(w);
    if (!r) return "";
    return `<article id="sec-review"><div class="eyebrow">CIERRE SEMANAL · SEMANA ${w}</div><h3>¿Vas en ruta a −${C.GOAL_KG} kg?</h3><div class="daily-numbers"><div><span>Déficit semanal</span><strong>${r.n ? fmt(r.defSum) + " kcal" : "—"}</strong><p class="tiny subtle">Ruta: ${fmt(C.NEEDED * 7)} · ${r.n} de 7 días cerrados con Whoop</p></div><div><span>Cintura · Fuerza</span><strong>${C.has(r.waist) ? fmt(r.waist) + " cm" : "—"} · ${r.strengthDone}/${r.strengthTotal}</strong></div></div><p class="coach-reco ${r.tone}">${escape(r.reco)}</p><details><summary>Cómo se calcula</summary><p class="tiny subtle">Estimación con 7.700 kcal/kg: tiende a sobreestimar la pérdida real y las primeras semanas incluyen agua. Úsala como guía, no como promesa. El peso real y la ruta de la semana están en Pesadas.</p></details></article>`;
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
    const stepsGoal = Math.round((C.goals().steps || 800000) / 8),
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
    const cards = parts
      .map((x) => {
        const ok = x.pct >= 100;
        return `<li class="wp-card${ok ? " is-done" : ""}${x.key === "steps" ? " wp-wide" : ""}" aria-label="${x.name}: ${Math.round(x.pct)} %, ${escape(x.done)}${ok ? ", completado" : ""}"><div class="wp-card-head">${wpIcon(x.key)}<span>${x.name}</span></div><div class="wp-pct"><b>${Math.round(x.pct)}</b><small>%</small></div><p class="wp-done">${escape(x.done)}</p>${ok ? `<p class="wp-ok">${wpIcon("check", "wp-ico wp-check")}Completado</p>` : ""}${wpBar(x.key, x.pct, x.name + ": progreso semanal", "wp-thin")}</li>`;
      })
      .join("");
    const rules = `<details class="wp-how"><summary>Cómo se calcula</summary><ul class="tiny subtle"><li>Cada pilar aporta 20 % al avance semanal; su aporte se limita a 100 %, aunque se muestra la cantidad real.</li><li>Déficit: balance neto (Whoop − comidas) de los días cerrados con todas las comidas y el Whoop final; los superávits restan. Meta: ${fmt(goal)} kcal por semana.</li><li>Fuerza: ejercicios completados de la rutina de la semana.</li><li>Cardio: minutos de actividades registradas sin judo; varias sesiones del mismo día se suman. Meta: 3 h.</li><li>Judo: días distintos con judo. Meta: 3 días.</li><li>Pasos: suma de los pasos diarios. Meta: el reto total de pasos repartido en 8 semanas.</li></ul></details>`;
    return `<article class="wp" aria-labelledby="wpTitle"><header class="wp-top"><span class="wp-brand">EVÓ</span><div class="wp-goal"><span>Meta de peso</span><b>${Math.round(weightPct)} %</b>${wpBar("weight", weightPct, "Progreso hacia la meta de peso", "wp-mini")}</div></header>
      <div class="wp-body"><div class="wp-title"><div><p class="wp-eyebrow">TU AVANCE</p><h3 id="wpTitle">Semana ${pad(w)} <small>/ ${pad(8)}</small></h3></div><p class="wp-total" aria-label="Avance semanal ${Math.round(total)} %"><b>${Math.round(total)}</b><small>%</small></p></div>
      ${wpBar("total", total, `Avance de la semana ${w}`, "wp-main")}
      <ul class="wp-grid">${cards}</ul>
      <footer class="wp-foot"><p><span class="wp-dot${completeDays >= 7 ? " is-full" : ""}" aria-hidden="true"></span>${completeDays >= 7 ? "Balance completo · 7/7 días" : `Balance parcial · ${completeDays}/7 días completos`}</p>${rules}</footer></div></article>`;
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
              `<li><span>${escape(l.name)}</span><b>${fmt(l.first[1])} → ${fmt(l.last[1])} lb</b><em class="${l.delta > 0 ? "good" : l.delta < 0 ? "bad" : "subtle"}">${signed(l.delta)} · S${l.first[0]}→S${l.last[0]}</em></li>`,
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
    const volRows = weeks.filter((w) => vol[w]).map((w) => ({ label: "S" + w, value: vol[w], text: fmt(Math.round(vol[w])) + " lb" }));
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
  function panelConsistency(days) {
    const sDates = strengthDates(),
      active = days.filter((d) => activeOn(d)).length,
      weekdays = days.filter(isWeekday),
      // Días con pesas según la rutina vigente (un día sin ejercicios es solo cardio).
      liftDays = [1, 2, 3, 4, 5].filter((n) => EXERCISES.some((e) => e.day === n)),
      // Mismo plan que «Hoy» (planFor) y solo desde la fecha de inicio del programa.
      planned = days.filter((d) => d >= program.start && planFor(d).day && liftDays.includes(planFor(d).day)),
      inRange = new Set(days),
      liftDone = [...sDates].filter((d) => inRange.has(d)).length,
      doneW = Math.min(planned.length, routineDates(days).length),
      cardioPlanned = weekdays.length,
      cardioDone = Math.min(cardioPlanned, new Set(program.sessions.filter((s) => inRange.has(s.date)).map((s) => s.date)).size);
    const lead = (new Date(days[0] + "T12:00:00Z").getUTCDay() + 6) % 7;
    const cells =
      DOW.map((d) => `<b>${d}</b>`).join("") +
      "<i></i>".repeat(lead) +
      days
        .map((d) => {
          const st = sDates.has(d),
            ca = program.sessions.some((s) => s.date === d),
            any = activeOn(d),
            food = (program.diary[d]?.meals || []).length > 0,
            lv = st && ca ? 3 : st || ca ? 2 : any ? 1 : 0;
          return `<span class="lv${lv}${d === today() ? " now" : ""}" title="${d}${st ? " · pesas" : ""}${ca ? " · cardio" : ""}${food ? " · comidas" : ""}">${Number(d.slice(8))}</span>`;
        })
        .join("");
    return `<article class="panel-card"><div class="dash-head"><span>📅 Consistencia</span><strong>Racha ${streak(today())} d</strong></div>
      <div class="panel-stats">${stat("Días con actividad", `${active}/${days.length}`)}${stat("Rutinas completas", `${doneW}/${planned.length}`, `${liftDone} días con fuerza · ${liftDays.length} por semana`)}${stat("Cardio vs. programado", `${cardioDone}/${cardioPlanned}`, "días con cardio")}</div>
      ${bar(doneW, planned.length || 1)}
      <h4 class="panel-sub">Calendario de actividad</h4><div class="panel-cal">${cells}</div>
      <p class="panel-legend"><span class="lg-c lv1"></span>Reto <span class="lg-c lv2"></span>Pesas o cardio <span class="lg-c lv3"></span>Pesas + cardio</p></article>`;
  }
  function panel() {
    if (!C.validDate(program.start)) return note("Elige la fecha de inicio del programa para ver el panel.");
    const n = RANGES.includes(Number(program.insightRange)) ? Number(program.insightRange) : 30,
      days = rangeDays(n);
    const filter = `<nav class="subtabs panel-range" aria-label="Periodo">${RANGES.map((r) => `<button data-insight-range="${r}" aria-pressed="${r === n}">${r} días</button>`).join("")}</nav>`;
    const span = `<p class="tiny subtle">${days[0]} → ${days.at(-1)} · ${days.length} día${days.length > 1 ? "s" : ""}${days.length < n ? " (desde el inicio del programa)" : ""}</p>`;
    return `<div class="panel">${weeklyProgress()}${filter}${span}${panelWeight(days)}${panelTraining(days)}${panelFood(days)}${panelConsistency(days)}</div>`;
  }
  function progress() {
    const initial = Number(program.initialWeight) || 85,
      target = initial - C.GOAL_KG;
    const rows = C.series(program),
      recent = rows.filter((r) => r.week > 0 && r.actual !== null).at(-1);
    const current = recent ? recent.actual : initial;
    const pct = Math.max(0, Math.min(100, ((initial - current) / (initial - target)) * 100));
    const sub = program.progressTab || "panel";
    const tabs = `<nav class="subtabs" aria-label="Progreso">${[
      ["panel", "Panel"],
      ["weight", "Peso y balance"],
      ["missions", "Retos"],
      ["wellbeing", "Bienestar"],
    ]
      .map(([k, l]) => `<button data-progress-tab="${k}" aria-pressed="${sub === k}">${l}</button>`)
      .join("")}</nav>`;
    if (sub === "panel") return tabs + panel();
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
      challenges.render()
    );
  }
  function cardio() {
    const selected = program.cardioMode || "Judo";
    const dt = date();
    const sessions = program.sessions.filter((s) => s.date === dt);
    const weekSessions = program.sessions.filter((s) => s.week === week());
    const planned = typeof DAY_CARDIO !== "undefined" ? DAY_CARDIO[(state.day || 1) - 1] : "";
    return `<article id="cardioEntry"><div class="challenge-heading"><h3>Registrar actividad</h3><span>${dt || "pendiente"}</span></div>${planned ? `<p class="tiny subtle">Plan del Día ${state.day}: <strong>${escape(planned)}</strong>. Puedes registrar cualquier otra actividad.</p>` : ""}<div class="cat-chips mode-chips" role="group" aria-label="Actividad">${modes.map((m) => `<button type="button" data-cardio-mode="${m}" aria-pressed="${m === selected}">${modeIcons[m]} ${m}</button>`).join("")}</div><p class="tiny subtle" id="cardioDesc">${modeDescriptions[selected]}</p><form id="cardioForm"><input type="hidden" name="mode" id="cardioModeValue" value="${selected}"><div class="fields"><label>Minutos <input name="minutes" type="number" min="1" max="600" required></label><label>Esfuerzo 1–10 (opcional) <input name="effort" type="number" min="1" max="10"></label><label>Distancia (opcional) <input name="distance" type="number" min="0" max="100000" step="any"></label><label>Unidad <select name="unit"><option value="km" ${selected !== "Nadar" ? "selected" : ""}>km</option><option value="m" ${selected === "Nadar" ? "selected" : ""}>m</option></select></label><label id="cardioLoad" ${["Rucking", "Hiking"].includes(selected) ? "" : "hidden"}>Mochila kg (opcional) <input name="load" type="number" min="0" max="50" step="0.1"></label><label>Kcal de actividad (opcional) <input name="calories" type="number" min="0" max="10000" step="1"></label></div><button class="primary">Guardar actividad</button></form><p class="tiny subtle">Las kcal de actividad son informativas. El balance usa únicamente Whoop total, sin sumar actividades ni pasos de nuevo.</p></article>`;
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
          `<line x1="${padL}" y1="${y(v)}" x2="${width - padR}" y2="${y(v)}" stroke="#e3d4c1"/><text x="${padL - 8}" y="${y(v) + 4}" fill="#7b6a5b" font-size="11" text-anchor="end">${fmt(v)}</text>`,
      )
      .join("");
    const xs = Array.from({ length: 9 }, (_, i) => i)
      .map(
        (i) =>
          `<line x1="${x(i)}" y1="${padT}" x2="${x(i)}" y2="${height - padB}" stroke="#eee4d6"/><text x="${x(i)}" y="${height - 12}" fill="#7b6a5b" text-anchor="middle" font-size="11">S${i}</text>`,
      )
      .join("");
    const series = [
      ["target", "#a3917f", "6 4", "Trayectoria objetivo"],
      ["projected", "#6f845e", "3 4", `Estimación por balance (${(rows.at(-1) || {}).count || 0} días cerrados)`],
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
        ["projected", "#6f845e"],
      ]
        .filter(([k]) => last[k] !== null)
        .map(
          ([k, color]) =>
            `<text x="${x(8) - 6}" y="${y(last[k]) + (k === "target" ? 16 : -8)}" fill="${color}" font-size="11" font-weight="700" text-anchor="end">${fmt(last[k])} kg</text>`,
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
      )}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Peso objetivo, peso registrado y proyección por déficit"><title>Comparación de peso en 8 semanas</title>${grid}${xs}<text x="4" y="12" fill="#7b6a5b" font-size="11">kg</text>${lines}${start}${labels}${ends}</svg><p class="tiny subtle">Eje vertical: peso en kg · Eje horizontal: semanas del programa (S0 = inicio). Peso real = promedio de las pesadas de la semana.</p>`;
  }
  function backup() {
    const last = FitStore.get("backupInfo")?.lastRequested;
    const lastText = last ? new Date(last).toLocaleString("es-CR") : "Aún no se ha solicitado una copia en este dispositivo";
    return `<article><h3>Copias de seguridad</h3><p class="tiny subtle">Última descarga solicitada: ${escape(lastText)}. Comprueba que el archivo se haya guardado en Descargas.</p><p>Los datos se guardan en este navegador. Exporta una copia para cambiarlos de dispositivo o protegerlos si borras el almacenamiento.</p><div class="btn-row"><button id="exportAll" class="primary">Exportar todo</button><label class="file-btn">Importar copia<input id="importAll" type="file" accept="application/json" hidden></label></div></article>`;
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
    for (const button of root.querySelectorAll('button[data-log-recipe], button[data-quick-log], form button:not([type="button"])')) {
      if (!button.closest('#cardioForm,#dailyForm,#manualMealForm,#foodLogForm') && !button.matches('[data-log-recipe],[data-quick-log]')) continue;
      const label = document.createElement('small'); label.className = 'save-date';
      label.textContent = date() ? 'Para ' + niceDate(date()) : 'Configura la fecha de inicio';
      button.after(label);
    }
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
      const f = b.dataset.focus && el && el.querySelector(`[name="${b.dataset.focus}"],[data-weight-metric]`);
      if (f) setTimeout(() => f.focus({ preventScroll: true }), 350);
      return;
    }
    if (b.hasAttribute("data-go-today")) {
      goDate(today());
      return;
    }
    if (b.hasAttribute("data-open-settings")) {
      document.getElementById("backupBtn").click();
      return;
    }
    if (b.dataset.insightRange) {
      program.insightRange = Number(b.dataset.insightRange);
      persist();
      show();
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
        if (file.size > 80000000) throw Error("La copia supera 80 MB");
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
        // r94: restaura también las fotos propias de alimentos si la copia las trae.
        let nPhotos = 0;
        if (o.photos && typeof o.photos === "object" && window.FitPhotos?.importAll) {
          try { nPhotos = await window.FitPhotos.importAll(o.photos); } catch {}
        }
        alert(nPhotos ? `Copia importada (incluye ${nPhotos} fotos)` : "Copia importada");
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
        effort: d.get("effort") === "" ? null : Number(d.get("effort")),
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
  const backupAccess = document.createElement("button");
  backupAccess.type = "button"; backupAccess.textContent = "Copias: descargar o restaurar";
  backupAccess.setAttribute("data-open-backup", ""); settings.appendChild(backupAccess);
  document.addEventListener("click", e => {
    if (!e.target.closest("[data-open-backup]")) return;
    settings.hidden = true; program.view = "progress"; program.progressTab = "weight";
    pendingJump = "sec-backup"; persist(); show();
  });
  document.getElementById("backupBtn").onclick = () => {
    settings.hidden = !settings.hidden;
    if (!settings.hidden) {
      syncCalendar();
      settings.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  // Opciones → Metas: cada meta se puede cambiar; vacío vuelve al valor original.
  const GOAL_FIELDS = [
    ["kg", "Bajar en 8 semanas (kg)", 1, 40, 0.5],
    ["kcal", "Consumo máximo diario (kcal)", 1000, 5000, 50],
    ["run", "Running (km)", 1, 2000, 1],
    ["swim", "Natación (km)", 1, 2000, 1],
    ["hike", "Hiking / Rucking (km)", 1, 2000, 1],
    ["steps", "Pasos totales", 1000, 5000000, 1000],
    ["pushups", "Push-ups (reps)", 1, 100000, 1],
    ["abs", "Abdominales (reps)", 1, 100000, 1],
    ["pullups", "Pull-ups (reps)", 1, 100000, 1],
    ["squats", "Sentadillas (reps)", 1, 100000, 1],
  ];
  function renderGoals() {
    const box = document.getElementById("goalFields");
    if (!box) return;
    const g = C.goals(),
      saved = program.goals || {};
    box.innerHTML =
      GOAL_FIELDS.map(
        ([k, label, min, max, step]) =>
          `<label>${label}<input data-goal="${k}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${saved[k] ?? ""}" placeholder="${C.DEFAULT_GOALS[k]}">${saved[k] != null && Number(saved[k]) !== C.DEFAULT_GOALS[k] ? `<small class="subtle">Original: ${C.DEFAULT_GOALS[k].toLocaleString("es-CR")}</small>` : ""}</label>`,
      ).join("") +
      `<p class="tiny subtle goal-note">Equivalencia matemática diaria de la meta de −${g.kg} kg: <b>${C.NEEDED.toLocaleString("es-CR")} kcal</b>. Es una estimación, no una recomendación de déficit diario. Deja un campo vacío para volver al valor original.</p>`;
  }
  document.getElementById("goalFields")?.addEventListener("change", (e) => {
    const k = e.target.dataset.goal;
    if (!k) return;
    if (e.target.value === "") {
      if (program.goals) delete program.goals[k];
    } else {
      if (!e.target.checkValidity()) {
        e.target.reportValidity?.();
        return;
      }
      program.goals ??= {};
      program.goals[k] = Number(e.target.value);
    }
    persist();
    renderGoals();
    show();
  });
  renderGoals();
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
      if (e.target.closest("[data-done],[data-set-done],[data-copy-series]") && (!C.validDate(date()) || date() > today())) {
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
