const service = require('../services/usuarios.service');
const { ok, creado } = require('../utils/respuesta');

const listar = async (req, res) => {
  const { data, meta } = await service.listar(req.user.restauranteId, req.query);
  ok(res, data, undefined, meta);
};
const obtener = async (req, res) => ok(res, await service.obtener(req.user.restauranteId, req.params.id));
const crear = async (req, res) => creado(res, await service.crear(req.user.restauranteId, req.body), 'Usuario creado');
const actualizar = async (req, res) =>
  ok(res, await service.actualizar(req.user.restauranteId, req.params.id, req.body, req.user.id), 'Usuario actualizado');
const eliminar = async (req, res) =>
  ok(res, await service.desactivar(req.user.restauranteId, req.params.id, req.user.id), 'Usuario desactivado');

module.exports = { listar, obtener, crear, actualizar, eliminar };
