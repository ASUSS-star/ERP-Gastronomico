import { useEffect, useState } from 'react';
import EstadoBadge, { urgencia } from './EstadoBadge';
import '../../styles/tokens.css';

export default function ComandaCard({ comanda: c, accion, onAccion, cargando }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const fecha = c.createdAt ?? c.creadaEn;
  const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);

  return (
    <article className="card comanda" data-urgencia={urgencia(fecha)}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '1.3em' }}>#{c.folio} · Mesa {c.mesa?.numero}</strong>
        <EstadoBadge estado={c.estado} />
      </header>
      <p style={{ color: 'var(--text-2)', margin: '4px 0 12px' }}>
        {min} min · {c.mesero?.nombre}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {c.detalles?.map((d) => (
          <li key={d.id}>
            {d.cantidad}× {d.platillo?.nombre} {d.notas && <em>({d.notas})</em>}
          </li>
        ))}
      </ul>
      {accion && (
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }}
          disabled={cargando} onClick={() => onAccion(c)}>
          {accion}
        </button>
      )}
    </article>
  );
}