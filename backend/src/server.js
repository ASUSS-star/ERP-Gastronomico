/** Punto de entrada: levanta el servidor HTTP y cierra Prisma de forma ordenada. */
const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

const server = app.listen(env.port, () => {
  console.log(`ERP Gastronómico API escuchando en http://localhost:${env.port}/api (${env.nodeEnv})`);
});

const apagar = async (senal) => {
  console.log(`\n${senal} recibido. Cerrando servidor...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('unhandledRejection', (err) => {
  console.error('Promesa rechazada sin manejar:', err);
});
