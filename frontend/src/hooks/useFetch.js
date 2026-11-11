import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useFetch(fn, { intervalo, deps })  -> { data, loading, error, recargar }
 * fn: () => Promise<data>.
 * intervalo (ms) activa polling silencioso (sin skeleton).
 * deps: vuelve a cargar cuando cambia alguno de estos valores (filtros, rango...).
 */
export function useFetch(fn, { intervalo, deps = [] } = {}) {
  const [estado, setEstado] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setEstado((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setEstado({ data, loading: false, error: null });
    } catch (e) {
      setEstado((s) => ({ data: silencioso ? s.data : null, loading: false, error: silencioso ? s.error : e }));
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [cargar, ...deps]);
  useEffect(() => {
    if (!intervalo) return undefined;
    const id = setInterval(() => cargar(true), intervalo);
    return () => clearInterval(id);
  }, [intervalo, cargar]);

  return { ...estado, recargar: (silencioso = false) => cargar(silencioso) };
}
