import '../../styles/tokens.css';

export const Skeleton = ({ w = '100%', h = 16, style }) => (
  <span className="sk" style={{ width: w, height: h, ...style }} aria-hidden="true" />
);

/* Mismas proporciones que ComandaCard */
export function SkeletonComandas({ n = 6 }) {
  return (
    <div className="tablero" role="status" aria-label="Cargando comandas">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card comanda" style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton w={110} h={28} /><Skeleton w={70} h={24} />
          </div>
          <Skeleton h={18} /><Skeleton w="80%" h={18} /><Skeleton w="60%" h={18} />
          <Skeleton h="var(--touch)" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTabla({ filas = 8, cols = 4 }) {
  return (
    <div className="card" role="status" aria-label="Cargando datos" style={{ display: 'grid', gap: 12 }}>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
          {Array.from({ length: cols }, (_, j) => <Skeleton key={j} h={20} />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletonKPIs({ n = 4 }) {
  return (
    <div role="status" aria-label="Cargando indicadores"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card" style={{ display: 'grid', gap: 10 }}>
          <Skeleton w="50%" h={14} /><Skeleton w="70%" h={34} />
        </div>
      ))}
    </div>
  );
}

/* Caja: catálogo + resumen de cuenta */
export function SkeletonCaja() {
  return (
    <div role="status" aria-label="Cargando caja"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
        {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} h={96} />)}
      </div>
      <div className="card" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <Skeleton w="50%" h={24} /><Skeleton h={18} /><Skeleton h={18} /><Skeleton h={18} />
        <Skeleton w="60%" h={40} /><Skeleton h="var(--touch)" />
      </div>
    </div>
  );
}