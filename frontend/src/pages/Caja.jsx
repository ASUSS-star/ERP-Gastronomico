import { useState } from 'react';
import { comandasApi } from '../api/services';
import { useFetch } from '../hooks/useFetch';
import { useAvisos } from '../context/AvisosContext';
import { dinero } from '../utils/formato';
import EstadoVista from '../components/ui/EstadoVista';
import { SkeletonComandas } from '../components/skeletons/Skeleton';

const METODOS = [['EFECTIVO', 'Efectivo'], ['TARJETA', 'Tarjeta'], ['TRANSFERENCIA', 'Transfer.']];

/** Caja: cobra las comandas ENTREGADAS. Se actualiza sola cada 10 s. */
export default function Caja() {
  const avisar = useAvisos();
  const { data, loading, error, recargar } = useFetch(
    () => comandasApi.listar({ estado: 'ENTREGADO', limit: 50 }).then((r) => r.data),
    { intervalo: 10000 },
  );
  const [metodo, setMetodo] = useState({}); // comandaId → método elegido
  const [enCurso, setEnCurso] = useState(null);

  const cobrar = async (c) => {
    setEnCurso(c.id);
    try {
      await comandasApi.cambiarEstado(c.id, 'PAGADO', metodo[c.id]);
      avisar.ok(`Comanda #${c.folio} cobrada: ${dinero(c.total)}`);
      await recargar(true);
    } catch (err) { avisar.error(err); } finally { setEnCurso(null); }
  };

  const lista = data ?? [];
  const porCobrar = lista.reduce((s, c) => s + Number(c.total), 0);

  return (
    <EstadoVista loading={loading} error={error} vacio={!lista.length} skeleton={<SkeletonComandas n={3} />} onReintentar={recargar}
      tituloVacio="Nada por cobrar" textoVacio="Las comandas entregadas aparecerán aquí automáticamente.">
      <p className="muted" style={{ marginBottom: 14 }}>
        {lista.length} {lista.length === 1 ? 'cuenta' : 'cuentas'} por cobrar · <b className="num">{dinero(porCobrar)}</b>
      </p>
      <div className="cuentas">
        {lista.map((c) => (
          <article key={c.id} className="card cuenta">
            <header className="cuenta-cab">
              <strong style={{ fontSize: '1.2em' }}>Mesa {c.mesa?.numero}</strong>
              <span className="muted">#{c.folio} · {c.mesero?.nombre}</span>
            </header>
            <ul className="cuenta-lineas">
              {c.detalles?.map((d) => (
                <li key={d.id}><span>{d.cantidad}× {d.platillo?.nombre}</span><span className="num">{dinero(d.subtotal)}</span></li>
              ))}
            </ul>
            <div className="total"><span>Total</span><span className="num">{dinero(c.total)}</span></div>
            <div className="metodos" role="group" aria-label="Método de pago">
              {METODOS.map(([id, texto]) => (
                <button key={id} className="btn" aria-pressed={metodo[c.id] === id}
                  onClick={() => setMetodo({ ...metodo, [c.id]: id })}>{texto}</button>
              ))}
            </div>
            <button className="btn btn-primary btn-block" disabled={!metodo[c.id] || enCurso === c.id} onClick={() => cobrar(c)}>
              {enCurso === c.id ? 'Cobrando…' : metodo[c.id] ? 'Cobrar' : 'Elige el método de pago'}
            </button>
          </article>
        ))}
      </div>
    </EstadoVista>
  );
}
