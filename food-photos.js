// Fotos de alimentos: dos por alimento (empaque y etiqueta nutricional).
// Se guardan comprimidas en IndexedDB de este navegador, separadas de los
// datos principales para no llenar el espacio de localStorage.
(function (g) {
  const SLOTS = ["Empaque", "Etiqueta"];
  const MAX = 1280;
  const key = (id, slot) => id + "|" + slot;
  const known = new Set();
  // r94: fotos de catálogo (food-images.js). Un número es una imagen de producto de
  // Walmart CR; un texto es una ruta dentro de la app. Se ven en todos los dispositivos;
  // una foto propia del mismo espacio tiene prioridad.
  const CAT = g.FIT_FOOD_IMAGES || {};
  const catSrc = (k) => {
    const [id, slot] = k.split("|");
    const v = CAT[id] && CAT[id][slot];
    if (typeof v === "number") return `https://walmartcr.vteximg.com.br/arquivos/ids/${v}-500-500/foto.jpg`;
    return typeof v === "string" && v ? v : null;
  };
  const has = (k) => known.has(k) || !!catSrc(k);
  const urls = new Map();
  let pending = { editor: null, slots: {} };
  let dbp = null;

  const db = () =>
    (dbp ??= new Promise((ok, ko) => {
      const r = indexedDB.open("fittrack-photos", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("photos");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    }));
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((ok, ko) => {
      const t = d.transaction("photos", mode);
      const req = fn(t.objectStore("photos"));
      t.oncomplete = () => ok(req && req.result);
      t.onerror = () => ko(t.error);
    });
  };
  const getBlob = (k) => tx("readonly", (s) => s.get(k));
  const putBlob = (k, b) => tx("readwrite", (s) => s.put(b, k));
  const delBlob = (k) => tx("readwrite", (s) => s.delete(k));

  async function compress(file) {
    const src = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, ko) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => ko(Error("No se pudo leer la imagen"));
        i.src = src;
      });
      const s = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.8));
    } finally {
      URL.revokeObjectURL(src);
    }
  }

  async function url(k) {
    if (urls.has(k)) return urls.get(k);
    if (!known.has(k)) return catSrc(k);
    const b = await getBlob(k);
    if (!b) return catSrc(k);
    const u = URL.createObjectURL(b);
    urls.set(k, u);
    return u;
  }
  function forget(k) {
    if (urls.has(k)) URL.revokeObjectURL(urls.get(k));
    urls.delete(k);
  }

  // Guarda las fotos elegidas en el editor bajo el id definitivo del alimento.
  async function commit(editor, id) {
    if (pending.editor !== editor) return;
    const slots = pending.slots;
    pending = { editor: null, slots: {} };
    for (const [slot, blob] of Object.entries(slots)) {
      const k = key(id, slot);
      forget(k);
      if (blob) {
        await putBlob(k, blob);
        known.add(k);
      } else {
        await delBlob(k);
        known.delete(k);
      }
    }
    refresh();
  }

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  async function fillEditor(el) {
    const id = el.dataset.photoEditor;
    if (pending.editor !== id) pending = { editor: id, slots: {} };
    const parts = await Promise.all(
      SLOTS.map(async (label, slot) => {
        let src = null;
        if (slot in pending.slots) {
          const b = pending.slots[slot];
          src = b ? (b._url ??= URL.createObjectURL(b)) : null;
        } else if (id !== "new" && has(key(id, slot))) src = await url(key(id, slot));
        const fromCat = !(slot in pending.slots) && id !== "new" && !known.has(key(id, slot)) && !!src;
        return `<div class="fp-slot"><span class="fp-label">${label}${fromCat ? ' <small>· catálogo</small>' : ""}</span>${
          src
            ? `<img src="${esc(src)}" alt="${label}" data-photo-preview referrerpolicy="no-referrer">`
            : `<div class="fp-empty">Sin foto</div>`
        }<div class="fp-actions"><label class="fp-btn">${src ? "Cambiar" : "Agregar foto"}<input type="file" accept="image/*" data-photo-input="${slot}" hidden></label>${
          src && !fromCat ? `<button type="button" class="fp-btn" data-photo-remove="${slot}">Quitar</button>` : ""
        }</div></div>`;
      }),
    );
    el.innerHTML = `<span class="fp-title">Fotos (opcional)</span><div class="fp-grid">${parts.join("")}</div>`;
  }

  async function fillThumbs(el) {
    const id = el.dataset.foodPhotos;
    const imgs = await Promise.all(
      SLOTS.map(async (label, slot) => {
        const k = key(id, slot);
        if (!has(k)) return "";
        const u = await url(k);
        return u
          ? `<button type="button" class="fp-thumb-btn" data-photo-view="${esc(k)}" aria-label="Ver foto: ${label}"><img class="fp-thumb" src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`
          : "";
      }),
    );
    el.innerHTML = imgs.join("");
    el.hidden = !el.innerHTML;
  }

  function fillBackup(box) {
    const a = box.querySelector("article");
    if (!a || a.querySelector("[data-photo-backup]")) return;
    const d = document.createElement("div");
    d.className = "btn-row";
    d.dataset.photoBackup = "1";
    d.innerHTML = `<button type="button" id="exportPhotos">Exportar fotos</button><label class="file-btn">Importar fotos<input id="importPhotos" type="file" accept="application/json" hidden></label>`;
    a.append(d);
  }

  let queued = false;
  function hydrate(force) {
    document.querySelectorAll("[data-photo-editor]").forEach((el) => {
      if (force || !el.dataset.done) {
        el.dataset.done = "1";
        fillEditor(el);
      }
    });
    document.querySelectorAll("[data-food-photos]").forEach((el) => {
      if (force || !el.dataset.done) {
        el.dataset.done = "1";
        fillThumbs(el);
      }
    });
    const b = document.getElementById("sec-backup");
    if (b) fillBackup(b);
    if (!document.querySelector("[data-photo-editor]") && pending.editor) pending = { editor: null, slots: {} };
  }
  const refresh = () => hydrate(true);
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      hydrate(false);
    });
  };

  function lightbox(k) {
    const id = k.split("|")[0];
    const list = SLOTS.map((_, s) => key(id, s)).filter((x) => (known.has(x) && urls.has(x)) || (!known.has(x) && catSrc(x)));
    const src = (x) => (known.has(x) ? urls.get(x) : catSrc(x));
    const o = document.createElement("div");
    o.className = "fp-lightbox";
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-label", "Fotos del alimento");
    o.innerHTML = `<button type="button" class="fp-close" aria-label="Cerrar">✕</button><div class="fp-strip">${list
      .map((x) => `<figure data-k="${esc(x)}"><img src="${esc(src(x))}" alt="${SLOTS[x.split("|")[1]]}" referrerpolicy="no-referrer"><figcaption>${SLOTS[x.split("|")[1]]}</figcaption></figure>`)
      .join("")}</div>`;
    const opener = document.activeElement;
    document.body.append(o);
    o.querySelector(`[data-k="${CSS.escape(k)}"]`)?.scrollIntoView({ inline: "start", block: "nearest" });
    // r105: el foco va al botón de cerrar y vuelve a la miniatura al cerrar.
    o.querySelector(".fp-close").focus();
    const close = () => {
      o.remove();
      opener?.focus?.();
    };
    o.addEventListener("click", (e) => {
      if (e.target === o || e.target.closest(".fp-close")) close();
    });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", esc);
      }
    });
  }

  const toDataURL = (b) =>
    new Promise((ok) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.readAsDataURL(b);
    });

  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.photoInput !== undefined) {
      const file = t.files && t.files[0];
      if (!file) return;
      const el = t.closest("[data-photo-editor]");
      try {
        pending.slots[t.dataset.photoInput] = await compress(file);
      } catch (err) {
        alert(err.message);
      }
      if (el) fillEditor(el);
    }
    if (t.id === "importPhotos") {
      const file = t.files && t.files[0];
      if (!file) return;
      try {
        const o = JSON.parse(await file.text());
        if (o.version !== "fittrack-photos-1" || !o.photos) throw Error("Archivo no válido");
        const entries = Object.entries(o.photos);
        if (!confirm(`¿Importar ${entries.length} fotos? Reemplaza las fotos con el mismo alimento.`)) return;
        const r = await importAll(o.photos);
        alert(r.failed ? `Se importaron ${r.n} fotos; ${r.failed} no se pudieron importar.` : `Fotos importadas: ${r.n}.`);
      } catch (err) {
        alert("No se pudieron importar las fotos: " + err.message);
      }
      t.value = "";
    }
  });

  document.addEventListener("click", async (e) => {
    const rm = e.target.closest("[data-photo-remove]");
    if (rm) {
      pending.slots[rm.dataset.photoRemove] = null;
      fillEditor(rm.closest("[data-photo-editor]"));
      return;
    }
    const v = e.target.closest("[data-photo-view]");
    if (v) {
      lightbox(v.dataset.photoView);
      return;
    }
    if (e.target.closest("#closeFood")) pending = { editor: null, slots: {} };
    if (e.target.closest("#exportPhotos")) {
      let photos = {};
      try { photos = await exportAll(); } catch (err) { return alert("No se pudieron leer las fotos: " + err.message); }
      if (!Object.keys(photos).length) return alert("Todavía no hay fotos guardadas.");
      const blob = new Blob([JSON.stringify({ version: "fittrack-photos-1", exported: new Date().toISOString(), photos })], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "fittrack-fotos.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  });

  const style = document.createElement("style");
  style.textContent = `
.fp-title{display:block;font-size:.85rem;color:var(--muted,#9aa0a6);margin:.75rem 0 .4rem}
.fp-grid{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.75rem}
.fp-slot{display:flex;flex-direction:column;gap:.4rem;min-width:0}
.fp-label{font-size:.8rem;font-weight:600}
.fp-slot img,.fp-empty{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)}
.fp-empty{display:grid;place-items:center;font-size:.8rem;color:var(--muted,#9aa0a6)}
.fp-actions{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}
.fp-btn,.food-photos button.fp-btn{display:inline-flex!important;align-items:center;justify-content:center;padding:.4rem .7rem!important;min-height:0!important;min-width:0!important;height:auto!important;aspect-ratio:auto!important;line-height:1.2!important;border-radius:999px!important;border:1px solid rgba(255,255,255,.18)!important;font-size:.8rem!important;font-weight:400!important;cursor:pointer;background:transparent!important;color:inherit!important;width:auto!important}
.fr-photos{display:flex;gap:.3rem;margin-top:.3rem}
.fr-photos[hidden]{display:none}
.fp-thumb-btn{padding:0;border:0;background:none;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;cursor:zoom-in;border-radius:8px}
.fp-thumb{width:34px;height:34px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,.15);pointer-events:none}
.fp-lightbox{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.88);display:flex;align-items:center}
.fp-strip{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;width:100%}
.fp-strip figure{flex:0 0 100%;scroll-snap-align:start;margin:0;padding:16px;box-sizing:border-box;text-align:center}
.fp-strip img{max-width:100%;max-height:80vh;object-fit:contain;border-radius:8px}
.fp-strip figcaption{color:#fff;margin-top:.5rem;font-size:.9rem}
.fp-close{position:absolute;top:12px;right:12px;width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.15);color:#fff;font-size:1.1rem;cursor:pointer;z-index:1}
`;
  document.head.append(style);

  // r94: las fotos propias viajan dentro de «Descargar copia».
  // r103: espera a conocer todas las fotos guardadas y lee directo de IndexedDB.
  async function exportAll() {
    const photos = {};
    if ("indexedDB" in g) (await tx("readonly", (s) => s.getAllKeys())).forEach((k) => known.add(k));
    for (const k of known) {
      const b = await getBlob(k);
      if (b) photos[k] = await toDataURL(b);
    }
    return photos;
  }
  // r103: devuelve cuántas fotos entraron y cuántas fallaron.
  async function importAll(photos) {
    let n = 0, failed = 0;
    for (const [k, data] of Object.entries(photos || {})) {
      if (!/^[\w-]+\|[01]$/.test(k) || !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(String(data))) { failed++; continue; }
      try {
        const b = await (await fetch(data)).blob();
        forget(k);
        await putBlob(k, b);
        known.add(k);
        n++;
      } catch { failed++; }
    }
    refresh();
    return { n, failed };
  }
  g.FitPhotos = { commit, refresh, exportAll, importAll };
  // Las fotos de catálogo se muestran aunque el navegador no tenga IndexedDB.
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
  if (!("indexedDB" in g)) return;
  tx("readonly", (s) => s.getAllKeys())
    .then((keys) => {
      keys.forEach((k) => known.add(k));
      refresh();
    })
    .catch(() => {});
})(window);
