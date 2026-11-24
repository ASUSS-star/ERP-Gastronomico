/**
 * IMPRESIÓN DIRECTA POR USB (WebUSB, sólo Chrome / Edge en computadora, sitio con https o localhost).
 *
 * El navegador le habla a la impresora sin pasar por las impresoras de Windows.
 * En Windows la impresora debe tener el controlador WinUSB (se instala una vez con Zadig).
 * El permiso se pide una sola vez por equipo; después la impresora se reconecta sola.
 */
const CLASE_IMPRESORA = 0x07;

export const soportaUsb = () => typeof navigator !== 'undefined' && 'usb' in navigator;

const nombre = (d) => [d.manufacturerName, d.productName].filter(Boolean).join(' ') || `USB ${d.vendorId.toString(16)}:${d.productId.toString(16)}`;

/** Muestra el selector del navegador para elegir la impresora (debe llamarse desde un clic). */
export async function conectarImpresora() {
  if (!soportaUsb()) throw new Error('Este navegador no permite impresión USB directa. Usa Chrome o Edge en computadora.');
  const d = await navigator.usb.requestDevice({ filters: [] });
  await abrir(d);
  return nombre(d);
}

/** Impresora autorizada antes en este equipo (o null). */
export async function impresoraGuardada() {
  if (!soportaUsb()) return null;
  const lista = await navigator.usb.getDevices();
  return lista.find((d) => buscarSalida(d)) || lista[0] || null;
}
export const nombreImpresora = async () => {
  const d = await impresoraGuardada();
  return d ? nombre(d) : null;
};

export async function olvidarImpresora() {
  const d = await impresoraGuardada();
  if (d?.forget) await d.forget();
}

/** Interfaz y endpoint de salida: primero la de clase impresora, si no, cualquiera con salida bulk. */
function buscarSalida(d) {
  const config = d.configuration || d.configurations?.[0];
  if (!config) return null;
  const candidatas = [...config.interfaces].sort((a, b) =>
    (b.alternates[0]?.interfaceClass === CLASE_IMPRESORA) - (a.alternates[0]?.interfaceClass === CLASE_IMPRESORA));
  for (const itf of candidatas) {
    for (const alt of itf.alternates) {
      const ep = alt.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk');
      if (ep) return { interfaz: itf.interfaceNumber, alterna: alt.alternateSetting, endpoint: ep.endpointNumber, config: config.configurationValue };
    }
  }
  return null;
}

async function abrir(d) {
  if (!d.opened) await d.open();
  if (!d.configuration) await d.selectConfiguration(d.configurations[0].configurationValue);
  const s = buscarSalida(d);
  if (!s) throw new Error('No se encontró la salida de datos de la impresora');
  const itf = d.configuration.interfaces.find((i) => i.interfaceNumber === s.interfaz);
  if (!itf.claimed) await d.claimInterface(s.interfaz);
  if (s.alterna) await d.selectAlternateInterface(s.interfaz, s.alterna);
  return s;
}

/** Envía los bytes ESC/POS a la impresora. */
export async function enviarUsb(bytes) {
  const d = await impresoraGuardada();
  if (!d) throw new Error('No hay impresora USB conectada. Ve a Caja → Impresora → Conectar impresora USB.');
  let s;
  try {
    s = await abrir(d);
  } catch (e) {
    if (/access denied|security|claim/i.test(e.message)) {
      throw new Error('Windows no deja usar la impresora: instálale el controlador WinUSB con Zadig (ver la guía) y vuelve a conectarla.');
    }
    throw new Error(`No se pudo abrir la impresora USB: ${e.message}`);
  }
  for (let i = 0; i < bytes.length; i += 4096) {
    // eslint-disable-next-line no-await-in-loop
    const r = await d.transferOut(s.endpoint, bytes.slice(i, i + 4096));
    if (r.status !== 'ok') throw new Error(`La impresora respondió "${r.status}"`);
  }
}
