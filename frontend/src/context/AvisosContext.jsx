import { createContext, useCallback, useContext, useState } from 'react';
import { textoError } from '../utils/formato';

const AvisosContext = createContext(() => {});

/** Avisos breves (toasts): const avisar = useAvisos(); avisar('Guardado'); avisar.error(err) */
export function AvisosProvider({ children }) {
  const [avisos, setAvisos] = useState([]);

  const mostrar = useCallback((texto, tipo = 'ok') => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'err' ? 6000 : 3200);
  }, []);

  return (
    <AvisosContext.Provider value={mostrar}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className="aviso" data-tipo={a.tipo}>{a.texto}</div>
        ))}
      </div>
    </AvisosContext.Provider>
  );
}

export function useAvisos() {
  const mostrar = useContext(AvisosContext);
  return {
    ok: (texto) => mostrar(texto, 'ok'),
    error: (err) => mostrar(typeof err === 'string' ? err : textoError(err), 'err'),
  };
}
