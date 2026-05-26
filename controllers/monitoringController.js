const { pool } = require('../database/db');

// ─── RANGOS NORMALES POR MÉTRICA ──────────────────────────────────────────────
const RANGES = {
  glucosa:            { min: 70,  max: 110, unit: 'mg/dL'  },
  presion_sistolica:  { min: 90,  max: 140, unit: 'mmHg'   },
  presion_diastolica: { min: 60,  max: 90,  unit: 'mmHg'   },
  frecuencia_cardiaca:{ min: 60,  max: 100, unit: 'bpm'    },
  saturacion_oxigeno: { min: 95,  max: 100, unit: '%'      },
  temperatura:        { min: 36.1,max: 37.2,unit: '°C'     },
};

// Determina severidad según cuánto se aleja del rango
function getSeverity(metricType, value) {
  const range = RANGES[metricType];
  if (!range) return null; // métrica desconocida → no alerta

  if (value >= range.min && value <= range.max) return null; // dentro del rango

  const deviation = value < range.min
    ? ((range.min - value) / range.min) * 100
    : ((value - range.max) / range.max) * 100;

  if (deviation >= 30) return 'critica';
  if (deviation >= 20) return 'alta';
  if (deviation >= 10) return 'media';
  return 'baja';
}

// ─── POST /iot/metrics ────────────────────────────────────────────────────────
const createMetric = async (req, res) => {
  const { patient_id, metric_type, metric_value, unit } = req.body;

  if (!patient_id || !metric_type || metric_value === undefined) {
    return res.status(400).json({ error: 'patient_id, metric_type y metric_value son requeridos.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insertar métrica
    const metricResult = await client.query(
      `INSERT INTO monitoring_service.iot_metrics
         (patient_id, metric_type, metric_value, unit)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [patient_id, metric_type, metric_value, unit || RANGES[metric_type]?.unit || '']
    );
    const metric = metricResult.rows[0];

    // 2. ¿Está fuera de rango? → buscar médico y generar alerta
    const severity = getSeverity(metric_type, parseFloat(metric_value));
    let alert = null;

    if (severity) {
      // Buscar el médico más reciente que atiende a este paciente
      const doctorResult = await client.query(
        `SELECT doctor_id FROM appointment_service.appointments
          WHERE patient_id = $1
            AND status IN ('programada','completada')
          ORDER BY appointment_date DESC
          LIMIT 1`,
        [patient_id]
      );

      if (doctorResult.rows.length > 0) {
        const doctor_id = doctorResult.rows[0].doctor_id;
        const range = RANGES[metric_type];
        const message = `[ALERTA ${severity.toUpperCase()}] Métrica "${metric_type}" = ${metric_value} ${metric.unit} — rango normal: ${range.min}–${range.max} ${range.unit}`;

        const alertResult = await client.query(
          `INSERT INTO monitoring_service.alerts
             (patient_id, doctor_id, metric_id, severity, message, status)
           VALUES ($1, $2, $3, $4, $5, 'pendiente')
           RETURNING *`,
          [patient_id, doctor_id, metric.id, severity, message]
        );
        alert = alertResult.rows[0];
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      metric,
      alert: alert || null,
      in_range: !severity,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createMetric error:', err.message);
    return res.status(500).json({ error: 'Error al registrar métrica.' });
  } finally {
    client.release();
  }
};

// ─── GET /iot/metrics/patient/:patientId ──────────────────────────────────────
const getMetricsByPatient = async (req, res) => {
  const { patientId } = req.params;
  const { metric_type, limit = 50, offset = 0 } = req.query;

  try {
    let query = `
      SELECT * FROM monitoring_service.iot_metrics
      WHERE patient_id = $1`;
    const params = [patientId];

    if (metric_type) {
      params.push(metric_type);
      query += ` AND metric_type = $${params.length}`;
    }

    query += ` ORDER BY measured_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Resumen estadístico por tipo de métrica
    const summaryResult = await pool.query(
      `SELECT metric_type,
              COUNT(*)::int          AS total,
              ROUND(AVG(metric_value)::numeric, 2) AS promedio,
              MIN(metric_value)      AS minimo,
              MAX(metric_value)      AS maximo,
              MAX(measured_at)       AS ultima_medicion
         FROM monitoring_service.iot_metrics
        WHERE patient_id = $1
        GROUP BY metric_type`,
      [patientId]
    );

    return res.status(200).json({
      patient_id: patientId,
      total: result.rowCount,
      metrics: result.rows,
      summary: summaryResult.rows,
    });
  } catch (err) {
    console.error('getMetricsByPatient error:', err.message);
    return res.status(500).json({ error: 'Error al obtener métricas.' });
  }
};

// ─── GET /alerts/doctor/:doctorId ─────────────────────────────────────────────
const getAlertsByDoctor = async (req, res) => {
  const { doctorId } = req.params;
  const { status, severity } = req.query;

  try {
    let query = `
      SELECT
        a.*,
        u.full_name   AS patient_name,
        u.email       AS patient_email,
        m.metric_type,
        m.metric_value,
        m.unit        AS metric_unit,
        m.measured_at
      FROM monitoring_service.alerts a
      JOIN auth_service.users       u ON u.id = a.patient_id
      LEFT JOIN monitoring_service.iot_metrics m ON m.id = a.metric_id
      WHERE a.doctor_id = $1`;

    const params = [doctorId];

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }
    if (severity) {
      params.push(severity);
      query += ` AND a.severity = $${params.length}`;
    }

    query += ` ORDER BY
        CASE a.severity
          WHEN 'critica' THEN 1
          WHEN 'alta'    THEN 2
          WHEN 'media'   THEN 3
          ELSE 4
        END,
        a.created_at DESC`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      doctor_id: doctorId,
      total: result.rowCount,
      alerts: result.rows,
    });
  } catch (err) {
    console.error('getAlertsByDoctor error:', err.message);
    return res.status(500).json({ error: 'Error al obtener alertas.' });
  }
};

