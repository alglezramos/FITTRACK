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
  g.FitMacros = { fields, known, scaled, sum, validate };
})(window);
