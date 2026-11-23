import { useEffect, useRef, useState } from 'react';
import { comandasApi } from '../api/services';
import { useFetch } from '../hooks/useFetch';
import { useAvisos } from '../context/AvisosContext';
import { sonar, notificar, detectarNuevos, permisoNotificaciones, pedirPermiso, puedeNotificar } from '../utils/avisoSonoro';
import Icono from './ui/Icono';

/**
 * Aviso "comida lista" para MESERO y ADMIN, en cualquier pantalla.
 * El mesero sólo recibe los de SUS comandas (el backend filtra la lista por mesero).
 */
export default function AvisosComandas({ compacto = false }) {
  const avisar = useAvisos();
  const previos = useRef(null);
  const [permiso, setPermiso] = useState(permisoNotificaciones());
  const { data } = useFetch(
    () => comandasApi.listar({ estado: 'LISTO', limit: 50 }).then((r) => r.data),
    { intervalo: 10000, escuchar: ['comandas'] },
  );

  useEffect(() => {
    if (!data) return;
    const nuevos = detectarNuevos(previos, data);
    if (!nuevos.length) return;
    sonar('listo');
    nuevos.forEach((c) => {
      avisar.ok(`Mesa ${c.mesa?.numero}: la comanda #${c.folio} está lista para servir`);
      notificar('Comida lista', `Mesa ${c.mesa?.numero} · comanda #${c.folio}`);
    });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!puedeNotificar() || permiso !== 'default') return null;
  return (
    <button className={`btn ${compacto ? '' : 'btn-sm'}`} onClick={() => pedirPermiso().then(setPermiso)}
      title="Recibe el aviso aunque estés en otra pestaña">
      <Icono n="alerta" size={16} /> Activar avisos
    </button>
  );
}
