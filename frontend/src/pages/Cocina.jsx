import { useEffect, useRef, useState } from 'react';
import { comandasApi } from '../api/services';
import { useFetch } from '../hooks/useFetch';
import { useAvisos } from '../context/AvisosContext';
import { sonar, detectarNuevos } from '../utils/avisoSonoro';
import EstadoVista from '../components/ui/EstadoVista';
import ComandaCard from '../components/ui/ComandaCard';
import { SkeletonComandas } from '../components/skeletons/Skeleton';

const COLUMNAS = [
  { titulo: 'Pendientes', estado: 'PENDIENTE', accion: 'Empezar', siguiente: 'EN_PREPARACION' },
  { titulo: 'En preparación', estado: 'EN_PREPARACION', accion: '¡Lista para servir!', siguiente: 'LISTO' },
  { titulo: 'Listas · esperando al mesero', estado: 'LISTO', accion: 'Ya se entregó', siguiente: 'ENTREGADO' },
];

/**
 * KDS (pantalla de cocina). Se actualiza sola en tiempo real.
 * Al marcar "¡Lista para servir!" el mesero recibe el aviso en su pantalla.
 * Suena cuando llega una comanda nueva.
 */
export default function Cocina() {
  const avisar = useAvisos();
  const { data, loading, error, recargar } = useFetch(
    () => comandasApi.listar({ estado: 'PENDIENTE,EN_PREPARACION,LISTO', limit: 60 }).then((r) => r.data),
    { intervalo: 10000, escuchar: ['comandas'] },
  );
  const [enCurso, setEnCurso] = useState(null);
  const [local, setLocal] = useState({}); // id → estado aplicado sin internet (aún sin confirmar)
  const previas = useRef(null);

  useEffect(() => {
    if (!data) return;
    // Quitamos los cambios locales que el servidor ya confirmó
    setLocal((l) => Object.fromEntries(Object.entries(l).filter(([id, est]) => data.find((c) => c.id === Number(id))?.estado !== est)));
    const nuevas = detectarNuevos(previas, data.filter((c) => c.estado === 'PENDIENTE'));
    if (nuevas.length) {
      sonar('nuevo');
      avisar.ok(nuevas.length === 1 ? `Nueva comanda #${nuevas[0].folio} · Mesa ${nuevas[0].mesa?.numero}` : `${nuevas.length} comandas nuevas`);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const mover = async (c, estado) => {
    setEnCurso(c.id);
    try {
      const res = await comandasApi.cambiarEstado(c.id, estado, `Cocina: comanda #${c.folio} (mesa ${c.mesa?.numero}) → ${estado}`);
      if (res.pendiente) {
        setLocal((l) => ({ ...l, [c.id]: estado }));
        avisar.ok('Sin internet: el cambio se enviará al reconectar');
      } else {
        if (estado === 'LISTO') avisar.ok(`Comanda #${c.folio} lista: se avisó al mesero`);
        await recargar(true);
      }
    } catch (err) {
      avisar.error(err);
    } finally {
      setEnCurso(null);
    }
  };

  // Más antiguas primero: es el orden en que se cocinan
  const lista = (data ?? [])
    .map((c) => ({ ...c, estado: local[c.id] ?? c.estado }))
    .filter((c) => c.estado !== 'ENTREGADO')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return (
    <EstadoVista loading={loading} error={error} vacio={lista.length === 0} skeleton={<SkeletonComandas />}
      onReintentar={recargar} tituloVacio="Sin comandas activas" textoVacio="Las nuevas comandas aparecerán aquí al instante.">
      <div className="tablero" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {COLUMNAS.map((col) => {
          const deCol = lista.filter((c) => c.estado === col.estado);
          return (
            <section key={col.estado} style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <h2 style={{ margin: 0 }}>{col.titulo} ({deCol.length})</h2>
              {deCol.map((c) => (
                <ComandaCard key={c.id} comanda={c} cargando={enCurso === c.id}
                  accion={col.accion} onAccion={(x) => mover(x, col.siguiente)}
                />
              ))}
            </section>
          );
        })}
      </div>
    </EstadoVista>
  );
}
