import { useState } from 'react';
import { reportesApi } from '../api/services';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { dinero } from '../utils/formato';
import { imprimirCorte } from '../impresion/ticket';
import { useAvisos } from '../context/AvisosContext';
import EstadoVista from './ui/EstadoVista';
import Modal from './ui/Modal';
import Icono from './ui/Icono';
import { Skeleton } from './skeletons/Skeleton';

const METODOS = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };
const hoyTexto = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** De 00:00 a 23:59:59 del día elegido, en hora LOCAL (el servidor está en UTC). Hoy: hasta este momento. */
const rangoDe = (fechaTexto) => {
  const [a, m, d] = fechaTexto.split('-').map(Number);
  const desde = new Date(a, m - 1, d, 0, 0, 0, 0);
  const fin = new Date(a, m - 1, d, 23, 59, 59, 999);
  return { desde: desde.toISOString(), hasta: (fechaTexto === hoyTexto() ? new Date() : fin).toISOString() };
};
const hora = (v) => new Date(v).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

/** Corte de caja: lo vendido en el día, dinero por método, arqueo de efectivo e impresión en el ticket. */
export default function CorteCaja({ onCerrar }) {
  const { usuario } = useAuth();
  const [fecha, setFecha] = useState(hoyTexto);
  const [fondo, setFondo] = useState('');
  const [contado, setContado] = useState('');
  const [conComandas, setConComandas] = useState(true);
  const { data: c, loading, error, recargar } = useFetch(
    () => reportesApi.corte(rangoDe(fecha)).then((r) => r.data),
    { deps: [fecha], escuchar: ['reportes'] },
  );

  const esperado = (Number(fondo) || 0) + (c?.efectivoEsperado || 0);
  const diferencia = contado === '' ? null : Number(contado) - esperado;

  const avisar = useAvisos();
  const imprimir = () => imprimirCorte({
    restaurante: usuario.restaurante, corte: c, cajero: usuario.nombre, arqueo: { fondo, contado }, conComandas,
  }).catch((e) => avisar.error(`No se imprimió el corte: ${e.message}`));

  return (
    <Modal titulo="Corte de caja" ancho="lg" onCerrar={onCerrar}
      pie={<>
        <label className="check" style={{ marginRight: 'auto' }}>
          <input type="checkbox" checked={conComandas} onChange={(e) => setConComandas(e.target.checked)} /> Incluir lista de cuentas en el ticket
        </label>
        <button className="btn" onClick={onCerrar}>Cerrar</button>
        <button className="btn btn-primary" disabled={!c} onClick={imprimir}><Icono n="ticket" /> Imprimir corte</button>
      </>}>
      <div className="filtros">
        <label className="campo" style={{ maxWidth: 200 }}>
          <span>Día</span>
          <input type="date" value={fecha} max={hoyTexto()} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </label>
        {c && <span className="muted">De {hora(c.rango.desde)} a {hora(c.rango.hasta)}</span>}
      </div>

      <EstadoVista loading={loading} error={error} onReintentar={recargar} skeleton={<Skeleton h={260} />}>
        {c && (
          <>
            <div className="saldos" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <div><small>Venta total</small><b>{dinero(c.ventas.total)}</b></div>
              <div><small>Cuentas cobradas</small><b>{c.ventas.comandas}</b></div>
              <div><small>Platillos vendidos</small><b>{c.ventas.articulos}</b></div>
              <div><small>Ticket promedio</small><b>{dinero(c.ventas.ticketPromedio)}</b></div>
            </div>

            <div className="dos-col">
              <section className="card">
                <div className="seccion-cab"><h2>Platillos vendidos</h2></div>
                {c.platillos.length ? (
                  <div className="tabla-wrap">
                    <table className="tabla" style={{ minWidth: 0 }}>
                      <thead><tr><th>Platillo</th><th className="der">Cant.</th><th className="der">Importe</th></tr></thead>
                      <tbody>
                        {c.platillos.map((p) => (
                          <tr key={p.platilloId}><td>{p.nombre}</td><td className="der num">{p.cantidad}</td><td className="der num">{dinero(p.importe)}</td></tr>
                        ))}
                        <tr><td><b>Total</b></td><td className="der num"><b>{c.ventas.articulos}</b></td><td className="der num"><b>{dinero(c.ventas.total)}</b></td></tr>
                      </tbody>
                    </table>
                  </div>
                ) : <p className="muted">No hay ventas cobradas este día.</p>}
              </section>

              <div style={{ display: 'grid', gap: 16 }}>
                <section className="card">
                  <div className="seccion-cab"><h2>Dinero recibido</h2></div>
                  <ul className="lista-simple">
                    {c.porMetodo.map((m) => (
                      <li key={m.metodo}><span>{METODOS[m.metodo] ?? m.metodo} <small className="muted">({m.pagos})</small></span><b className="num">{dinero(m.total)}</b></li>
                    ))}
                    <li><b>Total recibido</b><b className="num">{dinero(c.recibido)}</b></li>
                  </ul>
                  {c.abonosCuentasAbiertas > 0 && (
                    <small className="muted">Incluye {dinero(c.abonosCuentasAbiertas)} de abonos a cuentas que siguen abiertas.</small>
                  )}
                </section>

                <section className="card" style={{ display: 'grid', gap: 12 }}>
                  <h2>Arqueo de efectivo</h2>
                  <div className="form-2">
                    <label className="campo"><span>Fondo inicial</span>
                      <input type="number" min="0" step="0.01" value={fondo} placeholder="0.00" onChange={(e) => setFondo(e.target.value)} /></label>
                    <label className="campo"><span>Efectivo contado</span>
                      <input type="number" min="0" step="0.01" value={contado} placeholder="Cuenta los billetes" onChange={(e) => setContado(e.target.value)} /></label>
                  </div>
                  <div className="total"><span>Debe haber en caja</span><span className="num">{dinero(esperado)}</span></div>
                  {diferencia != null && (
                    <p className={`alerta ${Math.abs(diferencia) < 0.005 ? 'alerta-ok' : 'alerta-err'}`}>
                      {Math.abs(diferencia) < 0.005 ? 'La caja cuadra exactamente.' : `${diferencia > 0 ? 'Sobrante' : 'Faltante'} de ${dinero(Math.abs(diferencia))}`}
                    </p>
                  )}
                </section>
              </div>
            </div>

            {c.comandas.length > 0 && (
              <section>
                <div className="seccion-cab"><h2>Cuentas cobradas ({c.comandas.length})</h2></div>
                <div className="tabla-wrap">
                  <table className="tabla">
                    <thead><tr><th>Folio</th><th>Mesa</th><th>Hora</th><th>Mesero</th><th>Pago</th><th className="der">Total</th></tr></thead>
                    <tbody>
                      {c.comandas.map((x) => (
                        <tr key={x.folio}>
                          <td>#{x.folio}</td><td>{x.mesa}</td><td>{hora(x.pagadoAt)}</td><td>{x.mesero}</td>
                          <td>{x.metodos.map((m) => METODOS[m] ?? m).join(' + ')}</td>
                          <td className="der num">{dinero(x.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {(c.canceladas.cantidad > 0 || c.abiertas.cantidad > 0) && (
              <p className="alerta badge-warn">
                {c.canceladas.cantidad > 0 && `${c.canceladas.cantidad} cancelada(s) por ${dinero(c.canceladas.total)}. `}
                {c.abiertas.cantidad > 0 && `Quedan ${c.abiertas.cantidad} cuenta(s) abiertas por ${dinero(c.abiertas.total)}: cóbralas antes de cerrar el día.`}
              </p>
            )}
          </>
        )}
      </EstadoVista>
    </Modal>
  );
}
