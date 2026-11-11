import { useEffect } from 'react';
import Icono from './Icono';

/**
 * Ventana modal. Cierra con Escape o clic fuera.
 * Si se pasa onSubmit, el contenido se envuelve en <form> (Enter envía).
 */
export default function Modal({ titulo, onCerrar, onSubmit, pie, ancho, children }) {
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', tecla);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = previo;
    };
  }, [onCerrar]);

  const Caja = onSubmit ? 'form' : 'div';
  const enviar = onSubmit ? (e) => { e.preventDefault(); onSubmit(e); } : undefined;

  return (
    <div className="modal-velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <Caja className="modal" data-ancho={ancho} role="dialog" aria-modal="true" aria-label={titulo} onSubmit={enviar}>
        <header className="modal-cab">
          <h2>{titulo}</h2>
          <button type="button" className="btn btn-icon" onClick={onCerrar} aria-label="Cerrar"><Icono n="cerrar" /></button>
        </header>
        <div className="modal-cuerpo">{children}</div>
        {pie && <footer className="modal-pie">{pie}</footer>}
      </Caja>
    </div>
  );
}
