const { Sequelize, DataTypes } = require('sequelize');
const pg = require('pg');
require('dotenv').config();

// ─── Configuración de Conexión ───────────────────────────────────────────────
const mustUseSSL =
  (process.env.DB_SSL && ['true', '1', 'yes'].includes(String(process.env.DB_SSL).toLowerCase())) ||
  /neon\.tech/i.test(process.env.DATABASE_URL || '') ||
  /neon\.tech/i.test(process.env.DB_HOST || '');

const commonOpts = {
  dialect: 'postgres',
  dialectModule: pg,
  logging: false, // Apagamos el log para que no ensucie tu consola
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: mustUseSSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, commonOpts)
  : new Sequelize(
      process.env.DB_NAME || 'mediconnect_monitoring',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || 'password',
      { host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT) || 5432, ...commonOpts }
    );

// ─── Modelo: IotMetric ────────────────────────────────────────────────────────
const IotMetric = sequelize.define('IotMetric', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  paciente_id: { type: DataTypes.UUID, allowNull: false, field: 'patient_id' }, // Mapeo al inglés
  tipo_metrica: { type: DataTypes.STRING(50), allowNull: false, field: 'metric_type' },
  valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'metric_value' },
  unidad: { type: DataTypes.STRING(30), field: 'unit' },
  // measured_at en tu BD
  measured_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { 
  tableName: 'iot_metrics', 
  timestamps: false // Apagamos createdAt/updatedAt por defecto
});

// ─── Modelo: Alert ────────────────────────────────────────────────────────────
const Alert = sequelize.define('Alert', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  paciente_id: { type: DataTypes.UUID, allowNull: false, field: 'patient_id' },
  medico_id: { type: DataTypes.UUID, allowNull: false, field: 'doctor_id' },
  metrica_id: { type: DataTypes.UUID, field: 'metric_id' },
  severidad: { type: DataTypes.STRING(20), defaultValue: 'media', field: 'severity' },
  mensaje: { type: DataTypes.TEXT, allowNull: false, field: 'message' },
  estado: { type: DataTypes.STRING(30), defaultValue: 'pendiente', field: 'status' },
  createdAt: { type: DataTypes.DATE, field: 'created_at', defaultValue: DataTypes.NOW }
}, { 
  tableName: 'alerts', 
  timestamps: false 
});

// ─── Modelo: Rating ───────────────────────────────────────────────────────────
const Rating = sequelize.define('Rating', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  paciente_id: { type: DataTypes.UUID, allowNull: false, field: 'patient_id' },
  medico_id: { type: DataTypes.UUID, allowNull: false, field: 'doctor_id' },
  cita_id: { type: DataTypes.UUID, field: 'appointment_id' },
  puntaje: { type: DataTypes.INTEGER, allowNull: false, field: 'rating' },
  comentario: { type: DataTypes.TEXT, field: 'comment' },
  createdAt: { type: DataTypes.DATE, field: 'created_at', defaultValue: DataTypes.NOW }
}, { 
  tableName: 'ratings', 
  timestamps: false 
});

// ─── Asociaciones ─────────────────────────────────────────────────────────────
Alert.belongsTo(IotMetric, { foreignKey: 'metric_id', as: 'metrica' });
IotMetric.hasMany(Alert, { foreignKey: 'metric_id', as: 'alertas' });

module.exports = { sequelize, IotMetric, Alert, Rating };