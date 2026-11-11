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
  // r103: si no se pueden leer los datos, no se escribe nada encima.
  let locked = "";
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    data = parse(raw);
  } catch (e) {
    locked = "El navegador no permitió leer los datos guardados.";
  }
  if (raw && (!data || typeof data !== "object")) {
    // Texto dañado: se conserva aparte y se bloquea la escritura.
    try { localStorage.setItem(KEY + ".cuarentena", raw); } catch {}
    locked = "Los datos guardados están dañados. Se conservó una copia aparte; importa un respaldo desde Opciones.";
  }
  if (!data || typeof data !== "object") data = {};
  // r103: número de revisión para detectar cambios hechos desde otra pestaña.
  let rev = Number(data.rev) || 0;
  let stale = false;
  let lastOk = true;
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
  const recordSignature = (part,value) => JSON.stringify(part === 'program' ? [value?.diary,value?.weeks,value?.sessions,value?.meds,value?.wellbeing,value?.customFoods,value?.foodEdits,value?.customMenus,value?.recipeEdits] : value);
  const signatures = {program:recordSignature('program',data.program),strength:recordSignature('strength',data.strength)};
  // Lo último escrito de cada parte; vacío si hubo migración pendiente de guardar.
  const written = {};
  const localDate = () => {const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
  const backupNotice = () => {
    const info=data.backupInfo||{},days=info.changedDays||[];
    const last=info.lastRequested?new Date(info.lastRequested).toLocaleDateString('es-CR'):'ninguna todavía';
    const due=days.length>=3;
    return `<aside class="backup-notice" aria-label="Estado de copia de seguridad"><strong>${due?'Conviene descargar una copia':'Copia de seguridad'}</strong><p class="tiny">Última descarga solicitada: ${last}. ${days.length} días con cambios desde entonces.</p>${due?'<button type="button" data-open-backup>Guardar una copia</button>':''}<small>Comprueba que el archivo esté en Descargas.</small></aside>`;
  };
  const conflictError = () => Object.assign(Error("Otra pestaña guardó cambios más recientes"), { conflict: true });
  const storedRev = () => {
    const cur = parse(localStorage.getItem(KEY));
    return cur && typeof cur === "object" ? Number(cur.rev) || 0 : 0;
  };
  const write = () => {
    if (locked) throw Object.assign(Error(locked), { locked: true });
    if (stale || storedRev() !== rev) {
      stale = true;
      throw conflictError();
    }
    data.rev = rev + 1;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      data.rev = rev;
      throw e;
    }
    rev = data.rev;
  };
  for (const part of ["program", "strength"]) if (data[part] != null) written[part] = JSON.stringify(data[part]);
  if (migrated && !locked) {
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
  const exportBackup = async () => {
    const now = new Date();
    // r94: incluye las fotos propias de alimentos (guardadas en este navegador).
    let photos = {};
    let photoError = "";
    try { photos = (await g.FitPhotos?.exportAll?.()) || {}; } catch (e) { photoError = (e && e.message) || "error desconocido"; }
    // r103: si las fotos no se pudieron leer, se avisa en vez de exportar una copia incompleta en silencio.
    if (photoError && !confirm(`No se pudieron leer las fotos de alimentos (${photoError}). ¿Descargar la copia sin fotos?`)) return { photos: 0, photoError, cancelled: true };
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const body = JSON.stringify(
      { version: BACKUP_VERSION, exported: now.toISOString(), program: data.program ?? null, strength: data.strength ?? null, photos },
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
    data.backupInfo = { lastRequested: now.toISOString(), changedDays: [] };
    document.querySelectorAll(".backup-notice").forEach(el=>{el.outerHTML=backupNotice();});
    try { write(); } catch { mark(false); }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const n = Object.keys(photos).length;
    const el = typeof document !== "undefined" && document.getElementById("saveState");
    if (el) el.textContent = `⬇️ Copia descargada${n ? ` con ${n} fotos` : photoError ? " sin fotos" : ""}`;
    return { photos: n, photoError };
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
  // r103: aviso fijo para conflictos entre pestañas y datos bloqueados.
  const banner = (text, reload) => {
    if (typeof document === "undefined" || !document.body) return;
    let el = document.getElementById("storeBanner");
    if (!el) {
      el = document.createElement("div");
      el.id = "storeBanner";
      el.setAttribute("role", "alert");
      el.style.cssText = "position:sticky;top:0;z-index:999;background:#7a2e1f;color:#fff;padding:12px 16px;font-size:15px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap";
      document.body.prepend(el);
    }
    el.innerHTML = "";
    const span = document.createElement("span");
    span.textContent = text;
    el.append(span);
    if (reload) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Recargar";
      b.style.cssText = "background:#fff;color:#7a2e1f;border:0;border-radius:8px;padding:8px 14px;font-weight:700";
      b.onclick = () => location.reload();
      el.append(b);
    }
  };
  const showLocked = () => locked && banner("⚠️ " + locked + " No se guardará nada hasta resolverlo.", false);
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showLocked);
    else showLocked();
  }
  // Otra pestaña guardó: esta queda desactualizada y se recarga al volver a ella.
  g.addEventListener?.("storage", (e) => {
    if (e.key !== KEY || stale) return;
    const cur = parse(e.newValue);
    if (cur && Number(cur.rev) === rev) return;
    stale = true;
    if (document.hidden) return;
    banner("Hay cambios guardados desde otra pestaña. Recarga antes de seguir registrando.", true);
  });
  document.addEventListener?.("visibilitychange", () => {
    if (!document.hidden && stale) location.reload();
  });
  g.FitStore = {
    get: (part) => data[part] ?? null,
    set(part, value) {
      // r103: si no cambió nada, no se escribe (así abrir la app no deja desactualizadas a otras pestañas).
      const json = JSON.stringify(value);
      if (json === written[part]) {
        data[part] = value;
        if (!locked) { lastOk = true; mark(true); }
        return;
      }
      const prevInfo = data.backupInfo, prevValue = data[part], prevSig = signatures[part];
      if (part === 'program' || part === 'strength') {
        const signature=recordSignature(part,value);
        if(signature!==signatures[part]) {
          const info=data.backupInfo||{};
          data.backupInfo={...info,changedDays:[...new Set([...(info.changedDays||[]),localDate()])]};
          signatures[part]=signature;
        }
      }
      data[part] = value;
      try {
        write();
      } catch (e) {
        lastOk = false;
        data.backupInfo = prevInfo;
        signatures[part] = prevSig;
        if (e.conflict) {
          data[part] = prevValue;
          banner("⚠️ No se guardó tu último cambio: otra pestaña guardó antes. Se recargará la app; repítelo después.", true);
          setTimeout(() => location.reload(), 3500);
        } else if (e.locked) showLocked();
        mark(false);
        throw e;
      }
      written[part] = json;
      lastOk = true;
      mark(true);
    },
    // true si el último intento de guardado funcionó.
    ok: () => lastOk,
    // Bloquea la escritura (por ejemplo, si un módulo no pudo leer sus datos).
    lock(reason) {
      locked = locked || reason;
      lastOk = false;
      showLocked();
    },
    isLocked: () => !!locked,
    // r103: importar una copia reemplaza todo en una sola escritura.
    // Guarda antes una copia de lo actual («antes de importar») y desbloquea.
    snapshotBeforeImport() {
      let before = null;
      try { before = localStorage.getItem(KEY); } catch {}
      if (!before) return true;
      try { localStorage.setItem(KEY + ".antes-de-importar", before); return true; } catch { return false; }
    },
    replaceAll(parts) {
      const next = { ...data, ...parts, backupInfo: data.backupInfo };
      let cur = 0;
      try { cur = storedRev(); } catch {}
      next.rev = Math.max(cur, rev) + 1;
      localStorage.setItem(KEY, JSON.stringify(next));
      data = next;
      rev = next.rev;
      locked = "";
      stale = false;
      lastOk = true;
      for (const part of ["program", "strength"]) {
        signatures[part] = recordSignature(part, data[part]);
        written[part] = JSON.stringify(data[part]);
      }
      document.getElementById("storeBanner")?.remove();
      mark(true);
    },
    exportBackup,
    backupNotice,
    readBackup,
  };
})(window);
