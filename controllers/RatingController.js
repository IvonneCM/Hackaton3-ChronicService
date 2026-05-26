const { Op } = require('sequelize');
const { Rating } = require('../models');

// ─── POST /ratings ────────────────────────────────────────────────────────────
const crearCalificacion = async (req, res) => {
  try {
    const {
      paciente_id,
      medico_id,
      cita_id,
      puntaje,
      comentario,
      aspectos,
    } = req.body;

    if (!paciente_id || !medico_id || puntaje === undefined) {
      return res.status(400).json({
        ok: false,
        mensaje: 'paciente_id, medico_id y puntaje son obligatorios',
      });
    }

    if (puntaje < 1 || puntaje > 5) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El puntaje debe estar entre 1 y 5',
      });
    }

    // Verificar si ya calificó esta cita
    if (cita_id) {
      const yaCalificó = await Rating.findOne({ where: { paciente_id, cita_id } });
      if (yaCalificó) {
        return res.status(409).json({
          ok: false,
          mensaje: 'Ya calificaste esta cita médica',
        });
      }
    }

    const calificacion = await Rating.create({
      paciente_id,
      medico_id,
      cita_id: cita_id || null,
      puntaje: parseInt(puntaje),
      comentario: comentario || null,
      aspectos: aspectos ? JSON.stringify(aspectos) : null,
    });

    return res.status(201).json({
      ok: true,
      mensaje: 'Calificación registrada correctamente',
      calificacion,
    });
  } catch (error) {
    console.error('Error en crearCalificacion:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

// ─── GET /ratings/doctor/:doctorId ────────────────────────────────────────────
const obtenerCalificacionesMedico = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { page, limit, desde, hasta } = req.query;

    const pagina = parseInt(page) || 1;
    const limite = parseInt(limit) || 20;
    const offset = (pagina - 1) * limite;

    const where = { medico_id: doctorId };
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt[Op.gte] = new Date(desde);
      if (hasta) where.createdAt[Op.lte] = new Date(hasta);
    }

    const { count, rows } = await Rating.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limite,
      offset,
    });

    // Calcular métricas de calidad
    const todasLasCalificaciones = await Rating.findAll({
      where: { medico_id: doctorId },
      attributes: ['puntaje'],
      raw: true,
    });

    const puntajes = todasLasCalificaciones.map((r) => r.puntaje);
    const promedio =
      puntajes.length > 0
        ? (puntajes.reduce((a, b) => a + b, 0) / puntajes.length).toFixed(2)
        : null;

    // Distribución de puntajes (1 a 5 estrellas)
    const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    puntajes.forEach((p) => distribucion[p]++);

    return res.json({
      ok: true,
      total: count,
      pagina,
      total_paginas: Math.ceil(count / limite),
      metricas_calidad: {
        promedio_general: parseFloat(promedio),
        total_calificaciones: puntajes.length,
        distribucion_puntajes: distribucion,
        porcentaje_satisfaccion: puntajes.length
          ? ((puntajes.filter((p) => p >= 4).length / puntajes.length) * 100).toFixed(1) + '%'
          : null,
      },
      calificaciones: rows,
    });
  } catch (error) {
    console.error('Error en obtenerCalificacionesMedico:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

module.exports = { crearCalificacion, obtenerCalificacionesMedico };