// ─── POST /ratings ────────────────────────────────────────────────────────────
const createRating = async (req, res) => {
  const { patient_id, doctor_id, appointment_id, rating, comment } = req.body;

  if (!patient_id || !doctor_id || !rating) {
    return res.status(400).json({ error: 'patient_id, doctor_id y rating son requeridos.' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'El rating debe estar entre 1 y 5.' });
  }

  // Verificar que no haya calificado ya esta cita
  if (appointment_id) {
    const existing = await pool.query(
      `SELECT id FROM monitoring_service.ratings
        WHERE patient_id = $1 AND appointment_id = $2`,
      [patient_id, appointment_id]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Ya existe una calificación para esta cita.' });
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO monitoring_service.ratings
         (patient_id, doctor_id, appointment_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [patient_id, doctor_id, appointment_id || null, rating, comment || null]
    );
    return res.status(201).json({ rating: result.rows[0] });
  } catch (err) {
    console.error('createRating error:', err.message);
    return res.status(500).json({ error: 'Error al registrar calificación.' });
  }
};

// ─── GET /ratings/doctor/:doctorId ────────────────────────────────────────────
const getRatingsByDoctor = async (req, res) => {
  const { doctorId } = req.params;

  try {
    const ratingsResult = await pool.query(
      `SELECT
         r.*,
         u.full_name AS patient_name
       FROM monitoring_service.ratings r
       JOIN auth_service.users u ON u.id = r.patient_id
       WHERE r.doctor_id = $1
       ORDER BY r.created_at DESC`,
      [doctorId]
    );

    const statsResult = await pool.query(
      `SELECT
         COUNT(*)::int                          AS total_ratings,
         ROUND(AVG(rating)::numeric, 2)         AS average_rating,
         COUNT(*) FILTER (WHERE rating = 5)::int AS five_stars,
         COUNT(*) FILTER (WHERE rating = 4)::int AS four_stars,
         COUNT(*) FILTER (WHERE rating = 3)::int AS three_stars,
         COUNT(*) FILTER (WHERE rating = 2)::int AS two_stars,
         COUNT(*) FILTER (WHERE rating = 1)::int AS one_star
       FROM monitoring_service.ratings
       WHERE doctor_id = $1`,
      [doctorId]
    );

    return res.status(200).json({
      doctor_id: doctorId,
      stats: statsResult.rows[0],
      ratings: ratingsResult.rows,
    });
  } catch (err) {
    console.error('getRatingsByDoctor error:', err.message);
    return res.status(500).json({ error: 'Error al obtener calificaciones.' });
  }
};

module.exports = {
  createMetric,
  getMetricsByPatient,
  getAlertsByDoctor,
  createRating,
  getRatingsByDoctor,
};
