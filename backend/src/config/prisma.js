/**
 * Instancia ÚNICA de PrismaClient (patrón Singleton).
 * Crear un cliente por petición agota las conexiones de Supabase.
 */
const { PrismaClient } = require('@prisma/client');
const env = require('./env');

const prisma = new PrismaClient({
  log: env.isProd || env.isTest ? ['error'] : ['warn', 'error'],
});

module.exports = prisma;
