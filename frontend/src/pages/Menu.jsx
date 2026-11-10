import { useState } from 'react';
import { categoriasApi, platillosApi, insumosApi } from '../api/services';
import { useFetch } from '../hooks/useFetch';
import { useAvisos } from '../context/AvisosContext';
import { dinero, cantidad } from '../utils/formato';
import EstadoVista from '../components/ui/EstadoVista';
import Modal from '../components/ui/Modal';
import Icono from '../components/ui/Icono';
import { Skeleton, SkeletonTabla } from '../components/skeletons/Skeleton';

function FormPlatillo({ platillo, categorias, onCerrar, onGuardado }) {
  const avisar = useAvisos();
  const editando = Boolean(platillo);
  const [form, setForm] = useState({
    nombre: platillo?.nombre ?? '', descripcion: platillo?.descripcion ?? '', precio: platillo?.precio ?? '',
    categoriaId: platillo?.categoriaId ?? '', disponible: platillo?.disponible ?? true,
  });
  const [guardando, setGuardando] = useState(false);
  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const guardar = async () => {
    setGuardando(true);
    try {
      const payload = {
        nombre: form.nombre, descripcion: form.descripcion, precio: Number(form.precio),
        categoriaId: form.categoriaId ? Number(form.categoriaId) : null, disponible: form.disponible,
      };
      if (editando) await platillosApi.actualizar(platillo.id, payload);
      else await platillosApi.crear(payload);
      avisar.ok(editando ? 'Platillo actualizado' : 'Platillo agregado al menú');
      onGuardado();
    } catch (err) { avisar.error(err); } finally { setGuardando(false); }
  };

  return (
    <Modal titulo={editando ? 'Editar platillo' : 'Nuevo platillo'} onCerrar={onCerrar} onSubmit={guardar}
      pie={<><button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button></>}>
      <label className="campo"><span>Nombre</span>
        <input name="nombre" value={form.nombre} onChange={cambiar} minLength={2} maxLength={120} required autoFocus /></label>
      <label className="campo"><span>Descripción <small>(opcional)</small></span>
        <textarea name="descripcion" value={form.descripcion} onChange={cambiar} maxLength={500} /></label>
      <div className="form-2">
        <label className="campo"><span>Precio (MXN)</span>
          <input name="precio" type="number" min="0.01" step="0.01" max="999999.99" value={form.precio} onChange={cambiar} required /></label>
        <label className="campo"><span>Categoría</span>
          <select name="categoriaId" value={form.categoriaId} onChange={cambiar}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select></label>
      </div>
      <label className="check"><input type="checkbox" name="disponible" checked={form.disponible} onChange={cambiar} /> Disponible para la venta</label>
    </Modal>
  );
}

