import '../../styles/tokens.css';

/**
 * Maneja los 4 estados: loading (skeleton) · error · vacío · datos.
 * <EstadoVista loading={loading} error={error} vacio={!data?.length}
 *   skeleton={<SkeletonComandas />} onReintentar={recargar}
 *   tituloVacio="Sin comandas" textoVacio="Aparecerán aquí cuando el mesero las envíe.">
 *   ...contenido
 * </EstadoVista>
 */
export default function EstadoVista({
  loading, error, vacio, skeleton, onReintentar,
  tituloVacio = 'Sin resultados', textoVacio = '', children,
}) {
  if (loading) return skeleton;
  if (error) {
    const msg = error?.mensaje || error?.response?.data?.message || error?.message || 'Error desconocido';
    return (
      <div className="estado" role="alert">
        <h3>No se pudo cargar</h3>
        <p>{msg}</p>
        {onReintentar && <button className="btn btn-primary" onClick={onReintentar}>Reintentar</button>}
      </div>
    );
  }
  if (vacio) return <div className="estado"><h3>{tituloVacio}</h3><p>{textoVacio}</p></div>;
  return children;
}