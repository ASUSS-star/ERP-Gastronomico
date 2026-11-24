import { useEffect, useState } from 'react';
import { comandasApi } from '../api/services';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useAvisos } from '../context/AvisosContext';
import { dinero } from '../utils/formato';
import { imprimirTicket, leerAjustes, guardarAjustes, ultimoTicket, ticketPrueba, abrirCajon } from '../impresion/ticket';
import { soportaUsb, conectarImpresora, nombreImpresora, olvidarImpresora } from '../impresion/usb';
import EstadoVista from '../components/ui/EstadoVista';
import CorteCaja from '../components/CorteCaja';
import Modal from '../components/ui/Modal';
import Icono from '../components/ui/Icono';
import { SkeletonComandas } from '../components/skeletons/Skeleton';

const METODOS = [['EFECTIVO', 'Efectivo'], ['TARJETA', 'Tarjeta'], ['TRANSFERENCIA', 'Transfer.']];
const MODOS = [['uno', 'Un solo pago'], ['partes', 'Partes iguales'], ['platillos', 'Por platillos']];

// Todo el cálculo de dinero se hace en centavos enteros para no arrastrar errores de redondeo
const cent = (v) => Math.round((Number(v) || 0) * 100);
const pesos = (c) => (c / 100).toFixed(2);
let sec = 0;
const linea = (montoC, metodo = 'EFECTIVO') => ({ key: (sec += 1), metodo, monto: pesos(montoC), recibido: '' });

/** Reparte `totalC` centavos en `n` partes; los centavos sobrantes van a las primeras. */
const repartir = (totalC, n) => {
  const base = Math.floor(totalC / n);
  return Array.from({ length: n }, (_, i) => base + (i < totalC - base * n ? 1 : 0));
};

const pagadoDe = (c) => (c.pagos ?? []).reduce((s, p) => s + cent(p.monto), 0);

