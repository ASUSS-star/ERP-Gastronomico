import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { textoError } from '../utils/formato';
import Acceso from '../components/ui/Acceso';

export default function Login() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(textoError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Acceso>
      <form onSubmit={enviar}>
        <div>
          <h2>Iniciar sesión</h2>
          <p className="muted">Entra con el correo que te dio tu administrador.</p>
        </div>
        <label className="campo">
          <span>Correo electrónico</span>
          <input type="email" name="email" autoComplete="username" value={form.email} onChange={cambiar} required autoFocus />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input type="password" name="password" autoComplete="current-password" value={form.password} onChange={cambiar} required />
        </label>
        {error && <p className="alerta alerta-err" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="acceso-pie">¿Tu restaurante aún no está registrado? <Link to="/registro">Regístralo gratis</Link></p>
      </form>
    </Acceso>
  );
}
