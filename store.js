// Almacenamiento único de FitTrack.
// Guarda programa y fuerza bajo una sola clave. La primera vez copia los datos
// de las claves antiguas (fittrack.program.v1 y fittrack.v1), que se conservan
// intactas como respaldo.
(function (g) {
  const KEY = "fittrack.data.v2";
  const LEGACY = { program: "fittrack.program.v1", strength: "fittrack.v1" };
  const parse = (raw) => {
    try {
      return JSON.parse(raw || "null");
    } catch {
      return null;
    }
  };
  let data = null;
  try {
    data = parse(localStorage.getItem(KEY));
  } catch {}
  if (!data || typeof data !== "object") data = {};
  let migrated = false;
  for (const [part, oldKey] of Object.entries(LEGACY)) {
    if (data[part] != null) continue;
    let old = null;
    try {
      old = parse(localStorage.getItem(oldKey));
    } catch {}
    if (old) {
      data[part] = old;
      migrated = true;
    }
  }
  const write = () => localStorage.setItem(KEY, JSON.stringify(data));
  if (migrated) {
    try {
      write();
    } catch {}
  }
  const BACKUP_VERSION = "fittrack-complete-2";
  // Normaliza cualquier copia conocida a { program, strength }.
  // Acepta: formato actual (fittrack-complete-1/2) y el antiguo de «Guardar»
  // ({ app: "FitTrack", data: { "fittrack.data.v2": {...} } } o claves legacy).
  const readBackup = (o) => {
    if (!o || typeof o !== "object") throw Error("El archivo no es una copia de FitTrack");
    if (["fittrack-complete-1", BACKUP_VERSION].includes(o.version))
      return { program: o.program, strength: o.strength };
    if (o.app === "FitTrack" && o.data && typeof o.data === "object") {
      const v2 = o.data[KEY];
      if (v2 && typeof v2 === "object") return { program: v2.program, strength: v2.strength };
      const program = o.data[LEGACY.program],
        strength = o.data[LEGACY.strength];
      if (program || strength) return { program, strength };
    }
    throw Error("Formato de copia no reconocido");
  };
  // Única forma de exportar: «💾 Guardar» y «Exportar todo» usan esta función.
  const exportBackup = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const body = JSON.stringify(
      { version: BACKUP_VERSION, exported: now.toISOString(), program: data.program ?? null, strength: data.strength ?? null },
      null,
      2,
    );
    const a = document.createElement("a");
    const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
    a.href = url;
    a.download = `fittrack-respaldo-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    data.backupInfo = { lastRequested: now.toISOString() };
    try { write(); } catch { mark(false); }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // Estado visible del guardado: solo dice «Guardado» si el almacenamiento funcionó.
  const mark = (ok) => {
    const el = typeof document !== "undefined" && document.getElementById("saveState");
    if (!el) return;
    el.className = "save-state " + (ok ? "ok" : "fail");
    el.textContent = ok ? "✓ Guardado en este dispositivo" : "⚠️ No se pudo guardar: descarga una copia";
    const btn = document.getElementById("saveBtn");
    if (btn) btn.classList.toggle("urgent", !ok);
  };
  g.FitStore = {
    get: (part) => data[part] ?? null,
    set(part, value) {
      data[part] = value;
      try {
        write();
      } catch (e) {
        mark(false);
        throw e;
      }
      mark(true);
    },
    exportBackup,
    readBackup,
  };
})(window);