function Cobro({ comanda, onCerrar, onCobrado }) {
  const avisar = useAvisos();
  const saldoC = cent(comanda.total) - pagadoDe(comanda);
  const [modo, setModo] = useState('uno');
  const [partes, setPartes] = useState(2);
  const [lineas, setLineas] = useState(() => [linea(saldoC)]);
  const [seleccion, setSeleccion] = useState([]);
  const [asignados, setAsignados] = useState([]);
  const [enviando, setEnviando] = useState(false);

  const cambiarModo = (m) => {
    setModo(m);
    setSeleccion([]);
    setAsignados([]);
    if (m === 'uno') setLineas([linea(saldoC)]);
    if (m === 'partes') setLineas(repartir(saldoC, partes).map((c) => linea(c)));
    if (m === 'platillos') setLineas([]);
  };
  const cambiarPartes = (n) => {
    const v = Math.min(20, Math.max(2, Number(n) || 2));
    setPartes(v);
    setLineas(repartir(saldoC, v).map((c) => linea(c)));
  };
  const editar = (key, cambios) => setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, ...cambios } : l)));
  const quitar = (key) => setLineas((ls) => ls.filter((l) => l.key !== key));

  const asignadoC = lineas.reduce((s, l) => s + cent(l.monto), 0);
  const faltaC = saldoC - asignadoC;
  const seleccionC = (comanda.detalles ?? []).filter((d) => seleccion.includes(d.id)).reduce((s, d) => s + cent(d.subtotal), 0);

  const agregarSeleccion = () => {
    const montoC = Math.min(seleccionC, faltaC);
    if (montoC <= 0) return;
    setLineas((ls) => [...ls, linea(montoC)]);
    setAsignados((a) => [...a, ...seleccion]);
    setSeleccion([]);
  };

  const errores = [];
  if (!lineas.length) errores.push('Agrega al menos un pago');
  if (lineas.some((l) => cent(l.monto) <= 0)) errores.push('Cada pago debe ser mayor a $0');
  if (faltaC < 0) errores.push(`Los pagos suman ${dinero(-faltaC / 100)} más que el saldo`);
  if (lineas.some((l) => l.metodo === 'EFECTIVO' && l.recibido !== '' && cent(l.recibido) < cent(l.monto))) {
    errores.push('El efectivo recibido no alcanza para el monto');
  }

  const cobrar = async () => {
    setEnviando(true);
    const pagos = lineas.map((l) => ({
      metodo: l.metodo,
      monto: Number(pesos(cent(l.monto))),
      ...(l.metodo === 'EFECTIVO' && l.recibido !== '' && { recibido: Number(pesos(cent(l.recibido))) }),
    }));
    try {
      const res = await comandasApi.pagar(comanda.id, pagos, `Cobro mesa ${comanda.mesa?.numero} (#${comanda.folio}) · ${dinero(asignadoC / 100)}`);
      if (res.pendiente) {
        // Sin internet: armamos el resultado localmente para el ticket; el cobro se envía al reconectar
        const locales = pagos.map((p, i) => ({
          id: `local-${i}`, ...p, cambio: p.recibido != null ? Number(pesos(cent(p.recibido) - cent(p.monto))) : null,
        }));
        onCobrado({ ...comanda, pagos: [...(comanda.pagos ?? []), ...locales], pagadoAt: new Date().toISOString() }, true, locales);
      } else {
        onCobrado(res.data, false);
      }
    } catch (err) {
      avisar.error(err);
      setEnviando(false);
    }
  };

  return (
    <Modal titulo={`Cobrar mesa ${comanda.mesa?.numero} · #${comanda.folio}`} ancho="lg" onCerrar={onCerrar} onSubmit={cobrar}
      pie={<>
        <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-primary" disabled={enviando || errores.length > 0}>
          {enviando ? 'Cobrando…' : faltaC > 0 ? `Cobrar ${dinero(asignadoC / 100)} (parcial)` : `Cobrar ${dinero(asignadoC / 100)}`}
        </button>
      </>}>
      <div className="saldos">
        <div><small>Total</small><b>{dinero(comanda.total)}</b></div>
        <div><small>Ya pagado</small><b>{dinero(pagadoDe(comanda) / 100)}</b></div>
        <div><small>Saldo</small><b>{dinero(saldoC / 100)}</b></div>
      </div>

      <div className="segmentado" role="group" aria-label="Forma de cobro">
        {MODOS.map(([id, texto]) => (
          <button type="button" key={id} aria-pressed={modo === id} onClick={() => cambiarModo(id)}>{texto}</button>
        ))}
      </div>

      {modo === 'partes' && (
        <label className="campo" style={{ maxWidth: 220 }}>
          <span>¿Entre cuántas personas?</span>
          <input type="number" min="2" max="20" value={partes} onChange={(e) => cambiarPartes(e.target.value)} />
        </label>
      )}

      {modo === 'platillos' && (
        <section className="card" style={{ padding: 12 }}>
          <p className="muted" style={{ marginBottom: 8 }}>Marca lo que paga cada persona y agrégalo como un pago.</p>
          <ul className="platillos-cuenta">
            {(comanda.detalles ?? []).map((d) => (
              <li key={d.id}>
                <label style={asignados.includes(d.id) ? { opacity: 0.45 } : undefined}>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="checkbox" disabled={asignados.includes(d.id)} checked={seleccion.includes(d.id)}
                      onChange={(e) => setSeleccion((s) => (e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id)))} />
                    {d.cantidad}× {d.platillo?.nombre}
                  </span>
                  <span className="num">{dinero(d.subtotal)}</span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} disabled={!seleccion.length || faltaC <= 0} onClick={agregarSeleccion}>
            <Icono n="mas" size={15} /> Agregar pago con lo marcado ({dinero(Math.min(seleccionC, Math.max(faltaC, 0)) / 100)})
          </button>
        </section>
      )}

      {lineas.map((l, i) => {
        const cambioC = l.metodo === 'EFECTIVO' && l.recibido !== '' ? cent(l.recibido) - cent(l.monto) : null;
        return (
          <div key={l.key} className="linea-pago">
            <div className="metodos" role="group" aria-label={`Método del pago ${i + 1}`}>
              {METODOS.map(([id, texto]) => (
                <button type="button" key={id} className="btn" aria-pressed={l.metodo === id}
                  onClick={() => editar(l.key, { metodo: id, ...(id !== 'EFECTIVO' && { recibido: '' }) })}>{texto}</button>
              ))}
            </div>
            <span style={{ fontWeight: 700 }}>Pago {i + 1}</span>
            <label className="campo"><span>Monto</span>
              <input type="number" min="0.01" step="0.01" required value={l.monto} onChange={(e) => editar(l.key, { monto: e.target.value })} /></label>
            {l.metodo === 'EFECTIVO' ? (
              <label className="campo"><span>Recibe</span>
                <input type="number" min="0" step="0.01" value={l.recibido} placeholder={l.monto}
                  onChange={(e) => editar(l.key, { recibido: e.target.value })} /></label>
            ) : <span />}
            <button type="button" className="btn btn-icon btn-danger" aria-label={`Quitar pago ${i + 1}`} onClick={() => quitar(l.key)}>
              <Icono n="basura" size={16} />
            </button>
            {cambioC != null && cambioC >= 0 && <span className="cambio badge badge-ok num" style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>Cambio: {dinero(cambioC / 100)}</span>}
          </div>
        );
      })}

      {modo !== 'platillos' && (
        <button type="button" className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => setLineas((ls) => [...ls, linea(Math.max(faltaC, 0))])}>
          <Icono n="mas" size={15} /> Agregar otro pago
        </button>
      )}

      {errores.length > 0 && <p className="alerta alerta-err">{errores[0]}</p>}
      {!errores.length && faltaC > 0 && (
        <p className="alerta badge-warn">Quedará un saldo de {dinero(faltaC / 100)}: la cuenta seguirá abierta para cobrar el resto después.</p>
      )}
    </Modal>
  );
}

