import { useState } from 'react';
import { insumosApi, proveedoresApi } from '../api/services';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useAvisos } from '../context/AvisosContext';
import { dinero, cantidad, fechaHora } from '../utils/formato';
import EstadoVista from '../components/ui/EstadoVista';
import Modal from '../components/ui/Modal';
import Icono from '../components/ui/Icono';
import { SkeletonTabla } from '../components/skeletons/Skeleton';

const TIPOS = {
  ENTRADA: { texto: 'Entrada (compra)', clase: 'badge-ok', ayuda: 'Cantidad que entra al almacén.' },
  SALIDA: { texto: 'Salida (merma / consumo)', clase: 'badge-err', ayuda: 'Cantidad que sale del almacén.' },
  AJUSTE: { texto: 'Ajuste por conteo físico', clase: 'badge-info', ayuda: 'Escribe el stock real que contaste; el sistema calcula la diferencia.' },
};
const pie = (onCerrar, guardando, texto = 'Guardar') => (
  <><button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
    <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : texto}</button></>
);

function FormInsumo({ insumo, proveedores, onCerrar, onGuardado }) {
  const avisar = useAvisos();
  const editando = Boolean(insumo);
  const [form, setForm] = useState({
    nombre: insumo?.nombre ?? '', unidad: insumo?.unidad ?? 'kg', stockActual: '', stockMinimo: insumo?.stockMinimo ?? '',
    costoUnitario: insumo?.costoUnitario ?? '', proveedorId: insumo?.proveedorId ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async () => {
    setGuardando(true);
    try {
      const payload = {
        nombre: form.nombre, unidad: form.unidad, stockMinimo: Number(form.stockMinimo) || 0,
        costoUnitario: Number(form.costoUnitario) || 0, proveedorId: form.proveedorId ? Number(form.proveedorId) : null,
      };
      // El stock sólo se captura al dar de alta; después cambia únicamente con movimientos (kardex)
      if (editando) await insumosApi.actualizar(insumo.id, payload);
      else await insumosApi.crear({ ...payload, stockActual: Number(form.stockActual) || 0 });
      avisar.ok(editando ? 'Insumo actualizado' : 'Insumo dado de alta');
      onGuardado();
    } catch (err) { avisar.error(err); } finally { setGuardando(false); }
  };

  return (
    <Modal titulo={editando ? 'Editar insumo' : 'Nuevo insumo'} onCerrar={onCerrar} onSubmit={guardar} pie={pie(onCerrar, guardando)}>
      <div className="form-2">
        <label className="campo"><span>Nombre</span>
          <input name="nombre" value={form.nombre} onChange={cambiar} minLength={2} maxLength={120} required autoFocus /></label>
        <label className="campo"><span>Unidad</span>
          <input name="unidad" value={form.unidad} onChange={cambiar} maxLength={20} required list="unidades" />
          <datalist id="unidades"><option value="kg" /><option value="g" /><option value="lt" /><option value="ml" /><option value="pza" /><option value="paquete" /></datalist></label>
      </div>
      <div className="form-2">
        {!editando && (
          <label className="campo"><span>Stock inicial</span>
            <input name="stockActual" type="number" min="0" step="0.001" value={form.stockActual} onChange={cambiar} /></label>
        )}
        <label className="campo"><span>Stock mínimo (alerta)</span>
          <input name="stockMinimo" type="number" min="0" step="0.001" value={form.stockMinimo} onChange={cambiar} /></label>
        <label className="campo"><span>Costo por unidad (MXN)</span>
          <input name="costoUnitario" type="number" min="0" step="0.01" value={form.costoUnitario} onChange={cambiar} /></label>
      </div>
      <label className="campo"><span>Proveedor</span>
        <select name="proveedorId" value={form.proveedorId} onChange={cambiar}>
          <option value="">Sin proveedor</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select></label>
    </Modal>
  );
}

function FormMovimiento({ insumo, onCerrar, onGuardado }) {
  const avisar = useAvisos();
  const [form, setForm] = useState({ tipo: 'ENTRADA', cantidad: '', motivo: '' });
  const [guardando, setGuardando] = useState(false);
  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await insumosApi.registrarMovimiento(insumo.id, { tipo: form.tipo, cantidad: Number(form.cantidad), motivo: form.motivo });
      avisar.ok(`${insumo.nombre}: ahora hay ${cantidad(res.data.insumo.stockActual)} ${insumo.unidad}`);
      onGuardado();
    } catch (err) { avisar.error(err); } finally { setGuardando(false); }
  };

  return (
    <Modal titulo={`Movimiento · ${insumo.nombre}`} onCerrar={onCerrar} onSubmit={guardar} pie={pie(onCerrar, guardando, 'Registrar')}>
      <p className="muted">Stock actual: <b className="num">{cantidad(insumo.stockActual)} {insumo.unidad}</b></p>
      <label className="campo"><span>Tipo de movimiento</span>
        <select name="tipo" value={form.tipo} onChange={cambiar}>
          {Object.entries(TIPOS).map(([id, t]) => <option key={id} value={id}>{t.texto}</option>)}
        </select><small>{TIPOS[form.tipo].ayuda}</small></label>
      <label className="campo"><span>{form.tipo === 'AJUSTE' ? `Stock contado (${insumo.unidad})` : `Cantidad (${insumo.unidad})`}</span>
        <input name="cantidad" type="number" min={form.tipo === 'AJUSTE' ? '0' : '0.001'} step="0.001" value={form.cantidad} onChange={cambiar} required autoFocus /></label>
      <label className="campo"><span>Motivo <small>(opcional)</small></span>
        <input name="motivo" value={form.motivo} onChange={cambiar} maxLength={255} placeholder="Compra semanal, merma, conteo de cierre…" /></label>
    </Modal>
  );
}

