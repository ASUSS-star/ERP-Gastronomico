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

const CLAVE = 'erp:impresora';
const CLAVE_ULTIMO = 'erp:ultimo-ticket';
const METODOS = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };

export const AJUSTES_BASE = { auto: true, papel: 58, copias: 1, pie: '¡Gracias por su visita!', fiscal: true };

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

/** Imprime en la impresora predeterminada del sistema mediante un iframe oculto. */
export function imprimirTicket(datos, ajustes = leerAjustes()) {
  if (datos.tipo !== 'cuenta') {
    try { localStorage.setItem(CLAVE_ULTIMO, JSON.stringify(datos)); } catch { /* sin espacio */ }
  }
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlTicket(datos, ajustes));
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
