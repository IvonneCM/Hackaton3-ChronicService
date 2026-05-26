const { Op } = require('sequelize');
const { IotMetric, Alert } = require('../models');

// ─── Rangos normales por tipo de métrica ───────────────────────────────────────
const METRIC_RANGES = {
  glucosa: { min: 70, max: 140, unit: 'mg/dL' },
  presion_sistolica: { min: 90, max: 140, unit: 'mmHg' },
  presion_diastolica: { min: 60, max: 90, unit: 'mmHg' },
  oxigeno: { min: 95, max: 100, unit: '%' },
  frecuencia_cardiaca: { min: 60, max: 100, unit: 'bpm' },
  temperatura: { min: 36.1, max: 37.5, unit: '°C' },
};

// ─── Helper: evaluar si el valor está fuera de rango ──────────────────────────
const evaluateMetric = (tipo, valor) => {
  const range = METRIC_RANGES[tipo];
  if (!range) return { fuera_de_rango: false, mensaje: null };

  if (valor < range.min) {
    return {
      fuera_de_rango: true,
      severidad: valor < range.min * 0.85 ? 'CRITICA' : 'MODERADA',
      mensaje: `${tipo} BAJA: ${valor} ${range.unit} (mínimo esperado: ${range.min} ${range.unit})`,
    };
  }
  if (valor > range.max) {
    return {
      fuera_de_rango: true,
      severidad: valor > range.max * 1.2 ? 'CRITICA' : 'MODERADA',
      mensaje: `${tipo} ALTA: ${valor} ${range.unit} (máximo esperado: ${range.max} ${range.unit})`,
    };
  }
  return { fuera_de_rango: false, mensaje: null };
};

// ─── POST /iot/metrics ────────────────────────────────────────────────────────
const registrarMetrica = async (req, res) => {
  try {
    const {
      paciente_id,
      medico_id,
      tipo_metrica,
      valor,
      dispositivo,
      notas,
    } = req.body;

    if (!paciente_id || !tipo_metrica || valor === undefined) {
      return res.status(400).json({
        ok: false,
        mensaje: 'paciente_id, tipo_metrica y valor son obligatorios',
      });
    }

    const tiposValidos = Object.keys(METRIC_RANGES);
    if (!tiposValidos.includes(tipo_metrica)) {
      return res.status(400).json({
        ok: false,
        mensaje: `tipo_metrica inválido. Tipos permitidos: ${tiposValidos.join(', ')}`,
      });
    }

    // Registrar la métrica
    const metrica = await IotMetric.create({
      paciente_id,
      medico_id: medico_id || null,
      tipo_metrica,
      valor: parseFloat(valor),
      unidad: METRIC_RANGES[tipo_metrica].unit,
      dispositivo: dispositivo || 'IoT genérico',
      notas: notas || null,
    });

    // Evaluar si genera alerta
    const evaluacion = evaluateMetric(tipo_metrica, parseFloat(valor));
    let alerta = null;

    if (evaluacion.fuera_de_rango && medico_id) {
      alerta = await Alert.create({
        paciente_id,
        medico_id,
        metrica_id: metrica.id,
        tipo_metrica,
        valor_registrado: parseFloat(valor),
        severidad: evaluacion.severidad,
        mensaje: evaluacion.mensaje,
        estado: 'PENDIENTE',
      });
    }

    return res.status(201).json({
      ok: true,
      mensaje: 'Métrica registrada correctamente',
      metrica,
      alerta_generada: alerta
        ? {
            id: alerta.id,
            severidad: alerta.severidad,
            mensaje: alerta.mensaje,
          }
        : null,
    });
  } catch (error) {
    console.error('Error en registrarMetrica:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

// ─── GET /iot/metrics/patient/:patientId ──────────────────────────────────────
const obtenerMetricasPaciente = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { tipo_metrica, desde, hasta, page, limit } = req.query;

    const pagina = parseInt(page) || 1;
    const limite = parseInt(limit) || 20;
    const offset = (pagina - 1) * limite;

    const where = { paciente_id: patientId };

    if (tipo_metrica) where.tipo_metrica = tipo_metrica;
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt[Op.gte] = new Date(desde);
      if (hasta) where.createdAt[Op.lte] = new Date(hasta);
    }

    const { count, rows } = await IotMetric.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limite,
      offset,
    });

    // Resumen por tipo de métrica
    const resumen = {};
    rows.forEach((m) => {
      if (!resumen[m.tipo_metrica]) {
        resumen[m.tipo_metrica] = { total: 0, ultimo_valor: null, unidad: m.unidad };
      }
      resumen[m.tipo_metrica].total += 1;
      if (!resumen[m.tipo_metrica].ultimo_valor) {
        resumen[m.tipo_metrica].ultimo_valor = m.valor;
      }
    });

    return res.json({
      ok: true,
      total: count,
      pagina,
      total_paginas: Math.ceil(count / limite),
      resumen_por_tipo: resumen,
      metricas: rows,
    });
  } catch (error) {
    console.error('Error en obtenerMetricasPaciente:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

module.exports = { registrarMetrica, obtenerMetricasPaciente };