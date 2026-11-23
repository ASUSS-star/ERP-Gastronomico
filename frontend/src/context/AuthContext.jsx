import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/services';
import { TOKEN_KEY, limpiarCache } from '../api/client';

const AuthContext = createContext(null);
const USUARIO_KEY = 'erp:usuario'; // copia local para poder abrir la app sin internet

const usuarioGuardado = () => {
  try { return JSON.parse(localStorage.getItem(USUARIO_KEY)); } catch { return null; }
};

export function AuthProvider({ children }) {
  const [usuario, setUsuarioEstado] = useState(null);
  const [cargando, setCargando] = useState(true);

  const setUsuario = (u) => {
    setUsuarioEstado(u);
    if (u) localStorage.setItem(USUARIO_KEY, JSON.stringify(u));
    else localStorage.removeItem(USUARIO_KEY);
  };

  // Al recargar la página, si hay token, recuperamos el perfil
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return setCargando(false);
    authApi
      .perfil()
      .then((res) => setUsuario(res.data))
      .catch((err) => {
        // Sin internet: seguimos con la sesión guardada. Sólo un rechazo real del servidor la cierra.
        if (!err.status && usuarioGuardado()) setUsuarioEstado(usuarioGuardado());
        else {
          localStorage.removeItem(TOKEN_KEY);
          setUsuario(null);
        }
      })
      .finally(() => setCargando(false));
    return undefined;
  }, []);

  const iniciar = (data) => {
    limpiarCache();
    localStorage.setItem(TOKEN_KEY, data.token);
    setUsuario({ ...data.usuario, restaurante: data.restaurante });
    return data.usuario;
  };

  const login = async (email, password) => iniciar((await authApi.login(email, password)).data);

  /** Alta de un restaurante nuevo: crea el restaurante + su ADMIN y deja la sesión iniciada. */
  const registrar = async (payload) => iniciar((await authApi.registro(payload)).data);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    limpiarCache();
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, registrar, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
