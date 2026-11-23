/**
 * TIEMPO REAL con Supabase Realtime (Broadcast).
 *
 * El backend, después de cada cambio, publica un aviso { tipos: ['comandas', ...], comanda? }
 * en el canal privado del restaurante. Aquí escuchamos ese canal y avisamos a las pantallas
 * (useFetch con `escuchar`) para que recarguen sus datos al instante, sin refrescar la página.
 *
 * Si faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, todo sigue funcionando
 * con consultas periódicas (cada 10–15 s).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = URL && KEY
  ? createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const TiempoRealContext = createContext({ estado: 'apagado', conectado: false, suscribir: () => () => {} });

export function TiempoRealProvider({ children }) {
  const { usuario } = useAuth();
  const canal = usuario?.restaurante?.canal;
  const [estado, setEstado] = useState(supabase ? 'conectando' : 'apagado');
  const oyentes = useRef(new Set());

  useEffect(() => {
    if (!supabase || !canal) return undefined;
    setEstado('conectando');
    const ch = supabase
      .channel(canal)
      .on('broadcast', { event: 'cambio' }, ({ payload }) => {
        oyentes.current.forEach((fn) => {
          try { fn(payload || {}); } catch (e) { console.error(e); }
        });
      })
      .subscribe((status) => setEstado(status === 'SUBSCRIBED' ? 'conectado' : 'desconectado'));
    return () => { supabase.removeChannel(ch); };
  }, [canal]);

  /** fn(payload) se llama con cada aviso. Devuelve la función para dejar de escuchar. */
  const suscribir = useCallback((fn) => {
    oyentes.current.add(fn);
    return () => oyentes.current.delete(fn);
  }, []);

  return (
    <TiempoRealContext.Provider value={{ estado, conectado: estado === 'conectado', suscribir }}>
      {children}
    </TiempoRealContext.Provider>
  );
}

export const useTiempoReal = () => useContext(TiempoRealContext);
