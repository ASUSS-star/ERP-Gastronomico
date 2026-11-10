import { useState } from 'react';
import { comandasApi } from '../api/services';
import { useFetch } from '../hooks/useFetch';
import EstadoVista from '../components/ui/EstadoVista';
import ComandaCard from '../components/ui/ComandaCard';
import { SkeletonComandas } from '../components/skeletons/Skeleton';

/** KDS: pendientes y en preparación, refresco cada 10 s. */
export default function Cocina() {
  const { data, loading, error, recargar } = useFetch(
    () => comandasApi.listar({ estado: 'PENDIENTE,EN_PREPARACION', limit: 50 }).then((r) => r.data),
    { intervalo: 10000 },
  );
  const [errorAccion, setErrorAccion] = useState('');
  const [enCurso, setEnCurso] = useState(null);

  const avanzar = async (c) => {
    const siguiente = c.estado === 'PENDIENTE' ? 'EN_PREPARACION' : 'ENTREGADO';
    setEnCurso(c.id);
    setErrorAccion('');
    try {
      await comandasApi.cambiarEstado(c.id, siguiente);
      await recargar(true);
    } catch (err) {
      setErrorAccion(err.mensaje);
    } finally {
      setEnCurso(null);
    }
  };

  const lista = data ?? [];
  const columnas = [
    { titulo: 'Pendientes', estado: 'PENDIENTE', accion: 'Empezar' },
    { titulo: 'En preparación', estado: 'EN_PREPARACION', accion: 'Marcar entregado' },
  ];

  return (
    <>
      {errorAccion && <p role="alert" className="badge badge-err">{errorAccion}</p>}
      <EstadoVista
        loading={loading}
        error={error}
        vacio={lista.length === 0}
        skeleton={<SkeletonComandas />}
        onReintentar={recargar}
        tituloVacio="Sin comandas activas"
        textoVacio="Las nuevas comandas aparecerán aquí automáticamente."
      >
        <div className="tablero" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {columnas.map((col) => (
            <section key={col.estado} style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <h2 style={{ margin: 0 }}>
                {col.titulo} ({lista.filter((c) => c.estado === col.estado).length})
              </h2>
              {lista.filter((c) => c.estado === col.estado).map((c) => (
                <ComandaCard key={c.id} comanda={c} accion={col.accion}
                  onAccion={avanzar} cargando={enCurso === c.id} />
              ))}
            </section>
          ))}
        </div>
      </EstadoVista>
    </>
  );
}