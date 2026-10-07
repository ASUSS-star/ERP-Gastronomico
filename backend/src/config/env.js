/**
 * Carga y valida las variables de entorno UNA sola vez.
 * Si falta algo crítico, la app se detiene al arrancar (fail fast)
 * en lugar de fallar a mitad de una petición.
 */
require('dotenv').config({ quiet: true });

const requeridas = ['DATABASE_URL', 'JWT_SECRET'];
const faltantes = requeridas.filter((k) => !process.env[k]);
if (faltantes.length) {
  throw new Error(`Faltan variables de entorno: ${faltantes.join(', ')}. Revisa tu archivo .env`);
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  bcryptRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim()),
};
