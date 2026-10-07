/** Constantes de dominio compartidas por validadores y servicios. */

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  MESERO: 'MESERO',
  COCINERO: 'COCINERO',
  CAJERO: 'CAJERO',
});

const ESTADOS_COMANDA = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  EN_PREPARACION: 'EN_PREPARACION',
  ENTREGADO: 'ENTREGADO',
  PAGADO: 'PAGADO',
  CANCELADO: 'CANCELADO',
});

/**
 * Máquina de estados de la comanda.
 * Clave = estado actual → { estadoSiguiente: [roles que pueden hacer la transición] }
 * Cualquier transición que no esté aquí se rechaza con 400.
 */
const TRANSICIONES_COMANDA = Object.freeze({
  PENDIENTE: {
    EN_PREPARACION: [ROLES.COCINERO, ROLES.ADMIN],
    CANCELADO: [ROLES.MESERO, ROLES.ADMIN],
  },
  EN_PREPARACION: {
    ENTREGADO: [ROLES.COCINERO, ROLES.MESERO, ROLES.ADMIN],
    CANCELADO: [ROLES.ADMIN],
  },
  ENTREGADO: {
    PAGADO: [ROLES.CAJERO, ROLES.ADMIN],
  },
  PAGADO: {},
  CANCELADO: {},
});

const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];
const TIPOS_MOVIMIENTO = ['ENTRADA', 'SALIDA', 'AJUSTE'];
const ESTADOS_MESA = ['LIBRE', 'OCUPADA', 'INACTIVA'];

module.exports = {
  ROLES,
  ESTADOS_COMANDA,
  TRANSICIONES_COMANDA,
  METODOS_PAGO,
  TIPOS_MOVIMIENTO,
  ESTADOS_MESA,
};
