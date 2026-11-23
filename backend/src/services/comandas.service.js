/**
 * Servicio de COMANDAS (pedidos) — el corazón del ERP.
 *
 * Reglas de negocio:
 *  - El folio es consecutivo POR restaurante (contador atómico en Restaurante.ultimoFolio).
 *  - El precio de cada platillo se "congela" en el detalle (si mañana sube, la comanda no cambia).
 *  - Al crear la comanda se descuenta el inventario según la receta de cada platillo.
 *    Si no alcanza el stock de algún insumo, se aborta TODO (transacción) → 409.
 *  - Al CANCELAR (o editar items) se devuelve al inventario exactamente lo que se descontó.
 *  - Los cambios de estado siguen la máquina de estados de constants/index.js.
 *  - Un MESERO sólo ve y modifica sus propias comandas.
 *  - El cobro admite varios pagos (cuenta dividida / varios métodos); la comanda pasa a
 *    PAGADO cuando la suma de pagos cubre el total.
 *  - `clienteId` (generado en el dispositivo) hace seguros los reintentos del modo sin internet.
 */
const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { paginacion, metaPaginacion } = require('../utils/respuesta');
const { ROLES, TRANSICIONES_COMANDA } = require('../constants');
const { ESTADOS_ABIERTOS } = require('./mesas.service');

const TX_OPCIONES = { timeout: 15000, maxWait: 10000 };

const INCLUDE_COMANDA = {
  mesa: { select: { id: true, numero: true } },
  mesero: { select: { id: true, nombre: true } },
  detalles: {
    include: { platillo: { select: { id: true, nombre: true } } },
    orderBy: { id: 'asc' },
  },
  pagos: {
    select: { id: true, metodo: true, monto: true, recibido: true, cambio: true, createdAt: true },
    orderBy: { id: 'asc' },
  },
};

// ---------------------------------------------------------------------------
// Helpers internos (reciben `tx` para ejecutarse dentro de una transacción)
// ---------------------------------------------------------------------------

/** Obtiene platillos del restaurante, valida que existan/estén disponibles y arma los detalles. */
const construirDetalles = async (tx, restauranteId, items) => {
  const ids = [...new Set(items.map((i) => i.platilloId))];
  const platillos = await tx.platillo.findMany({
    where: { id: { in: ids }, restauranteId },
    include: { receta: true },
  });

  const porId = new Map(platillos.map((p) => [p.id, p]));
  const faltan = ids.filter((id) => !porId.has(id));
  if (faltan.length) throw AppError.notFound(`Platillos no encontrados: ${faltan.join(', ')}`);

  const noDisponibles = platillos.filter((p) => !p.disponible).map((p) => p.nombre);
  if (noDisponibles.length) throw AppError.conflict(`Platillos no disponibles: ${noDisponibles.join(', ')}`);

  let total = new Prisma.Decimal(0);
  const consumo = new Map(); // insumoId → cantidad total a descontar

  const detalles = items.map((item) => {
    const p = porId.get(item.platilloId);
    const subtotal = p.precio.mul(item.cantidad);
    total = total.add(subtotal);

    for (const r of p.receta) {
      const actual = consumo.get(r.insumoId) || new Prisma.Decimal(0);
      consumo.set(r.insumoId, actual.add(r.cantidad.mul(item.cantidad)));
    }

    return {
      platilloId: p.id,
      cantidad: item.cantidad,
      precioUnitario: p.precio,
      subtotal,
      notas: item.notas || null,
    };
  });

  return { detalles, total, consumo };
};

/**
 * Descuenta inventario con UPDATE condicional atómico (stock >= requerido).
 * Si algún insumo no alcanza, lanza 409 y la transacción completa hace rollback.
 */
