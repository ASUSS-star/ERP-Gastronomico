/**
 * Después de cada POST/PUT/PATCH/DELETE exitoso avisa al canal del restaurante qué cambió.
 * Envuelve res.json para mandar el aviso ANTES de responder: en Vercel la función puede
 * congelarse en cuanto se envía la respuesta, y el aviso se perdería.
 */
const { notificar } = require('../utils/tiempoReal');

// Recurso de la URL → qué pantallas deben recargar
const TIPOS = {
  comandas: ['comandas', 'mesas', 'inventario', 'reportes'],
  mesas: ['mesas'],
  platillos: ['menu'],
  categorias: ['menu'],
  insumos: ['inventario', 'menu'],
  proveedores: ['inventario'],
  usuarios: ['usuarios'],
};
const MUTACIONES = ['POST', 'PUT', 'PATCH', 'DELETE'];

const resumenComanda = (d) =>
  d && d.folio ? { id: d.id, folio: d.folio, estado: d.estado, meseroId: d.meseroId, mesa: d.mesa?.numero } : undefined;

const notificarCambios = (req, res, next) => {
  const recurso = req.path.split('/')[1];
  const tipos = TIPOS[recurso];
  if (!tipos || !MUTACIONES.includes(req.method)) return next();

  const enviar = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 || !req.user) return enviar(body);
    const comanda = recurso === 'comandas' ? resumenComanda(body?.data) : undefined;
    notificar(req.user.restauranteId, { tipos, origen: req.user.id, ...(comanda && { comanda }) })
      .finally(() => enviar(body));
    return res;
  };
  return next();
};

module.exports = { notificarCambios };