/** Receta: qué insumos y cuánto consume UNA unidad del platillo (con esto se descuenta el inventario). */
function FormReceta({ platillo, onCerrar }) {
  const avisar = useAvisos();
  const [filas, setFilas] = useState(null); // [{ insumoId, cantidad }]
  const [guardando, setGuardando] = useState(false);
  const { data, loading, error, recargar } = useFetch(async () => {
    const [detalle, insumos] = await Promise.all([platillosApi.obtener(platillo.id), insumosApi.listar({ limit: 100 })]);
    setFilas(detalle.data.receta.map((r) => ({ insumoId: r.insumoId, cantidad: Number(r.cantidad) })));
    return insumos.data;
  });
  const insumos = data ?? [];
  const usados = new Set((filas ?? []).map((f) => f.insumoId));
  const libres = insumos.filter((i) => !usados.has(i.id));
  const costo = (filas ?? []).reduce((s, f) => {
    const ins = insumos.find((i) => i.id === f.insumoId);
    return s + (Number(ins?.costoUnitario) || 0) * (Number(f.cantidad) || 0);
  }, 0);

  const editar = (i, cambios) => setFilas(filas.map((f, j) => (j === i ? { ...f, ...cambios } : f)));

  const guardar = async () => {
    setGuardando(true);
    try {
      await platillosApi.definirReceta(platillo.id, filas.map((f) => ({ insumoId: f.insumoId, cantidad: Number(f.cantidad) })));
      avisar.ok(`Receta de ${platillo.nombre} guardada`);
      onCerrar();
    } catch (err) { avisar.error(err); } finally { setGuardando(false); }
  };

  return (
    <Modal titulo={`Receta · ${platillo.nombre}`} onCerrar={onCerrar} onSubmit={guardar}
      pie={<><button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-primary" disabled={guardando || !filas}>{guardando ? 'Guardando…' : 'Guardar receta'}</button></>}>
      <p className="muted">Indica cuánto de cada insumo lleva <b>una</b> porción. Cada venta lo descuenta del inventario automáticamente.</p>
      <EstadoVista loading={loading} error={error} onReintentar={recargar} skeleton={<Skeleton h={120} />}>
        {filas && (
          <>
            {!filas.length && <p className="alerta badge-neutral">Este platillo no tiene receta: no descuenta inventario.</p>}
            {filas.map((f, i) => {
              const ins = insumos.find((x) => x.id === f.insumoId);
              return (
                <div key={f.insumoId} style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 8, alignItems: 'center' }}>
                  <b>{ins?.nombre ?? `Insumo ${f.insumoId}`} <small className="muted">({ins?.unidad})</small></b>
                  <input className="input" type="number" min="0.001" step="0.001" required value={f.cantidad}
                    aria-label={`Cantidad de ${ins?.nombre}`} onChange={(e) => editar(i, { cantidad: e.target.value })} />
                  <button type="button" className="btn btn-icon btn-danger" aria-label="Quitar insumo"
                    onClick={() => setFilas(filas.filter((_, j) => j !== i))}><Icono n="basura" size={16} /></button>
                </div>
              );
            })}
            {libres.length > 0 ? (
              <label className="campo"><span>Agregar insumo</span>
                <select value="" onChange={(e) => e.target.value && setFilas([...filas, { insumoId: Number(e.target.value), cantidad: 1 }])}>
                  <option value="">Selecciona un insumo…</option>
                  {libres.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                </select></label>
            ) : !insumos.length && <p className="muted">Primero da de alta insumos en Inventario.</p>}
            <div className="total">
              <span>Costo por porción</span>
              <span className="num">{dinero(costo)}</span>
            </div>
            <small className="muted">Precio de venta {dinero(platillo.precio)} · margen bruto {dinero(Number(platillo.precio) - costo)}
              {filas.length > 0 && ` · rinde con el stock actual: ${cantidad(Math.floor(Math.min(...filas.map((f) => {
                const ins = insumos.find((x) => x.id === f.insumoId);
                return Number(f.cantidad) > 0 ? Number(ins?.stockActual || 0) / Number(f.cantidad) : Infinity;
              }))))} porciones`}</small>
          </>
        )}
      </EstadoVista>
    </Modal>
  );
}

