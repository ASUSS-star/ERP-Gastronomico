/**
 * Limita intentos de login/registro para frenar ataques de fuerza bruta.
 * En pruebas automáticas (NODE_ENV=test) se desactiva.
 */
const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { ok: false, mensaje: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
});

module.exports = { limiteAuth };
