// Nutrientes por porción base. null significa desconocido; 0 es un dato explícito.
(function (g) {
  const fields = [['protein','Proteína'],['carbs','Carbohidratos'],['fat','Grasas'],['fiber','Fibra']];
  const known = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const scaled = (food, quantity) => {
    const ratio = Number(quantity) / Number(food.base);
    return Object.fromEntries(fields.map(([key]) => [key, ratio === 0 ? 0 : known(food[key]) && Number.isFinite(ratio) && ratio >= 0 ? food[key] * ratio : null]));
  };
  const sum = values => Object.fromEntries(fields.map(([key]) => [key,
    values.every(v => known(v?.[key])) ? values.reduce((total,v) => total + v[key], 0) : null
  ]));
  const validate = (value) => value == null || (typeof value === 'object' && !Array.isArray(value) && fields.every(([key]) => value[key] == null || known(value[key])));
  const dailyHtml = (day = {}) => {
    const meals = day.meals || [];
    const fmt = n => Number(n).toLocaleString('es-CR', {maximumFractionDigits:1});
    const extras = Number(day.extras) > 0;
    return `<section class="daily-macros" aria-label="Nutrientes del día"><h3>Nutrientes del día</h3><div class="macro-grid"><div><small>Energía</small><strong>${fmt(meals.reduce((n,m)=>n+Number(m.kcal||0),0)+Number(day.extras||0))} kcal</strong></div>${fields.map(([key,label])=>{
      const complete = meals.every(m=>known(m.macros?.[key])) && !extras;
      const total = meals.reduce((n,m)=>n+(known(m.macros?.[key])?m.macros[key]:0),0);
      return `<div><small>${label}</small><strong>${fmt(total)} g</strong><small>${complete ? 'Registrado' : 'Parcial · faltan datos'}</small></div>`;
    }).join('')}</div><p class="tiny subtle">${meals.length ? 'Solo incluye lo registrado.' : 'Todavía no hay comidas registradas.'} Los valores parciales suman únicamente nutrientes conocidos.</p></section>`;
  };
  g.FitMacros = { fields, known, scaled, sum, validate, dailyHtml };
})(window);
