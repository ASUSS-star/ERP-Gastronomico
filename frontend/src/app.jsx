import { Routes, Route, Navigate } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida';
import Layout from './components/Layout';
import LayoutOperacion from './components/LayoutOperacion';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Inicio from './pages/Inicio';
import Salon from './pages/Salon';
import Menu from './pages/Menu';
import Inventario from './pages/Inventario';
import Personal from './pages/Personal';
import Cocina from './pages/Cocina';
import Caja from './pages/Caja';

const solo = (roles, el) => <RutaProtegida roles={roles}>{el}</RutaProtegida>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      {/* Administrativo: con barra lateral */}
      <Route element={<RutaProtegida><Layout /></RutaProtegida>}>
        <Route index element={<Inicio />} />
        <Route path="salon" element={solo(['ADMIN', 'MESERO'], <Salon />)} />
        <Route path="menu" element={solo(['ADMIN'], <Menu />)} />
        <Route path="inventario" element={solo(['ADMIN', 'COCINERO'], <Inventario />)} />
        <Route path="personal" element={solo(['ADMIN'], <Personal />)} />
      </Route>

      {/* Operación: pantalla completa, sin barra lateral */}
      <Route element={<RutaProtegida><LayoutOperacion /></RutaProtegida>}>
        <Route path="cocina" element={solo(['ADMIN', 'COCINERO'], <Cocina />)} />
        <Route path="caja" element={solo(['ADMIN', 'CAJERO'], <Caja />)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
