const DAYS = ["Pecho y tríceps", "Espalda y bíceps", "Pierna completa", "Hombro aislado", "Bíceps y tríceps"];
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
  } catch (e) {
    alert("No se pudieron guardar los datos. Revisa el almacenamiento del navegador.");
  }
};
const weightKey = (id) => id + "-w" + state.week;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
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
      '"><b>DÍA ' +
      (i + 1) +
      "</b><span>" +
      d +
      "</span></button>",
  ).join("");
  const ex = EXERCISES.filter((x) => x.day === state.day);
  const done = ex.filter((x) => state.completed[weightKey(x.id)]).length;
  const total = EXERCISES.filter((x) => state.completed[weightKey(x.id)]).length;
  $("progress").textContent = total + "/" + EXERCISES.length + " completados";
  $("summary").innerHTML =
    '<div class="sectionHead"><h2>' +
    DAYS[state.day - 1] +
    "</h2><span>" +
    done +
    "/" +
    ex.length +
    " completados</span></div>";
  $("exerciseList").innerHTML =
    '<div class="grid">' +
    ex
      .map((x, i) => {
        const key = weightKey(x.id),
          w = state.weights[key] ?? "",
          ok = !!state.completed[key];
        return (
          '<article class="exercise"><div class="exTop"><img loading="lazy" src="' +
          x.image +
          '" alt="Referencia visual de ' +
          esc(x.name) +
          '"><div><div class="exNum">EJERCICIO ' +
          (i + 1) +
          "</div><h3>" +
          esc(x.name) +
          '</h3><p>3 series × 10–12 repeticiones</p></div></div><div class="controls"><label for="w' +
          x.id +
          '">kg</label><input id="w' +
          x.id +
          '" data-weight="' +
          x.id +
          '" type="number" min="0" step="0.5" inputmode="decimal" placeholder="0" value="' +
          esc(w) +
          '"><button class="' +
          (ok ? "done" : "") +
          '" data-done="' +
          x.id +
          '">' +
          (ok ? "✓ Hecho" : "Completar") +
          '</button><button class="detailBtn" data-detail="' +
          x.id +
          '">Guía ↓</button></div><div class="details" id="detail-' +
          x.id +
          '" hidden><div class="steps"><div class="step"><strong>01 · PREPARACIÓN</strong><p>' +
          esc(x.start) +
          '</p></div><div class="step"><strong>02 · EJECUCIÓN</strong><p>' +
          esc(x.how) +
          '</p></div><div class="step"><strong>03 · MÚSCULOS</strong><p>' +
          esc(x.muscles) +
          '</p><p>Regresa lentamente a la posición inicial.</p></div></div><div class="warning"><b>Evita:</b> ' +
          esc(x.avoid) +
          "</div></div></article>"
        );
      })
      .join("") +
    "</div>";
  $("history").innerHTML =
    '<div class="sectionHead"><h2>Historial de pesos</h2><span>kg · 8 semanas</span></div><div class="history"><table><thead><tr><th>Ejercicio</th>' +
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
              esc(state.weights[x.id + "-w" + (i + 1)] ?? "—") +
              "</td>",
          ).join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table></div>";
}
document.addEventListener("click", (e) => {
  const d = e.target.closest("[data-day]");
  if (d) {
    state.day = Number(d.dataset.day);
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
  const c = e.target.closest("[data-done]");
  if (c) {
    const key = weightKey(c.dataset.done);
    if (!state.completed[key] && !(Number(state.weights[key]) > 0)) {
      alert("Introduce primero el peso utilizado (kg).");
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
  if (e.target.dataset.weight) {
    const key = weightKey(e.target.dataset.weight);
    const val = e.target.value;
    if (val !== "" && (!Number.isFinite(Number(val)) || Number(val) < 0)) {
      alert("Introduce un peso válido.");
      return;
    }
    if (val === "") delete state.weights[key];
    else state.weights[key] = Number(val);
    save();
    render();
  }
});
$("backupBtn").onclick = () => {
  $("settings").hidden = !$("settings").hidden;
  if (!$("settings").hidden) $("settings").scrollIntoView({ behavior: "smooth" });
};
function download(name, body, type) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([body], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
  navigator.serviceWorker.register("./sw.js").catch(() => {});
render();