/** Menú: categorías, platillos, disponibilidad y recetas. */
export default function Menu() {
  const avisar = useAvisos();
  const cats = useFetch(() => categoriasApi.listar().then((r) => r.data));
  const [catId, setCatId] = useState(null);
  const [q, setQ] = useState('');
  const platillos = useFetch(
    () => platillosApi.listar({ limit: 100, ...(catId && { categoriaId: catId }) }).then((r) => r.data),
    { deps: [catId] },
  );
  const [form, setForm] = useState(null);
  const [receta, setReceta] = useState(null);
  const [nuevaCat, setNuevaCat] = useState('');

  const refrescar = () => { cats.recargar(true); platillos.recargar(true); };

  const crearCategoria = async (e) => {
    e.preventDefault();
    try {
      await categoriasApi.crear({ nombre: nuevaCat });
      setNuevaCat('');
      cats.recargar(true);
    } catch (err) { avisar.error(err); }
  };
  const borrarCategoria = async (c) => {
    if (!window.confirm(`¿Eliminar la categoría "${c.nombre}"? Sus platillos quedarán sin categoría.`)) return;
    try {
      await categoriasApi.eliminar(c.id);
      if (catId === c.id) setCatId(null);
      refrescar();
    } catch (err) { avisar.error(err); }
  };
  const alternar = async (p) => {
    try {
      await platillosApi.actualizar(p.id, { disponible: !p.disponible });
      platillos.recargar(true);
    } catch (err) { avisar.error(err); }
  };
  const borrar = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.nombre}" del menú?`)) return;
    try {
      await platillosApi.eliminar(p.id);
      avisar.ok('Platillo eliminado');
      refrescar();
    } catch (err) { avisar.error(err); } // si ya tiene ventas, la API pide marcarlo como no disponible
  };

  const filtro = q.trim().toLowerCase();
  const lista = (platillos.data ?? []).filter((p) => !filtro || p.nombre.toLowerCase().includes(filtro));

  return (
    <div className="pagina">
      <header className="pagina-cab">
        <div><h1>Menú y recetas</h1><p>Lo que vendes, a cuánto, y qué insumos consume cada platillo.</p></div>
        <button className="btn btn-primary" onClick={() => setForm({})}><Icono n="mas" /> Nuevo platillo</button>
      </header>

      <section className="card">
        <div className="seccion-cab"><h2>Categorías</h2></div>
        <div className="chips">
          <button className="chip" aria-pressed={catId === null} onClick={() => setCatId(null)}>Todas</button>
          {(cats.data ?? []).map((c) => (
            <span key={c.id} className="chip" aria-pressed={catId === c.id} role="button" tabIndex={0}
              onClick={() => setCatId(c.id)} onKeyDown={(e) => e.key === 'Enter' && setCatId(c.id)}>
              {c.nombre} <small>{c._count?.platillos ?? 0}</small>
              <button className="x" aria-label={`Eliminar categoría ${c.nombre}`}
                onClick={(e) => { e.stopPropagation(); borrarCategoria(c); }}><Icono n="cerrar" size={14} /></button>
            </span>
          ))}
          <form onSubmit={crearCategoria} style={{ display: 'flex', gap: 6 }}>
            <input className="input" style={{ minHeight: 34, width: 170 }} placeholder="Nueva categoría" value={nuevaCat}
              onChange={(e) => setNuevaCat(e.target.value)} minLength={2} maxLength={80} required aria-label="Nombre de la nueva categoría" />
            <button className="btn btn-sm">Agregar</button>
          </form>
        </div>
      </section>

      <div className="filtros">
        <input className="input" type="search" placeholder="Buscar platillo…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar platillo" />
      </div>

      <EstadoVista loading={platillos.loading} error={platillos.error} vacio={!lista.length} onReintentar={platillos.recargar}
        skeleton={<SkeletonTabla filas={6} cols={4} />} tituloVacio="Aún no hay platillos"
        textoVacio="Agrega tu primer platillo y después define su receta para que descuente inventario.">
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Platillo</th><th>Categoría</th><th className="der">Precio</th><th>Venta</th><th className="der">Acciones</th></tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className={p.disponible ? '' : 'fila-inactiva'}>
                  <td><b>{p.nombre}</b>{p.descripcion && <small>{p.descripcion}</small>}</td>
                  <td>{p.categoria?.nombre ?? <span className="muted">Sin categoría</span>}</td>
                  <td className="der num">{dinero(p.precio)}</td>
                  <td>
                    <button className={`badge ${p.disponible ? 'badge-ok' : 'badge-neutral'}`} style={{ border: 0, cursor: 'pointer' }}
                      onClick={() => alternar(p)} title="Cambiar disponibilidad">
                      {p.disponible ? 'Disponible' : 'Agotado'}
                    </button>
                  </td>
                  <td><div className="acciones">
                    <button className="btn btn-sm" onClick={() => setReceta(p)}><Icono n="receta" size={15} /> Receta</button>
                    <button className="btn btn-sm btn-icon" onClick={() => setForm(p)} aria-label={`Editar ${p.nombre}`}><Icono n="editar" size={15} /></button>
                    <button className="btn btn-sm btn-icon btn-danger" onClick={() => borrar(p)} aria-label={`Eliminar ${p.nombre}`}><Icono n="basura" size={15} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstadoVista>

      {form && (
        <FormPlatillo platillo={form.id ? form : null} categorias={cats.data ?? []} onCerrar={() => setForm(null)}
          onGuardado={() => { setForm(null); refrescar(); }} />
      )}
      {receta && <FormReceta platillo={receta} onCerrar={() => setReceta(null)} />}
    </div>
  );
}
