import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useFetch(fn, { intervalo })  -> { data, loading, error, recargar }
 * fn: () => Promise<data>. intervalo (ms) activa polling silencioso (sin skeleton).
 */
export function useFetch(fn, { intervalo } = {}) {
  const [estado, setEstado] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setEstado((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setEstado({ data, loading: false, error: null });
    } catch (e) {
      setEstado((s) => ({ data: silencioso ? s.data : null, loading: false, error: e }));
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!intervalo) return;
    const id = setInterval(() => cargar(true), intervalo);
    return () => clearInterval(id);
  }, [intervalo, cargar]);

  return { ...estado, recargar: () => cargar() };
}