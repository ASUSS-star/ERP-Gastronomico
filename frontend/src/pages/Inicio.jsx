import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Dashboard from './Dashboard';

/** Página de inicio según el rol: cada quien aterriza en su pantalla de trabajo. */
export default function Inicio() {
  const { usuario } = useAuth();
  if (usuario.rol === 'MESERO') return <Navigate to="/salon" replace />;
  if (usuario.rol === 'COCINERO') return <Navigate to="/cocina" replace />;
  return <Dashboard />; // ADMIN y CAJERO
}