function Impresora({ restaurante, onCerrar }) {
  const avisar = useAvisos();
  const [a, setA] = useState(leerAjustes);
  const [usb, setUsb] = useState(null); // nombre de la impresora USB autorizada
  const cambiar = (e) => setA({ ...a, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const ajustes = { ...a, papel: Number(a.papel), copias: Number(a.copias) };

  useEffect(() => { nombreImpresora().then(setUsb).catch(() => {}); }, []);

  const conectar = async () => {
    try {
      setUsb(await conectarImpresora());
      setA((x) => ({ ...x, modo: 'usb' }));
      avisar.ok('Impresora USB conectada');
    } catch (e) {
      if (e.name !== 'NotFoundError') avisar.error(e.message); // NotFoundError = cerraron el selector
    }
  };
  const probar = () => imprimirTicket(ticketPrueba(restaurante), ajustes).catch((e) => avisar.error(e.message));
  const cajon = () => abrirCajon(ajustes).catch((e) => avisar.error(e.message));
  const guardar = () => {
    guardarAjustes(ajustes);
    avisar.ok('Ajustes de impresión guardados en este equipo');
    onCerrar();
  };

  return (
    <Modal titulo="Impresora de tickets" onCerrar={onCerrar} onSubmit={guardar}
      pie={<>
        {a.modo === 'usb' && a.cajon && <button type="button" className="btn" onClick={cajon}>Abrir cajón</button>}
        <button type="button" className="btn" onClick={probar}><Icono n="ticket" size={16} /> Imprimir prueba</button>
        <button className="btn btn-primary">Guardar</button>
      </>}>
      <p className="muted">Estos ajustes se guardan sólo en esta computadora.</p>

      <div className="segmentado" role="group" aria-label="Forma de imprimir">
        <button type="button" aria-pressed={a.modo === 'usb'} onClick={() => setA({ ...a, modo: 'usb' })}>USB directo (recomendado)</button>
        <button type="button" aria-pressed={a.modo !== 'usb'} onClick={() => setA({ ...a, modo: 'navegador' })}>Impresora de Windows</button>
      </div>

      {a.modo === 'usb' ? (
        <section className="card" style={{ display: 'grid', gap: 10, padding: 14 }}>
          {!soportaUsb() ? (
            <p className="alerta alerta-err">Este navegador no permite USB directo. Abre el sistema en Chrome o Edge en computadora.</p>
          ) : (
            <>
              <p>{usb ? <>Conectada: <b>{usb}</b></> : 'Ninguna impresora USB conectada todavía.'}</p>
              <div className="pagina-acciones">
                <button type="button" className="btn btn-primary" onClick={conectar}><Icono n="mas" size={16} /> {usb ? 'Cambiar impresora' : 'Conectar impresora USB'}</button>
                {usb && <button type="button" className="btn btn-danger" onClick={() => olvidarImpresora().then(() => setUsb(null))}>Olvidar</button>}
              </div>
              <small className="muted">Imprime al instante, sin diálogo. En Windows la impresora necesita el controlador WinUSB (se instala una vez con Zadig).</small>
            </>
          )}
          <label className="check"><input type="checkbox" name="cortar" checked={a.cortar} onChange={cambiar} /> Cortar el papel al terminar (si tu impresora tiene cortador)</label>
          <label className="check"><input type="checkbox" name="cajon" checked={a.cajon} onChange={cambiar} /> Abrir el cajón de dinero al cobrar</label>
          <label className="check"><input type="checkbox" name="acentos" checked={a.acentos} onChange={cambiar} /> Imprimir acentos y ñ (desmárcalo si salen símbolos raros)</label>
        </section>
      ) : (
        <small className="muted">Usa la impresora predeterminada de Windows con el diálogo de impresión: elige la impresora térmica, márgenes “Ninguno” y sin encabezados ni pies de página.</small>
      )}

      <label className="check"><input type="checkbox" name="auto" checked={a.auto} onChange={cambiar} /> Imprimir el ticket automáticamente al cobrar</label>
      <div className="form-2">
        <label className="campo"><span>Ancho del papel</span>
          <select name="papel" value={a.papel} onChange={cambiar}>
            <option value={58}>58 mm (EC-5890X)</option>
            <option value={80}>80 mm</option>
          </select></label>
        <label className="campo"><span>Copias</span>
          <select name="copias" value={a.copias} onChange={cambiar}>
            <option value={1}>1</option><option value={2}>2 (cliente y negocio)</option><option value={3}>3</option>
          </select></label>
      </div>
      <label className="campo"><span>Mensaje al pie</span>
        <input name="pie" value={a.pie} maxLength={80} onChange={cambiar} /></label>
      <label className="check"><input type="checkbox" name="fiscal" checked={a.fiscal} onChange={cambiar} /> Leyenda “no es comprobante fiscal”</label>
    </Modal>
  );
}

/** Caja: cobra las comandas ENTREGADAS (completas, divididas o con varios métodos) e imprime el ticket. */
export default function Caja() {
  const { usuario } = useAuth();
  const avisar = useAvisos();
  const { data, loading, error, recargar } = useFetch(
    () => comandasApi.listar({ estado: 'ENTREGADO', limit: 50 }).then((r) => r.data),
    { intervalo: 10000, escuchar: ['comandas'] },
  );
  const [cobrando, setCobrando] = useState(null);
  const [impresora, setImpresora] = useState(false);
  const [corte, setCorte] = useState(false);
  // Cobros hechos sin internet (aún sin confirmar por el servidor): id → { base, pagos }
  const [local, setLocal] = useState({});

  useEffect(() => {
    if (!data) return;
    setLocal((l) => Object.fromEntries(Object.entries(l).filter(([id, v]) => {
      const c = data.find((x) => x.id === Number(id));
      return c && (c.pagos?.length ?? 0) <= v.base; // el servidor aún no lo registra
    })));
  }, [data]);

  const restaurante = usuario.restaurante;
  const lista = (data ?? [])
    .map((c) => (local[c.id] ? { ...c, pagos: [...(c.pagos ?? []), ...local[c.id].pagos] } : c))
    .filter((c) => pagadoDe(c) < cent(c.total));
  const porCobrar = lista.reduce((s, c) => s + cent(c.total) - pagadoDe(c), 0);

  const cobrado = (resultado, pendiente, locales) => {
    const original = lista.find((c) => c.id === resultado.id);
    setCobrando(null);
    if (pendiente) {
      setLocal((l) => ({ ...l, [resultado.id]: { base: (data.find((c) => c.id === resultado.id)?.pagos?.length ?? 0), pagos: [...(l[resultado.id]?.pagos ?? []), ...locales] } }));
      avisar.ok('Sin internet: cobro guardado; se enviará al reconectar');
    } else {
      const saldo = cent(resultado.total) - pagadoDe(resultado);
      avisar.ok(saldo > 0 ? `Pago parcial registrado. Saldo: ${dinero(saldo / 100)}` : `Mesa ${resultado.mesa?.numero} cobrada`);
      recargar(true);
    }
    if (leerAjustes().auto) {
      imprimirTicket({ restaurante, comanda: { ...original, ...resultado }, cajero: usuario.nombre, tipo: 'pago' })
        .catch((e) => avisar.error(`No se imprimió el ticket: ${e.message}`));
    }
  };

  const reimprimir = () => {
    const t = ultimoTicket();
    if (t) imprimirTicket(t).catch((e) => avisar.error(e.message)); else avisar.error('Aún no hay tickets impresos en este equipo');
  };

  return (
    <>
      <div className="seccion-cab">
        <p className="muted">
          {lista.length} {lista.length === 1 ? 'cuenta' : 'cuentas'} por cobrar · <b className="num">{dinero(porCobrar / 100)}</b>
        </p>
        <div className="pagina-acciones">
          <button className="btn btn-primary" onClick={() => setCorte(true)}><Icono n="caja" /> Corte de caja</button>
          <button className="btn" onClick={reimprimir}><Icono n="ticket" /> Reimprimir último</button>
          <button className="btn" onClick={() => setImpresora(true)}><Icono n="editar" /> Impresora</button>
        </div>
      </div>

      <EstadoVista loading={loading} error={error} vacio={!lista.length} skeleton={<SkeletonComandas n={3} />} onReintentar={recargar}
        tituloVacio="Nada por cobrar" textoVacio="Las comandas entregadas aparecerán aquí al instante.">
        <div className="cuentas">
          {lista.map((c) => {
            const pagadoC = pagadoDe(c);
            return (
              <article key={c.id} className="card cuenta">
                <header className="cuenta-cab">
                  <strong style={{ fontSize: '1.2em' }}>Mesa {c.mesa?.numero}</strong>
                  <span className="muted">#{c.folio} · {c.mesero?.nombre}</span>
                </header>
                <ul className="cuenta-lineas">
                  {c.detalles?.map((d) => (
                    <li key={d.id}><span>{d.cantidad}× {d.platillo?.nombre}</span><span className="num">{dinero(d.subtotal)}</span></li>
                  ))}
                </ul>
                <div className="total"><span>Total</span><span className="num">{dinero(c.total)}</span></div>
                {pagadoC > 0 && (
                  <ul className="cuenta-lineas">
                    <li><span className="muted">Pagado ({c.pagos.length})</span><span className="num">{dinero(pagadoC / 100)}</span></li>
                    <li><b>Saldo</b><b className="num">{dinero((cent(c.total) - pagadoC) / 100)}</b></li>
                  </ul>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" title="Imprimir la cuenta para llevarla a la mesa"
                    onClick={() => imprimirTicket({ restaurante, comanda: c, tipo: 'cuenta' }).catch((e) => avisar.error(e.message))}>
                    <Icono n="ticket" /> Cuenta
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setCobrando(c)}>
                    <Icono n="caja" /> Cobrar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </EstadoVista>

      {cobrando && <Cobro comanda={cobrando} onCerrar={() => setCobrando(null)} onCobrado={cobrado} />}
      {corte && <CorteCaja onCerrar={() => setCorte(false)} />}
      {impresora && <Impresora restaurante={restaurante} onCerrar={() => setImpresora(false)} />}
    </>
  );
}
