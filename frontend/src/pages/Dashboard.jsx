import { useState } from 'react';
import { Link } from 'react-router-dom';
import { reportesApi, insumosApi } from '../api/services';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { dinero, cantidad } from '../utils/formato';
import EstadoVista from '../components/ui/EstadoVista';
import EstadoBadge from '../components/ui/EstadoBadge';
import Icono from '../components/ui/Icono';
import { SkeletonKPIs } from '../components/skeletons/Skeleton';

const RANGOS = [
  { id: 'hoy', texto: 'Hoy', dias: 0 },
  { id: '7', texto: '7 días', dias: 6 },
  { id: '30', texto: '30 días', dias: 29 },
];
const METODOS = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };
const ESTADOS = ['PENDIENTE', 'EN_PREPARACION', 'ENTREGADO', 'PAGADO', 'CANCELADO'];

/** Medianoche LOCAL de hace N días (el servidor en la nube trabaja en UTC, por eso se manda explícito). */
const desdeHace = (dias) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dias);
  return d.toISOString();
};

function Kpi({ icono, etiqueta, valor, tono }) {
  return (
    <div className="card kpi" data-tono={tono}>
      <span className="kpi-etiqueta"><span className="kpi-ico"><Icono n={icono} size={16} /></span>{etiqueta}</span>
      <span className="kpi-valor">{valor}</span>
    </div>
  );
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const esAdmin = usuario.rol === 'ADMIN';
  const [rango, setRango] = useState('hoy');
  const dias = RANGOS.find((r) => r.id === rango).dias;

  const { data, loading, error, recargar } = useFetch(
    () => reportesApi.resumen({ desde: desdeHace(dias) }).then((r) => r.data),
    { deps: [rango], intervalo: 30000 },
  );
  // El detalle de stock bajo sólo lo puede consultar ADMIN / COCINERO
  const alertas = useFetch(() => (esAdmin ? insumosApi.alertas().then((r) => r.data) : Promise.resolve([])));

  const top = data?.topPlatillos ?? [];
  const maxTop = Math.max(1, ...top.map((t) => Number(t.cantidad)));
  const metodos = data?.ventasPorMetodo ?? [];
  const totalVentas = Number(data?.ventas.total) || 0;

  return (
    <div className="pagina">
      <header className="pagina-cab">
        <div>
          <h1>Hola, {usuario.nombre?.split(' ')[0]}</h1>
          <p>Así va {usuario.restaurante?.nombre}.</p>
        </div>
        <div className="segmentado" role="group" aria-label="Periodo">
          {RANGOS.map((r) => (
            <button key={r.id} aria-pressed={rango === r.id} onClick={() => setRango(r.id)}>{r.texto}</button>
          ))}
        </div>
      </header>

      <EstadoVista loading={loading} error={error} skeleton={<SkeletonKPIs n={5} />} onReintentar={recargar}>
        {data && (
          <>
            <section className="kpis">
              <Kpi icono="caja" etiqueta="Ventas cobradas" valor={dinero(data.ventas.total)} />
              <Kpi icono="ticket" etiqueta="Comandas pagadas" valor={data.ventas.comandasPagadas} tono="ok" />
              <Kpi icono="panel" etiqueta="Ticket promedio" valor={dinero(data.ventas.ticketPromedio)} tono="info" />
              <Kpi icono="salon" etiqueta="Mesas ocupadas ahora" valor={data.mesasOcupadas} tono="info" />
              <Kpi icono="alerta" etiqueta="Insumos con stock bajo" valor={data.insumosStockBajo} tono={data.insumosStockBajo ? 'warn' : 'ok'} />
            </section>

            <div className="dos-col">
              <section className="card">
                <div className="seccion-cab"><h2>Platillos más vendidos</h2></div>
                {top.length === 0 ? (
                  <p className="muted">Todavía no hay ventas cobradas en este periodo. Aparecerán aquí en cuanto la caja cobre una comanda.</p>
                ) : (
                  <div className="barras">
                    {top.map((t) => (
                      <div className="barra-fila" key={t.platilloId}>
                        <header><span>{t.nombre}</span><span className="num">{t.cantidad} vendidos · {dinero(t.importe)}</span></header>
                        <div className="barra"><i style={{ width: `${(Number(t.cantidad) / maxTop) * 100}%` }} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div style={{ display: 'grid', gap: 16 }}>
                <section className="card">
                  <div className="seccion-cab"><h2>Ventas por método de pago</h2></div>
                  {metodos.length === 0 ? <p className="muted">Sin cobros en este periodo.</p> : (
                    <div className="barras">
                      {metodos.map((m) => (
                        <div className="barra-fila" key={m.metodo}>
                          <header><span>{METODOS[m.metodo] ?? m.metodo}</span><span className="num">{dinero(m.total)} · {m.comandas}</span></header>
                          <div className="barra"><i style={{ width: `${totalVentas ? (Number(m.total) / totalVentas) * 100 : 0}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="card">
                  <div className="seccion-cab"><h2>Comandas del periodo</h2></div>
                  <ul className="lista-simple">
                    {ESTADOS.map((e) => (
                      <li key={e}><EstadoBadge estado={e} /><b className="num">{data.comandasPorEstado[e] ?? 0}</b></li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>

            {esAdmin && (alertas.data?.length ?? 0) > 0 && (
              <section className="card">
                <div className="seccion-cab">
                  <h2>Hay que resurtir</h2>
                  <Link className="btn btn-sm" to="/inventario">Ir a inventario</Link>
                </div>
                <ul className="lista-simple">
                  {alertas.data.map((i) => (
                    <li key={i.id}>
                      <span><b>{i.nombre}</b> <small className="muted">{i.proveedor?.nombre ?? 'Sin proveedor'}</small></span>
                      <span className="badge badge-warn num">{cantidad(i.stockActual)} / mín. {cantidad(i.stockMinimo)} {i.unidad}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </EstadoVista>
    </div>
  );
}
