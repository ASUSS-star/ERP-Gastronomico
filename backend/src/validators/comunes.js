const Joi = require('joi');

const id = Joi.number().integer().positive();
const idParam = Joi.object({ id: id.required() });
const paginacion = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};
// Texto saneado: quita espacios extremos y limita longitud
const texto = (max) => Joi.string().trim().max(max);
const dinero = Joi.number().precision(2).min(0).max(999999.99);
const cantidadDecimal = Joi.number().precision(3).positive().max(9999999);
// Contraseña: mínimo 8, al menos una letra y un número
const password = Joi.string()
  .min(8)
  .max(72) // bcrypt sólo usa los primeros 72 bytes
  .pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)
  .messages({ 'string.pattern.base': 'La contraseña debe contener al menos una letra y un número' });

module.exports = { Joi, id, idParam, paginacion, texto, dinero, cantidadDecimal, password };
