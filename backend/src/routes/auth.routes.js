const { Router } = require('express');
const ctrl = require('../controllers/auth.controller');
const v = require('../validators/auth.validator');
const { validar } = require('../middlewares/validate.middleware');
const { autenticar } = require('../middlewares/auth.middleware');
const { limiteAuth } = require('../middlewares/rateLimit.middleware');

const router = Router();

// Públicas
router.post('/registro', limiteAuth, validar({ body: v.registro }), ctrl.registro);
router.post('/login', limiteAuth, validar({ body: v.login }), ctrl.login);

// Protegidas
router.get('/perfil', autenticar, ctrl.perfil);
router.patch('/password', autenticar, validar({ body: v.cambiarPassword }), ctrl.cambiarPassword);

module.exports = router;
