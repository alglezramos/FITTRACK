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
    box.innerHTML =
      GOAL_FIELDS.map(([k, label, min, max, step]) => {
        const sug = k === "kcal" ? C.profileCalc(p).suggestedKcal : null,
          def = sug || C.DEFAULT_GOALS[k];
        return `<label>${label}<input data-goal="${k}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${escape(saved[k] ?? "")}" placeholder="${def ? def : "sin meta"}">${saved[k] != null && Number(saved[k]) !== def ? `<small class="subtle">Original: ${def ? def.toLocaleString("es-CR") : "sin meta"}</small>` : ""}</label>`;
      }).join("") +
      `<p class="tiny subtle goal-note">Consumo máximo vacío = ${C.profileCalc(p).suggestedKcal ? "el sugerido por tu perfil" : "1.800 kcal (completa tu perfil para una sugerencia propia)"}. Deja cualquier campo vacío para volver al valor original.</p>`;
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
      item = (label, value, note) => `<div><span>${label}</span><strong>${value}</strong>${note ? `<small class="subtle">${note}</small>` : ""}</div>`;
    const kcalNow = C.goals().kcal,
      custom = Number((p.goals || {}).kcal) > 0;
    return `<div class="daily-numbers profile-numbers">
        ${item("Meta", r.goalWeight != null ? fmt(r.goalWeight) + " kg" : "—", `−${r.kgGoal} kg · 1 kg por semana`)}
        ${item("Fin del programa", r.end ? escape(r.end) : "—", `${C.WEEKS} semanas`)}
        ${item("Déficit necesario", fmt(r.dailyDeficit) + " kcal/día", "7.700 kcal ≈ 1 kg")}
        ${item("IMC", r.bmi != null ? fmt(r.bmi) : "—", r.bmiGoal != null ? "Meta: " + fmt(r.bmiGoal) : "falta la estatura")}
        ${item("Gasto en reposo", r.bmr ? fmt(r.bmr) + " kcal" : "—", r.bmr ? "Mifflin-St Jeor" : "faltan datos")}
        ${item("Gasto estimado", r.tdee ? fmt(r.tdee) + " kcal" : "—", r.tdee ? "con tu nivel de actividad" : "falta el nivel de actividad")}
        ${item("Consumo máximo", fmt(kcalNow) + " kcal", custom ? "propio (en Metas)" : r.suggestedKcal ? "sugerido por tu perfil" : "valor por defecto")}
        ${item("Proteína sugerida", r.protein ? `${fmt(r.protein[0])}–${fmt(r.protein[1])} g` : "—", "1,6–2 g por kg de la meta")}
      </div>
      ${r.warnings.length ? `<ul class="profile-warn">${r.warnings.map((w) => `<li>⚠️ ${escape(w)}</li>`).join("")}</ul>` : ""}
      <p class="tiny subtle">Estimaciones de referencia; el balance real usa el gasto del Whoop. No sustituyen la indicación de un profesional de salud.</p>`;
  }
  function weekPlanHtml() {
    const wp = C.weekPlan(getProgram());
    return `<div class="wp-plan">${wp
      .map(
        (d, i) => `<div class="wp-plan-row"><b>${DOW[i]}</b>
        <label>Pesas<select data-wp="r" data-i="${i}">${["—", "Rutina A", "Rutina B", "Rutina C"].map((l, v) => `<option value="${v}" ${d.r === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="check"><input type="checkbox" data-wp="judo" data-i="${i}" ${d.judo ? "checked" : ""}> Judo</label>
        <label>Cardio (min)<input type="number" min="0" max="600" step="5" inputmode="numeric" data-wp="minutes" data-i="${i}" value="${d.minutes || ""}" placeholder="0"></label></div>`,
      )
      .join("")}</div><p class="tiny subtle">En Entreno cada día muestra su rutina programada; puedes elegir otra solo para esa fecha.</p>`;
  }

  function render() {
    const pf = $("profileFields"),
      sm = $("profileSummary"),
      wpf = $("weekPlanFields");
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
