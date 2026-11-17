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
      // r104: los datos se leyeron bien: se guarda la copia buena del día.
      FitStore.keepGood?.();
    }
  } catch (err) {
    // r103: bloquea el guardado para no reemplazar los datos originales con valores vacíos.
    FitStore.lock("No se pudieron leer los registros (" + err.message + "). Se conservan intactos; importa una copia desde Opciones.");
  }
  program.recordDay ??= 0;
  // r106: el suplemento se configura en Opciones. Quien ya marcaba tomas conserva su pauta anterior.
  const withSupplement = (p) => {
    if (!p.supplement)
      p.supplement = Object.values(p.meds || {}).some(Boolean)
        ? { name: "Minoxidil + Dutasteride", dose: "1 cápsula diaria", show: true }
        : { name: "", dose: "", show: false };
    return p;
  };
  withSupplement(program);
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
  // r106: semanas del programa (Opciones → Duración).
  const W = () => FitStore.weeks();
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
        `Ese registro está fuera de las ${W()} semanas del ciclo actual. Se conserva en el historial y en la copia exportada.`,
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
  // r104: con registros, la fecha de inicio queda fija (cada módulo cuenta semanas a su manera
  // y moverla reasignaría el historial a semanas distintas).
  function startLocked() {
    if (!program.start) return false;
    const st = typeof state === "object" ? state : {};
    return (
      Object.values(program.diary || {}).some((d) => (d.meals || []).length || C.has(d.whoop) || C.has(d.steps)) ||
      (program.sessions || []).length > 0 ||
      Object.values(program.weeks || {}).some((w) => Object.values(w || {}).some((v) => C.has(v) && Number(v) > 0)) ||
      Object.values(st.completed || {}).some(Boolean)
    );
  }
  function syncCalendar() {
    program.menuDay = program.recordDay;
    const startInput = document.getElementById("programStart");
    startInput.value = program.start;
    const locked = startLocked();
    startInput.disabled = locked;
    let note = document.getElementById("startLockNote");
    if (locked && !note) {
      note = document.createElement("small");
      note.id = "startLockNote";
      note.className = "tiny subtle";
      note.style.display = "block";
      note.textContent = "Fija: el programa ya tiene registros. Cambiarla movería tu historial entre semanas.";
      startInput.closest("label").after(note);
    } else if (!locked && note) note.remove();
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
          .join("")}<button type="button" class="wk-arrow" data-wk-shift="1" ${w >= W() ? "disabled" : ""} aria-label="Semana siguiente">›</button></span><span class="wk-meta"><span>Semana ${w} de ${W()} · <b>${escape(niceDate(dt))}</b></span>${canToday && dt !== today() ? ' <button type="button" class="go-today" data-go-today>Hoy</button>' : ""}${canYest && dt !== C.datePlus(today(), -1) ? ' <button type="button" class="go-today" data-go-yesterday>Ayer</button>' : ""}</span><span class="wk-legend"><span><i class="is-done"></i>Completo</span><span><i class="is-part"></i>Pendiente</span><span><i class="is-none"></i>Sin registro</span></span>`
      : "";
    rd.innerHTML = dt
      ? strip
      : 'Elige el inicio del programa. <button type="button" class="go-today" data-open-settings>Configurar programa</button>';
    rd.onclick = (e) => {
      const day = e.target.closest("[data-wk-day]"),
        shift = e.target.closest("[data-wk-shift]");
      if (day) goDate(FitCalendar.date(program.start, week(), Number(day.dataset.wkDay)));
      else if (shift) {
        const nw = Math.min(W(), Math.max(1, week() + Number(shift.dataset.wkShift)));
        goDate(FitCalendar.date(program.start, nw, program.recordDay));
      } else if (e.target.closest("[data-go-yesterday]")) goDate(C.datePlus(today(), -1));
      else if (e.target.closest("[data-go-today]")) goDate(today());
      else if (e.target.closest("[data-open-settings]")) document.getElementById("backupBtn").click();
    };
  }
  // r103: devuelve true solo si de verdad se guardó.
  const persist = () => {
    try {
      FitStore.set("program", program);
      return true;
    } catch (e) {
      if (!e.conflict && !e.locked) alert("No se pudieron guardar los datos. Exporta una copia antes de cerrar.");
      return false;
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
  const weighing = window.createFitWeight({ getProgram: () => program, week, today, escape });
  const weight = weighing.weight,
    chart = weighing.chart;
  // El panel se crea después de definir weightOn, bar y kcalTarget (más abajo).
  let insights = null;
  const weekReview = (w) => insights.weekReview(w),
    weeklyProgress = () => insights.weeklyProgress(),
    panel = () => insights.panel();
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
      const end = C.datePlus(from, W() * 7 - 1);
      for (let d = from; d <= today() && d <= end; d = C.datePlus(d, 1)) eligible.push(d);
    }
    const n = eligible.filter((d) => program.meds[d]).length;
    const sup = program.supplement || {};
    if (!sup.show) return "";
    const name = sup.name || "Suplemento",
      dose = sup.dose || "Configúrala en ⚙ Opciones";
    return `<article><div class="eyebrow">SUPLEMENTOS</div><h3>${escape(name)}</h3><p>Tu pauta: <strong>${escape(dose)}</strong>. Marca «Tomado» después de tomarlo.</p><button id="medTaken" class="${taken ? "primary" : ""}" aria-pressed="${taken}" ${date() > today() ? "disabled" : ""}>${taken ? "✓ Tomado · desmarcar" : "Marcar como tomado"}</button><p>${program.medFrequency === "daily" && eligible.length ? `${n}/${eligible.length} días transcurridos · ${Math.round((n / eligible.length) * 100)}% registrados` : "Configura la frecuencia prescrita para calcular el porcentaje."}</p><details><summary>Frecuencia e historial del ciclo</summary><p>Inicio del control: ${escape(from || "pendiente")}</p><p><strong>Pauta: ${escape(dose)}.</strong> Se cambia en ⚙ Opciones.</p><p class="tiny subtle">Pauta registrada según tu indicación. «Sin registro» no significa necesariamente que omitiste la toma.</p><div class="med-grid">${
      C.validDate(from)
        ? Array.from({ length: W() * 7 }, (_, i) => {
            const d = C.datePlus(from, i);
            return `<button data-med-date="${d}" aria-label="${d}: ${program.meds[d] ? "tomado" : "sin registro"}" class="${program.meds[d] ? "taken" : ""}" ${d > today() ? "disabled" : ""}>${i + 1}${program.meds[d] ? " ✓" : ""}</button>`;
          }).join("")
        : "Selecciona una fecha de inicio."
    }</div></details></article>`;
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
    for (let i = 0; i < W() * 7; i++) {
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
    // r109: rutinas full body fijas (L A · M B · X C · J A · V B); la elegida en Entreno para esa fecha manda.
    const defaults = [
      {label:'RUTINA A · Full body + Judo',day:1,judo:true,minutes:0},
      {label:'RUTINA B · Full body + Cardio',day:2,judo:false,minutes:60},
      {label:'RUTINA C · Full body + Judo',day:3,judo:true,minutes:0},
      {label:'RUTINA A · Full body + Cardio',day:1,judo:false,minutes:60},
      {label:'RUTINA B · Full body + Judo',day:2,judo:true,minutes:0},
      {label:'WILD MILES · Hiking o fondo',day:0,judo:false,minutes:60},
      {label:'RESET & RECHARGE · Descanso',day:0,judo:false,minutes:0,rest:true}
    ];
    const plan = {...defaults[i],...(program.dayPlans || {})[dt]};
    const r = window.fitRoutineFor ? window.fitRoutineFor(dt) : plan.day;
    if (r && r !== plan.day) {
      plan.day = r;
      plan.label = "RUTINA " + "ABC"[r - 1] + " · Full body" + (plan.judo ? " + Judo" : plan.minutes ? " + Cardio" : "");
    }
    return plan;
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
  // r106: proteína del día frente a la meta (solo si hay meta). Suma lo conocido y avisa si falta información.
  function proteinRow(d) {
    const goal = C.goals().protein;
    if (!(goal > 0)) return "";
    const meals = d.meals || [];
    const known = meals.filter((m) => window.FitMacros.known(m.macros?.protein));
    const g = known.reduce((n, m) => n + m.macros.protein, 0);
    const missing = meals.length - known.length,
      partial = missing > 0 || Number(d.extras) > 0;
    return `<div class="protein-row"><div class="dash-row"><span>🥩 Proteína</span><strong class="${g >= goal ? "good" : ""}">${fmt(Math.round(g))} / ${fmt(goal)} g</strong></div>${bar(g, goal)}${partial ? `<p class="tiny subtle">Parcial: ${missing ? `${missing} comida${missing === 1 ? "" : "s"} sin dato de proteína` : "hay calorías extra sin desglose"}.</p>` : ""}</div>`;
  }
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
    const kcalCard = `<article class="dash-card"><div class="dash-head"><span>🔥 Calorías</span><strong class="${status[0]}">${status[1]}</strong></div><div class="dash-big"><strong>${fmt(kcal)}</strong><span>/ ${fmt(kcalTarget())} kcal consumidas</span></div>${bar(kcal, kcalTarget(), over ? "is-over" : "")}<div class="dash-row"><div><span>Gastadas</span><strong>${C.has(d.whoop) ? fmt(d.whoop) : "—"}</strong></div><div><span>Balance</span><strong>${b === null ? "—" : (b >= 0 ? "−" : "+") + fmt(Math.abs(b))}</strong></div><div><span>Necesario</span><strong>−${fmt(C.NEEDED)}</strong></div></div>${proteinRow(d)}<p class="tiny subtle">${r.n ? `Ruta −${C.GOAL_KG} kg: vas <b>${fmt(Math.abs(r.gap))} kcal ${r.gap >= 0 ? "por delante" : "por detrás"}</b> (${r.n} días cerrados con Whoop).` : "Datos insuficientes: cierra días con Whoop y comidas para ver si vas en ruta."}${b !== null && !d.closed ? " Balance de hoy provisional hasta cerrar el día." : ""}</p></article>`;
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
      routineN = plan.day >= 1 && plan.day <= 3 && window.fitRoutineEx ? window.fitRoutineEx(plan.day).length : 0;
    const items = [
      { ok: mk.length === 3 || (d.closed && meals.length > 0), icon: "🍽", name: "Comidas", info: mk.length ? mk.join(" · ") + ` · ${fmt(kcal)} kcal` : "Desayuno, almuerzo y cena", act: "data-quick-food", btn: "+ Comida" },
    ];
    if (wk) items.push({ ok: Number(wv) > 0, icon: "⚖️", name: "Peso", info: Number(wv) > 0 ? fmt(Number(wv)) + " kg" : "Pesada de lunes a viernes", act: 'data-jump="dashWeight" data-focus="weight"', btn: "Pesar" });
    if (plan.day >= 1 && plan.day <= 3)
      items.push({ ok: routineN > 0 && todayEx >= routineN, icon: "🏋️", name: "Entreno", info: `${todayEx} de ${routineN || "—"} ejercicios`, act: 'data-home-go="training"', btn: "Entrenar" });
    items.push({ ok: sessions.length > 0, icon: "🏃", name: plan.judo ? "Judo" : plan.day ? "Cardio" : "Actividad", info: sessions.length ? sessions.map((s) => escape(s.mode)).join(" · ") : plan.day ? "Judo, natación o la que hagas" : "Fondo, hiking o recuperación", act: 'data-home-go="training" data-jump-after="cardioEntry"', btn: "Registrar" });
    items.push({ ok: C.has(d.whoop), icon: "⌚", name: "Whoop", info: C.has(d.whoop) ? fmt(d.whoop) + " kcal gastadas" : "Calorías gastadas", act: 'data-jump="sec-quick" data-focus="whoop"', btn: "Anotar" });
    items.push({ ok: C.has(d.steps), icon: "👣", name: "Pasos", info: C.has(d.steps) ? fmt(d.steps) : "Pasos del día", act: 'data-jump="sec-quick" data-focus="steps"', btn: "Anotar" });
    items.push({ ok: !!d.closed, icon: "✅", name: "Cerrar día", info: d.closed ? "Día completo" : "Cuando tengas la comida y el Whoop final", act: 'data-jump="sec-quick" data-focus="closed"', btn: "Cerrar" });
    const doneN = items.filter((x) => x.ok).length;
    const todoCard = `<article class="dash-card todo-card"><div class="dash-head"><span>📋 Tu día</span><strong class="${doneN === items.length ? "good" : ""}">${doneN} de ${items.length} listos</strong></div>${bar(doneN, items.length)}<ul class="todo-list">${items.map((x) => `<li class="${x.ok ? "is-ok" : ""}"><span class="todo-check" aria-hidden="true">${x.ok ? "✓" : ""}</span><span class="todo-txt"><b>${x.icon} ${x.name}</b><small>${x.info}</small></span>${x.ok ? `<button type="button" class="todo-btn quiet" ${x.act}>Ver</button>` : `<button type="button" class="todo-btn" ${x.act}>${x.btn}</button>`}<span class="sr-only">${x.ok ? "Hecho" : "Pendiente"}</span></li>`).join("")}</ul></article>`;
    return `<article id="sec-day" class="dash-top"><div class="eyebrow">HOY · SEMANA ${week()} DE ${W()} · META −${C.GOAL_KG} KG</div><h2>${escape(niceDate(dt))}</h2>${dt !== today() ? "<p><button data-go-today>↩ Volver a hoy</button></p>" : ""}</article>${FitStore.backupNotice()}${todoCard}${window.FitMacros.dailyHtml(d)}<div class="dash-grid">${kcalCard}${actCard}${progCard}</div>${nutrition.renderQuick()}<div class="sec" id="sec-checkin">${coach.render()}</div>`;
  }
  insights = window.createFitPanel({ getProgram: () => program, week, today, escape, weightOn, bar, kcalTarget });
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
      lb = (v) => fmt(window.fitLoad.show(v)),
      U = window.fitLoad.unit();
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
    if (C.validDate(program.start)) for (let i = 0; i < W() * 7; i++) { const d = C.datePlus(program.start, i); if (weightOn(d)) days.add(d); }
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
          if (done.length) strengthRows.push(`<li>${escape(exName(k.replace(/-w\d+(?:-d\d)?$/, "")))} · ${done.map((z) => lb(z.w) + "×" + z.r).join(" · ")} ${U}</li>`);
        }
        for (const a of state.archive || []) {
          const done = a.sets.filter((z) => z && z.done && (z.d || a.date) === day);
          if (done.length) strengthRows.push(`<li>${escape(exName(a.id))} · ${done.map((z) => lb(z.w) + "×" + z.r).join(" · ")} ${U}</li>`);
        }
        for (const [k, dd] of Object.entries(state.completedDates || {})) {
          if (dd !== day || (state.sets || {})[k]) continue;
          const v = state.weights[k];
          const exU = (EXERCISES.find((x) => x.id === k.replace(/-w\d+(?:-d\d)?$/, "")) || {}).unit;
          strengthRows.push(`<li>${escape(exName(k.replace(/-w\d+(?:-d\d)?$/, "")))}${v ? " · " + (exU ? fmt(v) + " " + escape(exU) : lb(v) + " " + U) : ""} ✓</li>`);
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
          parts.push(`<div class="hist-sec"><h4>📝 Otros</h4><p>${program.meds[day] ? escape((program.supplement || {}).name || "Suplemento") + " ✓" : ""}${program.meds[day] && coachD && coachD.checkin ? " · " : ""}${coachD && coachD.checkin ? `Check-in: energía ${coachD.energy}/5${coachD.pain && coachD.pain !== "none" ? " · molestia: " + escape(coachD.pain === "shoulder" ? "hombro" : coachD.pain) : ""}` : ""}</p></div>`);
        if (!parts.length) return "";
        return `<details class="hist-day" ${idx < 7 ? "open" : ""}><summary><span><b>${escape(niceDate(day))}</b>${pos ? ` <small>· Semana ${pos.week}</small>` : ""}</span><span class="hist-tags">${d.closed && (meals.length || Number(d.extras) > 0) ? '<em class="ok">✓ Cerrado</em>' : d.closed ? "<em>Cerrado sin comidas · no cuenta</em>" : meals.length || C.has(d.whoop) ? "<em>Provisional</em>" : ""}${meals.length ? `<em>${fmt(kcal)} kcal</em>` : ""}</span></summary>${parts.join("")}<p class="hist-open"><button type="button" data-hist-open="${day}">Abrir este día en Hoy →</button></p></details>`;
      })
      .filter(Boolean);
    return `<article class="hist-head"><div class="eyebrow">HISTORIAL</div><h2>Todos tus registros</h2><p class="tiny subtle">${cards.length} día${cards.length === 1 ? "" : "s"} con registros · los 7 más recientes abiertos.</p><nav class="subtabs" aria-label="Filtrar historial">${HIST_FILTERS.map(([k, l]) => `<button data-history-filter="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</nav></article>${cards.join("") || '<article><p class="subtle">No hay registros para este filtro.</p></article>'}`;
  }
  function reviewCard() {
    if (!C.validDate(program.start) || !C.has(program.initialWeight))
      return "<article><h3>Cierre semanal</h3><p>Configura inicio y peso inicial en ⚙ Opciones.</p></article>";
    const w = week(),
      r = weekReview(w);
    if (!r) return "";
    return `<article id="sec-review"><div class="eyebrow">CIERRE SEMANAL · SEMANA ${w}</div><h3>¿Vas en ruta a −${C.GOAL_KG} kg?</h3><div class="daily-numbers"><div><span>Déficit semanal</span><strong>${r.n ? fmt(r.defSum) + " kcal" : "—"}</strong><p class="tiny subtle">Ruta: ${fmt(C.NEEDED * 7)} · ${r.n} de 7 días cerrados con Whoop</p></div><div><span>Cintura · Fuerza</span><strong>${C.has(r.waist) ? fmt(r.waist) + " cm" : "—"} · ${r.strengthDone}/${r.strengthTotal}</strong></div></div><p class="coach-reco ${r.tone}">${escape(r.reco)}</p><details><summary>Cómo se calcula</summary><p class="tiny subtle">Estimación con 7.700 kcal/kg: tiende a sobreestimar la pérdida real y las primeras semanas incluyen agua. Úsala como guía, no como promesa. El peso real y la ruta de la semana están en Pesadas.</p></details></article>`;
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
    const planned = window.fitDayCardio ? window.fitDayCardio(dt) : "";
    return `<article id="cardioEntry"><div class="challenge-heading"><h3>Registrar actividad</h3><span>${dt || "pendiente"}</span></div>${planned ? `<p class="tiny subtle">Plan de este día: <strong>${escape(planned)}</strong>. Puedes registrar cualquier otra actividad.</p>` : ""}<div class="cat-chips mode-chips" role="group" aria-label="Actividad">${modes.map((m) => `<button type="button" data-cardio-mode="${m}" aria-pressed="${m === selected}">${modeIcons[m]} ${m}</button>`).join("")}</div><p class="tiny subtle" id="cardioDesc">${modeDescriptions[selected]}</p><form id="cardioForm"><input type="hidden" name="mode" id="cardioModeValue" value="${selected}"><div class="fields"><label>Minutos <input name="minutes" type="number" min="1" max="600"></label><label>Esfuerzo 1–10 (opcional) <input name="effort" type="number" min="1" max="10"></label><label>Distancia (opcional) <input name="distance" type="number" min="0" max="100000" step="any"></label><label>Unidad <select name="unit"><option value="km" ${selected !== "Nadar" ? "selected" : ""}>km</option><option value="m" ${selected === "Nadar" ? "selected" : ""}>m</option></select></label><label id="cardioLoad" ${["Rucking", "Hiking"].includes(selected) ? "" : "hidden"}>Mochila kg (opcional) <input name="load" type="number" min="0" max="50" step="0.1"></label><label>Kcal de actividad (opcional) <input name="calories" type="number" min="0" max="10000" step="1"></label></div><button class="primary">Guardar actividad</button></form><p class="tiny subtle">Escribe minutos, distancia o ambos. La distancia de Correr, Nadar (1.000 m = 1 km), Hiking y Rucking suma a los retos de km. Las kcal de actividad son informativas: el balance usa únicamente Whoop total.</p>${challenges.repForm()}</article>`;
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
      if (button.closest('.quick-repeat')) continue;
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
    if (t.id === "programStart" && C.validDate(t.value) && !startLocked()) program.start = t.value;
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
        C.validateStrength(s);
        if (!confirm("¿Reemplazar todos los registros con esta copia?")) return;
        // r103: guarda lo actual antes de reemplazar; si no cabe, lo descarga como archivo.
        if (!FitStore.snapshotBeforeImport()) {
          if (!confirm("No hay espacio para guardar una copia de lo actual dentro del navegador. Se descargará primero un respaldo de lo actual. ¿Continuar?")) return;
          await FitStore.exportBackup();
        }
        const nextProgram = withSupplement({
          ...defaults,
          ...incoming,
          medFrequency: "daily",
          view: "progress",
          progressTab: "weight",
        });
        // Las copias antiguas guardaban los pesos en kg: se pasan a libras.
        const nextState = normalizeStrengthUnits({ ...s });
        // Una sola escritura: o entra todo o no entra nada.
        FitStore.replaceAll({ program: nextProgram, strength: nextState });
        program = nextProgram;
        state = nextState;
        render();
        pendingJump = "sec-backup";
        show();
        // r94: restaura también las fotos propias de alimentos si la copia las trae.
        let photoMsg = "";
        if (o.photos && typeof o.photos === "object" && Object.keys(o.photos).length && window.FitPhotos?.importAll) {
          try {
            const r = await window.FitPhotos.importAll(o.photos);
            photoMsg = ` Fotos: ${r.n} importadas${r.failed ? `, ${r.failed} con error` : ""}.`;
          } catch (err) {
            photoMsg = " ⚠️ Las fotos no se pudieron importar: " + err.message;
          }
        }
        alert("Copia importada." + photoMsg);
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
    const d = new FormData(e.target);
    // r108: minutos opcionales si hay distancia (así se registran también las salidas de los retos de km).
    const minIn = e.target.elements.minutes,
      noMin = d.get("minutes") === "",
      noDist = !(Number(d.get("distance")) > 0);
    if (noMin && noDist) {
      minIn.setCustomValidity("Escribe los minutos o la distancia.");
      minIn.reportValidity();
      minIn.addEventListener("input", () => minIn.setCustomValidity(""), { once: true });
      return;
    }
    const s = {
        id: Date.now().toString(36),
        week: week(),
        mode: d.get("mode"),
        date: date(),
        minutes: noMin ? null : Number(d.get("minutes")),
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
      settingsUI.render();
      settings.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  // r106: Opciones (metas, duración, ciclos y suplemento) viven en settings.js.
  const settingsUI = window.createFitSettings({
    getProgram: () => program,
    getStrength: () => state,
    persist,
    save,
    escape,
    today,
    rerender: (o) => {
      if (o && o.strength) render();
      show();
    },
  });
  settingsUI.render();
  // Opciones: inicio y peso inicial, sin mezclar configuración con registros.
  document.getElementById("setupInitialWeight").addEventListener("change", (e) => {
    if (!e.target.checkValidity()) return;
    program.initialWeight = e.target.value === "" ? "" : Number(e.target.value);
    persist();
    show();
  });
  document.getElementById("programStart").addEventListener("change", (e) => {
    if (!C.validDate(e.target.value) || startLocked()) {
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
      write = !!e.target.closest("[data-log-recipe],[data-repeat-meal],[data-quick-log],[data-quick-undo],#medTaken,[data-wellbeing]");
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
      if (e.target.closest("[data-done],[data-set-done],[data-copy-series],[data-use-suggest]") && (!C.validDate(date()) || date() > today())) {
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
