const { Router } = require('express');
const ctrl = require('../controllers/usuarios.controller');
const v = require('../validators/usuarios.validator');
const { idParam } = require('../validators/comunes');
const { validar } = require('../middlewares/validate.middleware');
const { autenticar } = require('../middlewares/auth.middleware');
const { permitirRoles } = require('../middlewares/roles.middleware');
const { ROLES } = require('../constants');

const router = Router();
// Toda la gestión de personal es exclusiva del ADMIN
router.use(autenticar, permitirRoles(ROLES.ADMIN));

router.get('/', validar({ query: v.listar }), ctrl.listar);
router.get('/:id', validar({ params: idParam }), ctrl.obtener);
router.post('/', validar({ body: v.crear }), ctrl.crear);
router.put('/:id', validar({ params: idParam, body: v.actualizar }), ctrl.actualizar);
router.delete('/:id', validar({ params: idParam }), ctrl.eliminar);

module.exports = router;
