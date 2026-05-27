/**
 * iotSimulator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Simula dispositivos IoT enviando métricas de salud de pacientes crónicos.
 * Envía una métrica cada pocos segundos con valores realistas,
 * incluyendo picos fuera de rango para activar alertas automáticas.
 *
 * Uso:  node helpers/iotSimulator.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: '../.env' });

const BASE_URL = process.env.SIMULATOR_URL || 'http://localhost:4003';
const TOKEN    = process.env.SIMULATOR_TOKEN || 'TU_JWT_TOKEN_AQUI';
const INTERVAL_MS = parseInt(process.env.SIMULATOR_INTERVAL) || 4000; // 4 segundos

// ─── Pacientes crónicos de prueba ─────────────────────────────────────────────
const PACIENTES = [
    { 
    paciente_id: 'f7a3303c-b677-456a-bc05-288368590cf0', // 👉 ¡Con comillas!
    medico_id: 'ae777763-c67b-462a-933b-6c4ffdfa63d8',   // 👉 ¡Con comillas!
    nombre: 'Carlos Mendoza (diabético)',     
    condicion: 'diabetes' 
  },
    { paciente_id: 1, medico_id: 10, nombre: 'Carlos Mendoza (diabético)',     condicion: 'diabetes' },
  { paciente_id: 2, medico_id: 10, nombre: 'Ana Torres (hipertensa)',         condicion: 'hipertension' },
  { paciente_id: 3, medico_id: 11, nombre: 'Luis Quispe (EPOC)',              condicion: 'epoc' },
  { paciente_id: 4, medico_id: 11, nombre: 'Marta Solis (arritmia)',          condicion: 'arritmia' },
];

// ─── Rangos por condición ─────────────────────────────────────────────────────
// Cada condición tiene un perfil de métricas con rangos BASE y frecuencia de picos
const PERFILES = {
  diabetes: {
    metricas: [
      {
        tipo: 'glucosa',
        dispositivo: 'Glucómetro Accu-Chek',
        base: () => rand(80, 135),          // valor normal
        pico_alto: () => rand(250, 400),    // hiperglucemia
        pico_bajo: () => rand(40, 65),      // hipoglucemia
      },
      {
        tipo: 'presion_sistolica',
        dispositivo: 'Tensiómetro Omron',
        base: () => rand(110, 138),
        pico_alto: () => rand(160, 190),
        pico_bajo: () => rand(70, 88),
      },
    ],
  },
  hipertension: {
    metricas: [
      {
        tipo: 'presion_sistolica',
        dispositivo: 'Tensiómetro Omron M3',
        base: () => rand(115, 135),
        pico_alto: () => rand(160, 200),
        pico_bajo: () => rand(75, 88),
      },
      {
        tipo: 'presion_diastolica',
        dispositivo: 'Tensiómetro Omron M3',
        base: () => rand(70, 88),
        pico_alto: () => rand(100, 130),
        pico_bajo: () => rand(45, 58),
      },
      {
        tipo: 'frecuencia_cardiaca',
        dispositivo: 'Pulsómetro Polar',
        base: () => rand(62, 95),
        pico_alto: () => rand(110, 145),
        pico_bajo: () => rand(40, 55),
      },
    ],
  },
  epoc: {
    metricas: [
      {
        tipo: 'oxigeno',
        dispositivo: 'Pulsioxímetro Masimo',
        base: () => rand(92, 99),
        pico_alto: () => 100,
        pico_bajo: () => rand(82, 93),     // desaturación
      },
      {
        tipo: 'frecuencia_cardiaca',
        dispositivo: 'Pulsioxímetro Masimo',
        base: () => rand(65, 95),
        pico_alto: () => rand(110, 140),
        pico_bajo: () => rand(45, 58),
      },
    ],
  },
  arritmia: {
    metricas: [
      {
        tipo: 'frecuencia_cardiaca',
        dispositivo: 'Monitor Cardíaco Holter',
        base: () => rand(58, 98),
        pico_alto: () => rand(130, 180),   // taquicardia
        pico_bajo: () => rand(30, 55),     // bradicardia
      },
      {
        tipo: 'presion_sistolica',
        dispositivo: 'Tensiómetro automático',
        base: () => rand(105, 135),
        pico_alto: () => rand(155, 185),
        pico_bajo: () => rand(70, 88),
      },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rand = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(1));

// 15% de probabilidad de pico alto, 10% de pico bajo, resto normal
const generarValor = (metricaDef) => {
  const r = Math.random();
  if (r < 0.10) return { valor: metricaDef.pico_bajo(), tipo_evento: '⬇ BAJO' };
  if (r < 0.25) return { valor: metricaDef.pico_alto(), tipo_evento: '⬆ ALTO' };
  return { valor: metricaDef.base(), tipo_evento: '✓ normal' };
};

// ─── Contador de ciclos ───────────────────────────────────────────────────────
let ciclo = 0;
let totalEnviadas = 0;
let totalAlertas = 0;
let errores = 0;

// ─── Función principal de envío ───────────────────────────────────────────────
const enviarMetrica = async () => {
  ciclo++;

  // Rotar entre pacientes round-robin
  const paciente = PACIENTES[(ciclo - 1) % PACIENTES.length];
  const perfil = PERFILES[paciente.condicion];

  // Elegir métrica aleatoria del perfil del paciente
  const metricaDef = perfil.metricas[Math.floor(Math.random() * perfil.metricas.length)];
  const { valor, tipo_evento } = generarValor(metricaDef);

  const payload = {
    paciente_id: paciente.paciente_id,
    medico_id:   paciente.medico_id,
    tipo_metrica: metricaDef.tipo,
    valor,
    dispositivo: metricaDef.dispositivo,
    notas: `Lectura automática — ciclo ${ciclo}`,
  };

  const timestamp = new Date().toLocaleTimeString('es-BO');

  try {
    const response = await fetch(`${BASE_URL}/iot/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    totalEnviadas++;

    const alertaInfo = data.alerta_generada
      ? `  🚨 ALERTA [${data.alerta_generada.severidad}]: ${data.alerta_generada.mensaje}`
      : '';

    if (data.alerta_generada) totalAlertas++;

    console.log(
      `[${timestamp}] #${String(ciclo).padStart(4,'0')} ` +
      `${tipo_evento.padEnd(12)} | ` +
      `${paciente.nombre.padEnd(35)} | ` +
      `${metricaDef.tipo.padEnd(22)}: ${String(valor).padStart(6)} ` +
      `${response.ok ? '✅' : '❌'}` +
      alertaInfo
    );
  } catch (err) {
    errores++;
    console.error(`[${timestamp}] #${ciclo} ❌ Error de conexión: ${err.message}`);
    if (errores >= 5) {
      console.error('\n⚠️  Demasiados errores consecutivos. Verifica que el servidor esté corriendo.');
      console.error(`   URL: ${BASE_URL}`);
    }
  }
};

// ─── Resumen periódico cada 30 envíos ─────────────────────────────────────────
const mostrarResumen = () => {
  if (ciclo % 30 === 0 && ciclo > 0) {
    console.log('\n' + '─'.repeat(80));
    console.log(`📊 RESUMEN — Ciclo ${ciclo}`);
    console.log(`   Métricas enviadas : ${totalEnviadas}`);
    console.log(`   Alertas generadas : ${totalAlertas}`);
    console.log(`   Errores           : ${errores}`);
    console.log(`   Tasa de alertas   : ${((totalAlertas / totalEnviadas) * 100).toFixed(1)}%`);
    console.log('─'.repeat(80) + '\n');
  }
};

// ─── Inicio ───────────────────────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║          MediConnect — Simulador IoT de Enfermedades Crónicas        ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`\n🔗 Servidor  : ${BASE_URL}`);
console.log(`⏱  Intervalo : ${INTERVAL_MS}ms (${(INTERVAL_MS/1000).toFixed(1)}s por métrica)`);
console.log(`👥 Pacientes : ${PACIENTES.length} simulados`);
console.log('\n  Columnas: [hora] #ciclo estado | paciente | métrica: valor\n');
console.log('─'.repeat(80));

// Enviar inmediatamente y luego en intervalos
enviarMetrica();
const intervalo = setInterval(async () => {
  await enviarMetrica();
  mostrarResumen();
}, INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', () => {
  clearInterval(intervalo);
  console.log('\n\n🛑 Simulador detenido.');
  console.log(`   Total enviadas : ${totalEnviadas}`);
  console.log(`   Total alertas  : ${totalAlertas}`);
  console.log(`   Errores        : ${errores}`);
  process.exit(0);
});