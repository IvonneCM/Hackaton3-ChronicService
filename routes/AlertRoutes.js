const express = require('express');
const router = express.Router();
const { obtenerAlertasMedico, atenderAlerta } = require('../controllers/alertController');
const { verifyToken } = require('../middlewares/Authmiddleware');

// GET /alerts/doctor/:doctorId — obtener alertas activas de un médico
router.get('/doctor/:doctorId', verifyToken, obtenerAlertasMedico);

// PUT /alerts/:alertId/atender — marcar alerta como atendida
router.put('/:alertId/atender', verifyToken, atenderAlerta);

module.exports = router;