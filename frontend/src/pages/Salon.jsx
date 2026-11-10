import { useMemo, useState } from 'react';
import { mesasApi, platillosApi, comandasApi } from '../api/services';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useAvisos } from '../context/AvisosContext';
import { dinero } from '../utils/formato';
import EstadoVista from '../components/ui/EstadoVista';
import ComandaCard from '../components/ui/ComandaCard';
import Modal from '../components/ui/Modal';
import Icono from '../components/ui/Icono';
import { Skeleton, SkeletonComandas } from '../components/skeletons/Skeleton';

const ESTADO_MESA = { LIBRE: ['badge-ok', 'Libre'], OCUPADA: ['badge-warn', 'Ocupada'], INACTIVA: ['badge-neutral', 'Inactiva'] };

/** Toma de pedido: menú por categoría a la izquierda, cuenta a la derecha. */
function TomarPedido({ mesa, onCerrar, onCreada }) {
  const avisar = useAvisos();
  const { data, loading, error, recargar } = useFetch(() =>
    platillosApi.listar({ disponible: true, limit: 100 }).then((r) => r.data));
  const [busqueda, setBusqueda] = useState('');
  const [items, setItems] = useState({}); // platilloId → { platillo, cantidad, notas }
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);

  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const mapa = new Map();
    for (const p of data ?? []) {
      if (q && !p.nombre.toLowerCase().includes(q)) continue;
      const cat = p.categoria?.nombre ?? 'Sin categoría';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat).push(p);
    }
    return [...mapa.entries()];
  }, [data, busqueda]);

  const sumar = (p, delta) => setItems((prev) => {
    const actual = prev[p.id] ?? { platillo: p, cantidad: 0, notas: '' };
    const cant = actual.cantidad + delta;
    const sig = { ...prev };
    if (cant <= 0) delete sig[p.id]; else sig[p.id] = { ...actual, cantidad: Math.min(cant, 100) };
    return sig;
  });
  const anotar = (id, texto) => setItems((prev) => ({ ...prev, [id]: { ...prev[id], notas: texto } }));

  const lineas = Object.values(items);
  const total = lineas.reduce((s, l) => s + Number(l.platillo.precio) * l.cantidad, 0);

  const enviar = async () => {
    setEnviando(true);
    try {
      const res = await comandasApi.crear({
        mesaId: mesa.id,
        notas,
        items: lineas.map((l) => ({ platilloId: l.platillo.id, cantidad: l.cantidad, notas: l.notas })),
      });
      avisar.ok(`Comanda #${res.data.folio} enviada a cocina`);
      onCreada();
    } catch (err) {
      avisar.error(err); // p. ej. "Stock insuficiente de …"
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo={`Nuevo pedido · Mesa ${mesa.numero}`} ancho="lg" onCerrar={onCerrar}
      pie={<>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!lineas.length || enviando} onClick={enviar}>
          {enviando ? 'Enviando…' : 'Enviar a cocina'}
        </button>
      </>}>
      <div className="pedido">
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <input className="input" type="search" placeholder="Buscar platillo…" value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar platillo" />
          <EstadoVista loading={loading} error={error} vacio={!grupos.length} onReintentar={recargar}
            skeleton={<Skeleton h={180} />} tituloVacio="Sin platillos disponibles"
            textoVacio="Da de alta platillos en Menú y recetas para poder tomar pedidos.">
            <div className="pedido-menu">
              {grupos.map(([cat, platos]) => (
                <section key={cat} style={{ display: 'grid', gap: 8 }}>
                  <h3>{cat}</h3>
                  <div className="platos">
                    {platos.map((p) => (
                      <button key={p.id} className="plato" onClick={() => sumar(p, 1)}>
                        <b>{p.nombre}</b><span className="num">{dinero(p.precio)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </EstadoVista>
        </div>

        <aside className="carrito">
          <h3>Cuenta</h3>
          {!lineas.length && <p className="muted">Toca un platillo para agregarlo.</p>}
          {lineas.map((l) => (
            <div key={l.platillo.id} className="carrito-item">
              <div>
                <b>{l.platillo.nombre}</b>
                <small className="num"> · {dinero(Number(l.platillo.precio) * l.cantidad)}</small>
              </div>
              <span className="cantidad">
                <button onClick={() => sumar(l.platillo, -1)} aria-label={`Quitar uno de ${l.platillo.nombre}`}>−</button>
                <b className="num">{l.cantidad}</b>
                <button onClick={() => sumar(l.platillo, 1)} aria-label={`Agregar uno de ${l.platillo.nombre}`}>+</button>
              </span>
              <input className="input" style={{ gridColumn: '1 / -1', minHeight: 34 }} placeholder="Nota (sin cebolla…)"
                value={l.notas} maxLength={255} onChange={(e) => anotar(l.platillo.id, e.target.value)} />
            </div>
          ))}
          <label className="campo">
            <span>Nota general</span>
            <textarea value={notas} maxLength={500} onChange={(e) => setNotas(e.target.value)} />
          </label>
          <div className="total"><span>Total</span><span className="num">{dinero(total)}</span></div>
        </aside>
      </div>
    </Modal>
  );
}

function NuevaMesa({ siguiente, onCerrar, onGuardada }) {
  const avisar = useAvisos();
  const [form, setForm] = useState({ numero: siguiente, capacidad: 4 });
  const guardar = async () => {
    try {
      await mesasApi.crear({ numero: Number(form.numero), capacidad: Number(form.capacidad) });
      avisar.ok(`Mesa ${form.numero} creada`);
      onGuardada();
    } catch (err) { avisar.error(err); }
  };
  return (
    <Modal titulo="Agregar mesa" onCerrar={onCerrar} onSubmit={guardar}
      pie={<><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button className="btn btn-primary">Guardar</button></>}>
      <div className="form-2">
        <label className="campo"><span>Número</span>
          <input type="number" min="1" max="9999" required value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></label>
        <label className="campo"><span>Capacidad (personas)</span>
          <input type="number" min="1" max="50" required value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: e.target.value })} /></label>
      </div>
    </Modal>
  );
}

/** Salón: estado de las mesas, toma de pedidos y seguimiento de comandas abiertas. */
export default function Salon() {
  const { usuario } = useAuth();
  const avisar = useAvisos();
  const esAdmin = usuario.rol === 'ADMIN';
  const mesas = useFetch(() => mesasApi.listar().then((r) => r.data), { intervalo: 15000 });
  const comandas = useFetch(
    () => comandasApi.listar({ estado: 'PENDIENTE,EN_PREPARACION,ENTREGADO', limit: 50 }).then((r) => r.data),
    { intervalo: 10000 },
  );
  const [mesaPedido, setMesaPedido] = useState(null);
  const [nuevaMesa, setNuevaMesa] = useState(false);
  const [enCurso, setEnCurso] = useState(null);

  const refrescar = () => { mesas.recargar(true); comandas.recargar(true); };

  const cambiar = async (c, estado) => {
    if (estado === 'CANCELADO' && !window.confirm(`¿Cancelar la comanda #${c.folio}? Los insumos regresan al inventario.`)) return;
    setEnCurso(c.id);
    try {
      await comandasApi.cambiarEstado(c.id, estado);
      avisar.ok(estado === 'CANCELADO' ? `Comanda #${c.folio} cancelada` : `Comanda #${c.folio} entregada`);
      refrescar();
    } catch (err) { avisar.error(err); } finally { setEnCurso(null); }
  };

  const lista = mesas.data ?? [];
  const libres = lista.filter((m) => m.estado === 'LIBRE').length;
  const abiertas = comandas.data ?? [];

  return (
    <div className="pagina">
      <header className="pagina-cab">
        <div>
          <h1>Salón</h1>
          <p>{lista.length ? `${libres} de ${lista.length} mesas libres. Toca una mesa para tomar el pedido.` : 'Estado de las mesas y pedidos abiertos.'}</p>
        </div>
        {esAdmin && (
          <button className="btn btn-primary" onClick={() => setNuevaMesa(true)}><Icono n="mas" /> Agregar mesa</button>
        )}
      </header>

      <EstadoVista loading={mesas.loading} error={mesas.error} vacio={!lista.length} onReintentar={mesas.recargar}
        skeleton={<div className="mesas">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} h={104} />)}</div>}
        tituloVacio="Aún no hay mesas" textoVacio={esAdmin ? 'Agrega tu primera mesa para empezar a tomar pedidos.' : 'Pide a tu administrador que dé de alta las mesas.'}>
        <div className="mesas">
          {lista.map((m) => {
            const [clase, texto] = ESTADO_MESA[m.estado] ?? ['badge-neutral', m.estado];
            const n = m._count?.comandas || 0;
            return (
              <button key={m.id} className="mesa" data-estado={m.estado} disabled={m.estado === 'INACTIVA'} onClick={() => setMesaPedido(m)}>
                <small>Mesa</small>
                <b>{m.numero}</b>
                <span><span className={`badge ${clase}`}>{texto}</span></span>
                <small>{m.capacidad} personas{n ? ` · ${n} ${n === 1 ? 'comanda' : 'comandas'}` : ''}</small>
              </button>
            );
          })}
        </div>
      </EstadoVista>

      <section>
        <div className="seccion-cab"><h2>Comandas abiertas {abiertas.length ? `(${abiertas.length})` : ''}</h2></div>
        <EstadoVista loading={comandas.loading} error={comandas.error} vacio={!abiertas.length} onReintentar={comandas.recargar}
          skeleton={<SkeletonComandas n={3} />} tituloVacio="Sin comandas abiertas" textoVacio="Los pedidos que envíes a cocina aparecerán aquí.">
          <div className="tablero">
            {abiertas.map((c) => (
              <ComandaCard key={c.id} comanda={c} mostrarTotal cargando={enCurso === c.id}
                accion={c.estado === 'EN_PREPARACION' ? 'Marcar entregada' : undefined}
                onAccion={(x) => cambiar(x, 'ENTREGADO')}
                secundaria={c.estado === 'PENDIENTE' ? 'Cancelar' : undefined}
                onSecundaria={(x) => cambiar(x, 'CANCELADO')} />
            ))}
          </div>
        </EstadoVista>
      </section>

      {mesaPedido && (
        <TomarPedido mesa={mesaPedido} onCerrar={() => setMesaPedido(null)}
          onCreada={() => { setMesaPedido(null); refrescar(); }} />
      )}
      {nuevaMesa && (
        <NuevaMesa siguiente={Math.max(0, ...lista.map((m) => m.numero)) + 1} onCerrar={() => setNuevaMesa(false)}
          onGuardada={() => { setNuevaMesa(false); mesas.recargar(true); }} />
      )}
    </div>
  );
}
