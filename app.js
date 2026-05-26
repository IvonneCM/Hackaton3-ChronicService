const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const iotRoutes = require('./routes/iotRoutes');
const alertRoutes = require('./routes/alertRoutes');
const ratingRoutes = require('./routes/ratingRoutes');

const app = express();

// ─── Middlewares globales ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    servicio: 'chronic-monitoring-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use('/iot', iotRoutes);
app.use('/alerts', alertRoutes);
app.use('/ratings', ratingRoutes);

// ─── Ruta no encontrada ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: `Ruta ${req.method} ${req.path} no encontrada` });
});

// ─── Manejo global de errores ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
});

module.exports = app;