/**
 * Configuración de la aplicación Express (sin levantar el servidor).
 * Separar app.js de server.js permite importar la app en las pruebas con supertest.
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

// --- Seguridad y utilidades ---
app.disable('x-powered-by');
app.use(helmet()); // cabeceras HTTP seguras
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' })); // limita el tamaño del body
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

// --- Rutas ---
app.get('/', (_req, res) => res.json({ ok: true, mensaje: 'ERP Gastronómico API — ver /api/health' }));
app.use('/api', routes);

// --- Manejo de errores (SIEMPRE al final) ---
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
