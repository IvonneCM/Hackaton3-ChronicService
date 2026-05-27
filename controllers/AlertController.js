const { Op } = require('sequelize');
const { Alert, IotMetric } = require('../models');

// ─── GET /alerts/doctor/:doctorId ─────────────────────────────────────────────
const obtenerAlertasMedico = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { estado, severidad, page, limit } = req.query;

    const pagina = parseInt(page) || 1;
    const limite = parseInt(limit) || 20;
    const offset = (pagina - 1) * limite;

    const where = { medico_id: doctorId };

    if (estado) where.estado = estado.toUpperCase();
    if (severidad) where.severidad = severidad.toUpperCase();

    const { count, rows } = await Alert.findAndCountAll({
      where,
      order: [
        // Críticas primero, luego por fecha
        ['severidad', 'ASC'],
        ['measured_at', 'DESC'],
      ],
      limit: limite,
      offset,
      include: [
        {
          model: IotMetric,
          as: 'metrica',
          attributes: ['tipo_metrica', 'valor', 'unidad', 'dispositivo', 'measured_at'],
        },
      ],
    });

    // Conteo por estado
    const conteoEstados = await Alert.findAll({
      where: { medico_id: doctorId },
      attributes: [
        'estado',
        [Alert.sequelize.fn('COUNT', Alert.sequelize.col('id')), 'total'],
      ],
      group: ['estado'],
      raw: true,
    });

    return res.json({
      ok: true,
      total: count,
      pagina,
      total_paginas: Math.ceil(count / limite),
      resumen_estados: conteoEstados,
      alertas: rows,
    });
  } catch (error) {
    console.error('Error en obtenerAlertasMedico:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

// ─── PUT /alerts/:alertId/atender ─────────────────────────────────────────────
const atenderAlerta = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { notas_medico } = req.body;

    const alerta = await Alert.findByPk(alertId);
    if (!alerta) {
      return res.status(404).json({ ok: false, mensaje: 'Alerta no encontrada' });
    }

    await alerta.update({
      estado: 'ATENDIDA',
      notas_medico: notas_medico || null,
      atendida_at: new Date(),
    });

    return res.json({
      ok: true,
      mensaje: 'Alerta marcada como atendida',
      alerta,
    });
  } catch (error) {
    console.error('Error en atenderAlerta:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

module.exports = { obtenerAlertasMedico, atenderAlerta };