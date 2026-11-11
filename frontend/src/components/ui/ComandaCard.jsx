import { useEffect, useState } from 'react';
import EstadoBadge, { urgencia } from './EstadoBadge';
import { dinero } from '../../utils/formato';

/**
 * Tarjeta de comanda. `accion` es el botón principal; `secundaria` uno opcional (p. ej. Cancelar).
 * `mostrarTotal` agrega el importe (salón / caja); en cocina no hace falta.
 */
export default function ComandaCard({ comanda: c, accion, onAccion, secundaria, onSecundaria, cargando, mostrarTotal }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const fecha = c.createdAt ?? c.creadaEn;
  const min = Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60000));

  return (
    <article className="card comanda" data-urgencia={urgencia(fecha)}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: '1.2em' }}>#{c.folio} · Mesa {c.mesa?.numero}</strong>
        <EstadoBadge estado={c.estado} />
      </header>
      <p className="muted" style={{ margin: '4px 0 12px' }}>
        {min} min · {c.mesero?.nombre}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {c.detalles?.map((d) => (
          <li key={d.id}>
            {d.cantidad}× {d.platillo?.nombre} {d.notas && <em>({d.notas})</em>}
          </li>
        ))}
      </ul>
      {c.notas && <p className="alerta badge-warn" style={{ marginTop: 10 }}>Nota: {c.notas}</p>}
      {mostrarTotal && <p style={{ marginTop: 10, fontWeight: 700 }} className="num">Total {dinero(c.total)}</p>}
      {(accion || secundaria) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {secundaria && (
            <button className="btn btn-danger" disabled={cargando} onClick={() => onSecundaria(c)}>{secundaria}</button>
          )}
          {accion && (
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={cargando} onClick={() => onAccion(c)}>
              {accion}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
