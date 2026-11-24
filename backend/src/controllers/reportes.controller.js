const service = require('../services/reportes.service');
const { ok } = require('../utils/respuesta');

module.exports = {
  resumen: async (req, res) => ok(res, await service.resumen(req.user.restauranteId, req.query)),
  corte: async (req, res) => ok(res, await service.corte(req.user.restauranteId, req.query)),
};
