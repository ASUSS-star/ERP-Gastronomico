const { Joi, texto, password } = require('./comunes');

const registro = Joi.object({
  restaurante: Joi.object({
    nombre: texto(120).min(2).required(),
    telefono: texto(20).allow('', null),
    direccion: texto(255).allow('', null),
  }).required(),
  admin: Joi.object({
    nombre: texto(100).min(2).required(),
    email: Joi.string().trim().lowercase().email().max(150).required(),
    password: password.required(),
  }).required(),
});

const login = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().max(72).required(),
});

const cambiarPassword = Joi.object({
  passwordActual: Joi.string().max(72).required(),
  passwordNueva: password.required().invalid(Joi.ref('passwordActual')).messages({
    'any.invalid': 'La contraseña nueva debe ser distinta a la actual',
  }),
});

module.exports = { registro, login, cambiarPassword };
