import { useCallback, useEffect, useRef, useState } from 'react';
import { useTiempoReal } from '../context/TiempoRealContext';
import { suscribirCola } from '../offline/cola';

/**
 * useFetch(fn, { intervalo, deps, escuchar })  -> { data, loading, error, recargar }
 * fn: () => Promise<data>.
 * escuchar: tipos de aviso en tiempo real que provocan recarga ('comandas', 'mesas', 'inventario',
 *   'menu', 'reportes', 'usuarios'). Con tiempo real conectado, el `intervalo` se vuelve un respaldo de 60 s.
 * intervalo (ms): consulta periódica silenciosa (sin skeleton) cuando no hay tiempo real.
 * deps: vuelve a cargar cuando cambia alguno de estos valores (filtros, rango...).
 * También recarga al volver internet, al terminar de sincronizar y al regresar a la pestaña.
 */
export function useFetch(fn, { intervalo, deps = [], escuchar } = {}) {
  const [estado, setEstado] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const { conectado, suscribir } = useTiempoReal();
  const temporizador = useRef(null);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setEstado((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setEstado({ data, loading: false, error: null });
    } catch (e) {
      setEstado((s) => ({ data: silencioso ? s.data : null, loading: false, error: silencioso ? s.error : e }));
    }
  }, []);

  // Varias notificaciones seguidas → una sola recarga
  const recargarPronto = useCallback(() => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => cargar(true), 250);
  }, [cargar]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [cargar, ...deps]);

  const claveEscucha = (escuchar || []).join(',');
  useEffect(() => {
    if (!claveEscucha) return undefined;
    const tipos = claveEscucha.split(',');
    return suscribir((aviso) => {
      if ((aviso.tipos || []).some((t) => tipos.includes(t))) recargarPronto();
    });
  }, [claveEscucha, suscribir, recargarPronto]);

  useEffect(() => {
    const visible = () => document.visibilityState === 'visible' && recargarPronto();
    window.addEventListener('online', recargarPronto);
    document.addEventListener('visibilitychange', visible);
    const quitar = suscribirCola((evento) => evento === 'sincronizado' && recargarPronto());
    return () => {
      window.removeEventListener('online', recargarPronto);
      document.removeEventListener('visibilitychange', visible);
      quitar();
      clearTimeout(temporizador.current);
    };
  }, [recargarPronto]);

  const periodo = intervalo && (conectado && claveEscucha ? Math.max(intervalo, 60000) : intervalo);
  useEffect(() => {
    if (!periodo) return undefined;
    const id = setInterval(() => cargar(true), periodo);
    return () => clearInterval(id);
  }, [periodo, cargar]);

  return { ...estado, recargar: (silencioso = false) => cargar(silencioso) };
}
