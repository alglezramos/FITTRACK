// r106: Opciones — metas, duración del programa, ciclos y suplemento.
// Separado de program.js: aquí solo hay formularios de configuración; los cálculos viven en core.js y cycles.js.
window.createFitSettings = function ({ getProgram, getStrength, persist, save, rerender, escape, today }) {
  const C = window.FitCore;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n).toLocaleString("es-CR", { maximumFractionDigits: 1 });
  const GOAL_FIELDS = [
    ["kg", "Bajar en el ciclo (kg)", 1, 40, 0.5],
    ["kcal", "Consumo máximo diario (kcal)", 1000, 5000, 50],
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
      g = C.goals(),
      saved = p.goals || {},
      kg = Number(p.initialWeight) || 0;
    const proteinHint = kg
      ? ` Proteína: una referencia habitual en déficit es 1,6–2,2 g por kg de peso (≈ ${fmt(Math.round(kg * 1.6))}–${fmt(Math.round(kg * 2.2))} g con ${fmt(kg)} kg); confírmalo con tu nutricionista.`
      : "";
    box.innerHTML =
      GOAL_FIELDS.map(([k, label, min, max, step]) => {
        const def = C.DEFAULT_GOALS[k];
        return `<label>${label}<input data-goal="${k}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${escape(saved[k] ?? "")}" placeholder="${def ? def : "sin meta"}">${saved[k] != null && Number(saved[k]) !== def ? `<small class="subtle">Original: ${def ? def.toLocaleString("es-CR") : "sin meta"}</small>` : ""}</label>`;
      }).join("") +
      `<p class="tiny subtle goal-note">Equivalencia matemática diaria de la meta de −${g.kg} kg en ${C.WEEKS} semanas: <b>${C.NEEDED.toLocaleString("es-CR")} kcal</b>. Es una estimación, no una recomendación de déficit diario.${proteinHint} Deja un campo vacío para volver al valor original.</p>`;
  }

  function cycleHtml() {
    const p = getProgram(),
      s = getStrength(),
      W = C.WEEKS,
      minW = Math.max(4, window.FitCycles.lastWeekWithData(p, s));
    const opts = (sel, min) =>
      Array.from({ length: 13 }, (_, i) => i + 4)
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

  function render() {
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
    if (e.target.id === "weeksCount") {
      const n = Number(e.target.value),
        min = window.FitCycles.lastWeekWithData(p, getStrength());
      if (!(n >= 4 && n <= 16) || n < min) return render();
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
