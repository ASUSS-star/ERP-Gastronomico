import '../../styles/tokens.css';

const MAPA = {
  PENDIENTE: ['badge-warn', 'Pendiente'],
  EN_PREPARACION: ['badge-info', 'En preparación'],
  ENTREGADO: ['badge-ok', 'Entregado'],
  PAGADO: ['badge-ok', 'Pagado'],
  CANCELADO: ['badge-err', 'Cancelado'],
};

export default function EstadoBadge({ estado }) {
  const [clase, texto] = MAPA[estado] ?? ['badge-info', estado];
  return <span className={`badge ${clase}`}>{texto}</span>;
}

/** <10 min ok · <20 warn · resto err */
export const urgencia = (fecha) => {
  const min = (Date.now() - new Date(fecha).getTime()) / 60000;
  return min < 10 ? 'ok' : min < 20 ? 'warn' : 'err';
};