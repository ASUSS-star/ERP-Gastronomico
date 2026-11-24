/**
 * IMPRESIÓN DE TICKETS en impresora térmica (EC Line EC-5890X: 58 mm, USB, ESC/POS).
 *
 * Se imprime con el diálogo del navegador sobre la impresora instalada en Windows:
 * no necesita programas extra y funciona igual en Chrome y Edge.
 *  - Papel de 58 mm → área imprimible de 48 mm (384 puntos). Para 80 mm: 72 mm.
 *  - Para imprimir SIN diálogo, abre Chrome/Edge con  --kiosk-printing  (ver la guía).
 *  - Funciona sin internet: la impresora está conectada a esta computadora.
 */
import { dinero } from '../utils/formato';
import { Ticket } from './escpos';
import { enviarUsb } from './usb';

const CLAVE = 'erp:impresora';
const CLAVE_ULTIMO = 'erp:ultimo-ticket';
const METODOS = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };

// modo: 'navegador' (diálogo de impresión, impresora de Windows) | 'usb' (directo a la impresora con WebUSB)
export const AJUSTES_BASE = {
  modo: 'navegador', auto: true, papel: 58, copias: 1, pie: '¡Gracias por su visita!', fiscal: true,
  cortar: false, cajon: false, acentos: true,
};

