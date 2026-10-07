const { Joi, texto, password, paginacion } = require('./comunes');
const { ROLES } = require('../constants');

const rol = Joi.string().uppercase().valid(...Object.values(ROLES));

const crear = Joi.object({
  nombre: texto(100).min(2).required(),
  email: Joi.string().trim().lowercase().email().max(150).required(),
  password: password.required(),
  rol: rol.required(),
});

const actualizar = Joi.object({
  nombre: texto(100).min(2),
  email: Joi.string().trim().lowercase().email().max(150),
  password,
  rol,
  activo: Joi.boolean(),
}).min(1);

const listar = Joi.object({ ...paginacion, rol, activo: Joi.boolean(), q: texto(100) });

module.exports = { crear, actualizar, listar };
