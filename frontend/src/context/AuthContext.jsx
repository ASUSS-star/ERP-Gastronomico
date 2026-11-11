import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/services';
import { TOKEN_KEY } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al recargar la página, si hay token, recuperamos el perfil
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return setCargando(false);
    authApi
      .perfil()
      .then((res) => setUsuario(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setCargando(false));
  }, []);

  const iniciar = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setUsuario({ ...data.usuario, restaurante: data.restaurante });
    return data.usuario;
  };

  const login = async (email, password) => iniciar((await authApi.login(email, password)).data);

  /** Alta de un restaurante nuevo: crea el restaurante + su ADMIN y deja la sesión iniciada. */
  const registrar = async (payload) => iniciar((await authApi.registro(payload)).data);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, registrar, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
