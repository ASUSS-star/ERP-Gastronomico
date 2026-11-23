import { useState } from 'react';
import { useConexion } from '../offline/useConexion';
import { sincronizar, descartarFallidas } from '../offline/cola';
import { useTiempoReal } from '../context/TiempoRealContext';
import Modal from './ui/Modal';

/** Indicador de conexión: en vivo / sin internet / cambios pendientes de enviar. */
export default function EstadoConexion() {
  const { enLinea, pendientes, fallidas, sincronizando } = useConexion();
  const { estado } = useTiempoReal();
  const [detalle, setDetalle] = useState(false);

  let tono = 'ok';
  let texto = estado === 'conectado' ? 'En vivo' : 'Conectado';
  if (estado === 'conectando' || estado === 'desconectado') texto = 'Conectado · reconectando';
  if (pendientes.length) { tono = 'warn'; texto = sincronizando ? 'Sincronizando…' : `${pendientes.length} por enviar`; }
  if (!enLinea) { tono = 'err'; texto = pendientes.length ? `Sin internet · ${pendientes.length} por enviar` : 'Sin internet'; }
  if (fallidas.length) tono = 'err';

  return (
    <>
      <button className="conexion" data-tono={tono} onClick={() => setDetalle(true)} title="Estado de la conexión">
        <i aria-hidden="true" /> {texto}{fallidas.length ? ` · ${fallidas.length} con error` : ''}
      </button>
      {detalle && (
        <Modal titulo="Conexión y sincronización" onCerrar={() => setDetalle(false)}
          pie={<>
            {fallidas.length > 0 && <button className="btn btn-danger" onClick={descartarFallidas}>Descartar errores</button>}
            <button className="btn btn-primary" disabled={!pendientes.length || !enLinea} onClick={() => sincronizar()}>Enviar ahora</button>
          </>}>
          <p className="muted">
            {enLinea ? 'Hay conexión con el servidor.' : 'No hay internet. Puedes seguir tomando pedidos, avanzando comandas y cobrando: los cambios se guardan en este dispositivo y se envían solos al volver la conexión. Los demás dispositivos los verán hasta entonces.'}
            {' '}{estado === 'conectado' ? 'Las pantallas se actualizan al instante.' : estado === 'apagado' ? 'Las pantallas se actualizan cada pocos segundos.' : ''}
          </p>
          <h3>Pendientes de enviar ({pendientes.length})</h3>
          {pendientes.length ? (
            <ul className="lista-simple">
              {pendientes.map((p) => <li key={p.id}><span>{p.descripcion}</span><small className="muted">{new Date(p.creada).toLocaleTimeString('es-MX')}</small></li>)}
            </ul>
          ) : <p className="muted">Nada pendiente.</p>}
          {fallidas.length > 0 && (
            <>
              <h3>No se pudieron aplicar ({fallidas.length})</h3>
              <p className="muted">El servidor los rechazó al sincronizar (por ejemplo, ya no había stock o otra persona cambió la comanda). Revisa y vuelve a capturarlos si hace falta.</p>
              <ul className="lista-simple">
                {fallidas.map((p) => <li key={p.id}><span>{p.descripcion}</span><small className="badge badge-err">{p.error}</small></li>)}
              </ul>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
