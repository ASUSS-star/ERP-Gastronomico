import { useState } from 'react';
import { usuariosApi } from '../api/services';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useAvisos } from '../context/AvisosContext';
import { ROLES } from '../utils/formato';
import EstadoVista from '../components/ui/EstadoVista';
import Modal from '../components/ui/Modal';
import Icono from '../components/ui/Icono';
import { SkeletonTabla } from '../components/skeletons/Skeleton';

function FormUsuario({ usuario, onCerrar, onGuardado }) {
  const avisar = useAvisos();
  const editando = Boolean(usuario);
  const [form, setForm] = useState({ nombre: usuario?.nombre ?? '', email: usuario?.email ?? '', rol: usuario?.rol ?? 'MESERO', password: '' });
  const [guardando, setGuardando] = useState(false);
  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async () => {
    setGuardando(true);
    try {
      const payload = { nombre: form.nombre, email: form.email, rol: form.rol, ...(form.password && { password: form.password }) };
      if (editando) await usuariosApi.actualizar(usuario.id, payload);
      else await usuariosApi.crear(payload);
      avisar.ok(editando ? 'Usuario actualizado' : `${form.nombre} ya puede iniciar sesión`);
      onGuardado();
    } catch (err) { avisar.error(err); } finally { setGuardando(false); }
  };

  return (
    <Modal titulo={editando ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={onCerrar} onSubmit={guardar}
      pie={<><button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button></>}>
      <label className="campo"><span>Nombre completo</span>
        <input name="nombre" value={form.nombre} onChange={cambiar} minLength={2} maxLength={100} required autoFocus /></label>
      <label className="campo"><span>Correo (con él inicia sesión)</span>
        <input name="email" type="email" value={form.email} onChange={cambiar} maxLength={150} required /></label>
      <div className="form-2">
        <label className="campo"><span>Puesto</span>
          <select name="rol" value={form.rol} onChange={cambiar}>
            {Object.entries(ROLES).map(([id, r]) => <option key={id} value={id}>{r.texto}</option>)}
          </select></label>
        <label className="campo"><span>{editando ? 'Nueva contraseña' : 'Contraseña inicial'}</span>
          <input name="password" type="password" autoComplete="new-password" value={form.password} onChange={cambiar}
            minLength={8} maxLength={72} pattern="(?=.*[A-Za-z])(?=.*\d).+" required={!editando}
            placeholder={editando ? 'Dejar vacío para no cambiarla' : ''} title="Mínimo 8 caracteres, con al menos una letra y un número" /></label>
      </div>
      <small className="muted">La contraseña necesita mínimo 8 caracteres, con al menos una letra y un número. Compártela en persona con el empleado.</small>
    </Modal>
  );
}

/** Personal: alta, edición y baja lógica de meseros, cocineros, cajeros y administradores. */
export default function Personal() {
  const { usuario: yo } = useAuth();
  const avisar = useAvisos();
  const [q, setQ] = useState('');
  const { data, loading, error, recargar } = useFetch(() => usuariosApi.listar({ limit: 100 }).then((r) => r.data));
  const [form, setForm] = useState(null); // null | {} (nuevo) | usuario (editar)

  const alternar = async (u) => {
    if (u.activo && !window.confirm(`¿Dar de baja a ${u.nombre}? Ya no podrá iniciar sesión.`)) return;
    try {
      if (u.activo) await usuariosApi.eliminar(u.id);
      else await usuariosApi.actualizar(u.id, { activo: true });
      avisar.ok(u.activo ? `${u.nombre} dado de baja` : `${u.nombre} reactivado`);
      recargar(true);
    } catch (err) { avisar.error(err); }
  };

  const filtro = q.trim().toLowerCase();
  const lista = (data ?? []).filter((u) => !filtro || u.nombre.toLowerCase().includes(filtro) || u.email.toLowerCase().includes(filtro));

  return (
    <div className="pagina">
      <header className="pagina-cab">
        <div><h1>Personal</h1><p>Cada empleado entra con su propio correo y sólo ve lo que le toca a su puesto.</p></div>
        <button className="btn btn-primary" onClick={() => setForm({})}><Icono n="mas" /> Nuevo usuario</button>
      </header>

      <div className="filtros">
        <input className="input" type="search" placeholder="Buscar por nombre o correo…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar personal" />
      </div>

      <EstadoVista loading={loading} error={error} vacio={!lista.length} skeleton={<SkeletonTabla filas={5} cols={4} />} onReintentar={recargar}
        tituloVacio="Sin resultados" textoVacio="No hay usuarios que coincidan con la búsqueda.">
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Nombre</th><th>Puesto</th><th>Estado</th><th className="der">Acciones</th></tr></thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id} className={u.activo ? '' : 'fila-inactiva'}>
                  <td><b>{u.nombre}</b>{u.id === yo.id && <span className="muted"> (tú)</span>}<small>{u.email}</small></td>
                  <td><span className={`badge ${ROLES[u.rol]?.clase}`}>{ROLES[u.rol]?.texto ?? u.rol}</span></td>
                  <td><span className={`badge ${u.activo ? 'badge-ok' : 'badge-neutral'}`}>{u.activo ? 'Activo' : 'Baja'}</span></td>
                  <td><div className="acciones">
                    <button className="btn btn-sm" onClick={() => setForm(u)}><Icono n="editar" size={15} /> Editar</button>
                    {u.id !== yo.id && (
                      <button className={`btn btn-sm ${u.activo ? 'btn-danger' : ''}`} onClick={() => alternar(u)}>
                        {u.activo ? 'Dar de baja' : 'Reactivar'}
                      </button>
                    )}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstadoVista>

      {form && (
        <FormUsuario usuario={form.id ? form : null} onCerrar={() => setForm(null)}
          onGuardado={() => { setForm(null); recargar(true); }} />
      )}
    </div>
  );
}
