import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/tokens.css';

const TITULOS = { '/cocina': 'Cocina', '/caja': 'Caja' };

/** Layout sin sidebar para Cocina y Caja. */
export default function LayoutOperacion() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { usuario, logout } = useAuth();
  const [tema, setTema] = useState(() => localStorage.getItem('tema-op') || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem('tema-op', tema);
    return () => { delete document.documentElement.dataset.theme; };
  }, [tema]);

  return (
    <div className="op op-shell">
      <header className="op-bar">
        <button className="btn" onClick={() => nav('/')}>Inicio</button>
        <h1>{TITULOS[pathname] ?? 'Operación'} · {usuario.restaurante?.nombre}</h1>
        <button className="btn" onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}>
          {tema === 'dark' ? 'Claro' : 'Oscuro'}
        </button>
        <button className="btn" onClick={logout}>Salir</button>
      </header>
      <main className="op-main"><Outlet /></main>
    </div>
  );
}