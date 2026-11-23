import { useEffect, useState } from 'react';
import { estadoCola, suscribirCola } from './cola';

/** { enLinea, pendientes[], fallidas[], sincronizando } — se actualiza solo. */
export function useConexion() {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [cola, setCola] = useState(estadoCola);

  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const quitar = suscribirCola((_evento, estado) => setCola(estado));
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      quitar();
    };
  }, []);

  return { enLinea, ...cola };
}
