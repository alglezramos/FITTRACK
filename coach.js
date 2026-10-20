window.createFitCoach = function ({ getProgram, persist, date, today, escape, root, rerender, challenges }) {
  const state = () => getProgram().coachDays?.[date()] || {};
  const painOptions = [
    ["none", "Sin molestias"],
    ["shoulder", "Hombro"],
    ["knee", "Rodilla"],
    ["back", "Espalda"],
    ["neck", "Cuello"],
    ["leg", "Pierna"],
    ["other", "Otra zona"],
  ];
  const energyWords = { 1: "Muy baja", 2: "Baja", 3: "Media", 4: "Buena", 5: "Excelente" };
  function niceDate() {
    const d = date();
    if (!d) return "";
    const raw = new Date(d + "T12:00:00Z").toLocaleDateString("es-CR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  function render() {
    const d = state(),
      locked = date() > today(),
      energy = Number(d.energy) || 4,
      pain = d.pain || "none",
      painOther = d.painOther || "";
    return `<article><div class="eyebrow">ESTADO DEL DÍA</div><div class="coach-top"><div><h2>¿Cómo te sientes hoy?</h2><p class="subtle">${escape(niceDate())}</p></div><div class="coach-badge">♡</div></div><form id="coachCheckin" class="coach-card"><div class="coach-energy-head"><strong>Nivel de energía</strong><span><b id="coachEnergyValue">${energy}</b> /5</span></div><input id="coachEnergy" name="energy" type="range" min="1" max="5" step="1" value="${energy}" ${locked ? "disabled" : ""}><div class="coach-energy-scale"><span>Muy baja</span><strong id="coachEnergyWord">${energyWords[energy]}</strong><span>Excelente</span></div><div class="coach-pain"><strong>¿Tienes alguna molestia?</strong><div class="chip-group">${painOptions.map(([v, label]) => `<label class="chip ${pain === v ? "selected" : ""}"><input type="radio" name="pain" value="${v}" ${pain === v ? "checked" : ""} ${locked ? "disabled" : ""}>${label}</label>`).join("")}</div><div id="coachPainOtherWrap" ${pain === "other" ? "" : "hidden"}><label>Otra zona<input type="text" name="painOther" maxlength="120" value="${escape(painOther)}" placeholder="Escribe la zona" ${locked ? "disabled" : ""}></label></div></div><button class="primary coach-save" ${locked ? "disabled" : ""}>Guardar registro</button></form><p id="coachStatus" role="status"></p></article>`;
  }
  function writable() {
    const p = getProgram();
    p.coachDays ??= {};
    p.coachDays[date()] ??= {};
    return p.coachDays[date()];
  }
  root.addEventListener("submit", (e) => {
    if (e.target.id !== "coachCheckin") return;
    e.preventDefault();
    if (date() > today() || !e.target.checkValidity()) return;
    const f = new FormData(e.target),
      energy = Number(f.get("energy")),
      pain = f.get("pain") || "none",
      painOther = String(f.get("painOther") || "").trim();
    if (!Number.isInteger(energy) || energy < 1 || energy > 5 || !painOptions.some(([v]) => v === pain))
      return;
    const row = writable();
    Object.assign(row, { checkin: true, energy, pain });
    if (pain === "other") row.painOther = painOther;
    else delete row.painOther;
    persist();
    rerender();
  });
  root.addEventListener("input", (e) => {
    if (e.target.id === "coachEnergy") {
      const v = Number(e.target.value) || 4,
        out = root.querySelector("#coachEnergyValue"),
        word = root.querySelector("#coachEnergyWord");
      if (out) out.textContent = String(v);
      if (word) word.textContent = energyWords[v];
    }
  });
  root.addEventListener("change", (e) => {
    if (e.target.name === "pain") {
      const wrap = root.querySelector("#coachPainOtherWrap");
      if (wrap) wrap.hidden = e.target.value !== "other";
      root
        .querySelectorAll(".chip")
        .forEach((ch) => ch.classList.toggle("selected", !!ch.querySelector("input:checked")));
    }
  });
  return { render };
};
