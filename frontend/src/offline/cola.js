/**
 * MODO SIN INTERNET
 *
 * - Las lecturas (GET) exitosas se guardan en este navegador; si después falla la red,
 *   api/client.js devuelve la última copia guardada.
 * - Los cambios que importan en servicio (crear comanda, cambiar estado, cobrar) pasan por
 *   `mutar()`: si no hay conexión se guardan en una cola y se envían solos al volver el internet.
 * - Cada comanda y cada cobro llevan un `clienteId` generado aquí: si un envío se repite,
 *   el backend lo reconoce y no lo duplica.
 *
 * Límite honesto: mientras no haya internet, los OTROS dispositivos no ven estos cambios
 * (el servidor está en la nube). Se sincronizan en cuanto vuelve la conexión.
 */
import api from '../api/client';

const CLAVE = 'erp:cola';
const CLAVE_FALLIDAS = 'erp:cola-fallidas';
const oyentes = new Set();
let sincronizando = false;

const leer = (clave) => {
  try { return JSON.parse(localStorage.getItem(clave) || '[]'); } catch { return []; }
};
const guardar = (clave, valor) => {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* almacenamiento lleno o bloqueado */ }
};

export const estadoCola = () => ({ pendientes: leer(CLAVE), fallidas: leer(CLAVE_FALLIDAS), sincronizando });
const avisar = (evento) => oyentes.forEach((fn) => fn(evento, estadoCola()));

/** fn(evento, estado) con evento: 'cambio' | 'sincronizado'. Devuelve la función para desuscribirse. */
export const suscribirCola = (fn) => {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
};

export const nuevoId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`)
    .replace(/[^A-Za-z0-9_-]/g, '');

/** El cliente HTTP normaliza los errores; sin `status` significa que no hubo respuesta (red caída o timeout). */
export const esErrorDeRed = (err) => !err?.status;

const encolar = (operacion) => {
  guardar(CLAVE, [...leer(CLAVE), { ...operacion, id: nuevoId(), creada: new Date().toISOString() }]);
  avisar('cambio');
};

/**
 * Envía un cambio; si no hay red lo encola y responde { pendiente: true }.
 * Si ya hay cambios en cola, éste también se encola para respetar el orden.
 */
export async function mutar({ metodo, url, data, descripcion }) {
  const operacion = { metodo, url, data, descripcion };
  if (leer(CLAVE).length) {
    encolar(operacion);
    sincronizar();
    return { ok: true, pendiente: true, data: null };
  }
  try {
    return await api.request({ method: metodo, url, data });
  } catch (err) {
    if (!esErrorDeRed(err)) throw err;
    encolar(operacion);
    return { ok: true, pendiente: true, data: null };
  }
}

/** Envía la cola en orden. Se detiene al primer error de red; los rechazos del servidor van a "fallidas". */
export async function sincronizar() {
  if (sincronizando || !leer(CLAVE).length) return;
  sincronizando = true;
  avisar('cambio');
  let enviados = 0;
  try {
    for (;;) {
      const [siguiente] = leer(CLAVE);
      if (!siguiente) break;
      try {
        // eslint-disable-next-line no-await-in-loop
        await api.request({ method: siguiente.metodo, url: siguiente.url, data: siguiente.data });
        enviados += 1;
      } catch (err) {
        if (esErrorDeRed(err)) break;
        guardar(CLAVE_FALLIDAS, [...leer(CLAVE_FALLIDAS), { ...siguiente, error: err.mensaje }]);
      }
      guardar(CLAVE, leer(CLAVE).filter((op) => op.id !== siguiente.id));
      avisar('cambio');
    }
  } finally {
    sincronizando = false;
    avisar(enviados ? 'sincronizado' : 'cambio');
  }
}

export const descartarFallidas = () => {
  guardar(CLAVE_FALLIDAS, []);
  avisar('cambio');
};

// Reintentos automáticos: al volver la conexión y cada 20 s mientras haya pendientes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => sincronizar());
  setInterval(() => { if (navigator.onLine) sincronizar(); }, 20000);
  setTimeout(() => sincronizar(), 1500);
}