const descontarStock = async (tx, consumo, comandaId, usuarioId) => {
  // Orden fijo por id → evita deadlocks si dos comandas tocan los mismos insumos
  const ids = [...consumo.keys()].sort((a, b) => a - b);
  for (const insumoId of ids) {
    const cantidad = consumo.get(insumoId);
    // eslint-disable-next-line no-await-in-loop
    const { count } = await tx.insumo.updateMany({
      where: { id: insumoId, stockActual: { gte: cantidad } },
      data: { stockActual: { decrement: cantidad } },
    });
    if (count === 0) {
      // eslint-disable-next-line no-await-in-loop
      const insumo = await tx.insumo.findUnique({ where: { id: insumoId } });
      throw AppError.conflict(
        `Stock insuficiente de "${insumo.nombre}": se requieren ${cantidad} ${insumo.unidad} y hay ${insumo.stockActual}`,
      );
    }
    // eslint-disable-next-line no-await-in-loop
    const actualizado = await tx.insumo.findUnique({ where: { id: insumoId }, select: { stockActual: true } });
    // eslint-disable-next-line no-await-in-loop
    await tx.movimientoInventario.create({
      data: {
        insumoId,
        usuarioId,
        comandaId,
        tipo: 'SALIDA',
        cantidad,
        stockFinal: actualizado.stockActual,
        motivo: 'Consumo por comanda',
      },
    });
  }
};

/**
 * Devuelve al inventario lo que la comanda consumió.
 * Se calcula con los movimientos reales (SALIDAS − ENTRADAS de esa comanda),
 * no con la receta actual (que pudo cambiar desde que se pidió).
 */
const devolverStock = async (tx, comandaId, usuarioId, motivo) => {
  const movs = await tx.movimientoInventario.findMany({ where: { comandaId } });
  const neto = new Map();
  for (const m of movs) {
    const signo = m.tipo === 'SALIDA' ? 1 : m.tipo === 'ENTRADA' ? -1 : 0;
    neto.set(m.insumoId, (neto.get(m.insumoId) || new Prisma.Decimal(0)).add(m.cantidad.mul(signo)));
  }

  for (const [insumoId, cantidad] of neto) {
    if (cantidad.lte(0)) continue;
    // eslint-disable-next-line no-await-in-loop
    const actualizado = await tx.insumo.update({
      where: { id: insumoId },
      data: { stockActual: { increment: cantidad } },
    });
    // eslint-disable-next-line no-await-in-loop
    await tx.movimientoInventario.create({
      data: { insumoId, usuarioId, comandaId, tipo: 'ENTRADA', cantidad, stockFinal: actualizado.stockActual, motivo },
    });
  }
};

/** Libera la mesa si ya no le quedan comandas abiertas. */
const liberarMesaSiCorresponde = async (tx, mesaId) => {
  const abiertas = await tx.comanda.count({ where: { mesaId, estado: { in: ESTADOS_ABIERTOS } } });
  if (abiertas === 0) {
    await tx.mesa.updateMany({ where: { id: mesaId, estado: 'OCUPADA' }, data: { estado: 'LIBRE' } });
  }
};

/** Un MESERO sólo puede operar sobre sus comandas. */
const verificarPropiedad = (user, comanda) => {
  if (user.rol === ROLES.MESERO && comanda.meseroId !== user.id) {
    throw AppError.forbidden('Sólo puedes acceder a tus propias comandas');
  }
};

const buscarComanda = async (db, restauranteId, id) => {
  const comanda = await db.comanda.findFirst({ where: { id, restauranteId } });
  if (!comanda) throw AppError.notFound('Comanda no encontrada');
  return comanda;
};

// ---------------------------------------------------------------------------
// Casos de uso
// ---------------------------------------------------------------------------

/** Si el dispositivo ya envió esta comanda (reintento), devuelve la existente en lugar de duplicarla. */
const buscarPorClienteId = async (user, clienteId) => {
  const previa = await prisma.comanda.findUnique({ where: { clienteId }, include: INCLUDE_COMANDA });
  if (previa && previa.restauranteId !== user.restauranteId) throw AppError.conflict('Identificador de comanda inválido');
  return previa;
};

const crear = async (user, datos) => {
  if (datos.clienteId) {
    const previa = await buscarPorClienteId(user, datos.clienteId);
    if (previa) return previa;
  }
  try {
    return await crearNueva(user, datos);
  } catch (e) {
    // Dos reintentos simultáneos: el segundo choca con el índice único → devolvemos la primera
    if (datos.clienteId && e.code === 'P2002') {
      const previa = await buscarPorClienteId(user, datos.clienteId);
      if (previa) return previa;
    }
    throw e;
  }
};

