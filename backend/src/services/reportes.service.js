/**
 * Reportes para el dashboard (ADMIN / CAJERO).
 * Se ejecutan en paralelo con Promise.all para reducir el tiempo de respuesta.
 */
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const inicioDelDia = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const resumen = async (restauranteId, { desde, hasta } = {}) => {
  const rango = { gte: desde || inicioDelDia(), ...(hasta && { lte: hasta }) };
  const wherePagadas = { restauranteId, estado: 'PAGADO', pagadoAt: rango };

  const [ventas, porEstado, porMetodo, topAgrupado, stockBajo, mesasOcupadas] = await Promise.all([
    prisma.comanda.aggregate({ where: wherePagadas, _sum: { total: true }, _count: true, _avg: { total: true } }),
    prisma.comanda.groupBy({ by: ['estado'], where: { restauranteId, createdAt: rango }, _count: true }),
    // Por método se suman los PAGOS: una cuenta dividida aporta a varios métodos
    prisma.pago.groupBy({ by: ['metodo'], where: { restauranteId, comanda: wherePagadas }, _sum: { monto: true }, _count: true }),
    prisma.detalleComanda.groupBy({
      by: ['platilloId'],
      where: { comanda: wherePagadas },
      _sum: { cantidad: true, subtotal: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 5,
    }),
    prisma.insumo.count({ where: { restauranteId, stockActual: { lte: prisma.insumo.fields.stockMinimo } } }),
    prisma.mesa.count({ where: { restauranteId, estado: 'OCUPADA' } }),
  ]);

  const nombres = await prisma.platillo.findMany({
    where: { id: { in: topAgrupado.map((t) => t.platilloId) } },
    select: { id: true, nombre: true },
  });

  return {
    rango: { desde: rango.gte, hasta: hasta || new Date() },
    ventas: {
      total: ventas._sum.total || 0,
      comandasPagadas: ventas._count,
      ticketPromedio: ventas._avg.total || 0,
    },
    comandasPorEstado: Object.fromEntries(porEstado.map((e) => [e.estado, e._count])),
    ventasPorMetodo: porMetodo.map((m) => ({ metodo: m.metodo, total: m._sum.monto, pagos: m._count })),
    topPlatillos: topAgrupado.map((t) => ({
      platilloId: t.platilloId,
      nombre: nombres.find((n) => n.id === t.platilloId)?.nombre,
      cantidad: t._sum.cantidad,
      importe: t._sum.subtotal,
    })),
    insumosStockBajo: stockBajo,
    mesasOcupadas,
  };
};

/**
 * CORTE DE CAJA (no guarda nada: se calcula al momento para el periodo pedido).
 *  - Ventas: comandas PAGADAS en el periodo, con la lista de platillos vendidos y de tickets.
 *  - Dinero recibido por método: TODOS los pagos registrados en el periodo, incluidos los
 *    abonos de cuentas que siguen abiertas (es lo que físicamente entró a la caja).
 * El frontend manda `desde`/`hasta` con la medianoche LOCAL (el servidor en la nube usa UTC).
 */
const DIA = 24 * 60 * 60 * 1000;
const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;

const corte = async (restauranteId, { desde, hasta } = {}) => {
  const fin = hasta ? new Date(hasta) : new Date();
  const inicio = desde ? new Date(desde) : inicioDelDia();
  if (fin - inicio > 31 * DIA) throw AppError.badRequest('El corte puede abarcar como máximo 31 días');
  const rango = { gte: inicio, lte: fin };
  const wherePagadas = { restauranteId, estado: 'PAGADO', pagadoAt: rango };

  const [comandas, pagos, canceladas, abiertas] = await Promise.all([
    prisma.comanda.findMany({
      where: wherePagadas,
      orderBy: { pagadoAt: 'asc' },
      select: {
        id: true, folio: true, total: true, pagadoAt: true,
        mesa: { select: { numero: true } },
        mesero: { select: { nombre: true } },
        detalles: { select: { platilloId: true, cantidad: true, subtotal: true, platillo: { select: { nombre: true } } } },
        pagos: { select: { metodo: true, monto: true } },
      },
    }),
    prisma.pago.findMany({
      where: { restauranteId, createdAt: rango },
      select: { metodo: true, monto: true, cambio: true, comanda: { select: { estado: true } } },
    }),
    prisma.comanda.aggregate({ where: { restauranteId, estado: 'CANCELADO', updatedAt: rango }, _count: true, _sum: { total: true } }),
    prisma.comanda.aggregate({
      where: { restauranteId, estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'] } },
      _count: true, _sum: { total: true },
    }),
  ]);

  // Platillos vendidos (sumando todas las comandas pagadas)
  const porPlatillo = new Map();
  for (const c of comandas) {
    for (const d of c.detalles) {
      const p = porPlatillo.get(d.platilloId) || { platilloId: d.platilloId, nombre: d.platillo?.nombre ?? 'Platillo eliminado', cantidad: 0, importe: 0 };
      p.cantidad += d.cantidad;
      p.importe += n(d.subtotal);
      porPlatillo.set(d.platilloId, p);
    }
  }
  const platillos = [...porPlatillo.values()]
    .map((p) => ({ ...p, importe: r2(p.importe) }))
    .sort((a, b) => b.importe - a.importe || b.cantidad - a.cantidad);

  // Dinero recibido por método de pago
  const metodos = {};
  let abonos = 0;
  for (const p of pagos) {
    const m = (metodos[p.metodo] ||= { metodo: p.metodo, total: 0, pagos: 0 });
    m.total += n(p.monto);
    m.pagos += 1;
    if (p.comanda?.estado !== 'PAGADO') abonos += n(p.monto);
  }
  const porMetodo = Object.values(metodos).map((m) => ({ ...m, total: r2(m.total) })).sort((a, b) => b.total - a.total);

  const totalVentas = r2(comandas.reduce((s, c) => s + n(c.total), 0));
  return {
    rango: { desde: inicio, hasta: fin },
    generado: new Date(),
    ventas: {
      total: totalVentas,
      comandas: comandas.length,
      articulos: platillos.reduce((s, p) => s + p.cantidad, 0),
      ticketPromedio: comandas.length ? r2(totalVentas / comandas.length) : 0,
    },
    porMetodo,
    recibido: r2(porMetodo.reduce((s, m) => s + m.total, 0)),
    efectivoEsperado: r2(metodos.EFECTIVO?.total || 0),
    abonosCuentasAbiertas: r2(abonos),
    platillos,
    comandas: comandas.map((c) => ({
      folio: c.folio,
      mesa: c.mesa?.numero,
      mesero: c.mesero?.nombre,
      pagadoAt: c.pagadoAt,
      total: n(c.total),
      metodos: [...new Set(c.pagos.map((p) => p.metodo))],
    })),
    canceladas: { cantidad: canceladas._count, total: n(canceladas._sum.total) },
    abiertas: { cantidad: abiertas._count, total: n(abiertas._sum.total) },
  };
};

module.exports = { resumen, corte };
