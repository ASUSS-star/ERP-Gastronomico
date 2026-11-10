import { useEffect, useState } from 'react';

/** Tema claro/oscuro global, recordado en este navegador. */
export function useTema() {
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem('tema', tema);
  }, [tema]);
  return [tema, () => setTema((t) => (t === 'dark' ? 'light' : 'dark'))];
}