export const leerAjustes = () => {
  try { return { ...AJUSTES_BASE, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; } catch { return { ...AJUSTES_BASE }; }
};
export const guardarAjustes = (a) => localStorage.setItem(CLAVE, JSON.stringify(a));

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fila = (izq, der, clase = '') => `<tr class="${clase}"><td>${izq}</td><td class="r">${der}</td></tr>`;
const fecha = (d) => new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * datos: { restaurante, comanda, cajero?, tipo: 'cuenta' | 'pago' }
 * 'cuenta' = pre-cuenta para llevar a la mesa (sin pagos). 'pago' = ticket después de cobrar.
 */
export function htmlTicket({ restaurante = {}, comanda, cajero, tipo = 'pago' }, ajustes = leerAjustes()) {
  const papel = Number(ajustes.papel) === 80 ? 80 : 58;
  const ancho = papel === 80 ? 72 : 48;
  const pagos = tipo === 'pago' ? comanda.pagos ?? [] : [];
  const pagado = pagos.reduce((s, p) => s + Number(p.monto), 0);
  const saldo = Math.max(0, Number(comanda.total) - pagado);

  const cuerpo = `
    <div class="c g b">${esc(restaurante.nombre)}</div>
    ${restaurante.direccion ? `<div class="c">${esc(restaurante.direccion)}</div>` : ''}
    ${restaurante.telefono ? `<div class="c">Tel. ${esc(restaurante.telefono)}</div>` : ''}
    <hr>
    <div class="c b">${tipo === 'cuenta' ? 'CUENTA' : 'TICKET DE VENTA'}</div>
    <table>
      ${fila(`Folio #${esc(comanda.folio ?? '—')}`, `Mesa ${esc(comanda.mesa?.numero ?? '—')}`)}
      ${fila(fecha(comanda.pagadoAt || Date.now()), '')}
      ${comanda.mesero?.nombre ? fila(`Atendió: ${esc(comanda.mesero.nombre)}`, '') : ''}
      ${cajero && tipo === 'pago' ? fila(`Cobró: ${esc(cajero)}`, '') : ''}
    </table>
    <hr>
    <table>
      ${(comanda.detalles ?? []).map((d) => fila(`${d.cantidad} ${esc(d.platillo?.nombre)}`, dinero(d.subtotal))).join('')}
    </table>
    <hr>
    <table>${fila('TOTAL', dinero(comanda.total), 'b g')}</table>
    ${pagos.length ? `<table>
      ${pagos.map((p) => fila(METODOS[p.metodo] ?? p.metodo, dinero(p.monto))
        + (p.recibido != null ? fila('&nbsp;&nbsp;Recibido', dinero(p.recibido)) + fila('&nbsp;&nbsp;Cambio', dinero(p.cambio)) : '')).join('')}
      ${saldo > 0.004 ? fila('SALDO PENDIENTE', dinero(saldo), 'b') : fila('PAGADO', '', 'b')}
    </table>` : ''}
    <hr>
    ${ajustes.pie ? `<div class="c">${esc(ajustes.pie)}</div>` : ''}
    ${ajustes.fiscal ? '<div class="c p">Este ticket no es un comprobante fiscal</div>' : ''}
  `;

  const copias = Math.min(3, Math.max(1, Number(ajustes.copias) || 1));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ticket ${esc(comanda.folio ?? '')}</title>
<style>
  @page { size: ${papel}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: ${ancho}mm; margin: 0 auto; color: #000; font: 12px/1.35 "Courier New", Courier, monospace; }
  .copia { padding: 2mm 0 8mm; }
  .copia + .copia { break-before: page; page-break-before: always; }
  .c { text-align: center; } .b { font-weight: 700; } .g { font-size: 14px; } .p { font-size: 10px; margin-top: 2px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; word-break: break-word; }
  td.r { text-align: right; white-space: nowrap; padding-left: 6px; }
</style></head><body>${Array.from({ length: copias }, () => `<div class="copia">${cuerpo}</div>`).join('')}</body></html>`;
}

const fechaCorta = (d) => new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Mismo ticket que htmlTicket, en comandos ESC/POS para la impresión USB directa. */
export function escposTicket({ restaurante = {}, comanda, cajero, tipo = 'pago' }, ajustes = leerAjustes()) {
  const t = new Ticket(ajustes);
  const pagos = tipo === 'pago' ? comanda.pagos ?? [] : [];
  const pagado = pagos.reduce((x, p) => x + Number(p.monto), 0);
  const saldo = Math.max(0, Number(comanda.total) - pagado);
  const copias = Math.min(3, Math.max(1, Number(ajustes.copias) || 1));

  for (let n = 0; n < copias; n += 1) {
    t.centro().negrita().grande().parrafo(restaurante.nombre, Math.floor(t.ancho / 2)).grande(false).negrita(false);
    if (restaurante.direccion) t.parrafo(restaurante.direccion);
    if (restaurante.telefono) t.linea(`Tel. ${restaurante.telefono}`);
    t.separador().negrita().linea(tipo === 'cuenta' ? 'CUENTA' : 'TICKET DE VENTA').negrita(false).centro(false);
    t.fila(`Folio #${comanda.folio ?? '-'}`, `Mesa ${comanda.mesa?.numero ?? '-'}`);
    t.linea(fechaCorta(comanda.pagadoAt || Date.now()));
    if (comanda.mesero?.nombre) t.linea(`Atendio: ${comanda.mesero.nombre}`);
    if (cajero && tipo === 'pago') t.linea(`Cobro: ${cajero}`);
    t.separador();
    (comanda.detalles ?? []).forEach((d) => t.fila(`${d.cantidad} ${d.platillo?.nombre ?? ''}`, dinero(d.subtotal)));
    t.separador().negrita().fila('TOTAL', dinero(comanda.total)).negrita(false);
    pagos.forEach((p) => {
      t.fila(METODOS[p.metodo] ?? p.metodo, dinero(p.monto));
      if (p.recibido != null) t.fila('  Recibido', dinero(p.recibido)).fila('  Cambio', dinero(p.cambio));
    });
    if (pagos.length) t.negrita().fila(saldo > 0.004 ? 'SALDO PENDIENTE' : 'PAGADO', saldo > 0.004 ? dinero(saldo) : '').negrita(false);
    t.separador().centro();
    if (ajustes.pie) t.parrafo(ajustes.pie);
    if (ajustes.fiscal) t.linea('No es comprobante fiscal');
    t.centro(false);
    // El cajón sólo se abre al cobrar, una vez
    t.fin({ cortar: ajustes.cortar, cajon: n === 0 && tipo === 'pago' && ajustes.cajon });
  }
  return t.toUint8Array();
}

/**
 * Imprime un ticket (o pre-cuenta). Devuelve una promesa: en modo USB puede fallar
 * (impresora desconectada) y quien llama muestra el error.
 */
export async function imprimirTicket(datos, ajustes = leerAjustes()) {
  if (datos.tipo !== 'cuenta') {
    try { localStorage.setItem(CLAVE_ULTIMO, JSON.stringify(datos)); } catch { /* sin espacio */ }
  }
  if (ajustes.modo === 'usb') return enviarUsb(escposTicket(datos, ajustes));
  return imprimirHtml(htmlTicket(datos, ajustes));
}

/** Manda cualquier documento HTML a la impresora (iframe oculto + diálogo del navegador). */
export function imprimirHtml(html) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print(); // en Chrome/Edge bloquea hasta cerrar el diálogo
    setTimeout(() => iframe.remove(), 1000);
  }, 200);
}

