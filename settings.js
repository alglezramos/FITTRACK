// r106: Opciones — metas, duración del programa, ciclos y suplemento.
// r110: pestaña Perfil — datos de la persona, programa (4–12 semanas, meta fija de 1 kg/semana) y semana tipo.
// Separado de program.js: aquí solo hay formularios de configuración; los cálculos viven en core.js y cycles.js.
window.createFitSettings = function ({ getProgram, getStrength, persist, save, rerender, escape, today }) {
  const C = window.FitCore;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n).toLocaleString("es-CR", { maximumFractionDigits: 1 });
  const GOAL_FIELDS = [
    ["kcal", "Consumo máximo diario (kcal)", 1000, 5000, 50],
    ["cardioMin", "Cardio por semana (min)", 30, 1500, 10],
    ["judoDays", "Judo por semana (días)", 1, 7, 1],
    ["protein", "Proteína diaria (g) · opcional", 1, 400, 1],
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
    const box = $("goalFields");
    if (!box) return;
    const p = getProgram(),
      saved = p.goals || {};
    const field = ([k, label, min, max, step]) => {
      const sug = k === "kcal" ? C.profileCalc(p).suggestedKcal : null,
        def = sug || C.DEFAULT_GOALS[k];
      return `<label>${label}<input data-goal="${k}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${escape(saved[k] ?? "")}" placeholder="${def ? def : "sin meta"}">${saved[k] != null && Number(saved[k]) !== def ? `<small class="subtle">Original: ${def ? def.toLocaleString("es-CR") : "sin meta"}</small>` : ""}</label>`;
    };
    // r111: metas diarias y semanales a la vista; retos del ciclo plegados.
    const daily = ["kcal", "protein", "cardioMin", "judoDays"],
      F = (keys) => GOAL_FIELDS.filter(([k]) => keys.includes(k)).map(field).join(""),
      rest = GOAL_FIELDS.map(([k]) => k).filter((k) => !daily.includes(k));
    box.innerHTML = `<h4 class="pf-sub">Diarias y semanales</h4><div class="fields pf-grid">${F(daily)}</div>
      <details class="pf-details"><summary>Retos del ciclo <span class="subtle">· km, pasos y repeticiones</span></summary><div class="fields pf-grid">${F(rest)}</div></details>
      <p class="tiny subtle goal-note">Consumo máximo vacío = ${C.profileCalc(p).suggestedKcal ? "el sugerido por tu perfil" : "1.800 kcal (completa tu perfil para una sugerencia propia)"}. Deja cualquier campo vacío para volver al valor original.</p>`;
  }

  function cycleHtml() {
    const p = getProgram(),
      s = getStrength(),
      W = C.WEEKS,
      minW = Math.max(4, window.FitCycles.lastWeekWithData(p, s));
    const opts = (sel, min) =>
      Array.from({ length: 9 }, (_, i) => i + 4)
        .map((n) => `<option value="${n}" ${n === sel ? "selected" : ""} ${n < min ? "disabled" : ""}>${n} semanas</option>`)
        .join("");
    const end = C.validDate(p.start) ? C.datePlus(p.start, W * 7 - 1) : "";
    const rows = C.series(p),
      last = rows.filter((r) => r.week > 0 && r.actual != null).at(-1);
    const nextStart = end ? (today() > end ? today() : C.datePlus(end, 1)) : today();
    const past = (p.cycles || [])
      .slice()
      .reverse()
      .map((c) => {
        const lost = C.has(c.initialWeight) && c.finalWeight != null ? c.initialWeight - c.finalWeight : null;
        const sm = c.summary || {};
        return `<li><b>${escape(c.start)} → ${escape(c.end)}</b> · ${c.weeks} semanas${C.has(c.initialWeight) ? ` · ${fmt(c.initialWeight)} → ${c.finalWeight != null ? fmt(c.finalWeight) : "—"} kg` : ""}${lost != null ? ` (${lost > 0 ? "−" : "+"}${fmt(Math.abs(lost))} kg)` : ""}<br><small class="subtle">${fmt(sm.closedDays || 0)} días cerrados · déficit ${fmt(sm.deficit || 0)} kcal · ${fmt(sm.sessions || 0)} sesiones de cardio · ${fmt(sm.km || 0)} km · ${fmt(sm.exercisesDone || 0)} ejercicios completados</small></li>`;
      })
      .join("");
    return `<div class="fields"><label>Duración del ciclo<select id="weeksCount">${opts(W, minW)}</select>${minW > 4 ? `<small class="subtle">Mínimo ${minW}: ya hay registros en la semana ${minW}.</small>` : ""}</label></div>
      <p class="tiny subtle">Ciclo actual: ${end ? `<b>${escape(p.start)} → ${escape(end)}</b>` : "configura el inicio"}.</p>
      <details class="cycle-new"><summary>Cerrar este ciclo y empezar otro</summary>
        <p class="tiny subtle">Se archivan pesadas, cardio, retos, compras y fuerza de este ciclo (con su resumen). Se conservan comidas, Whoop, alimentos, recetas, bienestar y metas. Antes se guarda una copia de lo actual en este navegador.</p>
        <div class="fields"><label>Inicio del nuevo ciclo<input id="cycleStart" type="date" value="${escape(nextStart)}"></label>
        <label>Peso inicial (kg)<input id="cycleWeight" type="number" min="20" max="400" step="0.1" inputmode="decimal" value="${last ? escape(Math.round(last.actual * 10) / 10) : escape(p.initialWeight ?? "")}"></label>
        <label>Duración<select id="cycleWeeks">${opts(W, 4)}</select></label></div>
        <button type="button" class="primary" id="closeCycle">Cerrar ciclo y empezar</button>
      </details>
      ${past ? `<details><summary>Ciclos anteriores (${(p.cycles || []).length})</summary><ul class="cycle-list">${past}</ul></details>` : ""}`;
  }

  function supplementHtml() {
    const s = getProgram().supplement || { name: "", dose: "", show: false };
    return `<label>Nombre<input id="suppName" maxlength="80" value="${escape(s.name)}" placeholder="Ej.: vitamina D"></label>
      <label>Pauta<input id="suppDose" maxlength="120" value="${escape(s.dose)}" placeholder="Ej.: 1 cápsula diaria"></label>
      <label class="check"><input id="suppShow" type="checkbox" ${s.show ? "checked" : ""}> Mostrar la tarjeta en Progreso → Bienestar</label>`;
  }

  const DOW = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  // r111: cabecera del perfil — iniciales, nombre, semana actual y avance hacia la meta.
  function heroHtml() {
    const p = getProgram(),
      pr = p.profile || {},
      rows = C.series(p),
      last = rows.filter((r) => r.week > 0 && r.actual != null).at(-1),
      r = C.profileCalc(p, { currentKg: last ? last.actual : null, today: today() }),
      W = C.WEEKS,
      pos = C.validDate(p.start) && window.FitCalendar ? FitCalendar.position(p.start, today()) : null,
      wk = pos ? pos.week : null,
      name = (pr.name || "").trim(),
      initials = name ? name.split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase() : "EV",
      lost = r.initial != null && last ? Math.max(0, r.initial - last.actual) : 0,
      pct = r.kgGoal ? Math.min(100, Math.round((lost / r.kgGoal) * 100)) : 0;
    const chips = [
      r.age != null ? `${r.age} años` : null,
      r.height ? `${r.height} cm` : null,
      r.bmi != null ? `IMC ${fmt(r.bmi)}` : null,
      r.activity ? C.ACTIVITY[r.activity].split(" (")[0] : null,
    ].filter(Boolean);
    return `<div class="pf-avatar" aria-hidden="true">${escape(initials)}</div>
      <div class="pf-hero-main">
        <div class="eyebrow">PERFIL${wk ? ` · SEMANA ${wk} DE ${W}` : ""}</div>
        <h2>${escape(name || "Tu perfil")}</h2>
        <p class="pf-hero-goal">${r.initial != null ? `${fmt(r.initial)} kg → <b>${fmt(r.goalWeight)} kg</b>` : "Escribe tu peso inicial"}${r.end ? ` · hasta el ${escape(niceShort(r.end))}` : ""}</p>
        ${r.initial != null ? `<div class="pf-bar" role="img" aria-label="Avance: ${fmt(lost)} de ${r.kgGoal} kg"><span style="width:${pct}%"></span></div><p class="pf-hero-sub">${fmt(lost)} de ${r.kgGoal} kg · ${pct} %</p>` : ""}
        ${chips.length ? `<div class="pf-chips">${chips.map((c) => `<span>${escape(c)}</span>`).join("")}</div>` : `<p class="pf-hero-sub">Completa «Sobre ti» para ver tu IMC y tu gasto.</p>`}
      </div>`;
  }
  const niceShort = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("es-CR", { day: "numeric", month: "short", timeZone: "UTC" });
  function profileHtml() {
    const pr = getProgram().profile || {};
    const opt = (v, label, cur) => `<option value="${v}" ${String(cur ?? "") === String(v) ? "selected" : ""}>${label}</option>`;
    return `<label>Nombre<input data-profile="name" maxlength="80" value="${escape(pr.name || "")}" placeholder="Tu nombre"></label>
      <label>Sexo<select data-profile="sex">${opt("", "—", pr.sex)}${opt("M", "Hombre", pr.sex)}${opt("F", "Mujer", pr.sex)}</select></label>
      <label>Fecha de nacimiento<input data-profile="birth" type="date" value="${escape(pr.birth || "")}"></label>
      <label>Estatura (cm)<input data-profile="height" type="number" inputmode="decimal" min="100" max="250" step="1" value="${escape(pr.height ?? "")}"></label>
      <label>Nivel de actividad<select data-profile="activity">${opt("", "—", pr.activity)}${Object.entries(C.ACTIVITY).map(([v, l]) => opt(v, l, pr.activity)).join("")}</select></label>`;
  }
  function summaryHtml() {
    const p = getProgram(),
      rows = C.series(p),
      last = rows.filter((r) => r.week > 0 && r.actual != null).at(-1),
      r = C.profileCalc(p, { currentKg: last ? last.actual : null, today: today() }),
      tile = (label, value, note, cls = "") => `<div class="pf-kpi ${cls}"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ""}</div>`;
    const kcalNow = C.goals().kcal,
      custom = Number((p.goals || {}).kcal) > 0;
    return `<h4 class="pf-sub">Resumen</h4><div class="pf-kpis">
        ${tile("Meta", r.goalWeight != null ? fmt(r.goalWeight) + " kg" : "—", `−${r.kgGoal} kg en ${C.WEEKS} semanas`, "is-main")}
        ${tile("Consumo máximo", fmt(kcalNow) + " kcal", custom ? "propio (en Metas)" : r.suggestedKcal ? "sugerido por tu perfil" : "valor por defecto", "is-main")}
        ${tile("Déficit necesario", fmt(r.dailyDeficit) + " kcal/día", "7.700 kcal ≈ 1 kg")}
        ${tile("Fin", r.end ? escape(niceShort(r.end)) : "—", r.end ? escape(r.end.slice(0, 4)) : "")}
        ${tile("IMC", r.bmi != null ? fmt(r.bmi) : "—", r.bmiGoal != null ? "meta " + fmt(r.bmiGoal) : "falta la estatura")}
        ${tile("Gasto en reposo", r.bmr ? fmt(r.bmr) + " kcal" : "—", r.bmr ? "Mifflin-St Jeor" : "faltan datos")}
        ${tile("Gasto estimado", r.tdee ? fmt(r.tdee) + " kcal" : "—", r.tdee ? "con tu actividad" : "falta la actividad")}
        ${tile("Proteína", r.protein ? `${fmt(r.protein[0])}–${fmt(r.protein[1])} g` : "—", "1,6–2 g/kg de la meta")}
      </div>
      ${r.warnings.length ? `<div class="pf-warn" role="note"><b>A tener en cuenta</b><ul>${r.warnings.map((w) => `<li>${escape(w)}</li>`).join("")}</ul></div>` : ""}
      <p class="tiny subtle">Estimaciones de referencia; el balance real usa el gasto del Whoop. No sustituyen la indicación de un profesional de salud.</p>`;
  }
  function weekPlanHtml() {
    const wp = C.weekPlan(getProgram());
    const seg = (d, i) =>
      `<div class="pf-seg" role="group" aria-label="Pesas del ${DOW[i].toLowerCase()}">${["—", "A", "B", "C"]
        .map((l, v) => `<button type="button" data-wp-r="${v}" data-i="${i}" aria-pressed="${d.r === v}" title="${v ? "Rutina " + l : "Sin pesas"}">${l}</button>`)
        .join("")}</div>`;
    return `<div class="pf-week">${wp
      .map(
        (d, i) => `<div class="pf-day${d.r || d.judo || d.minutes ? "" : " is-rest"}">
        <b class="pf-dow" title="${DOW[i]}">${DOW[i].slice(0, 3)}</b>
        ${seg(d, i)}
        <button type="button" class="pf-judo" data-wp-judo="${i}" aria-pressed="${d.judo}">🥋 Judo</button>
        <label class="pf-min"><input type="number" min="0" max="600" step="5" inputmode="numeric" data-wp="minutes" data-i="${i}" value="${d.minutes || ""}" placeholder="0" aria-label="Minutos de cardio del ${DOW[i].toLowerCase()}"><span>min cardio</span></label>
      </div>`,
      )
      .join("")}</div>
      <p class="tiny subtle">${wp.filter((d) => d.r).length} días de pesas · ${wp.filter((d) => d.judo).length} de judo · ${wp.reduce((n, d) => n + d.minutes, 0)} min de cardio por semana.</p>`;
  }

  function render() {
    const pf = $("profileFields"),
      sm = $("profileSummary"),
      wpf = $("weekPlanFields"),
      hero = $("profileHero");
    if (hero) hero.innerHTML = heroHtml();
    if (pf) pf.innerHTML = profileHtml();
    if (sm) sm.innerHTML = summaryHtml();
    if (wpf) wpf.innerHTML = weekPlanHtml();
    renderGoals();
    const cyc = $("cycleFields"),
      sup = $("supplementFields");
    if (cyc) cyc.innerHTML = cycleHtml();
    if (sup) sup.innerHTML = supplementHtml();
  }

  $("goalFields")?.addEventListener("change", (e) => {
    const k = e.target.dataset.goal;
    if (!k) return;
    const p = getProgram();
    if (e.target.value === "") {
      if (p.goals) delete p.goals[k];
    } else {
      if (!e.target.checkValidity()) {
        e.target.reportValidity?.();
        return;
      }
      p.goals ??= {};
      p.goals[k] = Number(e.target.value);
    }
    persist();
    render();
    rerender();
  });

  $("settings")?.addEventListener("change", (e) => {
    const p = getProgram();
    const pk = e.target.dataset && e.target.dataset.profile;
    if (pk) {
      if (e.target.type === "number" && e.target.value !== "" && !e.target.checkValidity()) {
        e.target.reportValidity?.();
        return;
      }
      p.profile ??= {};
      const v = e.target.value;
      if (v === "") delete p.profile[pk];
      else p.profile[pk] = pk === "height" || pk === "activity" ? Number(v) : pk === "name" ? v.trim().slice(0, 80) : v;
      persist();
      render();
      rerender();
      return;
    }
    const wk = e.target.dataset && e.target.dataset.wp;
    if (wk) {
      const i = Number(e.target.dataset.i),
        plan = C.weekPlan(p);
      if (!(i >= 0 && i < 7)) return;
      if (wk === "r") plan[i].r = Math.max(0, Math.min(3, Number(e.target.value) || 0));
      if (wk === "judo") plan[i].judo = e.target.checked;
      if (wk === "minutes") plan[i].minutes = Math.max(0, Math.min(600, Math.round(Number(e.target.value) || 0)));
      p.weekPlan = plan;
      persist();
      render();
      rerender({ strength: true });
      return;
    }
    if (e.target.id === "weeksCount") {
      const n = Number(e.target.value),
        min = window.FitCycles.lastWeekWithData(p, getStrength());
      if (!(n >= 4 && n <= 12) || n < min) return render();
      p.weeksCount = n;
      persist();
      render();
      rerender({ strength: true });
      return;
    }
    if (["suppName", "suppDose", "suppShow"].includes(e.target.id)) {
      p.supplement = {
        name: $("suppName").value.trim().slice(0, 80),
        dose: $("suppDose").value.trim().slice(0, 120),
        show: $("suppShow").checked,
      };
      persist();
      rerender();
    }
  });

  $("settings")?.addEventListener("click", async (e) => {
    // r111: semana tipo con botones (rutina y judo).
    const rb = e.target.closest("[data-wp-r]"),
      jb = e.target.closest("[data-wp-judo]");
    if (rb || jb) {
      const p = getProgram(),
        plan = C.weekPlan(p),
        i = Number(rb ? rb.dataset.i : jb.dataset.wpJudo);
      if (!(i >= 0 && i < 7)) return;
      if (rb) plan[i].r = Math.max(0, Math.min(3, Number(rb.dataset.wpR) || 0));
      else plan[i].judo = !plan[i].judo;
      p.weekPlan = plan;
      persist();
      render();
      rerender({ strength: true });
      return;
    }
    if (e.target.id !== "closeCycle") return;
    if (FitStore.isLocked()) return alert("No se puede cerrar el ciclo mientras los datos están bloqueados.");
    const p = getProgram();
    let result;
    try {
      result = window.FitCycles.close(p, getStrength(), {
        start: $("cycleStart").value,
        initialWeight: $("cycleWeight").value,
        weeks: Number($("cycleWeeks").value),
      });
    } catch (err) {
      return alert(err.message);
    }
    const e0 = result.entry;
    if (
      !confirm(
        `¿Cerrar el ciclo ${e0.start} → ${e0.end} y empezar otro el ${result.program.start} (${result.program.weeksCount} semanas)?\n\nSe archivan pesadas, cardio, retos, compras y fuerza; las comidas y alimentos se conservan.`,
      )
    )
      return;
    if (!FitStore.snapshotBeforeImport()) {
      if (!confirm("No hay espacio para guardar una copia dentro del navegador. Se descargará primero un respaldo. ¿Continuar?")) return;
      await FitStore.exportBackup();
    }
    try {
      FitStore.replaceAll({ program: result.program, strength: result.strength });
    } catch (err) {
      return alert("No se pudo cerrar el ciclo: " + err.message);
    }
    location.reload();
  });

  return { render, GOAL_FIELDS };
};
