import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTema } from '../hooks/useTema';
import Icono from './ui/Icono';

const TITULOS = { '/cocina': 'Cocina', '/caja': 'Caja' };
// Sólo estos roles tienen pantallas administrativas a las que volver
const CON_PANEL = ['ADMIN', 'CAJERO', 'MESERO'];

/** Layout de pantalla completa (sin barra lateral) para Cocina y Caja. */
export default function LayoutOperacion() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { usuario, logout } = useAuth();
  const [tema, alternarTema] = useTema();
  const volver = CON_PANEL.includes(usuario.rol);

  return (
    <div className="op op-shell">
      <header className="op-bar">
        {volver && <button className="btn" onClick={() => nav('/')}><Icono n="panel" /> Panel</button>}
        {usuario.rol === 'COCINERO' && <button className="btn" onClick={() => nav('/inventario')}><Icono n="inventario" /> Inventario</button>}
        <h1>{TITULOS[pathname] ?? 'Operación'} · {usuario.restaurante?.nombre}</h1>
        <button className="btn" onClick={alternarTema} aria-label="Cambiar tema"><Icono n={tema === 'dark' ? 'sol' : 'luna'} /></button>
        <button className="btn" onClick={logout}><Icono n="salir" /> Salir</button>
      </header>
      <main className="op-main"><Outlet /></main>
    </div>
  );
}