export const ultimoTicket = () => {
  try { return JSON.parse(localStorage.getItem(CLAVE_ULTIMO)); } catch { return null; }
};

/**
 * CORTE DE CAJA en papel de 58/80 mm.
 * corte: respuesta de GET /reportes/corte. arqueo: { fondo, contado } capturados en pantalla (opcionales).
 */
export function htmlCorte({ restaurante = {}, corte, cajero, arqueo = {}, conComandas = true }, ajustes = leerAjustes()) {
  const papel = Number(ajustes.papel) === 80 ? 80 : 58;
  const ancho = papel === 80 ? 72 : 48;
  const mismoDia = new Date(corte.rango.desde).toDateString() === new Date(corte.rango.hasta).toDateString();
  const dia = (d) => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = (d) => new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const fondo = Number(arqueo.fondo) || 0;
  const contado = arqueo.contado === '' || arqueo.contado == null ? null : Number(arqueo.contado);
  const esperado = fondo + corte.efectivoEsperado;

  const cuerpo = `
    <div class="c g b">${esc(restaurante.nombre)}</div>
    <div class="c b">CORTE DE CAJA</div>
    <div class="c">${mismoDia ? dia(corte.rango.desde) : `${dia(corte.rango.desde)} al ${dia(corte.rango.hasta)}`}</div>
    <div class="c">De ${hora(corte.rango.desde)} a ${hora(corte.rango.hasta)}</div>
    ${cajero ? `<div class="c">Realizó: ${esc(cajero)}</div>` : ''}
    <hr>
    <div class="b">RESUMEN DE VENTAS</div>
    <table>
      ${fila('Cuentas cobradas', corte.ventas.comandas)}
      ${fila('Platillos vendidos', corte.ventas.articulos)}
      ${fila('Ticket promedio', dinero(corte.ventas.ticketPromedio))}
      ${fila('VENTA TOTAL', dinero(corte.ventas.total), 'b g')}
    </table>
    <hr>
    <div class="b">DINERO RECIBIDO</div>
    <table>
      ${corte.porMetodo.length ? corte.porMetodo.map((m) => fila(`${METODOS[m.metodo] ?? m.metodo} (${m.pagos})`, dinero(m.total))).join('') : fila('Sin cobros', dinero(0))}
      ${fila('TOTAL RECIBIDO', dinero(corte.recibido), 'b')}
      ${corte.abonosCuentasAbiertas > 0 ? fila('&nbsp;&nbsp;Incluye abonos de cuentas abiertas', dinero(corte.abonosCuentasAbiertas)) : ''}
    </table>
    <hr>
    <div class="b">ARQUEO DE EFECTIVO</div>
    <table>
      ${fila('Fondo inicial', dinero(fondo))}
      ${fila('Ventas en efectivo', dinero(corte.efectivoEsperado))}
      ${fila('Debe haber en caja', dinero(esperado), 'b')}
      ${contado != null ? fila('Efectivo contado', dinero(contado)) + fila(contado - esperado >= 0 ? 'SOBRANTE' : 'FALTANTE', dinero(Math.abs(contado - esperado)), 'b') : ''}
    </table>
    <hr>
    <div class="b">PLATILLOS VENDIDOS</div>
    <table>
      ${corte.platillos.length ? corte.platillos.map((p) => fila(`${p.cantidad} ${esc(p.nombre)}`, dinero(p.importe))).join('') : fila('Sin ventas', '')}
      ${fila('TOTAL', dinero(corte.ventas.total), 'b')}
    </table>
    ${conComandas && corte.comandas.length ? `<hr>
    <div class="b">CUENTAS COBRADAS</div>
    <table>
      ${corte.comandas.map((c) => fila(`#${esc(c.folio)} M${esc(c.mesa ?? '-')} ${hora(c.pagadoAt)}`, dinero(c.total))).join('')}
    </table>` : ''}
    ${corte.canceladas.cantidad || corte.abiertas.cantidad ? `<hr><table>
      ${corte.canceladas.cantidad ? fila(`Canceladas (${corte.canceladas.cantidad})`, dinero(corte.canceladas.total)) : ''}
      ${corte.abiertas.cantidad ? fila(`Cuentas aún abiertas (${corte.abiertas.cantidad})`, dinero(corte.abiertas.total)) : ''}
    </table>` : ''}
    <hr>
    <div class="c">Impreso ${dia(corte.generado)} ${hora(corte.generado)}</div>
    <div class="c" style="margin-top:14mm">______________________</div>
    <div class="c">Firma</div>
  `;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Corte de caja</title>
<style>
  @page { size: ${papel}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: ${ancho}mm; margin: 0 auto; padding: 2mm 0 8mm; color: #000; font: 12px/1.35 "Courier New", Courier, monospace; }
  .c { text-align: center; } .b { font-weight: 700; } .g { font-size: 14px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; word-break: break-word; }
  td.r { text-align: right; white-space: nowrap; padding-left: 6px; }
</style></head><body>${cuerpo}</body></html>`;
}

/** Corte de caja en ESC/POS (misma información que htmlCorte). */
export function escposCorte({ restaurante = {}, corte, cajero, arqueo = {}, conComandas = true }, ajustes = leerAjustes()) {
  const t = new Ticket(ajustes);
  const dia = (d) => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = (d) => new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const fondo = Number(arqueo.fondo) || 0;
  const contado = arqueo.contado === '' || arqueo.contado == null ? null : Number(arqueo.contado);
  const esperado = fondo + corte.efectivoEsperado;
  const mismoDia = dia(corte.rango.desde) === dia(corte.rango.hasta);

  t.centro().negrita().grande().parrafo(restaurante.nombre, Math.floor(t.ancho / 2)).grande(false)
    .linea('CORTE DE CAJA').negrita(false)
    .linea(mismoDia ? dia(corte.rango.desde) : `${dia(corte.rango.desde)} al ${dia(corte.rango.hasta)}`)
    .linea(`De ${hora(corte.rango.desde)} a ${hora(corte.rango.hasta)}`);
  if (cajero) t.linea(`Realizo: ${cajero}`);
  t.centro(false).separador();

  t.negrita().linea('RESUMEN DE VENTAS').negrita(false)
    .fila('Cuentas cobradas', corte.ventas.comandas)
    .fila('Platillos vendidos', corte.ventas.articulos)
    .fila('Ticket promedio', dinero(corte.ventas.ticketPromedio))
    .negrita().fila('VENTA TOTAL', dinero(corte.ventas.total)).negrita(false).separador();

  t.negrita().linea('DINERO RECIBIDO').negrita(false);
  if (corte.porMetodo.length) corte.porMetodo.forEach((m) => t.fila(`${METODOS[m.metodo] ?? m.metodo} (${m.pagos})`, dinero(m.total)));
  else t.fila('Sin cobros', dinero(0));
  t.negrita().fila('TOTAL RECIBIDO', dinero(corte.recibido)).negrita(false);
  if (corte.abonosCuentasAbiertas > 0) t.fila('  Incluye abonos de cuentas abiertas', dinero(corte.abonosCuentasAbiertas));
  t.separador();

  t.negrita().linea('ARQUEO DE EFECTIVO').negrita(false)
    .fila('Fondo inicial', dinero(fondo))
    .fila('Ventas en efectivo', dinero(corte.efectivoEsperado))
    .negrita().fila('Debe haber en caja', dinero(esperado)).negrita(false);
  if (contado != null) {
    t.fila('Efectivo contado', dinero(contado))
      .negrita().fila(contado - esperado >= 0 ? 'SOBRANTE' : 'FALTANTE', dinero(Math.abs(contado - esperado))).negrita(false);
  }
  t.separador();

  t.negrita().linea('PLATILLOS VENDIDOS').negrita(false);
  if (corte.platillos.length) corte.platillos.forEach((p) => t.fila(`${p.cantidad} ${p.nombre}`, dinero(p.importe)));
  else t.linea('Sin ventas');
  t.negrita().fila('TOTAL', dinero(corte.ventas.total)).negrita(false);

  if (conComandas && corte.comandas.length) {
    t.separador().negrita().linea('CUENTAS COBRADAS').negrita(false);
    corte.comandas.forEach((c) => t.fila(`#${c.folio} M${c.mesa ?? '-'} ${hora(c.pagadoAt)}`, dinero(c.total)));
  }
  if (corte.canceladas.cantidad || corte.abiertas.cantidad) {
    t.separador();
    if (corte.canceladas.cantidad) t.fila(`Canceladas (${corte.canceladas.cantidad})`, dinero(corte.canceladas.total));
    if (corte.abiertas.cantidad) t.fila(`Cuentas abiertas (${corte.abiertas.cantidad})`, dinero(corte.abiertas.total));
  }
  t.separador().centro().linea(`Impreso ${dia(corte.generado)} ${hora(corte.generado)}`)
    .avanzar(3).linea('______________________').linea('Firma').centro(false);
  t.fin({ cortar: ajustes.cortar });
  return t.toUint8Array();
}

