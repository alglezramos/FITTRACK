window.createFitChallenges = function ({ getProgram, persist, week, date, escape, root, rerender }) {
  // Únicas metas: acumuladas durante las ocho semanas. Sin cuotas semanales.
  const totalTargets = { pushups: 1500, abs: 2000, pullups: 500, squats: 2000 };
  const defaults = () => [
    { id: "pushups", name: "Push-ups", target: totalTargets.pushups },
    { id: "abs", name: "Abdominales", target: totalTargets.abs },
    { id: "pullups", name: "Pull-ups", target: totalTargets.pullups },
    { id: "squats", name: "Sentadillas", target: totalTargets.squats },
  ];
  const data = (w = week(), write = false) => {
    const p = getProgram();
    p.challenges ??= {};
    if (!p.challenges[w] && write) p.challenges[w] = { goals: defaults(), logs: [] };
    const d = p.challenges[w] || { goals: defaults(), logs: [] };
    d.logs ??= [];
    return d;
  };
  const total = (d, id) => d.logs.filter((l) => l.goal === id).reduce((n, l) => n + l.reps, 0);
  const freshId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  const today = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  const fmt = (n) => n.toLocaleString("es-CR", { maximumFractionDigits: 2 });
  const distance = (s) => Number(s.distance || 0) / (s.unit === "m" ? 1000 : 1);
  const kms = (w, mode) =>
    getProgram()
      .sessions.filter(
        (s) => s.week === w && (s.mode === mode || (mode === "Hiking" && s.mode === "Rucking")),
      )
      .reduce((n, s) => n + distance(s), 0);
  const KM_ROWS = [
    ["Correr", "Running", "run", "🏃"],
    ["Nadar", "Natación", "swim", "🏊"],
    ["Hiking", "Hiking / Rucking", "hike", "🥾"],
  ];
  let kmOpen = null,
    kmDraft = "";
  function distances() {
    const plan = planProgress();
    const sessions = getProgram().sessions.filter(
      (s) => s.week === week() && ["Correr", "Nadar", "Hiking", "Rucking"].includes(s.mode),
    );
    const label = (m) =>
      m === "Correr"
        ? "🏃 Running"
        : m === "Nadar"
          ? "🏊 Natación"
          : m === "Rucking"
            ? "🎒 Rucking"
            : "🥾 Hiking";
    const r2 = (n) => Math.round(n * 100) / 100;
    const rows = KM_ROWS.map(([mode, name, ic, emoji]) => {
      const g = plan.find((r) => r.name === name) || { completed: 0, target: 0 },
        pct = g.target ? Math.min(100, (g.completed / g.target) * 100) : 0,
        open = kmOpen === mode;
      const row = `<div class="rep-row km-row"><span class="km-icon">${icon(ic)}</span><div class="rep-info"><div class="rep-top"><strong>${escape(name)}</strong><span>${fmt(r2(g.completed))} / ${fmt(g.target)} km${g.completed >= g.target ? " ✓" : ""}</span></div><progress class="challenge-progress" value="${Math.min(g.completed, g.target)}" max="${g.target}" aria-label="${escape(name)}: ${fmt(r2(g.completed))} de ${fmt(g.target)} km"></progress><small>${Math.round(pct)}% · faltan ${fmt(r2(Math.max(0, g.target - g.completed)))} km</small></div><form data-km-open="${mode}" class="rep-form"><input name="km" type="number" min="0.01" max="1000" step="0.01" placeholder="km" inputmode="decimal" aria-label="Kilómetros de ${escape(name)}"><button class="primary" aria-expanded="${open}" aria-label="Registrar ${escape(name)}">+</button></form></div>`;
      const mini = open
        ? `<form id="weeklyDistanceForm" class="km-mini"><div class="km-mini-head">${emoji} Registrar ${escape(name)}</div>${mode === "Hiking" ? '<label>Actividad<select name="mode"><option value="Hiking">Hiking</option><option value="Rucking">Rucking</option></select></label>' : `<input type="hidden" name="mode" value="${mode}">`}<div class="km-mini-grid"><label>Distancia (km)<input type="number" name="km" min="0.01" max="1000" step="0.01" inputmode="decimal" placeholder="5.5" value="${escape(kmDraft)}" required></label><label>Duración (min)<input type="number" name="minutes" min="1" max="600" step="1" inputmode="numeric" placeholder="35" required></label></div><input type="hidden" name="effort" value="3"><div class="km-mini-actions"><button type="button" data-km-cancel>Cancelar</button><button class="primary">✓ Guardar</button></div></form>`
        : "";
      return row + mini;
    }).join("");
    return `<article class="reps-compact km-compact"><div class="challenge-heading"><h3>Retos de kilómetros</h3><span>Meta final · 8 semanas · <b>Semana ${week()}</b></span></div>${rows}<p class="tiny subtle km-note">Natación: 1.000 m = 1 km. Incluye lo registrado en Cardio; cada salida cuenta una sola vez.</p>${sessions.length ? `<div class="row-list">${sessions.map((s) => `<div class="food-log"><div><b>${label(s.mode)}</b><p>${fmt(distance(s))} km · ${s.minutes} min · ${escape(s.date)}</p></div><button data-delete-distance="${escape(s.id)}">Eliminar</button></div>`).join("")}</div>` : ""}</article>`;
  }
  root.addEventListener("submit", (e) => {
    const form = e.target;
    if (!form.dataset.kmOpen) return;
    e.preventDefault();
    kmOpen = form.dataset.kmOpen;
    kmDraft = form.elements.km.value || "";
    rerender();
    const next = document.querySelector('#weeklyDistanceForm input[name="' + (kmDraft ? "minutes" : "km") + '"]');
    if (next) next.focus();
  });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !("kmCancel" in b.dataset)) return;
    kmOpen = null;
    kmDraft = "";
    rerender();
  });
  
