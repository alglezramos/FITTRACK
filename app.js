const DAYS = ["Piernas y glúteos", "Pecho y tríceps", "Espalda, hombros y bíceps", "Solo cardio", "Brazos"];
// Nombre de cada día de la rutina (lunes a viernes).
const DAY_NAMES = ["BASE CAMP", "PUSH MODE", "PULL POWER", "ENGINE DAY", "ARM FORCE"];
// Cardio de cada día de la rutina general (fuerza + cardio).
const DAY_CARDIO = ["🥋 Judo", "🏊 Natación", "🥋 Judo", "🏊 Natación", "🥋 Judo"];
let state = { day: 1, week: 1, weights: {}, completed: {} };
try {
  const s = FitStore.get("strength");
  if (s && typeof s === "object") {
    state = { ...state, ...s };
  }
} catch (e) {}
const $ = (id) => document.getElementById(id);
const save = () => {
  try {
    FitStore.set("strength", state);
    return true;
  } catch (e) {
    if (!e.conflict && !e.locked) alert("No se pudieron guardar los datos. Revisa el almacenamiento del navegador.");
    return false;
  }
};
const weightKey = (id) => id + "-w" + state.week;
// Pesos de fuerza: siempre se guardan en libras. Se pueden registrar en kg o lb.
const KG_TO_LB = 2.20462;
const round1 = (n) => Math.round(n * 10) / 10;
const fmtW = (n) => String(round1(Number(n))).replace(".", ",");
// Ejercicios con carga: los que no tienen otra unidad (min, rep).
const isLoad = (id) => {
  const x = EXERCISES.find((e) => e.id === id);
  return !!x && !x.unit;
};
// Convierte una sola vez los pesos antiguos (guardados en kg) a libras.
function normalizeStrengthUnits(st) {
  st.weights ??= {};
  if (st.weightUnit !== "lb") {
    for (const [k, v] of Object.entries(st.weights)) {
      if (isLoad(k.replace(/-w\d+$/, "")) && Number.isFinite(Number(v))) st.weights[k] = round1(Number(v) * KG_TO_LB);
    }
    for (const sets of Object.values(st.sets || {}))
      for (const z of sets || []) if (z && z.w > 0) z.w = round1(z.w * KG_TO_LB);
    st.weightUnit = "lb";
  }
  if (!["lb", "kg"].includes(st.inputUnit)) st.inputUnit = "lb";
  return st;
}
if (state.weightUnit !== "lb" || !state.inputUnit) {
  normalizeStrengthUnits(state);
  save();
}
// ── Series ───────────────────────────────────────────────────────────────
// Objetivo de series × repeticiones a partir del texto del ejercicio ("3 series × 10 …").
const target = (x) => {
  const m = /(\d+)\s*series\s*[×x]\s*(\d+)/i.exec((x && x.sets) || "3 series × 10 repeticiones");
  return { n: m ? Number(m[1]) : 3, reps: m ? Number(m[2]) : 10 };
};
const exById = (id) => EXERCISES.find((e) => e.id === id);
const toShow = (lb) => (state.inputUnit === "kg" ? round1(lb / KG_TO_LB) : round1(lb));
const toLb = (v) => (state.inputUnit === "kg" ? round1(v * KG_TO_LB) : round1(v));
const recordDate = () => {
  const p = FitStore.get("program") || {};
  return window.fitSheetDate ? window.fitSheetDate() : p.start ? FitCalendar.date(p.start, state.week, p.recordDay || 0) : "";
};
// Series de un ejercicio en una semana. Si solo hay peso del formato antiguo, se infieren.
function setsOf(id, w) {
  const k = id + "-w" + w;
  state.sets ??= {};
  if (Array.isArray(state.sets[k])) return state.sets[k];
  if (state.weights[k] != null) {
    const t = target(exById(id));
    return Array.from({ length: t.n }, () => ({ w: Number(state.weights[k]), r: t.reps, done: !!state.completed[k] }));
  }
  return null;
}
const hasData = (sets) => !!sets && sets.some((z) => z.done || z.w > 0);
// Sesiones archivadas: si un ejercicio se repite otro día de la misma semana, la sesión
// anterior se guarda aquí con su fecha en lugar de sobrescribirse.
const archived = (id, w) => (state.archive || []).filter((a) => a.id === id && (w == null || a.week === w));
function prevSession(id) {
  for (let w = state.week - 1; w >= 1; w--) {
    const s = setsOf(id, w);
    if (hasData(s)) return { week: w, sets: s };
  }
  return null;
}
const topOf = (sets) => (sets || []).filter((z) => z.done && z.w > 0).reduce((m, z) => Math.max(m, z.w), 0);
// Mejor peso completado en cualquier semana distinta de la indicada (récord previo).
function bestOf(id, exceptWeek) {
  let best = 0;
  for (let w = 1; w <= 8; w++) if (w !== exceptWeek) best = Math.max(best, topOf(setsOf(id, w)));
  for (const a of archived(id)) best = Math.max(best, topOf(a.sets));
  return best;
}
// Crea las series de la semana actual (si no existen) a partir de lo que muestra la tarjeta.
function ensureSets(id) {
  const k = weightKey(id);
  state.sets ??= {};
  const cur = state.sets[k];
  if (Array.isArray(cur)) {
    // Nueva sesión del mismo ejercicio en otra fecha de la semana: archiva la anterior.
    const today = recordDate(),
      doneDates = [...new Set(cur.filter((z) => z.done && z.d).map((z) => z.d))];
    if (today && doneDates.length && !doneDates.includes(today)) {
      state.archive ??= [];
      state.archive.push({ id, week: state.week, date: doneDates.sort().at(-1), sets: cur.map((z) => ({ ...z })) });
      return (state.sets[k] = cur.map((z) => ({ w: z.w, r: z.r, done: false })));
    }
    return cur;
  }
  const inferred = setsOf(id, state.week);
  if (inferred) return (state.sets[k] = inferred.map((z) => ({ ...z })));
  const t = target(exById(id)),
    prev = prevSession(id),
    w = prev ? [...prev.sets].reverse().find((z) => z.w > 0)?.w ?? null : null;
  return (state.sets[k] = Array.from({ length: t.n }, () => ({ w, r: t.reps, done: false })));
}
// Recalcula peso de la semana (mejor serie), completado y fecha.
function syncExercise(id) {
  const k = weightKey(id),
    sets = state.sets[k] || [];
  const top = topOf(sets),
    anyW = sets.reduce((m, z) => Math.max(m, z.w || 0), 0);
  if (top > 0) state.weights[k] = top;
  else if (anyW > 0) state.weights[k] = anyW;
  else delete state.weights[k];
  const all = sets.length > 0 && sets.every((z) => z.done);
  state.completedDates ??= {};
  // Una sesión archivada completa de esta semana mantiene el ejercicio como hecho.
  const prevDone = archived(id, state.week).find((a) => a.sets.length && a.sets.every((z) => z.done));
  if (all && !state.completed[k]) state.completedDates[k] = recordDate();
  if (!all) {
    if (prevDone) state.completedDates[k] = prevDone.date;
    else delete state.completedDates[k];
  }
  state.completed[k] = all || !!prevDone;
}
const sparkline = (vals) => {
  const pts = vals.map((v, i) => [i, v]).filter(([, v]) => v > 0);
  if (pts.length < 2) return "";
  const max = Math.max(...pts.map((p) => p[1])),
    min = Math.min(...pts.map((p) => p[1])),
    span = max - min || 1,
    x = (i) => 6 + (i * 148) / 7,
    y = (v) => 34 - ((v - min) / span) * 26;
  return (
    '<svg class="spark" viewBox="0 0 160 40" role="img" aria-label="Evolución del mejor peso por semana"><polyline fill="none" stroke="#bf6b47" stroke-width="2" points="' +
    pts.map(([i, v]) => x(i) + "," + y(v)).join(" ") +
    '"/>' +
    pts.map(([i, v]) => '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="2.5" fill="#bf6b47"/>').join("") +
    "</svg>"
  );
};
function historyHtml(x) {
  const unit = state.inputUnit,
    rows = [],
    tops = [];
  for (let w = 1; w <= 8; w++) {
    const s = setsOf(x.id, w),
      k = x.id + "-w" + w;
    tops.push(topOf(s));
    if (!hasData(s)) continue;
    for (const a of archived(x.id, w))
      rows.push(
        "<li><b>S" + w + "</b> · " + esc(a.date.slice(8) + "/" + a.date.slice(5, 7)) + " · " +
          a.sets.filter((z) => z.w > 0).map((z) => fmtW(toShow(z.w)) + "×" + z.r + (z.done ? "" : "?")).join(" · ") + "</li>",
      );
    const date = s.find((z) => z.d)?.d || (state.completedDates || {})[k] || "";
    rows.push(
      "<li><b>S" +
        w +
        "</b>" +
        (date ? " · " + esc(date.slice(8) + "/" + date.slice(5, 7)) : "") +
        " · " +
        s.filter((z) => z.w > 0).map((z) => fmtW(toShow(z.w)) + "×" + z.r + (z.done ? "" : "?")).join(" · ") +
        "</li>",
    );
  }
  if (!rows.length) return '<div class="exhist"><strong>Historial</strong><p class="subtle">Aún no hay sesiones.</p></div>';
  return '<div class="exhist"><strong>Historial · ' + unit + "</strong>" + sparkline(tops) + "<ul>" + rows.reverse().join("") + "</ul></div>";
}
function setsHtml(x) {
  const k = weightKey(x.id),
    t = target(x),
    unit = state.inputUnit,
    cur = setsOf(x.id, state.week),
    prev = prevSession(x.id),
    best = bestOf(x.id, state.week),
    prefW = prev ? [...prev.sets].reverse().find((z) => z.w > 0)?.w ?? null : null,
    n = Math.max(t.n, cur ? cur.length : 0),
    doneN = cur ? cur.filter((z) => z.done).length : 0,
    top = topOf(cur);
  const previousSets = prev ? prev.sets.filter((z) => z.w > 0) : [];
  const same = previousSets.length && previousSets.every((z) => z.w === previousSets[0].w && z.r === previousSets[0].r);
  const previousText = same
    ? fmtW(toShow(previousSets[0].w)) + " " + unit + " × " + previousSets[0].r + " × " + previousSets.length
    : previousSets.map((z) => fmtW(toShow(z.w)) + " " + unit + " × " + z.r).join(" · ");
  const meta = '<div class="setmeta"><span>Anterior' +
    (prev ? " (S" + prev.week + "): " + (previousText || "sin carga") : ": sin registro") + "</span></div>";
  const rows = Array.from({ length: n }, (_, i) => {
    const s = (cur && cur[i]) || { w: prefW, r: t.reps, done: false };
    return (
      '<div class="setrow' +
      (s.done ? " done" : "") +
      '"><span class="setn">S' +
      (i + 1) +
      '</span><input data-set-w="' +
      x.id +
      '" data-i="' +
      i +
      '" type="number" min="0" step="0.1" inputmode="decimal" placeholder="—" value="' +
      (s.w > 0 ? toShow(s.w) : "") +
      '" aria-label="Peso de la serie ' +
      (i + 1) +
      '"><span class="setu">' +
      unit +
      '</span><span class="setx">×</span><input data-set-r="' +
      x.id +
      '" data-i="' +
      i +
      '" type="number" min="0" max="999" step="1" inputmode="numeric" value="' +
      (s.r ?? t.reps) +
      '" aria-label="Repeticiones de la serie ' +
      (i + 1) +
      '"><span class="setr">reps</span><button type="button" class="setok" data-set-done="' +
      x.id +
      '" data-i="' +
      i +
      '" aria-pressed="' +
      !!s.done +
      '" aria-label="Serie ' +
      (i + 1) +
      (s.done ? " completada" : " pendiente") +
      '">✓</button></div>'
    );
  }).join("");
  return { html: meta + '<div class="compact-sets"><div class="setlabels" aria-hidden="true"><span></span><span>' + unit + '</span><span>Reps</span><span></span></div><div class="setlist">' + rows + "</div></div>", doneN, n, ok: !!state.completed[k] };
}
// Lee de la tarjeta el peso y las repeticiones de una serie.
function readRow(id, i) {
  const w = document.querySelector('[data-set-w="' + id + '"][data-i="' + i + '"]'),
    r = document.querySelector('[data-set-r="' + id + '"][data-i="' + i + '"]');
  return { w: w && w.value !== "" ? Number(w.value) : null, r: r && r.value !== "" ? Number(r.value) : null };
}
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
// Rutina histórica: las semanas ya pasadas guardan la lista de ejercicios que tenían,
// así agregar o quitar ejercicios no cambia su porcentaje de cumplimiento.
function routineIds(w) {
  const snap = state.routineByWeek && state.routineByWeek[w];
  return Array.isArray(snap) && snap.length ? snap : EXERCISES.map((e) => e.id);
}
function freezeRoutines() {
  const p = FitStore.get("program") || {};
  if (!p.start || !window.FitCalendar) return;
  const t = new Date(),
    iso = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10),
    pos = FitCalendar.position(p.start, iso),
    cur = pos ? pos.week : iso > FitCalendar.date(p.start, 8, 6) ? 9 : 1;
  state.routineByWeek ??= {};
  let changed = false;
  for (let w = 1; w < Math.min(cur, 9); w++) {
    if (state.routineByWeek[w]) continue;
    const ids = new Set(EXERCISES.map((e) => e.id));
    Object.keys(state.completed || {}).forEach((k) => {
      const m = /^(.*)-w(\d+)$/.exec(k);
      if (m && Number(m[2]) === w && state.completed[k]) ids.add(m[1]);
    });
    state.routineByWeek[w] = [...ids];
    changed = true;
  }
  if (changed) save();
}
window.fitRoutineIds = routineIds;
let rendering = false;
function render() {
  if (rendering) return;
  rendering = true;
  try {
    renderNow();
  } finally {
    rendering = false;
  }
}
function renderNow() {
  $("week").innerHTML = Array.from(
    { length: 8 },
    (_, i) => '<option value="' + (i + 1) + '">Semana ' + (i + 1) + "</option>",
  ).join("");
  $("week").value = state.week;
  $("days").innerHTML = DAYS.map(
    (d, i) =>
      '<button class="day ' +
      (state.day === i + 1 ? "active" : "") +
      '" data-day="' +
      (i + 1) +
      '" title="' +
      esc(d + " + " + DAY_CARDIO[i]) +
      '"><b>' +
      DAY_NAMES[i] +
      "</b></button>",
  ).join("");
  // Encabezado de la hoja del día: fecha del registro y día de rutina elegido.
  const head = $("sheetHead");
  if (head) {
    // La fecha activa la da program.js (window.fitSheetDate); si aún no cargó, se usa la guardada.
    const p = FitStore.get("program") || {};
    const dt = window.fitSheetDate
      ? window.fitSheetDate()
      : window.FitCalendar && p.start
        ? FitCalendar.date(p.start, state.week, p.recordDay || 0)
        : "";
    const nice = dt
      ? new Date(dt + "T12:00:00Z").toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
      : "Elige el inicio del programa en ⚙ Opciones";
    head.innerHTML =
      '<div class="eyebrow">HOJA DEL DÍA · SEMANA ' +
      state.week +
      "</div><h2>" +
      esc(nice.charAt(0).toUpperCase() + nice.slice(1)) +
      "</h2><p>Rutina: <strong>" +
      DAY_NAMES[state.day - 1] +
      " · " +
      DAYS[state.day - 1] +
      " + " +
      DAY_CARDIO[state.day - 1] +
      "</strong>. Toca otro día abajo si hiciste una rutina distinta.</p>";
  }
  const ex = EXERCISES.filter((x) => x.day === state.day);
  const done = ex.filter((x) => state.completed[weightKey(x.id)]).length;
  // Avance de series del día (solo ejercicios con carga) y estado de la sesión.
  let setsDone = 0,
    setsTotal = 0;
  for (const x of ex.filter((e) => !e.unit)) {
    const s = setsOf(x.id, state.week);
    setsTotal += Math.max(target(x).n, s ? s.length : 0);
    setsDone += s ? s.filter((z) => z.done).length : 0;
  }
  const sessionTag =
    setsDone === 0 ? "" : setsDone >= setsTotal ? '<span class="sess done">✓ Sesión completa</span>' : '<span class="sess">⏸ En curso · continúa cuando quieras</span>';
  freezeRoutines();
  const weekIds = routineIds(state.week),
    total = weekIds.filter((id) => state.completed[id + "-w" + state.week]).length;
  const pct = (n, of) => (of ? (n / of) * 100 : 0);
  const pctText = (n, of) => pct(n, of).toFixed(1).replace(".", ",") + "%";
  const weekPct = pct(total, weekIds.length);
  $("progress").textContent = total + "/" + weekIds.length + " completados · " + pctText(total, weekIds.length);
  // Franja compacta: semana, ejercicios y series del día en una sola línea.
  const dayPct = setsTotal ? (setsDone / setsTotal) * 100 : pct(done, ex.length);
  $("summary").innerHTML =
    '<nav class="sheet-jumps" aria-label="Ir a"><button type="button" data-jump-to="exerciseList">💪 Fuerza</button><button type="button" data-jump-to="cardioEntry">🏃 Cardio</button><button type="button" data-jump-to="sec-retos">🔥 Retos</button></nav>' +
    (ex.length
      ? '<div class="str-strip"><div class="str-nums"><span><b>' +
        esc(DAY_NAMES[state.day - 1] + " · " + DAYS[state.day - 1]) +
        "</b></span><span>Ejercicios <b>" +
        done +
        "/" +
        ex.length +
        "</b></span>" +
        (setsTotal ? "<span>Series <b>" + setsDone + "/" + setsTotal + "</b></span>" : "") +
        "<span>Semana " +
        state.week +
        " <b>" +
        total +
        "/" +
        weekIds.length +
        "</b></span>" +
        sessionTag +
        '</div><div class="weight-progress-track dash-bar" role="progressbar" aria-label="Avance del día" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
        dayPct.toFixed(0) +
        '"><div class="weight-progress-fill" style="width:' +
        Math.min(100, dayPct).toFixed(1) +
        '%"></div></div></div>' +
        '<div class="unit-toggle" role="group" aria-label="Unidad para registrar pesos"><span>Registrar en</span>' +
        ["lb", "kg"]
          .map((u) => '<button type="button" data-unit="' + u + '" aria-pressed="' + (state.inputUnit === u) + '">' + u + "</button>")
          .join("") +
        "<small>Todo se guarda en libras</small></div>"
      : "");
  $("exerciseList").innerHTML =
    '<div class="grid">' +
    ex
      .map((x, i) => {
        const key = weightKey(x.id),
          load = !x.unit,
          stored = state.weights[key],
          inKg = load && state.inputUnit === "kg",
          w = stored == null ? "" : inKg ? round1(stored / KG_TO_LB) : stored,
          ok = !!state.completed[key],
          sets = load ? setsHtml(x) : null;
        return (
          '<article class="exercise exercise-minimal"><div class="exTop">' +
          (x.image
            ? '<button class="exercise-photo" type="button" data-photo="' + x.id + '" aria-label="Ampliar imagen de ' + esc(x.name) + '"><img loading="lazy" src="' + x.image + '" alt="Referencia visual de ' + esc(x.name) + '"></button>'
            : '<div aria-hidden="true" style="width:95px;height:102px;flex:0 0 auto;display:grid;place-items:center;background:#efe5d8;border-radius:10px;font-size:34px">🏋️</div>') +
          '<div><div class="exNum">EJERCICIO ' +
          (i + 1) +
          "</div><h3>" +
          esc(x.name) +
          '</h3><p>' + esc((x.sets || "3 series × 10 repeticiones").replace(/\s*series\s*/i, ' ').replace(/\s*repeticiones/i, '')) + '</p></div></div>' +
          (load
            ? sets.html +
              '<div class="controls"><span class="setprog">' +
              sets.doneN +
              "/" +
              sets.n +
              '</span><button class="' +
              (ok ? "done" : "") +
              '" data-done="' +
              x.id +
              '">' +
              (sets.doneN === sets.n ? "✓ Hecho" : "✓ Completar todo") +
              '</button><button type="button" class="copy-series" data-copy-series="' + x.id + '" aria-label="Copiar peso y repeticiones de la primera serie a las pendientes">Copiar S1</button><button class="detailBtn" data-detail="' +
              x.id +
              '">Guía ↓</button></div>'
            : '<div class="controls"><label for="w' +
          x.id +
          '">' + esc(load ? state.inputUnit : x.unit) + '</label><input id="w' +
          x.id +
          '" data-weight="' +
          x.id +
          '" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0" value="' +
          esc(w) +
          '">' +
          (inKg && stored != null ? '<span class="unit-hint">= ' + fmtW(stored) + " lb</span>" : "") +
          '<button class="' +
          (ok ? "done" : "") +
          '" data-done="' +
          x.id +
          '">' +
          (ok ? "✓ Hecho" : "Completar") +
          '</button><button class="detailBtn" data-detail="' +
          x.id +
          '">Guía ↓</button></div>') +
          '<div class="details" id="detail-' +
          x.id +
          '" hidden><div class="steps"><div class="step"><strong>01 · PREPARACIÓN</strong><p>' +
          esc(x.start) +
          '</p></div><div class="step"><strong>02 · EJECUCIÓN</strong><p>' +
          esc(x.how) +
          '</p></div><div class="step"><strong>03 · MÚSCULOS</strong><p>' +
          esc(x.muscles) +
          '</p><p>Regresa lentamente a la posición inicial.</p></div></div><div class="warning"><b>Evita:</b> ' +
          esc(x.avoid) +
          "</div>" +
          (load ? historyHtml(x) : "") +
          "</div></article>"
        );
      })
      .join("") +
    "</div>";
  // Día sin pesas (Día 4): solo cardio.
  if (!ex.length)
    $("exerciseList").innerHTML =
      '<p class="subtle empty-day">Este día no tiene pesas: solo cardio. Registra tu actividad abajo, en Cardio.</p>';
  $("history").innerHTML =
    '<details class="fold"><summary>Ver historial de pesos <small>lb · 8 semanas</small></summary><div class="history"><table><thead><tr><th>Ejercicio</th>' +
    Array.from({ length: 8 }, (_, i) => "<th>S" + (i + 1) + "</th>").join("") +
    "</tr></thead><tbody>" +
    ex
      .map(
        (x) =>
          "<tr><td>" +
          esc(x.name) +
          "</td>" +
          Array.from(
            { length: 8 },
            (_, i) =>
              '<td class="' +
              (state.week === i + 1 ? "current" : "") +
              '">' +
              esc(state.weights[x.id + "-w" + (i + 1)] == null ? "—" : fmtW(state.weights[x.id + "-w" + (i + 1)])) +
              "</td>",
          ).join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table></div></details>";
  if (!ex.length) $("history").innerHTML = "";
}
// Saltos dentro de Entreno: Fuerza, Cardio y Retos.
document.addEventListener("click", (e) => {
  const j = e.target.closest("[data-jump-to]");
  if (!j) return;
  const el = document.getElementById(j.dataset.jumpTo);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.addEventListener("click", (e) => {
  const d = e.target.closest("[data-day]");
  if (d) {
    state.day = Number(d.dataset.day);
    save();
    render();
    return;
  }
  const u = e.target.closest("#strengthView [data-unit]");
  if (u) {
    state.inputUnit = u.dataset.unit === "kg" ? "kg" : "lb";
    save();
    render();
    return;
  }
  const t = e.target.closest("[data-detail]");
  if (t) {
    const el = $("detail-" + t.dataset.detail);
    el.hidden = !el.hidden;
    return;
  }
  const photo = e.target.closest("[data-photo]");
  if (photo) {
    const x = exById(photo.dataset.photo);
    let dialog = document.getElementById("exercisePhotoDialog");
    if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "exercisePhotoDialog"; document.body.appendChild(dialog); }
    dialog.innerHTML = '<form method="dialog"><button aria-label="Cerrar imagen">Cerrar ×</button></form><h3>' + esc(x.name) + '</h3><img src="' + x.image + '" alt="' + esc(x.name) + '">';
    dialog.showModal(); return;
  }
  const copy = e.target.closest("[data-copy-series]");
  if (copy) {
    const id = copy.dataset.copySeries, first = readRow(id, 0);
    if (!(first.w > 0 && first.r > 0)) { alert("Introduce peso y repeticiones en S1."); return; }
    const sets = ensureSets(id);
    sets.forEach((s,i) => { if (!s.done) { s.w = toLb(first.w); s.r = first.r; } });
    syncExercise(id); save(); render(); return;
  }
  const sd = e.target.closest("[data-set-done]");
  if (sd) {
    const id = sd.dataset.setDone,
      i = Number(sd.dataset.i),
      row = readRow(id, i),
      wasDone = sd.getAttribute("aria-pressed") === "true";
    if (!wasDone && !(row.w > 0)) {
      alert("Introduce el peso de la serie " + (i + 1) + ".");
      return;
    }
    const sets = ensureSets(id);
    const s = (sets[i] ??= { w: null, r: target(exById(id)).reps, done: false });
    if (!s.done) {
      s.w = toLb(row.w);
      s.r = row.r > 0 ? row.r : s.r;
      s.done = true;
      s.d = recordDate();
    } else s.done = false;
    syncExercise(id);
    save();
    render();
    return;
  }
  const c = e.target.closest("[data-done]");
  if (c && isLoad(c.dataset.done)) {
    // Completar todo: marca todas las series con los valores que muestra la tarjeta.
    const id = c.dataset.done,
      k = weightKey(id),
      sets = ensureSets(id);
    if (sets.length && sets.every((z) => z.done)) sets.forEach((z) => (z.done = false));
    else {
      for (let i = 0; i < sets.length; i++) {
        const row = readRow(id, i);
        if (!(row.w > 0)) {
          alert("Introduce el peso de la serie " + (i + 1) + ".");
          return;
        }
        sets[i].w = toLb(row.w);
        if (row.r > 0) sets[i].r = row.r;
        sets[i].done = true;
        sets[i].d ??= recordDate();
      }
    }
    syncExercise(id);
    save();
    render();
    return;
  }
  if (c) {
    const key = weightKey(c.dataset.done);
    if (!state.completed[key] && !(Number(state.weights[key]) > 0)) {
      alert("Introduce primero el peso utilizado.");
      return;
    }
    state.completed[key] = !state.completed[key];
    state.completedDates ??= {};
    if (state.completed[key]) {
      const p = FitStore.get("program") || {};
      if (p.start) state.completedDates[key] = FitCalendar.date(p.start, state.week, p.recordDay || 0);
    } else delete state.completedDates[key];
    save();
    render();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "week") {
    state.week = Number(e.target.value);
    save();
    render();
  }
  if (e.target.dataset.setW || e.target.dataset.setR) {
    const id = e.target.dataset.setW || e.target.dataset.setR,
      i = Number(e.target.dataset.i),
      v = e.target.value === "" ? null : Number(e.target.value);
    if (v !== null && (!Number.isFinite(v) || v < 0)) {
      alert("Introduce un valor válido.");
      render();
      return;
    }
    const sets = ensureSets(id),
      s = (sets[i] ??= { w: null, r: target(exById(id)).reps, done: false });
    if (e.target.dataset.setW) s.w = v === null ? null : toLb(v);
    else s.r = v;
    syncExercise(id);
    save();
    render();
    return;
  }
  if (e.target.dataset.weight) {
    const key = weightKey(e.target.dataset.weight);
    const val = e.target.value;
    if (val !== "" && (!Number.isFinite(Number(val)) || Number(val) < 0)) {
      alert("Introduce un peso válido.");
      return;
    }
    if (val === "") delete state.weights[key];
    else if (isLoad(e.target.dataset.weight) && state.inputUnit === "kg")
      state.weights[key] = round1(Number(val) * KG_TO_LB);
    else state.weights[key] = Number(val);
    save();
    render();
  }
});
$("backupBtn").onclick = () => {
  $("settings").hidden = !$("settings").hidden;
  if (!$("settings").hidden) $("settings").scrollIntoView({ behavior: "smooth" });
};
// Guardar: descarga la copia completa (mismo formato que «Exportar todo»).
$("saveBtn").onclick = () => FitStore.exportBackup();
function download(name, body, type) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([body], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Actualizaciones: cuando una versión nueva toma el control, se avisa para recargar
// la app completa (evita seguir usando archivos de la versión anterior).
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  const hadController = !!navigator.serviceWorker.controller;
  let shown = false;
  const showUpdate = () => {
    if (shown || !hadController) return;
    shown = true;
    const bar = document.createElement("div");
    bar.className = "update-bar";
    bar.setAttribute("role", "status");
    bar.innerHTML = '<span>Nueva versión de EVÓ lista.</span><button type="button">Recargar</button>';
    bar.querySelector("button").onclick = () => location.reload();
    document.body.appendChild(bar);
  };
  navigator.serviceWorker.addEventListener("controllerchange", showUpdate);
  navigator.serviceWorker
    .register("./sw.js")
    .then((reg) => {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    })
    .catch(() => {});
}
render();
