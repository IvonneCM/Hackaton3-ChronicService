require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3005;

const iniciar = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida');

    // sync({ alter: true }) en desarrollo para aplicar cambios al schema
    await sequelize.sync({ alter: true }); // o simplemente sync()
    console.log('✅ Modelos sincronizados');

    app.listen(PORT, () => {
      console.log(`🚀 chronic-monitoring-service corriendo en http://localhost:${PORT}`);
      console.log(`📡 Endpoints disponibles:`);
      console.log(`   POST  /iot/metrics`);
      console.log(`   GET   /iot/metrics/patient/:patientId`);
      console.log(`   GET   /alerts/doctor/:doctorId`);
      console.log(`   PUT   /alerts/:alertId/atender`);
      console.log(`   POST  /ratings`);
      console.log(`   GET   /ratings/doctor/:doctorId`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servicio:', error);
    process.exit(1);
  }
};

iniciar();