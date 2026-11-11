import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTema } from '../hooks/useTema';
import { ROLES } from '../utils/formato';
import Icono from './ui/Icono';

// Menú lateral según el rol
const MENU = [
  { grupo: 'Operación', items: [
    { to: '/', texto: 'Panel', icono: 'panel', roles: ['ADMIN', 'CAJERO'] },
    { to: '/salon', texto: 'Salón y pedidos', icono: 'salon', roles: ['ADMIN', 'MESERO'] },
    { to: '/cocina', texto: 'Cocina', icono: 'cocina', roles: ['ADMIN', 'COCINERO'] },
    { to: '/caja', texto: 'Caja', icono: 'caja', roles: ['ADMIN', 'CAJERO'] },
  ] },
  { grupo: 'Administración', items: [
    { to: '/menu', texto: 'Menú y recetas', icono: 'menu', roles: ['ADMIN'] },
    { to: '/inventario', texto: 'Inventario', icono: 'inventario', roles: ['ADMIN', 'COCINERO'] },
    { to: '/personal', texto: 'Personal', icono: 'personal', roles: ['ADMIN'] },
  ] },
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const [tema, alternarTema] = useTema();
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setAbierto(false); }, [pathname]); // en móvil, cerrar al navegar

  const grupos = MENU.map((g) => ({ ...g, items: g.items.filter((m) => m.roles.includes(usuario.rol)) })).filter((g) => g.items.length);

  return (
    <div className="shell">
      <header className="topbar-movil">
        <button className="btn btn-icon" onClick={() => setAbierto(true)} aria-label="Abrir menú"><Icono n="hamburguesa" /></button>
        <b>{usuario.restaurante?.nombre || 'ERP Gastronómico'}</b>
      </header>
      {abierto && <button className="velo" aria-label="Cerrar menú" onClick={() => setAbierto(false)} />}

      <aside className="side" data-abierto={abierto}>
        <div className="marca">
          <span className="marca-logo"><Icono n="salon" size={20} /></span>
          <span>
            <b>ERP Gastronómico</b>
            <small title={usuario.restaurante?.nombre}>{usuario.restaurante?.nombre}</small>
          </span>
        </div>

        {grupos.map((g) => (
          <div key={g.grupo}>
            <div className="side-titulo">{g.grupo}</div>
            <nav>
              {g.items.map((m) => (
                <NavLink key={m.to} to={m.to} end={m.to === '/'}>
                  <Icono n={m.icono} /> {m.texto}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}

        <div className="side-pie">
          <div className="side-usuario">
            <span className="avatar">{usuario.nombre?.[0]?.toUpperCase()}</span>
            <div>
              <b title={usuario.nombre}>{usuario.nombre}</b>
              <small>{ROLES[usuario.rol]?.texto ?? usuario.rol}</small>
            </div>
          </div>
          <div className="side-acciones">
            <button className="btn" onClick={alternarTema}>
              <Icono n={tema === 'dark' ? 'sol' : 'luna'} size={16} /> {tema === 'dark' ? 'Claro' : 'Oscuro'}
            </button>
            <button className="btn" onClick={logout}><Icono n="salir" size={16} /> Salir</button>
          </div>
        </div>
      </aside>

      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
