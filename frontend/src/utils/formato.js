const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const num = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 });

/** Prisma devuelve los Decimal como string: siempre pasamos por Number(). */
export const dinero = (v) => mxn.format(Number(v) || 0);
export const cantidad = (v) => num.format(Number(v) || 0);
export const fechaHora = (v) =>
  new Date(v).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Mensaje legible a partir del error normalizado por api/client.js */
export const textoError = (err) => {
  const detalle = err?.errores?.[0]?.mensaje;
  return [err?.mensaje || 'Ocurrió un error', detalle].filter(Boolean).join(': ');
};

export const ROLES = {
  ADMIN: { texto: 'Administrador', clase: 'badge-err' },
  MESERO: { texto: 'Mesero', clase: 'badge-info' },
  COCINERO: { texto: 'Cocinero', clase: 'badge-warn' },
  CAJERO: { texto: 'Cajero', clase: 'badge-ok' },
};