const crearNueva = async (user, { mesaId, notas, items, clienteId }) =>
  prisma.$transaction(async (tx) => {
    const { restauranteId } = user;

    const mesa = await tx.mesa.findFirst({ where: { id: mesaId, restauranteId } });
    if (!mesa) throw AppError.notFound('Mesa no encontrada');
    if (mesa.estado === 'INACTIVA') throw AppError.conflict(`La mesa ${mesa.numero} está inactiva`);

    const { detalles, total, consumo } = await construirDetalles(tx, restauranteId, items);

    // Folio consecutivo atómico (UPDATE ... SET ultimoFolio = ultimoFolio + 1 RETURNING)
    const { ultimoFolio: folio } = await tx.restaurante.update({
      where: { id: restauranteId },
      data: { ultimoFolio: { increment: 1 } },
      select: { ultimoFolio: true },
    });

    const comanda = await tx.comanda.create({
      data: {
        restauranteId,
        folio,
        mesaId,
        meseroId: user.id,
        notas: notas || null,
        total,
        clienteId: clienteId || null,
        detalles: { create: detalles },
      },
    });

    await descontarStock(tx, consumo, comanda.id, user.id);
    await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'OCUPADA' } });

    return tx.comanda.findUnique({ where: { id: comanda.id }, include: INCLUDE_COMANDA });
  }, TX_OPCIONES);

const listar = async (user, { estado, mesaId, meseroId, desde, hasta, ...pag }) => {
  // El MESERO sólo ve las suyas aunque intente filtrar por otro meseroId
  const meseroFiltro = user.rol === ROLES.MESERO ? user.id : meseroId;
  const estados = estado ? estado.split(',') : undefined;

  const where = {
    restauranteId: user.restauranteId,
    ...(estados && { estado: { in: estados } }),
    ...(mesaId && { mesaId }),
    ...(meseroFiltro && { meseroId: meseroFiltro }),
    ...((desde || hasta) && { createdAt: { ...(desde && { gte: desde }), ...(hasta && { lte: hasta }) } }),
  };

  const [total, data] = await prisma.$transaction([
    prisma.comanda.count({ where }),
    prisma.comanda.findMany({ where, include: INCLUDE_COMANDA, orderBy: { createdAt: 'desc' }, ...paginacion(pag) }),
  ]);
  return { data, meta: metaPaginacion(total, pag) };
};

const listarPorMesa = async (user, mesaId, filtros) => {
  const mesa = await prisma.mesa.findFirst({ where: { id: mesaId, restauranteId: user.restauranteId } });
  if (!mesa) throw AppError.notFound('Mesa no encontrada');
  return listar(user, { ...filtros, mesaId });
};

const listarPorMesero = async (user, meseroId, filtros) => {
  if (user.rol === ROLES.MESERO && meseroId !== user.id) {
    throw AppError.forbidden('Sólo puedes consultar tus propias comandas');
  }
  const mesero = await prisma.usuario.findFirst({ where: { id: meseroId, restauranteId: user.restauranteId } });
  if (!mesero) throw AppError.notFound('Mesero no encontrado');
  return listar(user, { ...filtros, meseroId });
};

const obtener = async (user, id) => {
  const comanda = await prisma.comanda.findFirst({
    where: { id, restauranteId: user.restauranteId },
    include: INCLUDE_COMANDA,
  });
  if (!comanda) throw AppError.notFound('Comanda no encontrada');
  verificarPropiedad(user, comanda);
  return comanda;
};