root.addEventListener("submit", (e) => {
    if (e.target.id !== "weeklyDistanceForm") return;
    e.preventDefault();
    const form = e.target;
    if (!form.checkValidity()) return;
    const fd = new FormData(form),
      p = getProgram(),
      mode = fd.get("mode"),
      when = date(),
      km = Number(fd.get("km")),
      minutes = Number(fd.get("minutes")),
      effort = Number(fd.get("effort"));
    if (
      !["Correr", "Nadar", "Hiking", "Rucking"].includes(mode) ||
      !FitCore.validDate(when) ||
      when > today() ||
      !Number.isFinite(km) ||
      km <= 0 ||
      km > 1000 ||
      !Number.isFinite(minutes) ||
      minutes < 1 ||
      minutes > 600 ||
      !Number.isFinite(effort) ||
      effort < 1 ||
      effort > 10
    ) {
      status("Revisa la fecha, distancia, duración y esfuerzo.");
      return;
    }
    if (p.start) {
      const from = FitCore.datePlus(p.start, (week() - 1) * 7);
      if (when < from || when > FitCore.datePlus(from, 6)) {
        status("La fecha no corresponde a la semana activa.");
        return;
      }
    }
    p.sessions.push({
      id: freshId(),
      week: week(),
      mode,
      date: when,
      distance: km,
      unit: "km",
      minutes,
      effort,
      load: "",
      calories: "",
    });
    kmOpen = null;
    kmDraft = "";
    persist();
    rerender();
    status("Salida guardada.");
  });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b?.dataset.deleteDistance) return;
    const p = getProgram();
    p.sessions = p.sessions.filter((s) => s.id !== b.dataset.deleteDistance);
    persist();
    rerender();
    status("Salida eliminada también del historial de Cardio.");
  });
  function planEligible(when) {
    const start = getProgram().start;
    return !start || (when >= start && when <= FitCore.datePlus(start, 55));
  }
  function planProgress() {
    const sessions = getProgram().sessions.filter((s) => s.week >= 1 && s.week <= 8 && planEligible(s.date));
    const rows = [
      ["Running", 50, "km", "Correr"],
      ["Natación", 25, "km", "Nadar"],
      ["Hiking / Rucking", 50, "km", "Hiking"],
    ].map(([name, target, unit, mode]) => ({
      name,
      target,
      unit,
      completed: sessions
        .filter((s) => s.mode === mode || (mode === "Hiking" && s.mode === "Rucking"))
        .reduce((n, s) => n + distance(s), 0),
    }));
    const steps = Object.entries(getProgram().diary || {})
      .filter(([day]) => planEligible(day))
      .reduce((n, [, d]) => n + (FitCore.has(d.steps) ? Number(d.steps) : 0), 0);
    rows.push({ name: "Pasos", target: 800000, unit: "pasos", completed: steps });
    for (const g of defaults()) {
      let completed = 0;
      for (let w = 1; w <= 8; w++)
        completed += data(w)
          .logs.filter((l) => l.goal === g.id && planEligible(l.date))
          .reduce((n, l) => n + l.reps, 0);
      rows.push({ name: g.name, target: totalTargets[g.id], unit: "reps", completed });
    }
    return rows;
  }
  // Iconos de línea propios (24×24, trazo redondeado) para el dashboard de misiones.
  const ICONS = {
    run: '<circle cx="15" cy="4.5" r="2"/><path d="M13 8l-3 4 3 2.5-1.5 5.5M10 12l-4 1.5M13 8l3 3.5 3-.5M11.5 14.5l-4.5 5"/>',
    swim: '<path d="M3 9c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0M3 13.5c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0M3 18c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0"/>',
    hike: '<path d="M2.5 19.5l6.5-11 4 6.5 2.5-4 6 8.5z" fill="currentColor" fill-opacity=".85"/>',
    steps: '<ellipse cx="8" cy="9" rx="2.6" ry="4" fill="currentColor"/><ellipse cx="16" cy="6.5" rx="2.6" ry="4" fill="currentColor"/><circle cx="8" cy="16.5" r="1.8" fill="currentColor"/><circle cx="16" cy="14" r="1.8" fill="currentColor"/>',
    pushups: '<circle cx="19" cy="9" r="2"/><path d="M3 17l14-5M10 14.6l1 4.4M4.5 16.5v2.5"/>',
    abs: '<circle cx="8" cy="5.5" r="2"/><path d="M8.5 9l2 6h7l2.5 4M10.5 15l-4-3.5M5 10l3.5-1"/>',
    pullups: '<path d="M3 4h18"/><circle cx="12" cy="8.5" r="2"/><path d="M7 4l2 5h6l2-5M12 11v6M10 21l2-4 2 4"/>',
    squats: '<circle cx="13" cy="4.5" r="2"/><path d="M12.5 7.5l-1.5 6 5 1.5-1 5M11 13.5l-4 2.5 2 4M12 9.5l4.5 1"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><path d="M12 12l7-7M16.5 4.5H19.5V7.5"/>',
    check: '<path d="M6.5 12.5l3.5 3.5 7.5-8"/>',
    bars: '<path d="M7 17v-5M12 17V7M17 17v-8"/>',
    pulse: '<path d="M2 12h4l2.5-6 4 12 3-8 1.5 2H22"/>',
    dumbbell: '<path d="M6 7v10M3.5 9.5v5M18 7v10M20.5 9.5v5M6 12h12"/>',
  };
  const icon = (k) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
  const MISSION_STYLE = {
    Running: ["run", "#ef4444"],
    Natación: ["swim", "#3b82f6"],
    "Hiking / Rucking": ["hike", "#22c55e"],
    Pasos: ["steps", "#f97316"],
    "Push-ups": ["pushups", "#facc15"],
    Abdominales: ["abs", "#a855f7"],
    "Pull-ups": ["pullups", "#3b82f6"],
    Sentadillas: ["squats", "#f43f5e"],
  };
  function missions() {
    const rows = planProgress(),
      p = getProgram(),
      pctOf = (r) => Math.min(100, Math.max(0, (r.completed / r.target) * 100)),
      done = rows.filter((r) => r.completed >= r.target).length,
      overall = rows.length ? rows.reduce((n, r) => n + pctOf(r), 0) / rows.length : 0,
      pos = p.start ? FitCalendar.position(p.start, today()) : null,
      curWeek = pos ? pos.week : p.start && today() > FitCore.datePlus(p.start, 55) ? 8 : week();
    const card = (r) => {
      const [ic, color] = MISSION_STYLE[r.name] || ["target", "#ffc33d"],
        pct = pctOf(r),
        unit = r.unit === "reps" ? "reps" : r.unit;
      return `<div class="mcard" style="--mc:${color}"><div class="mcard-icon">${icon(ic)}</div><div class="mcard-body"><div class="mcard-top"><strong>${escape(r.name)}</strong><span class="mcard-pct">${Math.round(pct)}%</span></div><p><b>${fmt(Math.round(r.completed * 100) / 100)}</b> / ${fmt(r.target)} ${unit}</p><div class="mcard-bar" role="progressbar" aria-label="${escape(r.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct > 0 ? Math.max(pct, 2).toFixed(1) : 0}%"></i></div></div></div>`;
    };
    const section = (title, ic, color, tagline, set) =>
      `<section class="msec"><div class="msec-head"><h3><span style="color:${color}">${icon(ic)}</span>${title}</h3><small>${tagline}</small></div><div class="mgrid">${set.map(card).join("")}</div></section>`;
    return `<article class="mission-board"><div class="mb-head"><div><div class="eyebrow">MISIÓN 8 SEMANAS</div><h2>Tu camino al 100%</h2><p class="mb-sub">Disciplina hoy, resultados mañana.</p></div><div class="mb-week"><span>Semana</span><strong>${curWeek} / 8</strong><div class="mcard-bar" style="--mc:#ffc33d"><i style="width:${((curWeek / 8) * 100).toFixed(1)}%"></i></div></div></div><div class="mb-stats"><div class="mb-stat"><span class="mb-ic" style="--ic:#ffc33d">${icon("target")}</span><div><strong>${rows.length}</strong><small>Misiones totales</small></div></div><div class="mb-stat"><span class="mb-ic solid" style="--ic:#22c55e">${icon("check")}</span><div><strong>${done}</strong><small>Completadas</small></div></div><div class="mb-stat"><span class="mb-ic solid" style="--ic:#7c3aed">${icon("bars")}</span><div><strong>${rows.length - done}</strong><small>En progreso</small></div></div><div class="mb-stat mb-overall"><small>PROGRESO GENERAL</small><div><strong>${Math.round(overall)}%</strong><div class="mcard-bar" style="--mc:#ffc33d"><i style="width:${overall > 0 ? Math.max(overall, 2).toFixed(1) : 0}%"></i></div></div></div></div></article>${section("Resistencia", "pulse", "#ef4444", "Más kilómetros, más salud, más vida.", rows.filter((r) => r.unit !== "reps"))}${section("Fuerza", "dumbbell", "#c4b5fd", "Un cuerpo más fuerte, una vida más capaz.", rows.filter((r) => r.unit === "reps"))}`;
  }
  function history() {
    const p = getProgram(),
      pos = p.start ? FitCalendar.position(p.start, today()) : null,
      curW = pos ? pos.week : p.start && today() > FitCore.datePlus(p.start, 55) ? 9 : 0;
    const rows = [
      ["Sentadillas", "squats", "reps"],
      ["Push-ups", "pushups", "reps"],
      ["Pull-ups", "pullups", "reps"],
      ["Abdominales", "abs", "reps"],
      ["Running", "Correr", "km"],
      ["Hiking", "Hiking", "km"],
      ["Natación", "Nadar", "km"],
    ].map(([name, key, unit]) => {
      const vals = Array.from({ length: 8 }, (_, i) =>
        unit === "reps" ? total(data(i + 1), key) : kms(i + 1, key),
      );
      const plan = planProgress().find(
        (r) => r.name === name || (name === "Hiking" && r.name.startsWith("Hiking")),
      );
      return { name, unit, vals, sum: vals.reduce((a, b) => a + b, 0), target: plan ? plan.target : null };
    });
    const cell = (v, max, w) => {
      const future = curW && w > curW,
        alpha = v > 0 ? 0.18 + (0.82 * v) / max : 0;
      return `<td class="hm${future ? " is-future" : ""}${w === curW ? " is-now" : ""}" style="${v > 0 ? `background:rgba(255,195,61,${alpha.toFixed(2)});color:${alpha > 0.55 ? "#121212" : "#f4f4f5"}` : ""}" title="Semana ${w}: ${fmt(v)}">${v > 0 ? fmt(Math.round(v * 10) / 10) : "·"}</td>`;
    };
    return `<article><div class="card-head"><h3>Historial de 8 semanas</h3><span>${curW && curW < 9 ? "Vas en la semana " + curW : ""}</span></div><div class="scroll"><table class="heatmap"><thead><tr><th></th>${Array.from({ length: 8 }, (_, i) => `<th class="${i + 1 === curW ? "is-now" : ""}">S${i + 1}</th>`).join("")}</tr></thead><tbody>${rows
      .map((r, ri) => {
        const max = Math.max(...r.vals, 1);
        const pct = r.target ? Math.min(100, (r.sum / r.target) * 100) : 0;
        return `${ri === 4 ? '<tr class="hm-sep"><td colspan="9">Distancia · km</td></tr>' : ""}<tr><th scope="row"><span class="hm-name">${r.name}</span><span class="hm-sum"><strong>${fmt(Math.round(r.sum * 10) / 10)}</strong>${r.target ? ` / ${fmt(r.target)}` : ""}</span>${r.target ? `<span class="hm-bar"><i style="width:${pct.toFixed(1)}%"></i></span>` : ""}</th>${r.vals.map((v, i) => cell(v, max, i + 1)).join("")}</tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><p class="tiny subtle">Repeticiones y km por semana; todo suma a la meta final del programa. Más intenso = más volumen esa semana. Los retos no añaden calorías al balance: ya están en el total de Whoop.</p></article>`;
  }
  function render() {
    const d = data(),
      progress = planProgress(),
      challengeRows = progress.filter((r) => r.unit === "reps");
    return `<p id="challengeStatus" role="status" class="status"></p><article class="reps-compact"><div class="challenge-heading"><h3>Retos de fuerza</h3><span>Meta final · 8 semanas</span></div>${challengeRows
      .map((g) => {
        const id =
            g.name === "Push-ups"
              ? "pushups"
              : g.name === "Pull-ups"
                ? "pullups"
                : g.name === "Sentadillas"
                  ? "squats"
                  : "abs",
          pct = Math.min(100, (g.completed / g.target) * 100);
        return `<div class="rep-row"><div class="rep-info"><div class="rep-top"><strong>${escape(g.name)}</strong><span>${fmt(g.completed)} / ${fmt(g.target)}${g.completed >= g.target ? " ✓" : ""}</span></div><progress class="challenge-progress" value="${Math.min(g.completed, g.target)}" max="${g.target}" aria-label="${escape(g.name)}: ${fmt(g.completed)} de ${fmt(g.target)} repeticiones"></progress><small>${Math.round(pct)}% · faltan ${fmt(Math.max(0, g.target - g.completed))}</small></div><form data-challenge-log="${id}" class="rep-form"><input name="reps" type="number" min="1" max="10000" step="1" placeholder="reps" inputmode="numeric" required aria-label="Repeticiones de ${escape(g.name)}"><button class="primary" aria-label="Sumar a ${escape(g.name)}">+</button></form></div>`;
      })
      .join(
        "",
      )}</article>${distances()}<article><div class="card-head"><h3>Registro de la semana</h3><span>${d.logs.length} tandas</span></div>${
      d.logs.length
        ? d.logs
            .slice()
            .reverse()
            .map(
              (l) =>
                `<div class="food-log"><div><strong>${escape(defaults().find((g) => g.id === l.goal)?.name || "Ejercicio")}</strong><p>${l.reps} repeticiones · ${escape(l.date)}</p></div><button data-delete-challenge-log="${l.id}">Eliminar</button></div>`,
            )
            .join("")
        : '<p class="subtle">Registra tu primera tanda para empezar.</p>'
    }</article>${history()}`;
  }
  function status(msg) {
    const el = document.getElementById("challengeStatus");
    if (el) el.textContent = msg;
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.missionName) {
      getProgram().selectedMission = b.dataset.missionName;
      persist();
      rerender();
      return;
    }
    if (b.id === "openChallenges") {
      getProgram().view = "training";
      getProgram().trainingTab = "challenges";
      persist();
      rerender();
    }
    if (b.dataset.deleteChallengeLog) {
      const d = data(week(), true);
      d.logs = d.logs.filter((l) => l.id !== b.dataset.deleteChallengeLog);
      persist();
      rerender();
      status("Registro eliminado.");
    }
  });
  root.addEventListener("submit", (e) => {
    const form = e.target;
    if (!form.dataset.challengeLog) return;
    e.preventDefault();
    if (!form.checkValidity()) return;
    const fd = new FormData(form),
      d = data(week(), true);
    if (form.dataset.challengeLog) {
      const reps = Number(fd.get("reps")),
        when = date(),
        p = getProgram();
      if (!Number.isInteger(reps) || reps < 1 || reps > 10000) return;
      if (!FitCore.validDate(when) || when > today()) {
        status("Selecciona una fecha válida de hoy o anterior.");
        return;
      }
      if (p.start) {
        const start = FitCore.datePlus(p.start, (week() - 1) * 7);
        if (when < start || when > FitCore.datePlus(start, 6)) {
          status("La fecha no corresponde a esta semana. Cambia la fecha o la semana activa.");
          return;
        }
      }
      if (!defaults().some((g) => g.id === form.dataset.challengeLog)) return;
      d.logs.push({ id: freshId(), goal: form.dataset.challengeLog, reps, date: when });
    }
    persist();
    rerender();
    status("Guardado en la semana " + week() + ".");
  });
  return { render, missions, planProgress };
};
