const express = require('express');
const router = express.Router();
const { registrarMetrica, obtenerMetricasPaciente } = require('../controllers/iotController');
const { verifyToken } = require('../middlewares/Authmiddleware');

// POST /iot/metrics — registrar nueva métrica desde dispositivo IoT
router.post('/metrics', verifyToken, registrarMetrica);

// GET /iot/metrics/patient/:patientId — obtener métricas de un paciente
router.get('/metrics/patient/:patientId', verifyToken, obtenerMetricasPaciente);

module.exports = router;