/** Editar notas y/o reemplazar items. Sólo en estado PENDIENTE (la cocina aún no empieza). */
const actualizar = async (user, id, { notas, items }) =>
  prisma.$transaction(async (tx) => {
    const comanda = await buscarComanda(tx, user.restauranteId, id);
    verificarPropiedad(user, comanda);
    if (comanda.estado !== 'PENDIENTE') {
      throw AppError.conflict(`Sólo se pueden editar comandas PENDIENTES (estado actual: ${comanda.estado})`);
    }

    const data = {};
    if (notas !== undefined) data.notas = notas || null;

    if (items) {
      await devolverStock(tx, id, user.id, 'Edición de comanda (devolución)');
      const { detalles, total, consumo } = await construirDetalles(tx, user.restauranteId, items);
      await tx.detalleComanda.deleteMany({ where: { comandaId: id } });
      data.total = total;
      data.detalles = { create: detalles };
      await descontarStock(tx, consumo, id, user.id);
    }

    await tx.comanda.update({ where: { id }, data });
    return tx.comanda.findUnique({ where: { id }, include: INCLUDE_COMANDA });
  }, TX_OPCIONES);

/**
 * Cambia el estado siguiendo la máquina de estados.
 * Usa "optimistic locking": el UPDATE incluye el estado anterior en el WHERE;
 * si otra persona cambió la comanda en ese instante, count=0 → 409.
 */
const cambiarEstado = async (user, id, { estado: nuevo, metodoPago }) =>
  prisma.$transaction(async (tx) => {
    const comanda = await buscarComanda(tx, user.restauranteId, id);
    const actual = comanda.estado;

    // Idempotente: repetir el mismo cambio (reintento sin internet, doble clic) no es un error
    if (actual === nuevo) {
      verificarPropiedad(user, comanda);
      return tx.comanda.findUnique({ where: { id }, include: INCLUDE_COMANDA });
    }

    const permitidas = TRANSICIONES_COMANDA[actual] || {};
    if (!permitidas[nuevo]) {
      const opciones = Object.keys(permitidas);
      throw AppError.badRequest(
        `Transición inválida: ${actual} → ${nuevo}. ${opciones.length ? `Permitidas: ${opciones.join(', ')}` : 'La comanda ya está cerrada'}`,
      );
    }
    if (!permitidas[nuevo].includes(user.rol)) {
      throw AppError.forbidden(`Tu rol (${user.rol}) no puede pasar una comanda de ${actual} a ${nuevo}`);
    }
    if (nuevo === 'CANCELADO') verificarPropiedad(user, comanda);

    // Cobro del saldo completo con un solo método (compatibilidad con la API anterior)
    if (nuevo === 'PAGADO') {
      await bloquear(tx, id);
      await aplicarPagos(tx, user, comanda, [{ metodo: metodoPago, monto: null }]);
      return tx.comanda.findUnique({ where: { id }, include: INCLUDE_COMANDA });
    }

    const data = { estado: nuevo };
    const { count } = await tx.comanda.updateMany({ where: { id, estado: actual }, data });
    if (count === 0) throw AppError.conflict('La comanda fue modificada por otro usuario. Recarga e intenta de nuevo');

    if (nuevo === 'CANCELADO') await devolverStock(tx, id, user.id, `Cancelación de comanda #${comanda.folio}`);
    if (nuevo === 'PAGADO' || nuevo === 'CANCELADO') await liberarMesaSiCorresponde(tx, comanda.mesaId);

    return tx.comanda.findUnique({ where: { id }, include: INCLUDE_COMANDA });
  }, TX_OPCIONES);

// ---------------------------------------------------------------------------
// Cobro
// ---------------------------------------------------------------------------

/** Bloquea la fila de la comanda hasta el fin de la transacción (dos cajas cobrando a la vez). */
const bloquear = (tx, id) => tx.$queryRaw`SELECT id FROM comandas WHERE id = ${id} FOR UPDATE`;

/**
 * Registra pagos contra el saldo pendiente. `monto: null` significa "todo el saldo".
 * Si con estos pagos se cubre el total, la comanda pasa a PAGADO y se libera la mesa.
 */
