/**
 * Cliente HTTP único para toda la app.
 * - Agrega automáticamente el header Authorization: Bearer <token>
 * - Si la API responde 401 (token expirado/ inválido) cierra sesión y manda al login
 * - Guarda la última respuesta de cada consulta (GET) para seguir mostrando datos sin internet
 */
import axios from 'axios';

export const TOKEN_KEY = 'erp_token';
const PREFIJO_CACHE = 'erp:cache:';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 15000,
});

const claveCache = (config) => `${PREFIJO_CACHE}${config.url}?${JSON.stringify(config.params || {})}`;
const usarCache = (config) => config?.method === 'get' && !config.url.startsWith('/auth');

/** Borra las copias locales (al cerrar sesión, para que otro usuario del equipo no las vea). */
export const limpiarCache = () => {
  Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO_CACHE)).forEach((k) => localStorage.removeItem(k));
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (usarCache(res.config)) {
      try { localStorage.setItem(claveCache(res.config), JSON.stringify(res.data)); } catch { /* sin espacio: se omite */ }
    }
    return res.data; // devolvemos directamente { ok, data, meta, mensaje }
  },
  (error) => {
    const status = error.response?.status;
    // Sin respuesta (red caída): si es una consulta y tenemos copia local, la devolvemos
    if (!error.response && usarCache(error.config)) {
      const copia = localStorage.getItem(claveCache(error.config));
      if (copia) return { ...JSON.parse(copia), desdeCache: true };
    }
    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/login';
    }
    // Normalizamos el error para mostrarlo en la UI (status undefined = error de red)
    const data = error.response?.data || {};
    const mensaje = data.mensaje || (error.response ? 'Error del servidor' : 'Sin conexión con el servidor');
    return Promise.reject({ status, mensaje, errores: data.errores || [] });
  },
);

export default api;
