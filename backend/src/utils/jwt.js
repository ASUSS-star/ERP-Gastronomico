const jwt = require('jsonwebtoken');
const env = require('../config/env');

/** Firma un token con lo mínimo necesario (nunca datos sensibles). */
const firmarToken = (usuario) =>
  jwt.sign(
    { sub: usuario.id, rol: usuario.rol, restauranteId: usuario.restauranteId },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn, algorithm: 'HS256' },
  );

/** Verifica firma + expiración. Fija el algoritmo para evitar el ataque "alg: none". */
const verificarToken = (token) => jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });

module.exports = { firmarToken, verificarToken };
