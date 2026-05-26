const { Sequelize } = require('sequelize');
const pg = require('pg'); 
require('dotenv').config();

// Detect SSL requirement (Neon/managed Postgres)
const mustUseSSL =
  (process.env.DB_SSL && ['true', '1', 'yes'].includes(String(process.env.DB_SSL).toLowerCase())) ||
  /neon\.tech/i.test(process.env.DB_HOST || '') ||
  /render\.com/i.test(process.env.DB_HOST || '') ||
  /aws\.com/i.test(process.env.DB_HOST || '');

const commonOpts = {
  dialect: 'postgres',
  dialectModule: pg,
  logging: false,
  dialectOptions: mustUseSSL
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false, // necesario para Neon/Render
        },
      }
    : {},
};

// Permite DATABASE_URL o variables separadas
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, commonOpts)
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        ...commonOpts,
      }
    );

/*const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    dialectModule: pg, 
    logging: false,
  }
);*/
const dbConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexión a la base de datos exitosa');
  } catch (error) {
    console.error('Error al conectar la base de datos:', error);
    throw new Error('Error al iniciar la base de datos');
  }
};

module.exports = {
  dbConnection,
  sequelize, 
};

