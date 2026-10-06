/** Formato uniforme de respuestas exitosas: { ok, mensaje?, data, meta? } */
const ok = (res, data, mensaje, meta) =>
  res.status(200).json({ ok: true, ...(mensaje && { mensaje }), data, ...(meta && { meta }) });

const creado = (res, data, mensaje = 'Creado correctamente') =>
  res.status(201).json({ ok: true, mensaje, data });

/** Calcula skip/take a partir de ?page & ?limit ya validados. */
const paginacion = ({ page = 1, limit = 20 } = {}) => ({ skip: (page - 1) * limit, take: limit });

const metaPaginacion = (total, { page = 1, limit = 20 } = {}) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit) || 1,
});

module.exports = { ok, creado, paginacion, metaPaginacion };