const aplicarPagos = async (tx, user, comanda, pagos, clienteId) => {
  const previos = await tx.pago.aggregate({ where: { comandaId: comanda.id }, _sum: { monto: true } });
  const saldo = comanda.total.sub(previos._sum.monto || 0);
  if (saldo.lte(0)) throw AppError.conflict('La cuenta ya está saldada');

  let restante = saldo;
  const filas = pagos.map((p, i) => {
    const monto = p.monto == null ? restante : new Prisma.Decimal(p.monto);
    if (monto.lte(0)) throw AppError.badRequest('Cada pago debe ser mayor a 0');
    if (monto.gt(restante)) {
      throw AppError.badRequest(`Los pagos suman más que el saldo pendiente ($${saldo.toFixed(2)})`);
    }
    restante = restante.sub(monto);

    let recibido = null;
    let cambio = null;
    if (p.metodo === 'EFECTIVO' && p.recibido != null) {
      recibido = new Prisma.Decimal(p.recibido);
      if (recibido.lt(monto)) {
        throw AppError.badRequest(`El efectivo recibido ($${recibido.toFixed(2)}) es menor al monto ($${monto.toFixed(2)})`);
      }
      cambio = recibido.sub(monto);
    }
    return {
      restauranteId: comanda.restauranteId,
      comandaId: comanda.id,
      usuarioId: user.id,
      metodo: p.metodo,
      monto,
      recibido,
      cambio,
      clienteId: clienteId ? `${clienteId}:${i}` : null,
    };
  });
  await tx.pago.createMany({ data: filas });

  if (restante.gt(0)) return; // pago parcial: la comanda sigue ENTREGADA

  // Método principal = el de mayor importe (para la columna metodoPago y reportes antiguos)
  const porMetodo = await tx.pago.groupBy({ by: ['metodo'], where: { comandaId: comanda.id }, _sum: { monto: true } });
  const principal = porMetodo.reduce((a, b) => (b._sum.monto.gt(a._sum.monto) ? b : a)).metodo;

  const { count } = await tx.comanda.updateMany({
    where: { id: comanda.id, estado: comanda.estado },
    data: { estado: 'PAGADO', metodoPago: principal, pagadoAt: new Date() },
  });
  if (count === 0) throw AppError.conflict('La comanda fue modificada por otro usuario. Recarga e intenta de nuevo');
  await liberarMesaSiCorresponde(tx, comanda.mesaId);
};

/** POST /comandas/:id/pagos — uno o varios pagos (cuenta dividida, varios métodos). */
const registrarPagos = async (user, id, { pagos, clienteId }) =>
  prisma.$transaction(async (tx) => {
    await buscarComanda(tx, user.restauranteId, id);
    await bloquear(tx, id);

    // Reintento de un cobro que ya se guardó → devolvemos la comanda tal como quedó
    if (clienteId && (await tx.pago.findUnique({ where: { clienteId: `${clienteId}:0` }, select: { id: true } }))) {
      return tx.comanda.findUnique({ where: { id }, include: INCLUDE_COMANDA });
    }

    const comanda = await buscarComanda(tx, user.restauranteId, id); // releída ya bloqueada
    if (comanda.estado === 'PAGADO') throw AppError.conflict('La comanda ya está pagada');
    if (comanda.estado !== 'ENTREGADO') {
      throw AppError.badRequest(`Sólo se cobran comandas ENTREGADAS (estado actual: ${comanda.estado})`);
    }

    await aplicarPagos(tx, user, comanda, pagos, clienteId);
    return tx.comanda.findUnique({ where: { id }, include: INCLUDE_COMANDA });
  }, TX_OPCIONES);

/**
 * Eliminación física (sólo ADMIN). Únicamente comandas PENDIENTES o CANCELADAS;
 * las pagadas son registro contable y no se borran.
 */
const eliminar = async (user, id) =>
  prisma.$transaction(async (tx) => {
    const comanda = await buscarComanda(tx, user.restauranteId, id);
    if (!['PENDIENTE', 'CANCELADO'].includes(comanda.estado)) {
      throw AppError.conflict(`No se puede eliminar una comanda en estado ${comanda.estado}`);
    }
    if (comanda.estado === 'PENDIENTE') {
      await devolverStock(tx, id, user.id, `Eliminación de comanda #${comanda.folio}`);
    }
    await tx.comanda.delete({ where: { id } });
    await liberarMesaSiCorresponde(tx, comanda.mesaId);
  }, TX_OPCIONES);

module.exports = {
  crear, listar, listarPorMesa, listarPorMesero, obtener, actualizar, cambiarEstado, registrarPagos, eliminar,
};
