// Carga los módulos de EVÓ en un contexto aislado con localStorage y document mínimos.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}

function load(files, { storage = {}, session = {} } = {}) {
  const listeners = {};
  const document = {
    readyState: "complete",
    hidden: false,
    body: null,
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener: (t, f) => ((listeners["doc:" + t] ||= []).push(f)),
    createElement: () => ({ style: {}, setAttribute() {}, append() {}, click() {}, remove() {} }),
  };
  const ctx = {
    console,
    localStorage: storage && storage.getItem ? storage : memoryStorage(storage),
    sessionStorage: memoryStorage(session),
    document,
    location: { reload: () => (ctx.reloaded = (ctx.reloaded || 0) + 1) },
    setTimeout: (f) => f(),
    alert: () => {},
    confirm: () => true,
    addEventListener: (t, f) => ((listeners[t] ||= []).push(f)),
    _listeners: listeners,
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
  return ctx;
}

module.exports = { load, memoryStorage };