/** Imprime el corte de caja según el modo configurado. */
export async function imprimirCorte(datos, ajustes = leerAjustes()) {
  if (ajustes.modo === 'usb') return enviarUsb(escposCorte(datos, ajustes));
  return imprimirHtml(htmlCorte(datos, ajustes));
}

/** Abre el cajón de dinero (sólo modo USB). */
export async function abrirCajon(ajustes = leerAjustes()) {
  const t = new Ticket(ajustes).abrirCajon();
  return enviarUsb(t.toUint8Array());
}

/** Ticket de prueba para configurar la impresora. */
export const ticketPrueba = (restaurante) => ({
  restaurante,
  tipo: 'pago',
  cajero: 'Prueba',
  comanda: {
    folio: 'PRUEBA', mesa: { numero: 1 }, mesero: { nombre: 'Prueba' }, total: 150, pagadoAt: new Date().toISOString(),
    detalles: [
      { id: 1, cantidad: 2, platillo: { nombre: 'Platillo de prueba' }, subtotal: 100 },
      { id: 2, cantidad: 1, platillo: { nombre: 'Bebida de prueba con nombre largo' }, subtotal: 50 },
    ],
    pagos: [{ id: 1, metodo: 'EFECTIVO', monto: 150, recibido: 200, cambio: 50 }],
  },
});
