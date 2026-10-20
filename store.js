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
  g.FitStore = {
    get: (part) => data[part] ?? null,
    set(part, value) {
      data[part] = value;
      write();
    },
  };
})(window);