function Kardex({ insumo, onCerrar }) {
  const { data, loading, error, recargar } = useFetch(() => insumosApi.movimientos(insumo.id, { limit: 50 }).then((r) => r.data));
  return (
    <Modal titulo={`Kardex · ${insumo.nombre}`} ancho="lg" onCerrar={onCerrar}>
      <EstadoVista loading={loading} error={error} vacio={!data?.length} onReintentar={recargar} skeleton={<SkeletonTabla filas={5} cols={5} />}
        tituloVacio="Sin movimientos" textoVacio="Las entradas, salidas y ajustes de este insumo aparecerán aquí.">
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Tipo</th><th className="der">Cantidad</th><th className="der">Stock final</th><th>Detalle</th></tr></thead>
            <tbody>
              {(data ?? []).map((m) => (
                <tr key={m.id}>
                  <td>{fechaHora(m.createdAt)}</td>
                  <td><span className={`badge ${TIPOS[m.tipo]?.clase}`}>{m.tipo}</span></td>
                  <td className="der num">{m.tipo === 'SALIDA' ? '−' : m.tipo === 'ENTRADA' ? '+' : '±'}{cantidad(m.cantidad)}</td>
                  <td className="der num">{cantidad(m.stockFinal)} {insumo.unidad}</td>
                  <td>{m.motivo ?? '—'}{m.comanda && ` · comanda #${m.comanda.folio}`}<small>{m.usuario?.nombre ?? 'Sistema'}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstadoVista>
    </Modal>
  );
}

function FormProveedor({ proveedor, onCerrar, onGuardado }) {
  const avisar = useAvisos();
  const editando = Boolean(proveedor);
  const [form, setForm] = useState({
    nombre: proveedor?.nombre ?? '', contacto: proveedor?.contacto ?? '', telefono: proveedor?.telefono ?? '', email: proveedor?.email ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async () => {
    setGuardando(true);
    try {
      if (editando) await proveedoresApi.actualizar(proveedor.id, form);
      else await proveedoresApi.crear(form);
      avisar.ok(editando ? 'Proveedor actualizado' : 'Proveedor agregado');
      onGuardado();
    } catch (err) { avisar.error(err); } finally { setGuardando(false); }
  };

  return (
    <Modal titulo={editando ? 'Editar proveedor' : 'Nuevo proveedor'} onCerrar={onCerrar} onSubmit={guardar} pie={pie(onCerrar, guardando)}>
      <label className="campo"><span>Nombre o razón social</span>
        <input name="nombre" value={form.nombre} onChange={cambiar} minLength={2} maxLength={120} required autoFocus /></label>
      <label className="campo"><span>Persona de contacto <small>(opcional)</small></span>
        <input name="contacto" value={form.contacto} onChange={cambiar} maxLength={100} /></label>
      <div className="form-2">
        <label className="campo"><span>Teléfono <small>(opcional)</small></span>
          <input name="telefono" type="tel" value={form.telefono} onChange={cambiar} pattern="[0-9+\-\s\(\)]{7,20}" title="De 7 a 20 dígitos" /></label>
        <label className="campo"><span>Correo <small>(opcional)</small></span>
          <input name="email" type="email" value={form.email} onChange={cambiar} maxLength={150} /></label>
      </div>
    </Modal>
  );
}

/** Inventario: insumos con kardex y proveedores. El COCINERO registra movimientos; el catálogo lo edita el ADMIN. */
export default function Inventario() {
  const { usuario } = useAuth();
  const avisar = useAvisos();
  const esAdmin = usuario.rol === 'ADMIN';
  const [tab, setTab] = useState('insumos');
  const [q, setQ] = useState('');
  const [soloBajo, setSoloBajo] = useState(false);
  const insumos = useFetch(
    () => insumosApi.listar({ limit: 100, ...(soloBajo && { stockBajo: true }) }).then((r) => r.data),
    { deps: [soloBajo] },
  );
  const proveedores = useFetch(() => proveedoresApi.listar().then((r) => r.data));
  const [modal, setModal] = useState(null); // { tipo, dato }
  const cerrar = () => setModal(null);
  const refrescar = () => { cerrar(); insumos.recargar(true); proveedores.recargar(true); };

  const borrarInsumo = async (i) => {
    if (!window.confirm(`¿Eliminar el insumo "${i.nombre}" y su historial?`)) return;
    try { await insumosApi.eliminar(i.id); avisar.ok('Insumo eliminado'); insumos.recargar(true); } catch (err) { avisar.error(err); }
  };
  const borrarProveedor = async (p) => {
    if (!window.confirm(`¿Eliminar al proveedor "${p.nombre}"? Sus insumos quedarán sin proveedor.`)) return;
    try { await proveedoresApi.eliminar(p.id); avisar.ok('Proveedor eliminado'); refrescar(); } catch (err) { avisar.error(err); }
  };

  const filtro = q.trim().toLowerCase();
  const lista = (insumos.data ?? []).filter((i) => !filtro || i.nombre.toLowerCase().includes(filtro));
  const valor = (insumos.data ?? []).reduce((s, i) => s + Number(i.stockActual) * Number(i.costoUnitario), 0);

  return (
    <div className="pagina">
      <header className="pagina-cab">
        <div>
          <h1>Inventario</h1>
          <p>El stock baja solo con cada comanda y sube con las compras que registres.</p>
        </div>
        <div className="pagina-acciones">
          <div className="segmentado" role="group" aria-label="Sección">
            <button aria-pressed={tab === 'insumos'} onClick={() => setTab('insumos')}>Insumos</button>
            <button aria-pressed={tab === 'proveedores'} onClick={() => setTab('proveedores')}>Proveedores</button>
          </div>
          {esAdmin && (
            <button className="btn btn-primary" onClick={() => setModal({ tipo: tab === 'insumos' ? 'insumo' : 'proveedor' })}>
              <Icono n="mas" /> {tab === 'insumos' ? 'Nuevo insumo' : 'Nuevo proveedor'}
            </button>
          )}
        </div>
      </header>

      {tab === 'insumos' ? (
        <>
          <div className="filtros">
            <input className="input" type="search" placeholder="Buscar insumo…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar insumo" />
            <button className="chip" aria-pressed={soloBajo} onClick={() => setSoloBajo(!soloBajo)}><Icono n="alerta" size={15} /> Sólo stock bajo</button>
            {!soloBajo && insumos.data && <span className="muted">Valor del inventario: <b className="num">{dinero(valor)}</b></span>}
          </div>
          <EstadoVista loading={insumos.loading} error={insumos.error} vacio={!lista.length} onReintentar={insumos.recargar}
            skeleton={<SkeletonTabla filas={6} cols={5} />} tituloVacio={soloBajo ? 'Todo en orden' : 'Aún no hay insumos'}
            textoVacio={soloBajo ? 'Ningún insumo está por debajo de su mínimo.' : 'Da de alta tus insumos para controlar el stock y armar recetas.'}>
            <div className="tabla-wrap">
              <table className="tabla">
                <thead><tr><th>Insumo</th><th className="der">Stock</th><th className="der">Mínimo</th><th className="der">Costo</th><th className="der">Acciones</th></tr></thead>
                <tbody>
                  {lista.map((i) => {
                    const bajo = Number(i.stockActual) <= Number(i.stockMinimo);
                    return (
                      <tr key={i.id}>
                        <td><b>{i.nombre}</b><small>{i.proveedor?.nombre ?? 'Sin proveedor'}</small></td>
                        <td className="der num"><span className={`badge ${bajo ? 'badge-warn' : 'badge-ok'}`}>{cantidad(i.stockActual)} {i.unidad}</span></td>
                        <td className="der num">{cantidad(i.stockMinimo)} {i.unidad}</td>
                        <td className="der num">{dinero(i.costoUnitario)}</td>
                        <td><div className="acciones">
                          <button className="btn btn-sm" onClick={() => setModal({ tipo: 'movimiento', dato: i })}><Icono n="movimiento" size={15} /> Movimiento</button>
                          <button className="btn btn-sm btn-icon" onClick={() => setModal({ tipo: 'kardex', dato: i })} aria-label={`Kardex de ${i.nombre}`} title="Kardex"><Icono n="historial" size={15} /></button>
                          {esAdmin && <>
                            <button className="btn btn-sm btn-icon" onClick={() => setModal({ tipo: 'insumo', dato: i })} aria-label={`Editar ${i.nombre}`}><Icono n="editar" size={15} /></button>
                            <button className="btn btn-sm btn-icon btn-danger" onClick={() => borrarInsumo(i)} aria-label={`Eliminar ${i.nombre}`}><Icono n="basura" size={15} /></button>
                          </>}
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </EstadoVista>
        </>
      ) : (
        <EstadoVista loading={proveedores.loading} error={proveedores.error} vacio={!proveedores.data?.length} onReintentar={proveedores.recargar}
          skeleton={<SkeletonTabla filas={4} cols={4} />} tituloVacio="Aún no hay proveedores" textoVacio="Registra a quién le compras para ligar cada insumo con su proveedor.">
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Proveedor</th><th>Teléfono</th><th>Correo</th><th className="der">Insumos</th>{esAdmin && <th className="der">Acciones</th>}</tr></thead>
              <tbody>
                {(proveedores.data ?? []).map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.nombre}</b><small>{p.contacto || 'Sin contacto'}</small></td>
                    <td>{p.telefono || '—'}</td>
                    <td>{p.email || '—'}</td>
                    <td className="der num">{p._count?.insumos ?? 0}</td>
                    {esAdmin && <td><div className="acciones">
                      <button className="btn btn-sm btn-icon" onClick={() => setModal({ tipo: 'proveedor', dato: p })} aria-label={`Editar ${p.nombre}`}><Icono n="editar" size={15} /></button>
                      <button className="btn btn-sm btn-icon btn-danger" onClick={() => borrarProveedor(p)} aria-label={`Eliminar ${p.nombre}`}><Icono n="basura" size={15} /></button>
                    </div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EstadoVista>
      )}

      {modal?.tipo === 'insumo' && <FormInsumo insumo={modal.dato} proveedores={proveedores.data ?? []} onCerrar={cerrar} onGuardado={refrescar} />}
      {modal?.tipo === 'movimiento' && <FormMovimiento insumo={modal.dato} onCerrar={cerrar} onGuardado={refrescar} />}
      {modal?.tipo === 'kardex' && <Kardex insumo={modal.dato} onCerrar={cerrar} />}
      {modal?.tipo === 'proveedor' && <FormProveedor proveedor={modal.dato} onCerrar={cerrar} onGuardado={refrescar} />}
    </div>
  );
}
