window.createFitNutrition = function ({
  getProgram,
  persist,
  week,
  date,
  dayLabel,
  goDate,
  escape,
  root,
  rerender,
}) {
  const foods = [],
    menus = [];
  const sync = () => {
    const p = getProgram();
    foods.splice(
      0,
      foods.length,
      ...[...new Map([...window.FIT_FOODS, ...(p.customFoods || [])].map((f) => [f.id, f])).values()].map(
        (f) => ({ ...f, ...(p.foodEdits || {})[f.id] }),
      ),
    );
    menus.splice(
      0,
      menus.length,
      ...new Map([...window.FIT_MENUS, ...(p.customMenus || [])].map((r) => [r.id, r])).values(),
    );
  };
  sync();
  const kinds = ["Desayuno", "Almuerzo", "Cena", "Merienda 1", "Merienda 2", "Snack nocturno"];
  const category = (k) => (k.startsWith("Merienda") || k === "Snack nocturno" ? "Merienda" : k);
  const matches = (r, kind) =>
    (r.main && ["Almuerzo", "Cena"].includes(category(kind))) || r.kind === category(kind);
  const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const today = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const prog = () => {
    const p = getProgram();
    p.diary ??= {};
    p.foodKcal ??= {};
    p.recipeEdits ??= {};
    p.menuPlan ??= {};
    return p;
  };
  const selectedDate = date;
  const daily = () =>
    prog().diary[selectedDate()] || { meals: [], whoop: "", steps: "", extras: "", closed: false };
  const saveDay = (d) => {
    prog().diary[selectedDate()] = d;
    persist();
  };
  const fById = (id) => foods.find((f) => f.id === id);
  const unitKcal = (f) => prog().foodKcal[f.id] ?? f.kcal;
  const items = (r) => prog().recipeEdits[r.id] || r.items;
  const calories = (rows) =>
    rows.reduce((n, i) => {
      const f = fById(i.food);
      return n + (unitKcal(f) * i.qty) / f.base;
    }, 0);
  const fmt = (n) => Number(n).toLocaleString("es-CR", { maximumFractionDigits: 1 });
  const has = (v) => v !== "" && v !== undefined && v !== null;
  const intake = (d) => d.meals.reduce((n, m) => n + m.kcal, 0) + (Number(d.extras) || 0);
  const balance = (d) => (has(d.whoop) ? Number(d.whoop) - intake(d) : null);
  const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  const planKey = (day, kind) => `${week()}-${day}-${kind}`;
  const planRecipe = (day, kind) => {
    const group = menus.filter((r) => matches(r, kind));
    return (
      menus.find((r) => r.id === prog().menuPlan[planKey(day, kind)]) ||
      menus.find(
        (r) =>
          r.id ===
          {
            Desayuno: "simple-breakfast",
            Almuerzo: day % 2 ? "simple-lunch-b" : "simple-lunch-a",
            Cena: day % 2 ? "simple-dinner-b" : "simple-dinner-a",
            "Merienda 1": "simple-snack-a",
            "Merienda 2": "simple-snack-b",
            "Snack nocturno": "simple-night-soy",
          }[kind],
      ) ||
      group[0]
    );
  };
  const totalDay = (day) => kinds.reduce((sum, k) => sum + calories(items(planRecipe(day, k))), 0);
  const dateField = () =>
    `<p>Fecha del registro: <strong>${selectedDate() || "selecciona el inicio"}</strong></p>`;
  function renderFood() {
    sync();
    const p = prog(),
      tab = p.foodTab || "log",
      day = Number.isInteger(p.menuDay) ? p.menuDay : 0;
    return (
      `<nav class="subtabs" aria-label="Alimentación">${[
        ["log", "Registro"],
        ["week", "Plan"],
        ["catalog", "Alimentos"],
        ["menus", "Recetas"],
        ["shopping", "Súper"],
      ]
        .map(
          ([v, t]) =>
            `<button data-food-tab="${v}" aria-pressed="${tab === v || (v === "menus" && tab === "create")}">${t}</button>`,
        )
        .join("")}</nav>` +
      (tab === "log"
        ? renderLog()
        : tab === "shopping"
        ? renderShopping()
        : tab === "catalog"
          ? renderCatalog()
          : tab === "week"
            ? renderWeek(day)
            : tab === "create"
              ? renderCreate()
              : renderMenus()) +
      renderEditor()
    );
  }
  function renderLog() {
    const d = daily(),
      dt = selectedDate(),
      meals = d.meals || [],
      kcal = intake({ ...d, meals }),
      order = [...kinds, ...new Set(meals.map((m) => m.kind).filter((k) => !kinds.includes(k)))];
    const row = (m) =>
      `<div class="food-log"><div><strong>${escape(m.name)}</strong><br><span class="subtle tiny">${fmt(m.kcal)} kcal</span>${m.items && m.items.length ? `<details><summary>Porciones</summary><p class="tiny">${m.items.map((i) => `${fmt(i.qty)} ${escape(i.unit)} ${escape(i.name)}${has(i.kcal) ? " · " + fmt(i.kcal) + " kcal" : ""}`).join("<br>")}</p></details>` : ""}</div><button data-remove-meal="${escape(m.id)}">Eliminar</button></div>`;
    const groups = order
      .map((k) => {
        const list = meals.filter((m) => m.kind === k);
        return list.length ? `<h4 class="sub-title">${escape(k)}</h4>${list.map(row).join("")}` : "";
      })
      .join("");
    return `<article><div class="card-head"><div><div class="eyebrow">REGISTRO DEL DÍA</div><h3>${escape(dt || "Selecciona el inicio")}</h3></div><span class="pill">${meals.length} · ${fmt(kcal)} kcal</span></div><p>${kcal <= 1800 ? "Restan " + fmt(1800 - kcal) + " de 1.800 kcal" : "Sobre 1.800 por " + fmt(kcal - 1800) + " kcal"}${d.closed ? " · ✓ Día completo" : ""}</p>${groups || '<p class="subtle">Aún no hay comidas registradas este día.</p>'}<div class="btn-row"><button class="primary" data-quick-food>+ Alimento</button><button data-food-tab="menus">+ Receta</button><button data-food-tab="week">Ver plan</button></div></article>`;
  }
  function renderMenus() {
    const selected = prog().menuFilter || "Todos",
      groups = ["Desayuno", "Almuerzo", "Cena", "Merienda"].filter(
        (k) => selected === "Todos" || k === selected,
      );
    const row = (r) => {
      const kcal = calories(items(r));
      return `<div class="recipe-row"><div class="rr-main"><strong>${escape(r.name)}</strong><small><span class="${kcal > 500 ? "over-limit" : "rr-kcal"}">${fmt(kcal)} kcal${kcal > 500 ? " · supera 500" : ""}</span> · ${items(r).length} ingredientes</small></div><div class="rr-actions"><button data-edit-recipe="${r.id}" aria-label="Ajustar ${escape(r.name)}" title="Ajustar porciones">✎</button><button data-log-recipe="${r.id}" class="primary" aria-label="Registrar ${escape(r.name)}">+ Registrar</button></div></div>`;
    };
    return `<article class="catalog-head"><div class="card-head"><h3>${menus.length} recetas</h3><span>Se registran en ${selectedDate() || "—"}</span></div><div class="cat-chips">${["Todos", "Desayuno", "Almuerzo", "Cena", "Merienda"].map((k) => `<button data-menu-filter="${k}" aria-pressed="${k === selected}">${k}</button>`).join("")}</div></article><article class="food-compact">${groups
      .map((k) => {
        const list = menus.filter(
          (r) => r.kind === k || (selected !== "Todos" && matches(r, k) && r.kind !== k),
        );
        return list.length
          ? `<details open><summary><span>${k}</span><small>${list.length}</small></summary>${list.map(row).join("")}</details>`
          : "";
      })
      .join(
        "",
      )}</article><article><div class="card-head"><h3>Crear una receta</h3><button data-food-tab="create" class="primary">+ Crear receta</button></div><p class="tiny subtle">Agrega una receta personalizada a tu catálogo.</p></article>`;
  }
  function renderWeek(day) {
    return `<article><div class="card-head"><h3>Menú · semana ${week()}</h3><span>${fmt(totalDay(day))} kcal propuestas</span></div><details class="intro"><summary>Cómo funciona el plan</summary><p class="tiny subtle">La misma semana se repite durante las ocho semanas: un desayuno fijo, diez opciones intercambiables de almuerzo y cena, yogurt con fruta, batido solo o con fruta y helado de soya con 200 ml de leche por la noche. Reutiliza pollo, arroz y brócoli para preparar varias porciones. Puedes cambiar cualquiera de las seis comidas. Son propuestas; solo se suman al consumo cuando las registras.</p><p class="tiny subtle">Estimaciones, no etiquetas verificadas. El límite es por comida, no por día. Las porciones no acreditan un objetivo de proteína: faltan esos datos nutricionales.</p></details><div class="cat-chips day-picker">${weekdays.map((d, i) => `<button data-menu-day="${i}" aria-pressed="${i === day}">${dayLabel(i)}</button>`).join("")}</div><h3 class="sub-title">${dayLabel(day)} · ${fmt(totalDay(day))} kcal</h3><p class="tiny subtle">Referencia inicial: 1.800 kcal. El total propuesto varía según los platos y las meriendas elegidas; no se ajusta automáticamente a 1.800. Los cambios de porción actualizan el total; revisa esta referencia según rendimiento y recuperación.</p></article><article><h3>Los 7 días de esta semana</h3><p class="tiny subtle">Toca cualquier comida para cambiarla. El cambio se guarda solo para la semana activa y actualiza el total del día y la lista del súper.</p><button data-food-tab="shopping" class="primary">Generar lista del supermercado</button><p class="tiny subtle">Se suman los ingredientes de los seis tiempos de comida de cada día, según tus selecciones y porciones.</p><div class="scroll"><table><thead><tr><th>Día</th><th>Desayuno</th><th>Almuerzo</th><th>Cena</th><th>Merienda 1</th><th>Merienda 2</th><th>Snack nocturno</th><th>Kcal</th></tr></thead><tbody>${weekdays
      .map(
        (d, i) =>
          `<tr><td>${dayLabel(i)}</td>${kinds
            .map((k) => {
              const cur = planRecipe(i, k);
              return `<td><select class="plan-select" data-plan-day="${i}" data-plan-kind="${k}" aria-label="${escape(k)} · ${escape(dayLabel(i))}">${menus
                .filter((r) => matches(r, k))
                .map(
                  (r) =>
                    `<option value="${r.id}" ${r.id === cur.id ? "selected" : ""}>${escape(r.name)} · ${fmt(calories(items(r)))} kcal</option>`,
                )
                .join("")}</select></td>`;
            })
            .join("")}<td>${fmt(totalDay(i))}</td></tr>`,
      )
      .join("")}</tbody></table></div></article>`;
  }

  function shoppingRows() {
    sync();
    const sums = new Map();
    for (let day = 0; day < 7; day++)
      for (const kind of kinds) {
        const r = planRecipe(day, kind);
        for (const item of items(r)) {
          if (item.qty <= 0) continue;
          const f = fById(item.food);
          if (!f) continue;
          const row = sums.get(f.id) || {
            id: f.id,
            name: f.name,
            unit: f.unit,
            category: f.category,
            qty: 0,
          };
          row.qty += Number(item.qty);
          sums.set(f.id, row);
        }
      }
    return [...sums.values()]
      .map((r) => ({ ...r, qty: Math.round(r.qty * 1000) / 1000 }))
      .sort((a, b) => a.category.localeCompare(b.category, "es") || a.name.localeCompare(b.name, "es"));
  }
  const covered = (row) => {
    const v = prog().shopping?.[week()]?.[row.id];
    return !!v && v.qty === row.qty && v.unit === row.unit && v.name === row.name;
  };
  const quantity = (row) =>
    row.unit === "g" && row.qty >= 1000
      ? `${fmt(row.qty / 1000)} kg (${fmt(row.qty)} g)`
      : row.unit === "ml" && row.qty >= 1000
        ? `${fmt(row.qty / 1000)} L (${fmt(row.qty)} ml)`
        : `${fmt(row.qty)} ${escape(row.unit)}`;
  function renderShopping() {
    const rows = shoppingRows(),
      done = rows.filter(covered).length,
      categories = [...new Set(rows.map((r) => r.category))];
    return `<article><div class="eyebrow">LISTA DEL SÚPER · SEMANA ${week()}</div><div class="card-head"><h2>Todo para tu menú</h2><span class="pill">${done}/${rows.length}</span></div><p>Marca lo que ya tienes o compraste en la cantidad indicada.</p><p class="tiny subtle">Se suman las recetas elegidas en «Semana», incluyendo tus cambios de porción. Si cambia la cantidad de un producto marcado, vuelve a quedar pendiente para que lo revises. Las comidas consumidas no se descuentan de esta lista.</p><button data-food-tab="week">Revisar menú semanal</button></article><article class="food-compact">${categories
      .map((category) => {
        const list = rows.filter((r) => r.category === category);
        return `<details open><summary><span>${escape(category)}</span><small>${list.filter(covered).length}/${list.length}</small></summary>${list.map((r) => `<div class="shop-row${covered(r) ? " is-done" : ""}"><label><input type="checkbox" data-shopping-item="${escape(r.id)}" ${covered(r) ? "checked" : ""}><span><strong>${escape(r.name)}</strong><br>${quantity(r)}${r.id === "gnc" ? " · " + fmt(r.qty / 414) + " envases de 414 ml" : ""}<br></span></label></div>`).join("")}</details>`;
      })
      .join(
        "",
      )}</article><article><h3>Cómo interpretar las cantidades</h3><p class="tiny subtle">Las cantidades del menú son listas para comer. Esta lista suma lo que servirás, no el peso crudo de compra: 1 kg de arroz cocido no significa comprar 1 kg de arroz seco. En el pastor se usa provisionalmente 100 g crudos → 75 g cocinados, conservando las kcal originales; no descuenta grasa descartada. Ajusta la porción base en Alimentos según lo que rinda tu preparación.</p></article>`;
  }
  root.addEventListener("change", (e) => {
    const id = e.target.dataset.shoppingItem;
    if (!id) return;
    const row = shoppingRows().find((r) => r.id === id);
    if (!row) return;
    const p = prog();
    p.shopping ??= {};
    p.shopping[week()] ??= {};
    if (e.target.checked) p.shopping[week()][id] = { qty: row.qty, unit: row.unit, name: row.name };
    else delete p.shopping[week()][id];
    persist();
    rerender();
  });
  function defaultKind() {
    const h = new Date().getHours();
    return h < 11 ? "Desayuno" : h < 15 ? "Almuerzo" : h < 18 ? "Merienda 1" : h < 21 ? "Cena" : "Snack nocturno";
  }
  function renderFoodLog() {
    const p = prog(),
      f = p.loggingFood && fById(p.loggingFood);
    if (!f) return "";
    const kind = kinds.includes(p.loggingKind) ? p.loggingKind : defaultKind(),
      dt = selectedDate();
    return `<article id="foodLogPanel" class="food-log-panel"><div class="card-head"><div><div class="eyebrow">REGISTRAR ALIMENTO</div><h3>${escape(f.name)}</h3></div><button type="button" id="closeFoodLog" aria-label="Cerrar">✕</button></div><p class="tiny subtle">Porción base: ${fmt(f.base)} ${escape(f.unit)} = ${fmt(unitKcal(f))} kcal</p><form id="foodLogForm" class="quick-day"><label>Cantidad (${escape(f.unit)})<input name="qty" type="number" min="0.01" max="100000" step="any" inputmode="decimal" value="${f.base}" required></label><label>Comida<select name="kind">${kinds.map((k) => `<option ${k === kind ? "selected" : ""}>${k}</option>`).join("")}</select></label><button class="primary" type="submit">Registrar</button><p class="fl-total"><strong id="foodLogKcal">${fmt(unitKcal(f))}</strong> kcal · se registra en ${escape(dt || "—")}</p></form></article>`;
  }
  function renderCatalog() {
    const p = prog(),
      cats = [...new Set(foods.map((f) => f.category))],
      cat = cats.includes(p.catalogCat) ? p.catalogCat : "Todas",
      shown = cats.filter((c) => cat === "Todas" || c === cat);
    return (
      renderFoodLog() +
      renderFoodEditor() +
      `<article class="catalog-head"><div class="challenge-heading"><h3>${foods.length} alimentos</h3><button id="newFood" class="primary">+ Agregar</button></div><input id="foodSearch" type="search" placeholder="Buscar: pollo, tortilla, yogurt…" aria-label="Buscar alimento"><div class="cat-chips">${["Todas", ...cats].map((c) => `<button data-cat-filter="${escape(c)}" aria-pressed="${c === cat}">${escape(c)}</button>`).join("")}</div></article><article class="food-compact">${shown
        .map((c) => {
          const list = foods.filter((f) => f.category === c);
          return `<details open data-food-cat><summary><span>${escape(c)}</span><small>${list.length}</small></summary><ul class="food-rows">${list.map((f) => `<li data-food-row="${escape(f.name.toLowerCase())}"><div class="fr-main"><strong>${escape(f.name)}</strong><small>${fmt(f.base)} ${escape(f.unit)}${f.pending ? ' · <span class="food-badge">Por confirmar</span>' : ""}</small></div><label class="fr-kcal"><input data-food-kcal="${f.id}" type="number" min="0" max="5000" step="0.1" value="${unitKcal(f)}" aria-label="Kcal de ${escape(f.name)}"><span>kcal</span></label><button class="fr-log" data-log-food="${f.id}" aria-label="Registrar ${escape(f.name)}" title="Registrar en el día">＋</button><button class="fr-edit" data-edit-food="${f.id}" aria-label="Editar ${escape(f.name)}">✎</button></li>`).join("")}</ul></details>`;
        })
        .join(
          "",
        )}<p id="foodSearchEmpty" class="subtle" hidden>Ningún alimento coincide con la búsqueda.</p></article><article><details><summary>Notas sobre los valores</summary><p class="tiny subtle">Edita las kcal de la porción base al confirmar una etiqueta; las recetas se recalculan y las comidas ya registradas conservan su valor. Huel y soya: confirma cuántos gramos son «1 porción». Carnes: pesa después de cocinar. Res y cerdo: valores confirmados. Pastor: 75 g cocinados es una conversión provisional de los 100 g crudos, sin descontar grasa. El salmón usa una referencia genérica de 206 kcal/100 g. Incluye aceites y salsas.</p></details></article>`
    );
  }
  function renderEditor() {
    const r = menus.find((m) => m.id === prog().editingRecipe);
    if (!r) return "";
    const rows = items(r),
      kcal = calories(rows);
    return `<article id="recipeEditor"><div class="eyebrow">AJUSTAR COMIDA</div><h2>${escape(r.name)}</h2><p>${escape(r.prep)}</p><div class="ingredient-list">${rows
      .map((i, n) => {
        const f = fById(i.food);
        return `<label><span>${escape(f.name)}</span><span><input data-qty="${n}" type="number" min="0" max="5000" step="any" value="${i.qty}" aria-label="Cantidad de ${escape(f.name)}"> ${escape(f.unit)} · <b data-row-kcal="${n}">${fmt((unitKcal(f) * i.qty) / f.base)}</b> kcal</span></label>`;
      })
      .join(
        "",
      )}</div><form id="addRecipeIngredient"><div class="fields"><label>Añadir alimento <select name="food">${foods.map((f) => `<option value="${f.id}">${escape(f.name)} · ${escape(f.unit)}</option>`).join("")}</select></label><label>Cantidad <input name="quantity" type="number" min="0.01" max="5000" step="any" required></label><button>Añadir ingrediente</button></div></form><p class="meal-kcal" id="recipeTotal" aria-live="polite">${fmt(kcal)} kcal · ${kcal <= 500 ? "dentro de 500 kcal" : "supera 500 kcal"}</p><p class="tiny subtle">Las cantidades se guardan automáticamente. Puedes añadir aceite u otros ingredientes arriba; todos cuentan en el total. El total es estimado.</p><button data-log-recipe="${r.id}" class="primary">Registrar en ${escape(selectedDate())}</button> <button data-reset-recipe="${r.id}">Restaurar porciones</button> <button id="closeRecipe">Cerrar</button></article>`;
  }
  function renderQuick() {
    sync();
    const d = daily(),
      dt = selectedDate(),
      locked = !dt || dt > today(),
      p = getProgram(),
      day = Number.isInteger(p.recordDay) ? p.recordDay : 0,
      meals = d.meals || [];
    const rows = kinds
      .map((k) => {
        const r = planRecipe(day, k),
          logged = meals.find((m) => m.slot === k),
          kc = r ? calories(items(r)) : 0;
        const action = logged
          ? `<button data-quick-undo="${escape(logged.id)}" aria-label="Deshacer ${escape(k)}">Deshacer</button>`
          : r
            ? `<button class="primary" data-quick-log="${escape(k)}" ${locked ? "disabled" : ""}>✓ Comí esto</button>`
            : "";
        return `<li class="${logged ? "is-done" : ""}"><div class="qm-main"><small>${escape(k)}${logged ? " · ✓ registrado" : ""}</small><strong>${escape(logged ? logged.name : r ? r.name : "—")}</strong><span>${fmt(logged ? logged.kcal : kc)} kcal</span></div>${action}</li>`;
      })
      .join("");
    const done = meals.filter((m) => m.slot).length;
    return `<article id="sec-quick" class="quick-log"><form id="dailyForm" class="quick-day"><label>Whoop kcal<input name="whoop" type="number" min="0" max="20000" step="1" inputmode="numeric" placeholder="2500" value="${escape(d.whoop)}"></label><label>Pasos<input name="steps" type="number" min="0" max="200000" step="1" inputmode="numeric" placeholder="8000" value="${escape(d.steps)}"></label><button class="primary" type="submit">Guardar</button><label class="check"><input name="closed" type="checkbox" ${d.closed ? "checked" : ""}> Día completo: toda la comida y el Whoop final</label></form></article>`;
  }
  function renderDiary() {
    const d = daily(),
      meals = d.meals || [],
      dates = Object.keys(prog().diary).sort().reverse();
    return `<article><h3>Registrar otra comida</h3><form id="manualMealForm"><div class="fields"><label>Comida<input name="name" required maxlength="120"></label><label>Tipo<select name="kind">${kinds.map((k) => `<option>${k}</option>`).join("")}</select></label><label>Calorías<input name="kcal" type="number" min="0" max="20000" step="0.1" required></label></div><button class="primary">Guardar comida</button></form></article><article><h3>Comidas registradas · ${meals.length}</h3>${meals.length ? meals.map((m) => `<div class="food-log"><div><strong>${escape(m.name)}</strong><br><span class="subtle tiny">${escape(m.kind)} · ${fmt(m.kcal)} kcal</span><details><summary>Porciones guardadas</summary><p class="tiny">${m.items.map((i) => `${fmt(i.qty)} ${escape(i.unit)} ${escape(i.name)}${has(i.kcal) ? " · " + fmt(i.kcal) + " kcal" : ""}`).join("<br>")}</p></details></div><button data-remove-meal="${escape(m.id)}">Eliminar</button></div>`).join("") : '<p class="subtle">Registra las comidas desde Alimentación. El menú propuesto no se cuenta como consumido.</p>'}<button data-go-food="true">Elegir comida</button></article><article><h3>Historial diario</h3>${
      dates.length
        ? `<div class="scroll"><table><thead><tr><th>Fecha</th><th>Consumo</th><th>Whoop</th><th>Pasos</th><th>Balance</th></tr></thead><tbody>${dates
            .map((date) => {
              const v = prog().diary[date],
                delta = balance(v),
                label =
                  delta === null
                    ? "Pendiente"
                    : `${delta >= 0 ? "Déficit" : "Superávit"} ${v.closed ? "final" : "provisional"} ${fmt(Math.abs(delta))}`;
              return `<tr><td><button data-diary-date="${date}">${date}</button></td><td>${fmt(intake(v))}</td><td>${has(v.whoop) ? fmt(v.whoop) : "—"}</td><td>${has(v.steps) ? fmt(v.steps) : "—"}</td><td>${label}</td></tr>`;
            })
            .join("")}</tbody></table></div>`
        : '<p class="subtle">El historial aparecerá al guardar tu primer día.</p>'
    }</article>`;
  }
  function notify(message) {
    let box = document.getElementById("nutritionStatus");
    if (!box) {
      box = document.createElement("p");
      box.id = "nutritionStatus";
      box.setAttribute("role", "status");
      box.className = "nutrition-status";
      root.prepend(box);
    }
    box.textContent = message;
  }

  function renderFoodEditor() {
    const id = prog().editingFood;
    if (!id) return "";
    const f = fById(id) || { name: "", base: 100, unit: "g", kcal: 0, category: "Proteínas" };
    return `<article><h3>${id === "new" ? "Agregar" : "Editar"} alimento</h3><form id="foodEditorForm"><div class="fields"><label>Nombre <input name="name" value="${escape(f.name)}" maxlength="120" required></label><label>Porción base <input name="base" type="number" min="0.01" max="100000" step="any" value="${f.base}" required></label><label>Unidad <input name="unit" maxlength="30" value="${escape(f.unit)}" required></label><label>Kcal de la porción <input name="kcal" type="number" min="0" max="5000" step="any" value="${unitKcal(f) || 0}" required></label><label>Categoría <select name="category">${[...new Set(window.FIT_FOODS.map((f) => f.category))].map((c) => `<option ${c === f.category ? "selected" : ""}>${c}</option>`).join("")}</select></label></div><button class="primary">Guardar alimento</button> <button type="button" id="closeFood">Cancelar</button></form></article>`;
  }
  function renderCreate() {
    const draft = prog().recipeDraft || { items: [] };
    return `<article><h3>Crear una receta</h3><form id="recipeBuilder"><label>Nombre <input name="name" maxlength="120" value="${escape(draft.name || "")}" required></label><label>Tipo <select name="kind">${["Desayuno", "Almuerzo", "Cena", "Merienda"].map((k) => `<option ${draft.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select></label><div class="fields"><label>Ingrediente <select name="ingredient">${foods.map((f) => `<option value="${f.id}">${escape(f.name)} · ${escape(f.unit)}</option>`).join("")}</select></label><label>Cantidad <input name="quantity" type="number" min="0.01" max="5000" step="any"></label><button id="draftAdd" type="button">Añadir ingrediente</button></div><ul>${draft.items.map((i, n) => `<li>${fmt(i.qty)} ${escape(fById(i.food).unit)} ${escape(fById(i.food).name)} <button type="button" data-draft-remove="${n}">Quitar</button></li>`).join("")}</ul><p class="meal-kcal">${fmt(calories(draft.items))} kcal</p><p class="tiny subtle">La receta se guarda en el catálogo de recetas si tiene entre 0 y 500 kcal. Después puedes ajustar cantidades.</p><button class="primary">Guardar receta</button></form></article>`;
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const p = prog();
    if (b.id === "draftAdd" || b.dataset.draftRemove !== undefined) {
      const form = document.getElementById("recipeBuilder"),
        fd = new FormData(form);
      p.recipeDraft ??= { items: [] };
      p.recipeDraft.name = fd.get("name");
      p.recipeDraft.kind = fd.get("kind");
      if (b.id === "draftAdd") {
        const qty = Number(fd.get("quantity"));
        if (!Number.isFinite(qty) || qty <= 0 || qty > 5000) {
          notify("Introduce una cantidad válida.");
          return;
        }
        p.recipeDraft.items.push({ food: fd.get("ingredient"), qty });
      } else p.recipeDraft.items.splice(Number(b.dataset.draftRemove), 1);
      persist();
      rerender();
    }
  });
  root.addEventListener("submit", (e) => {
    const form = e.target;
    if (!["foodEditorForm", "recipeBuilder", "addRecipeIngredient"].includes(form.id)) return;
    e.preventDefault();
    if (!form.checkValidity()) return;
    const fd = new FormData(form),
      p = prog();
    if (form.id === "foodEditorForm") {
      const id = p.editingFood === "new" ? "c" + stamp() : p.editingFood;
      const f = {
        id,
        name: fd.get("name").trim(),
        base: Number(fd.get("base")),
        unit: fd.get("unit").trim(),
        kcal: Number(fd.get("kcal")),
        category: fd.get("category"),
        pending: false,
      };
      if (!f.name || !f.unit) return;
      p.customFoods ??= [];
      p.foodEdits ??= {};
      if (p.editingFood === "new") p.customFoods.push(f);
      else p.foodEdits[id] = f;
      p.foodKcal[id] = f.kcal;
      delete p.editingFood;
    }
    if (form.id === "recipeBuilder") {
      const draft = p.recipeDraft || { items: [] };
      if (!draft.items.length || calories(draft.items) <= 0 || calories(draft.items) > 500) {
        notify("Añade ingredientes y ajusta el total a 500 kcal o menos.");
        return;
      }
      p.customMenus ??= [];
      p.customMenus.push({
        id: "u" + stamp(),
        name: fd.get("name").trim(),
        kind: fd.get("kind"),
        items: draft.items.map((i) => ({ ...i })),
        prep: "Prepara los ingredientes según las cantidades indicadas; incluye las grasas y salsas utilizadas.",
      });
      delete p.recipeDraft;
      p.foodTab = "menus";
      p.menuFilter = "Todos";
    }
    if (form.id === "addRecipeIngredient") {
      const r = menus.find((m) => m.id === p.editingRecipe);
      p.recipeEdits[r.id] = items(r).map((i) => ({ ...i }));
      p.recipeEdits[r.id].push({ food: fd.get("food"), qty: Number(fd.get("quantity")) });
    }
    persist();
    sync();
    rerender();
  });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const p = prog();
    if (b.dataset.catFilter !== undefined) {
      p.catalogCat = b.dataset.catFilter;
      persist();
      rerender();
      return;
    }
    if (b.dataset.logFood) {
      p.loggingFood = b.dataset.logFood;
      persist();
      rerender();
      const panel = document.getElementById("foodLogPanel");
      if (panel) {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
        panel.querySelector("input[name=qty]")?.focus({ preventScroll: true });
      }
      return;
    }
    if (b.id === "closeFoodLog") {
      delete p.loggingFood;
      persist();
      rerender();
      return;
    }
    if (b.hasAttribute("data-quick-food")) {
      p.view = "food";
      p.foodTab = "catalog";
      persist();
      rerender();
      return;
    }
    if (b.dataset.quickLog) {
      const kind = b.dataset.quickLog,
        p2 = getProgram(),
        r = planRecipe(Number.isInteger(p2.recordDay) ? p2.recordDay : 0, kind);
      if (!r || !kinds.includes(kind)) return;
      const rows = items(r),
        d = daily();
      d.meals = d.meals || [];
      if (d.meals.some((m) => m.slot === kind)) return;
      d.meals.push({
        id: stamp(),
        name: r.name,
        kind,
        slot: kind,
        kcal: calories(rows),
        items: rows.map((i) => {
          const f = fById(i.food);
          return { name: f.name, qty: i.qty, unit: f.unit, kcal: (unitKcal(f) * i.qty) / f.base };
        }),
      });
      d.closed = false;
      saveDay(d);
      rerender();
      return;
    }
    if (b.dataset.quickUndo) {
      const d = daily();
      d.meals = (d.meals || []).filter((m) => m.id !== b.dataset.quickUndo);
      d.closed = false;
      saveDay(d);
      rerender();
      return;
    }
    if (b.hasAttribute("data-quick-other")) {
      const f = document.getElementById("manualMealForm");
      if (f) {
        f.scrollIntoView({ behavior: "smooth", block: "center" });
        f.querySelector("input")?.focus({ preventScroll: true });
      }
      return;
    }
    if (b.hasAttribute("data-quick-plan")) {
      p.view = "food";
      p.foodTab = "week";
      persist();
      rerender();
      return;
    }
    if (b.dataset.menuFilter !== undefined) {
      p.menuFilter = b.dataset.menuFilter;
      persist();
      rerender();
      return;
    }
    if (b.id === "newFood") {
      p.editingFood = "new";
      persist();
      rerender();
      return;
    }
    if (b.dataset.editFood) {
      p.editingFood = b.dataset.editFood;
      persist();
      rerender();
      return;
    }
    if (b.id === "closeFood") {
      delete p.editingFood;
      persist();
      rerender();
      return;
    }
    if (b.dataset.foodTab) {
      p.foodTab = b.dataset.foodTab;
      p.editingRecipe = null;
      persist();
      rerender();
    }
    if (b.dataset.menuDay !== undefined) {
      p.menuDay = Number(b.dataset.menuDay);
      persist();
      rerender();
    }
    if (b.dataset.editRecipe) {
      p.editingRecipe = b.dataset.editRecipe;
      persist();
      rerender();
      document.getElementById("recipeEditor").scrollIntoView({ block: "center", behavior: "smooth" });
    }
    if (b.id === "closeRecipe") {
      p.editingRecipe = null;
      persist();
      rerender();
    }
    if (b.dataset.resetRecipe) {
      delete p.recipeEdits[b.dataset.resetRecipe];
      persist();
      rerender();
    }
    if (b.dataset.logRecipe) {
      const r = menus.find((m) => m.id === b.dataset.logRecipe);
      const rows = items(r);
      if (rows.every((i) => i.qty === 0)) {
        notify("Añade una cantidad mayor que cero.");
        return;
      }
      const d = daily();
      d.meals.push({
        id: stamp(),
        name: r.name,
        kind: r.kind,
        kcal: calories(rows),
        items: rows.map((i) => {
          const f = fById(i.food);
          return { name: f.name, qty: i.qty, unit: f.unit, kcal: (unitKcal(f) * i.qty) / f.base };
        }),
      });
      d.closed = false;
      saveDay(d);
      notify("Receta o Alimento registrado");
    }
    if (b.dataset.removeMeal) {
      const d = daily();
      d.meals = d.meals.filter((m) => m.id !== b.dataset.removeMeal);
      d.closed = false;
      saveDay(d);
      rerender();
    }
    if (b.dataset.goFood) {
      p.view = "food";
      p.foodTab = "menus";
      persist();
      rerender();
    }
    if (b.dataset.diaryDate) {
      goDate(b.dataset.diaryDate);
    }
  });
  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "foodSearch") {
      const query = t.value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      root.querySelectorAll("[data-food-row]").forEach(
        (row) =>
          (row.hidden = !row.dataset.foodRow
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .includes(query)),
      );
      let any = false;
      root.querySelectorAll("[data-food-cat]").forEach((d) => {
        const vis = [...d.querySelectorAll("[data-food-row]")].some((r) => !r.hidden);
        d.hidden = !vis;
        if (vis) any = true;
        if (query) d.open = true;
      });
      const empty = document.getElementById("foodSearchEmpty");
      if (empty) empty.hidden = any;
    }
    if (t.dataset.qty !== undefined) {
      if (t.value === "" || !t.checkValidity()) return;
      const r = menus.find((m) => m.id === prog().editingRecipe);
      prog().recipeEdits[r.id] = items(r).map((i) => ({ ...i }));
      prog().recipeEdits[r.id][Number(t.dataset.qty)].qty = Number(t.value);
      persist();
      const rows = items(r);
      const i = rows[Number(t.dataset.qty)],
        f = fById(i.food);
      root.querySelector(`[data-row-kcal="${t.dataset.qty}"]`).textContent = fmt(
        (unitKcal(f) * i.qty) / f.base,
      );
      const total = calories(rows);
      document.getElementById("recipeTotal").textContent =
        `${fmt(total)} kcal · ${total <= 500 ? "dentro de 500 kcal" : "supera 500 kcal"}`;
    }
  });
  root.addEventListener("change", (e) => {
    const t = e.target,
      p = prog();
    if (t.id === "menuFilter") {
      p.menuFilter = t.value;
      persist();
      rerender();
    }
    if (t.dataset.planKind) {
      const day = t.dataset.planDay !== undefined ? Number(t.dataset.planDay) : p.menuDay || 0;
      if (!menus.some((r) => r.id === t.value)) return;
      p.menuPlan[planKey(day, t.dataset.planKind)] = t.value;
      persist();
      rerender();
    }
    if (t.dataset.foodKcal) {
      if (t.value === "" || !t.checkValidity()) {
        t.reportValidity();
        return;
      }
      p.foodKcal[t.dataset.foodKcal] = Number(t.value);
      persist();
      notify("Valor guardado. Las recetas se recalculan con esta referencia.");
    }
    if (t.dataset.qty !== undefined) {
      if (t.value === "" || !t.checkValidity()) {
        t.reportValidity();
        return;
      }
      rerender();
    }
  });
  root.addEventListener("submit", (e) => {
    if (e.target.id !== "dailyForm") return;
    e.preventDefault();
    if (!e.target.checkValidity()) return;
    const fd = new FormData(e.target),
      d = daily();
    for (const k of ["whoop", "steps"]) d[k] = fd.get(k) === "" ? "" : Number(fd.get(k));
    d.closed = fd.has("closed");
    if (d.closed && !has(d.whoop)) {
      notify("Introduce las calorías finales de Whoop para cerrar el día.");
      return;
    }
    saveDay(d);
    rerender();
    notify("Día guardado.");
  });
  root.addEventListener("submit", (e) => {
    if (e.target.id !== "manualMealForm") return;
    e.preventDefault();
    if (!e.target.checkValidity()) return;
    const f = new FormData(e.target),
      name = f.get("name").trim();
    if (!name) return;
    const d = daily();
    d.meals.push({ id: stamp(), name, kind: f.get("kind"), kcal: Number(f.get("kcal")), items: [] });
    d.closed = false;
    saveDay(d);
    rerender();
    notify("Receta o Alimento registrado");
  });
  root.addEventListener("input", (e) => {
    if (e.target.closest("#foodLogForm") && e.target.name === "qty") {
      const f = fById(prog().loggingFood),
        q = Number(e.target.value),
        out = document.getElementById("foodLogKcal");
      if (f && out) out.textContent = Number.isFinite(q) && q > 0 ? fmt((unitKcal(f) * q) / f.base) : "—";
    }
  });
  root.addEventListener("change", (e) => {
    if (e.target.closest("#foodLogForm") && e.target.name === "kind") prog().loggingKind = e.target.value;
  });
  root.addEventListener("submit", (e) => {
    if (e.target.id !== "foodLogForm") return;
    e.preventDefault();
    if (!e.target.checkValidity()) return;
    const p = prog(),
      f = fById(p.loggingFood),
      fd = new FormData(e.target),
      qty = Number(fd.get("qty")),
      kind = fd.get("kind");
    if (!f || !Number.isFinite(qty) || qty <= 0 || !kinds.includes(kind)) return;
    const kcal = (unitKcal(f) * qty) / f.base,
      d = daily();
    d.meals = d.meals || [];
    d.meals.push({ id: stamp(), name: f.name, kind, kcal, items: [{ name: f.name, qty, unit: f.unit, kcal }] });
    d.closed = false;
    p.loggingKind = kind;
    delete p.loggingFood;
    saveDay(d);
    rerender();
    notify(`Registrado: ${fmt(qty)} ${f.unit} de ${f.name} · ${fmt(kcal)} kcal (${kind})`);
  });
  return { renderFood, renderDiary, renderQuick, shoppingRows };
};
