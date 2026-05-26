const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME     || 'mediconnect_monitoring',
  process.env.DB_USER     || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host:    process.env.DB_HOST || 'localhost',
    port:    parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  }
);

// ─── Modelo: IotMetric ────────────────────────────────────────────────────────
const IotMetric = sequelize.define('IotMetric', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  paciente_id: { type: DataTypes.INTEGER, allowNull: false },
  medico_id:   { type: DataTypes.INTEGER, allowNull: true },
  tipo_metrica: {
    type: DataTypes.ENUM(
      'glucosa',
      'presion_sistolica',
      'presion_diastolica',
      'oxigeno',
      'frecuencia_cardiaca',
      'temperatura'
    ),
    allowNull: false,
  },
  valor:      { type: DataTypes.FLOAT, allowNull: false },
  unidad:     { type: DataTypes.STRING(20), allowNull: false },
  dispositivo:{ type: DataTypes.STRING(100), defaultValue: 'IoT genérico' },
  notas:      { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'iot_metrics', timestamps: true });

// ─── Modelo: Alert ────────────────────────────────────────────────────────────
const Alert = sequelize.define('Alert', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  paciente_id: { type: DataTypes.INTEGER, allowNull: false },
  medico_id:   { type: DataTypes.INTEGER, allowNull: false },
  metrica_id:  { type: DataTypes.INTEGER, allowNull: true },
  tipo_metrica: { type: DataTypes.STRING(50), allowNull: false },
  valor_registrado: { type: DataTypes.FLOAT, allowNull: false },
  severidad: {
    type: DataTypes.ENUM('MODERADA', 'CRITICA'),
    allowNull: false,
  },
  mensaje: { type: DataTypes.TEXT, allowNull: false },
  estado: {
    type: DataTypes.ENUM('PENDIENTE', 'ATENDIDA'),
    defaultValue: 'PENDIENTE',
  },
  notas_medico: { type: DataTypes.TEXT, allowNull: true },
  atendida_at:  { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'alerts', timestamps: true });

// ─── Modelo: Rating ───────────────────────────────────────────────────────────
const Rating = sequelize.define('Rating', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  paciente_id: { type: DataTypes.INTEGER, allowNull: false },
  medico_id:   { type: DataTypes.INTEGER, allowNull: false },
  cita_id:     { type: DataTypes.INTEGER, allowNull: true },
  puntaje: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  comentario: { type: DataTypes.TEXT, allowNull: true },
  aspectos:   { type: DataTypes.TEXT, allowNull: true }, // JSON stringified
}, { tableName: 'ratings', timestamps: true });

// ─── Asociaciones ─────────────────────────────────────────────────────────────
Alert.belongsTo(IotMetric, { foreignKey: 'metrica_id', as: 'metrica' });
IotMetric.hasMany(Alert, { foreignKey: 'metrica_id', as: 'alertas' });

module.exports = { sequelize, IotMetric, Alert, Rating };