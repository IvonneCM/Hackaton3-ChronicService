/**
 * iot-simulator.js
 * Simula dispositivos IoT enviando métricas de salud al endpoint /iot/metrics.
 * Ejecutar: node iot-simulator.js
 *
 * Variables de entorno opcionales:
 *   BASE_URL   → URL base de la API  (default: http://localhost:3000)
 *   INTERVAL   → Intervalo en ms     (default: 4000)
 */

const BASE_URL  = process.env.BASE_URL  || 'http://localhost:3000';
const INTERVAL  = parseInt(process.env.INTERVAL || '4000', 10);

// Pacientes de prueba (de la BD de prueba)
const PATIENTS = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Juan Perez',  condition: 'hipertension' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Maria Gomez', condition: 'diabetes'     },
];

// ─── GENERADORES DE MÉTRICAS REALISTAS ────────────────────────────────────────
// Cada paciente tiene un perfil de valores base + oscilación
const PROFILES = {
  // Juan: hipertenso → presión sistólica normalmente alta, a veces crítica
  '11111111-1111-1111-1111-111111111111': [
    {
      metric_type: 'presion_sistolica',
      unit: 'mmHg',
      // Rango normal 90-140. Juan ronda 145-175 (fuera de rango)
      generate: () => round(randomBetween(130, 185)),
    },
    {
      metric_type: 'presion_diastolica',
      unit: 'mmHg',
      generate: () => round(randomBetween(80, 105)),
    },
    {
      metric_type: 'frecuencia_cardiaca',
      unit: 'bpm',
      generate: () => round(randomBetween(62, 95)),
    },
  ],

  // Maria: diabética → glucosa normalmente alta, oscila mucho
  '22222222-2222-2222-2222-222222222222': [
    {
      metric_type: 'glucosa',
      unit: 'mg/dL',
      // Rango normal 70-110. Maria ronda 150-220 (fuera de rango)
      generate: () => round(randomBetween(140, 230)),
    },
    {
      metric_type: 'saturacion_oxigeno',
      unit: '%',
      generate: () => round(randomBetween(93, 99), 1),
    },
    {
      metric_type: 'frecuencia_cardiaca',
      unit: 'bpm',
      generate: () => round(randomBetween(68, 105)),
    },
  ],
};

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}
function round(n, decimals = 1) {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

// Colores para la consola
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  gray:   '\x1b[90m',
};

function severityColor(severity) {
  if (!severity)           return C.green + '✓ en rango' + C.reset;
  if (severity === 'baja') return C.yellow + '⚠ baja'    + C.reset;
  if (severity === 'media')return C.yellow + '⚠ media'   + C.reset;
  if (severity === 'alta') return C.red    + '🔴 alta'   + C.reset;
  return                          C.red    + '🚨 CRITICA' + C.reset;
}

// ─── ENVÍO DE MÉTRICA ─────────────────────────────────────────────────────────
async function sendMetric(patient, metricDef) {
  const payload = {
    patient_id:   patient.id,
    metric_type:  metricDef.metric_type,
    metric_value: metricDef.generate(),
    unit:         metricDef.unit,
  };

  const ts = new Date().toLocaleTimeString('es-BO');

  try {
    const res = await fetch(`${BASE_URL}/iot/metrics`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`${C.red}[${ts}] ERROR ${res.status}${C.reset}`, data);
      return;
    }

    const { metric, alert, in_range } = data;
    const rangeLabel = in_range ? C.green + '✓ en rango' + C.reset : severityColor(alert?.severity);

    console.log(
      `${C.gray}[${ts}]${C.reset} ` +
      `${C.bold}${patient.name.padEnd(12)}${C.reset} ` +
      `${C.cyan}${metric.metric_type.padEnd(22)}${C.reset}` +
      `${String(metric.metric_value).padStart(7)} ${(metric.unit || '').padEnd(7)}` +
      ` → ${rangeLabel}` +
      (alert ? `  ${C.red}[Alerta #${alert.id.slice(0,8)}]${C.reset}` : '')
    );
  } catch (err) {
    console.error(`${C.red}[${new Date().toLocaleTimeString()}] FETCH ERROR:${C.reset}`, err.message);
  }
}

// ─── LOOP PRINCIPAL ───────────────────────────────────────────────────────────
let tick = 0;

async function simulateTick() {
  tick++;
  // En cada tick se envía UNA métrica por paciente (en round-robin por métrica)
  const promises = PATIENTS.map((patient) => {
    const metrics = PROFILES[patient.id];
    const metricDef = metrics[tick % metrics.length]; // rota entre métricas
    return sendMetric(patient, metricDef);
  });
  await Promise.all(promises);
}

// ─── INICIO ───────────────────────────────────────────────────────────────────
console.log(`\n${C.bold}╔══════════════════════════════════════════════╗`);
console.log(`║     MediConnect — Simulador IoT              ║`);
console.log(`╚══════════════════════════════════════════════╝${C.reset}`);
console.log(`${C.gray}API:       ${BASE_URL}`);
console.log(`Intervalo: ${INTERVAL}ms`);
console.log(`Pacientes: ${PATIENTS.map(p => p.name).join(', ')}`);
console.log(`Iniciando en 2s...${C.reset}\n`);

setTimeout(() => {
  simulateTick(); // primera ejecución inmediata
  setInterval(simulateTick, INTERVAL);
}, 2000);
