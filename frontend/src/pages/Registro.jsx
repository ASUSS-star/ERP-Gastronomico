import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { textoError } from '../utils/formato';
import Acceso from '../components/ui/Acceso';

const INICIAL = { restNombre: '', telefono: '', direccion: '', nombre: '', email: '', password: '', confirmar: '' };

/** Alta de un restaurante nuevo (POST /auth/registro): crea el negocio y su usuario ADMIN. */
export default function Registro() {
  const { usuario, registrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(INICIAL);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmar) return setError('Las contraseñas no coinciden');
    setEnviando(true);
    try {
      await registrar({
        restaurante: { nombre: form.restNombre, telefono: form.telefono, direccion: form.direccion },
        admin: { nombre: form.nombre, email: form.email, password: form.password },
      });
      navigate('/');
    } catch (err) {
      setError(textoError(err));
    } finally {
      setEnviando(false);
    }
    return undefined;
  };

  return (
    <Acceso>
      <form onSubmit={enviar}>
        <div>
          <h2>Registra tu restaurante</h2>
          <p className="muted">En un minuto tienes tu cuenta de administrador y puedes empezar a operar.</p>
        </div>

        <fieldset>
          <legend>Tu negocio</legend>
          <label className="campo">
            <span>Nombre del restaurante</span>
            <input name="restNombre" value={form.restNombre} onChange={cambiar} minLength={2} maxLength={120} required autoFocus />
          </label>
          <div className="form-2">
            <label className="campo">
              <span>Teléfono <small>(opcional)</small></span>
              <input name="telefono" type="tel" value={form.telefono} onChange={cambiar} maxLength={20} />
            </label>
            <label className="campo">
              <span>Dirección <small>(opcional)</small></span>
              <input name="direccion" value={form.direccion} onChange={cambiar} maxLength={255} />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Administrador</legend>
          <label className="campo">
            <span>Tu nombre</span>
            <input name="nombre" autoComplete="name" value={form.nombre} onChange={cambiar} minLength={2} maxLength={100} required />
          </label>
          <label className="campo">
            <span>Correo electrónico</span>
            <input name="email" type="email" autoComplete="username" value={form.email} onChange={cambiar} required />
          </label>
          <div className="form-2">
            <label className="campo">
              <span>Contraseña</span>
              <input name="password" type="password" autoComplete="new-password" value={form.password} onChange={cambiar}
                minLength={8} maxLength={72} pattern="(?=.*[A-Za-z])(?=.*\d).+" title="Mínimo 8 caracteres, con al menos una letra y un número" required />
            </label>
            <label className="campo">
              <span>Confirmar contraseña</span>
              <input name="confirmar" type="password" autoComplete="new-password" value={form.confirmar} onChange={cambiar} required />
            </label>
          </div>
          <small className="muted">Mínimo 8 caracteres, con al menos una letra y un número.</small>
        </fieldset>

        {error && <p className="alerta alerta-err" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
          {enviando ? 'Creando tu cuenta…' : 'Crear mi restaurante'}
        </button>
        <p className="acceso-pie">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </form>
    </Acceso>
  );
}
