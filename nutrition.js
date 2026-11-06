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
  const MACRO_KEYS = ["protein", "carbs", "fat", "fiber"];
  const MACRO_LABELS = { protein: "Proteína", carbs: "Carbohidratos", fat: "Grasas", fiber: "Fibra" };
  const M = window.FitMacros;
  const macroLine = (f = {}) => MACRO_KEYS.map(k => `${MACRO_LABELS[k]} ${M.known(f[k]) ? fmt(f[k]) + ' g' : 'sin datos'}`).join(' · ') + (f.macroSource === 'etiqueta' ? ' · etiqueta' : f.macroSource === 'usuario' ? ' · ingresado manualmente' : f.macroSource ? ' · aprox.' : '');
  const macroHtml = (f) => `<p class="macro-line">${macroLine(f)}</p>`;
  const recipeMacros = rows => M.sum(rows.filter(i => Number(i.qty) > 0).map(i => M.scaled(fById(i.food), i.qty)));
  const sync = () => {
    const p = getProgram();
    // Catálogo + alimentos propios + ediciones. Los macros (proteína, carbohidratos, grasas, fibra)
    // se guardan por porción base; si una edición cambia la porción sin macros propios, se escalan.
    const builtin = new Map(window.FIT_FOODS.map((f) => [f.id, f])),
      extra = window.FIT_FOOD_MACROS || {};
    const scaled = (f, e) => {
      const out = { ...f, ...e };
      if (e && Number(e.base) > 0 && Number(f.base) > 0 && Number(e.base) !== Number(f.base))
        for (const k of MACRO_KEYS) if (!(k in e) && typeof f[k] === "number") out[k] = Math.round((f[k] * e.base * 10) / f.base) / 10;
      return out;
    };
    foods.splice(
      0,
      foods.length,
      ...[...new Map([...window.FIT_FOODS, ...(p.customFoods || [])].map((f) => [f.id, f])).values()].map((f) =>
        scaled(scaled({ ...extra[f.id], ...builtin.get(f.id) }, f), (p.foodEdits || {})[f.id]),
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
    mealUndo = null;
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
        ? renderLog() + renderDiary()
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
  let mealEdit = null, mealUndo = null, mealUndoAfter = null;
  function renderMealEditor() {
    if (!mealEdit) return '';
    const m = mealEdit.meal;
    return `<article><h3>${mealEdit.copy ? 'Duplicar comida' : 'Editar registro'}</h3><p>${escape(m.name)} · ${fmt(m.kcal)} kcal originales</p><form id="mealEditForm"><div class="fields"><label>Nombre<input name="name" value="${escape(m.name)}" maxlength="120" required></label><label>Fecha<input name="date" type="date" value="${mealEdit.target}" max="${today()}" required></label><label>Comida<select name="kind">${kinds.map(k=>`<option ${k===m.kind?'selected':''}>${k}</option>`).join('')}</select></label><label>Porciones (1 = cantidad registrada)<input name="factor" type="number" min="0.01" max="100" step="any" value="1" required></label></div><p class="tiny subtle">0,5 registra la mitad; 2, el doble. Se ajustan cantidades, kcal y macros con los valores originales, sin reemplazarlos por el catálogo actual.</p><button class="primary">Guardar registro</button> <button type="button" data-cancel-meal>Cancelar</button></form></article>`;
  }
  function renderLog() {
    const d = daily(),
      dt = selectedDate(),
      meals = d.meals || [],
      kcal = intake({ ...d, meals }),
      order = [...kinds, ...new Set(meals.map((m) => m.kind).filter((k) => !kinds.includes(k)))];
    const row = (m) =>
      `<div class="food-log"><div><strong>${escape(m.name)}</strong><br><span class="subtle tiny">${fmt(m.kcal)} kcal</span>${macroHtml(m.macros)}${m.items && m.items.length ? `<details><summary>Porciones</summary><p class="tiny">${m.items.map((i) => `${fmt(i.qty)} ${escape(i.unit)} ${escape(i.name)}${has(i.kcal) ? " · " + fmt(i.kcal) + " kcal" : ""}`).join("<br>")}</p></details>` : ""}</div><div class="btn-row"><button data-edit-meal="${escape(m.id)}">Editar</button><button data-copy-meal="${escape(m.id)}">Duplicar</button><button data-remove-meal="${escape(m.id)}">Eliminar</button></div></div>`;
    const groups = order
      .map((k) => {
        const list = meals.filter((m) => m.kind === k);
        return list.length ? `<h4 class="sub-title">${escape(k)}</h4>${list.map(row).join("")}` : "";
      })
      .join("");
    return `<article><div class="card-head"><div><div class="eyebrow">REGISTRO DEL DÍA</div><h3>${escape(dt || "Selecciona el inicio")}</h3></div><span class="pill">${meals.length} · ${fmt(kcal)} kcal</span></div><p>${kcal <= FitCore.goals().kcal ? "Restan " + fmt(FitCore.goals().kcal - kcal) + " de " + fmt(FitCore.goals().kcal) + " kcal" : "Sobre " + fmt(FitCore.goals().kcal) + " por " + fmt(kcal - FitCore.goals().kcal) + " kcal"}${d.closed ? " · ✓ Día completo" : ""}</p>${M.dailyHtml(d)}${renderMealEditor()}${mealUndo ? '<button data-undo-meal aria-label="Deshacer edición o duplicado">↶</button>' : ""}${groups || '<p class="subtle">Aún no hay comidas registradas este día.</p>'}<div class="btn-row"><button class="primary" data-quick-food>+ Alimento</button><button data-food-tab="menus">+ Receta</button><button data-food-tab="week">Ver plan</button></div></article>`;
  }
  root.addEventListener('click', e => {
    const b=e.target.closest('button'); if(!b)return;
    if(b.hasAttribute('data-cancel-meal')){mealEdit=null;rerender();return;}
    if(b.hasAttribute('data-undo-meal') && mealUndo){
      if(Object.entries(mealUndoAfter||{}).some(([dt,d])=>JSON.stringify(prog().diary[dt]||null)!==d)){mealUndo=null;rerender();notify('Hay cambios posteriores. Edita el registro para conservarlos.');return;}
      for(const [dt,d] of Object.entries(mealUndo)) { if(d===null) delete prog().diary[dt]; else prog().diary[dt]=d; }
      mealUndo=null;mealEdit=null;persist();rerender();notify('Cambio deshecho');return;
    }
    const id=b.dataset.editMeal || b.dataset.copyMeal;
    if(!id)return;
    const m=(daily().meals||[]).find(x=>x.id===id);if(!m)return;
    mealEdit={meal:JSON.parse(JSON.stringify(m)),source:selectedDate(),target:b.dataset.copyMeal?today():selectedDate(),copy:!!b.dataset.copyMeal};
    rerender();document.getElementById('mealEditForm')?.scrollIntoView({behavior:'smooth',block:'center'});
  });
  root.addEventListener('submit',e=>{
    if(e.target.id!=='mealEditForm')return;e.preventDefault();if(!mealEdit||!e.target.checkValidity())return;
    const fd=new FormData(e.target), dt=fd.get('date'),factor=Number(fd.get('factor')),p=prog();
    if(!FitCore.validDate(dt)||dt>today()||!Number.isFinite(factor)||factor<=0)return;
    const original=mealEdit.meal;
    if(original.kcal*factor>20000){notify('La cantidad supera el límite del registro.');return;}
    const scale=v=>Object.fromEntries(M.fields.map(([k])=>[k,M.known(v?.[k])?v[k]*factor:null]));
    const m={...original,name:fd.get('name').trim(),kind:fd.get('kind'),kcal:original.kcal*factor,macros:scale(original.macros),items:(original.items||[]).map(i=>({...i,qty:i.qty*factor,kcal:has(i.kcal)?i.kcal*factor:undefined,macros:scale(i.macros)}))};
    if(!m.name||m.items.some(i=>i.qty>100000))return;
    mealUndo=Object.fromEntries([...new Set([dt,mealEdit.source])].map(d=>[d,p.diary[d]?JSON.parse(JSON.stringify(p.diary[d])):null]));
    if(mealEdit.copy)m.id=stamp();
    else p.diary[mealEdit.source].meals=p.diary[mealEdit.source].meals.filter(x=>x.id!==original.id);
    delete m.slot;
    if(!mealEdit.copy && p.diary[mealEdit.source])p.diary[mealEdit.source].closed=false;
    p.diary[dt] ||= {meals:[],whoop:'',steps:'',extras:'',closed:false};
    p.diary[dt].meals.push(m);p.diary[dt].closed=false;
    mealUndoAfter=Object.fromEntries(Object.keys(mealUndo).map(d=>[d,JSON.stringify(p.diary[d]||null)]));
    mealEdit=null;persist();if(window.FitCalendar.position(p.start,dt))goDate(dt);rerender();notify('Registro guardado. Puedes deshacerlo con ↶.');
  });
  let recipeSearch = "";
  let recipeScope = "all";
  const normalizeSearch = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const recentRecipeIds = () => Object.entries(prog().diary || {}).sort(([a],[b]) => b.localeCompare(a)).flatMap(([,d]) => [...(d.meals || [])].reverse().map(m => m.recipeId || menus.find(r => r.name === m.name)?.id)).filter(Boolean);
  function renderMenus() {
    const selected = prog().menuFilter || "Todos",
      groups = ["Desayuno", "Almuerzo", "Cena", "Merienda"].filter(
        (k) => selected === "Todos" || k === selected,
      );
    const row = (r) => {
      const kcal = calories(items(r));
      const duplicates = menus.filter(m => normalizeSearch(m.name) === normalizeSearch(r.name));
      const variant = duplicates.length > 1 ? ` · Porción ${duplicates.findIndex(m => m.id === r.id) + 1}` : "";
      const portion = items(r).map(i => `${fmt(i.qty)} ${fById(i.food).unit} ${fById(i.food).name}`).join(" · ");
      return `<div class="recipe-row" data-recipe-row="${escape(r.id)}"><div class="rr-main"><strong>${escape(r.name)}${variant}</strong><small><span class="${kcal > 500 ? "over-limit" : "rr-kcal"}">${fmt(kcal)} kcal${kcal > 500 ? " · supera 500" : ""}</span> · ${items(r).length} ingredientes</small>${macroHtml(recipeMacros(items(r)))}<details class="recipe-portions"><summary>Ver porción e ingredientes</summary><p>${escape(portion)}</p></details></div><div class="rr-actions"><button data-recipe-favorite="${r.id}" aria-pressed="${!!prog().recipeFavorites?.includes(r.id)}" aria-label="Favorito: ${escape(r.name)}">${prog().recipeFavorites?.includes(r.id) ? "★" : "☆"}</button><button data-edit-recipe="${r.id}" aria-label="Ajustar ${escape(r.name)}" title="Ajustar porciones">✎</button><button data-log-recipe="${r.id}" class="primary" aria-label="Registrar ${escape(r.name)}">+ Registrar</button></div></div>`;
    };
    return `<article class="catalog-head"><div class="card-head"><h3>${menus.length} recetas</h3><span>Se registran en ${selectedDate() || "—"}</span></div><p class="tiny subtle">Macros estimados según los ingredientes y sus porciones. Los datos pendientes aparecen como «sin datos».</p><label class="recipe-search">Buscar receta<input type="search" id="recipeSearch" value="${escape(recipeSearch)}" placeholder="Nombre o ingrediente"></label><div class="cat-chips">${[["all","Todas"],["favorites","Favoritos"],["recent","Recientes"]].map(([id,label]) => `<button data-recipe-scope="${id}" aria-pressed="${recipeScope === id}">${label}</button>`).join("")}</div><div class="cat-chips">${["Todos", "Desayuno", "Almuerzo", "Cena", "Merienda"].map((k) => `<button data-menu-filter="${k}" aria-pressed="${k === selected}">${k}</button>`).join("")}</div></article><article class="food-compact">${groups
      .map((k) => {
        const list = menus.filter(
          (r) => (r.kind === k || (selected !== "Todos" && matches(r, k) && r.kind !== k)) &&
            (recipeScope !== "favorites" || prog().recipeFavorites?.includes(r.id)) &&
            (recipeScope !== "recent" || recentRecipeIds().slice(0,20).includes(r.id)) &&
            normalizeSearch(r.name + " " + items(r).map(i => fById(i.food).name).join(" ")).includes(normalizeSearch(recipeSearch)),
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
    return `<article><div class="card-head"><h3>Menú · semana ${week()}</h3><span>${fmt(totalDay(day))} kcal propuestas</span></div><details class="intro"><summary>Cómo funciona el plan</summary><p class="tiny subtle">La misma semana se repite durante las ocho semanas: un desayuno fijo, diez opciones intercambiables de almuerzo y cena, yogurt con fruta, batido solo o con fruta y helado de soya con 200 ml de leche por la noche. Reutiliza pollo, arroz y brócoli para preparar varias porciones. Puedes cambiar cualquiera de las seis comidas. Son propuestas; solo se suman al consumo cuando las registras.</p><p class="tiny subtle">Estimaciones, no etiquetas verificadas. El límite es por comida, no por día. Los macros se calculan con los valores del catálogo; revisa las etiquetas y completa los datos que falten.</p></details><div class="cat-chips day-picker">${weekdays.map((d, i) => `<button data-menu-day="${i}" aria-pressed="${i === day}">${dayLabel(i)}</button>`).join("")}</div><h3 class="sub-title">${dayLabel(day)} · ${fmt(totalDay(day))} kcal</h3><p class="tiny subtle">Referencia: ${fmt(FitCore.goals().kcal)} kcal. El total propuesto varía según los platos y las meriendas elegidas; no se ajusta automáticamente a esa referencia. Los cambios de porción actualizan el total; revisa esta referencia según rendimiento y recuperación.</p></article><article><h3>Los 7 días de esta semana</h3><p class="tiny subtle">Toca cualquier comida para cambiarla. El cambio se guarda solo para la semana activa y actualiza el total del día y la lista del súper.</p><button data-food-tab="shopping" class="primary">Generar lista del supermercado</button><p class="tiny subtle">Se suman los ingredientes de los seis tiempos de comida de cada día, según tus selecciones y porciones.</p><div class="scroll"><table><thead><tr><th>Día</th><th>Desayuno</th><th>Almuerzo</th><th>Cena</th><th>Merienda 1</th><th>Merienda 2</th><th>Snack nocturno</th><th>Kcal</th></tr></thead><tbody>${weekdays
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
  const big = (n) => (Math.round(n / 10) / 100).toLocaleString("es-CR", { maximumFractionDigits: 2 });
  const quantity = (row) =>
    row.unit === "g" && row.qty >= 1000
      ? `${big(row.qty)} kg (${fmt(row.qty)} g)`
      : row.unit === "ml" && row.qty >= 1000
        ? `${big(row.qty)} L (${fmt(row.qty)} ml)`
        : `${fmt(row.qty)} ${escape(row.unit)}`;
  // Cocinado → compra: factor aproximado para pasar lo servido a lo que se compra.
  const BUY = {
    arroz: [1 / 2.6, "arroz seco"],
    pasta: [1 / 2.25, "pasta seca"],
    pollo: [1 / 0.75, "pechuga cruda"],
    ribeye: [1 / 0.75, "rib eye crudo"],
    salmon: [1 / 0.8, "salmón crudo"],
    res: [1 / 0.75, "carne molida cruda"],
    cerdo: [1 / 0.75, "carne molida cruda"],
    pastor: [1 / 0.75, "carne cruda"],
    cmvfrfku87diwxvqe30x: [1 / 0.75, "carne molida cruda"],
  };
  const haveOf = (row) => Number(prog().shoppingHave?.[week()]?.[row.id]) || 0;
  const haveMode = (id) => BUY[id] && prog().shoppingHaveMode?.[week()]?.[id] === "raw" ? "raw" : "cooked";
  const haveCooked = (row) => haveMode(row.id) === "raw" ? haveOf(row) / BUY[row.id][0] : haveOf(row);
  const toBuy = (row) => Math.max(0, Math.round((row.qty - haveCooked(row)) * 10) / 10);
  const buyHint = (row) => {
    const b = BUY[row.id],
      n = toBuy(row);
    return b && n > 0 ? ` · ≈ ${fmt(Math.round(n * b[0]))} g de ${b[1]}` : "";
  };
  function renderShopping() {
    const rows = shoppingRows(),
      done = rows.filter(covered).length,
      categories = [...new Set(rows.map((r) => r.category))];
    return `<article><div class="eyebrow">LISTA DEL SÚPER · SEMANA ${week()}</div><div class="card-head"><h2>Todo para tu menú</h2><span class="pill">${done}/${rows.length}</span></div><p>Escribe en «Ya tengo» lo que hay en casa. Para arroz, pasta y carnes, selecciona si lo pesaste cocinado o crudo/seco; las equivalencias son aproximadas. Marca la casilla cuando lo compres.</p><p class="tiny subtle">Se suman las recetas elegidas en «Plan», incluyendo tus cambios de porción. Si cambia la cantidad de un producto marcado, vuelve a quedar pendiente para que lo revises. Las comidas consumidas no se descuentan de esta lista.</p><button data-food-tab="week">Revisar menú semanal</button></article><article class="food-compact">${categories
      .map((category) => {
        const list = rows.filter((r) => r.category === category);
        return `<details open><summary><span>${escape(category)}</span><small>${list.filter(covered).length}/${list.length}</small></summary>${list.map((r) => `<div class="shop-row${covered(r) ? " is-done" : ""}"><label><input type="checkbox" data-shopping-item="${escape(r.id)}" ${covered(r) ? "checked" : ""}><span><strong>${escape(r.name)}</strong><br>Menú: ${quantity(r)}${r.id === "gnc" ? " · " + fmt(r.qty / 414) + " envases de 414 ml" : ""}<br><b class="shop-buy">${toBuy(r) > 0 ? `Por comprar: ${quantity({ ...r, qty: toBuy(r) })}${buyHint(r)}` : "✓ Ya lo tienes"}</b></span></label><label class="shop-have">Ya tengo<input type="number" min="0" step="any" inputmode="decimal" data-shopping-have="${escape(r.id)}" value="${haveOf(r) || ""}" placeholder="0"><small>${haveMode(r.id) === "raw" ? "g crudos/secos" : escape(r.unit)}</small>${BUY[r.id] ? `<select data-have-mode="${r.id}" aria-label="Estado de ${escape(r.name)}"><option value="cooked" ${haveMode(r.id) === "cooked" ? "selected" : ""}>Cocinado</option><option value="raw" ${haveMode(r.id) === "raw" ? "selected" : ""}>Crudo / seco</option></select>` : ""}</label></div>`).join("")}</details>`;
      })
      .join(
        "",
      )}</article><article><h3>Cómo interpretar las cantidades</h3><p class="tiny subtle">Las cantidades del menú son listas para comer. Esta lista suma lo que servirás, no el peso crudo de compra: 1 kg de arroz cocido no significa comprar 1 kg de arroz seco. En el pastor se usa provisionalmente 100 g crudos → 75 g cocinados, conservando las kcal originales; no descuenta grasa descartada. Ajusta la porción base en Alimentos según lo que rinda tu preparación.</p></article>`;
  }
  root.addEventListener("change", (e) => {
    const id = e.target.dataset.haveMode;
    if (!id || !BUY[id]) return;
    const p = prog();
    const oldMode = haveMode(id), mode = e.target.value === "raw" ? "raw" : "cooked";
    p.shoppingHave ??= {}; p.shoppingHave[week()] ??= {};
    const old = Number(p.shoppingHave[week()][id]) || 0;
    // Convert the existing quantity so changing display mode preserves the stock.
    p.shoppingHave[week()][id] = oldMode === mode ? old : Math.round(old * (mode === "raw" ? BUY[id][0] : 1 / BUY[id][0]) * 10) / 10;
    p.shoppingHaveMode ??= {}; p.shoppingHaveMode[week()] ??= {};
    p.shoppingHaveMode[week()][id] = mode;
    persist(); rerender();
  });
  root.addEventListener("input", (e) => {
    if (e.target.id !== "recipeSearch") return;
    recipeSearch = e.target.value;
    const pos = e.target.selectionStart;
    rerender();
    const input = document.getElementById("recipeSearch");
    input?.focus({preventScroll:true}); input?.setSelectionRange(pos,pos);
  });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.recipeScope) { recipeScope = b.dataset.recipeScope; rerender(); }
    if (b.dataset.recipeFavorite) {
      const p = prog(), id = b.dataset.recipeFavorite;
      const ids = new Set(p.recipeFavorites || []);
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      p.recipeFavorites = [...ids]; persist(); rerender();
    }
    if (b.dataset.fitLimit) {
      const r = menus.find(r => r.id === b.dataset.fitLimit); if (!r) return;
      const total = calories(items(r)); if (!(total > 500)) return;
      prog().recipeEdits[r.id] = items(r).map(i => ({...i, qty: Math.floor(i.qty * 500 / total * 100) / 100}));
      persist(); rerender();
      notify("Porción ajustada. Las comidas ya registradas no cambian.");
    }
  });
  root.addEventListener("change", (e) => {
    const hid = e.target.dataset.shoppingHave;
    if (!hid) return;
    const v = e.target.value === "" ? 0 : Number(e.target.value);
    if (!Number.isFinite(v) || v < 0) return;
    const p = prog();
    p.shoppingHave ??= {};
    p.shoppingHave[week()] ??= {};
    if (v > 0) p.shoppingHave[week()][hid] = v;
    else delete p.shoppingHave[week()][hid];
    persist();
    rerender();
  });
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
    return `<article id="foodLogPanel" class="food-log-panel"><div class="card-head"><div><div class="eyebrow">REGISTRAR ALIMENTO</div><h3>${escape(f.name)}</h3></div><button type="button" id="closeFoodLog" aria-label="Cerrar">✕</button></div><p class="tiny subtle">Porción base: ${fmt(f.base)} ${escape(f.unit)} = ${fmt(unitKcal(f))} kcal</p><form id="foodLogForm" class="quick-day"><label>Cantidad (${escape(f.unit)})<input name="qty" type="number" min="0.01" max="100000" step="any" inputmode="decimal" value="${f.base}" required></label><label>Comida<select name="kind">${kinds.map((k) => `<option ${k === kind ? "selected" : ""}>${k}</option>`).join("")}</select></label><button class="primary" type="submit">Registrar</button><p class="fl-total"><strong id="foodLogKcal">${fmt(unitKcal(f))}</strong> kcal · se registra en ${escape(dt || "—")}</p><div id="foodLogMacros">${macroHtml(M.scaled(f, f.base))}</div></form></article>`;
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
          return `<details open data-food-cat><summary><span>${escape(c)}</span><small>${list.length}</small></summary><ul class="food-rows">${list.map((f) => `<li data-food-row="${escape(f.name.toLowerCase())}"><div class="fr-main"><strong>${escape(f.name)}</strong><small>${fmt(f.base)} ${escape(f.unit)}${f.pending ? ' · <span class="food-badge">Por confirmar</span>' : ""}</small><small class="fr-macros">${macroLine(f)}</small><span class="fr-photos" data-food-photos="${escape(f.id)}" hidden></span></div><label class="fr-kcal"><input data-food-kcal="${f.id}" type="number" min="0" max="5000" step="0.1" value="${unitKcal(f)}" aria-label="Kcal de ${escape(f.name)}"><span>kcal</span></label><button class="fr-log" data-log-food="${f.id}" aria-label="Registrar ${escape(f.name)}" title="Registrar en el día">＋</button><button class="fr-edit" data-edit-food="${f.id}" aria-label="Editar ${escape(f.name)}">✎</button></li>`).join("")}</ul></details>`;
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
      )}</div><form id="addRecipeIngredient"><div class="fields"><label>Añadir alimento <select name="food">${foods.map((f) => `<option value="${f.id}">${escape(f.name)} · ${escape(f.unit)}</option>`).join("")}</select></label><label>Cantidad <input name="quantity" type="number" min="0.01" max="5000" step="any" required></label><button>Añadir ingrediente</button></div></form><p class="meal-kcal" id="recipeTotal" aria-live="polite">${fmt(kcal)} kcal · ${kcal <= 500 ? "dentro de 500 kcal" : "supera 500 kcal"}</p><div id="recipeMacros" aria-live="polite">${macroHtml(recipeMacros(rows))}</div>${kcal > 500 ? `<button type="button" data-fit-limit="${r.id}">Ajustar porción a 500 kcal</button>` : ""}<p class="tiny subtle">Las cantidades se guardan automáticamente. Puedes añadir aceite u otros ingredientes arriba; todos cuentan en el total. El total es estimado.</p><button data-log-recipe="${r.id}" class="primary">Registrar en ${escape(selectedDate())}</button> <button data-reset-recipe="${r.id}">Restaurar porciones</button> <button id="closeRecipe">Cerrar</button></article>`;
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
  // Formulario para una comida libre (nombre + calorías); vive en Comida → Registro del día.
  function renderDiary() {
    return `<article><h3>Registrar otra comida</h3><form id="manualMealForm"><div class="fields"><label>Comida<input name="name" required maxlength="120"></label><label>Tipo<select name="kind">${kinds.map((k) => `<option>${k}</option>`).join("")}</select></label><label>Calorías<input name="kcal" type="number" min="0" max="20000" step="0.1" required></label></div><button class="primary">Guardar comida</button></form></article>`;
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
    return `<article><h3>${id === "new" ? "Agregar" : "Editar"} alimento</h3><form id="foodEditorForm"><div class="fields"><label>Nombre <input name="name" value="${escape(f.name)}" maxlength="120" required></label><label>Porción base <input name="base" type="number" min="0.01" max="100000" step="any" value="${f.base}" required></label><label>Unidad <input name="unit" maxlength="30" value="${escape(f.unit)}" required></label><label>Kcal de la porción <input name="kcal" type="number" min="0" max="5000" step="any" value="${unitKcal(f) || 0}" required></label>${MACRO_KEYS.map((k) => `<label>${MACRO_LABELS[k]} (g) <input name="${k}" type="number" min="0" max="1000" step="any" inputmode="decimal" value="${f[k] ?? ""}" placeholder="Sin datos"></label>`).join("")}<label>Categoría <select name="category">${[...new Set(window.FIT_FOODS.map((f) => f.category))].map((c) => `<option ${c === f.category ? "selected" : ""}>${c}</option>`).join("")}</select></label></div><p class="tiny subtle">Valores de la porción base indicada. Deja vacío lo que no conozcas; 0 significa cero confirmado. Las kcal se conservan según la etiqueta.</p><div class="food-photos" data-photo-editor="${escape(id)}"></div><button class="primary">Guardar alimento</button> <button type="button" id="closeFood">Cancelar</button></form></article>`;
  }
  function renderCreate() {
    const draft = prog().recipeDraft || { items: [] };
    return `<article><h3>Crear una receta</h3><form id="recipeBuilder"><label>Nombre <input name="name" maxlength="120" value="${escape(draft.name || "")}" required></label><label>Tipo <select name="kind">${["Desayuno", "Almuerzo", "Cena", "Merienda"].map((k) => `<option ${draft.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select></label><div class="fields"><label>Ingrediente <select name="ingredient">${foods.map((f) => `<option value="${f.id}">${escape(f.name)} · ${escape(f.unit)}</option>`).join("")}</select></label><label>Cantidad <input name="quantity" type="number" min="0.01" max="5000" step="any"></label><button id="draftAdd" type="button">Añadir ingrediente</button></div><ul>${draft.items.map((i, n) => `<li>${fmt(i.qty)} ${escape(fById(i.food).unit)} ${escape(fById(i.food).name)} <button type="button" data-draft-remove="${n}">Quitar</button></li>`).join("")}</ul><p class="meal-kcal">${fmt(calories(draft.items))} kcal</p>${macroHtml(recipeMacros(draft.items))}<p class="tiny subtle">La receta se guarda en el catálogo de recetas si tiene entre 0 y 500 kcal. Después puedes ajustar cantidades.</p><button class="primary">Guardar receta</button></form></article>`;
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
      // Macros por porción base; null conserva explícitamente los valores desconocidos.
      for (const k of MACRO_KEYS) {
        const v = fd.get(k);
        f[k] = v !== null && v !== "" ? Number(v) : null;
      }
      if (MACRO_KEYS.some((k) => k in f)) f.macroSource = "usuario";
      if (!f.name || !f.unit) return;
      p.customFoods ??= [];
      p.foodEdits ??= {};
      if (p.editingFood === "new") p.customFoods.push(f);
      else p.foodEdits[id] = f;
      p.foodKcal[id] = f.kcal;
      window.FitPhotos?.commit(p.editingFood, id);
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
        macros: recipeMacros(rows),
        items: rows.map((i) => {
          const f = fById(i.food);
          return { foodId: f.id, name: f.name, qty: i.qty, unit: f.unit, kcal: (unitKcal(f) * i.qty) / f.base, macros: M.scaled(f, i.qty) };
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
        recipeId: r.id,
        kind: r.kind,
        kcal: calories(rows),
        macros: recipeMacros(rows),
        items: rows.map((i) => {
          const f = fById(i.food);
          return { foodId: f.id, name: f.name, qty: i.qty, unit: f.unit, kcal: (unitKcal(f) * i.qty) / f.base, macros: M.scaled(f, i.qty) };
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
      document.getElementById("recipeMacros").innerHTML = macroHtml(recipeMacros(rows));
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
    // Un día sin comidas no es «0 kcal confirmadas»: queda abierto hasta registrar lo que comiste.
    if (d.closed && !(d.meals || []).length && !(Number(d.extras) > 0)) {
      d.closed = false;
      saveDay(d);
      rerender();
      notify("Guardado, pero el día sigue abierto: no tiene comidas registradas.");
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
      if (f) document.getElementById("foodLogMacros").innerHTML = macroHtml(M.scaled(f, q));
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
    d.meals.push({ id: stamp(), name: f.name, kind, kcal, macros: M.scaled(f, qty), items: [{ foodId: f.id, name: f.name, qty, unit: f.unit, kcal, macros: M.scaled(f, qty) }] });
    d.closed = false;
    p.loggingKind = kind;
    delete p.loggingFood;
    saveDay(d);
    rerender();
    notify(`Registrado: ${fmt(qty)} ${f.unit} de ${f.name} · ${fmt(kcal)} kcal (${kind})`);
  });
  return { renderFood, renderDiary, renderQuick, shoppingRows };
};
