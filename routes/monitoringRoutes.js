const express = require('express');
const router = express.Router();
const {
  createMetric,
  getMetricsByPatient,
  getAlertsByDoctor,
  createRating,
  getRatingsByDoctor,
} = require('../controllers/monitoringController');

// IoT Metrics
router.post('/iot/metrics', createMetric);
router.get('/iot/metrics/patient/:patientId', getMetricsByPatient);

// Alerts
router.get('/alerts/doctor/:doctorId', getAlertsByDoctor);

// Ratings
router.post('/ratings', createRating);
router.get('/ratings/doctor/:doctorId', getRatingsByDoctor);

module.exports = router;
