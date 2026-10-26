const assert = require('assert');
const { AstroPosEngine, FederationCoordinator } = require('../js/network-engine.js');

console.log("=== INICIANDO SUITE DE PRUEBAS PARA RADIO-OBSERVATORY-NETWORK ===");

// TEST 1: Posición y Tiempo Sidéreo
console.log("Test 1: Tiempo Sidéreo y Fecha Juliana");
const testDate = new Date("2026-10-26T12:00:00Z");
const jd = AstroPosEngine.dateToJulianDate(testDate);
assert.ok(jd > 2460000, `Fecha Juliana debe ser > 2460000 (obtenido ${jd})`);

const lstBUE = AstroPosEngine.calculateLST(testDate, -58.4);
assert.ok(lstBUE >= 0 && lstBUE < 24, `LST debe estar en [0, 24) horas (obtenido ${lstBUE})`);
console.log(`  -> OK: LST Buenos Aires calculado en ${lstBUE.toFixed(2)} h.`);

// TEST 2: Altura y Azimut
console.log("Test 2: Coordenadas Horizontales (Alt / Az)");
// Objeto en el cenit: Lat = -34.6, Dec = -34.6, HA = 0
const zen = AstroPosEngine.calculateAltAz(-34.6, -34.6, 0);
assert.ok(Math.abs(zen.altitudeDeg - 90.0) < 0.1, `Cenit debe tener Alt ~90° (obtenido ${zen.altitudeDeg})`);
assert.strictEqual(zen.isVisible, true, "Objeto en el cenit debe ser visible");

// Objeto bajo el horizonte
const below = AstroPosEngine.calculateAltAz(-34.6, 60.0, 12.0); // Polar norte profundo desde BsAs
assert.ok(below.altitudeDeg < 0, `Estrella circumpolar norte debe estar bajo el horizonte en BsAs (obtenido ${below.altitudeDeg})`);
assert.strictEqual(below.isVisible, false, "Objeto bajo el horizonte no es visible");
console.log("  -> OK: Transformaciones horizontales validadas.");

// TEST 3: Línea de Base Interferométrica (Geodesia)
console.log("Test 3: Cálculo de Línea de Base Interferométrica");
// Buenos Aires (-34.6, -58.4) a Ciudad del Cabo (-33.9, 18.4)
const dist = AstroPosEngine.baselineDistanceKm(-34.6, -58.4, -33.9, 18.4);
assert.ok(dist >= 6800 && dist <= 7000, `Línea de base transatlántica debe rondar ~6870 km (obtenido ${dist} km)`);
console.log(`  -> OK: Línea de base BUE - CPT calculada: ${dist} km.`);

// TEST 4: Capability Matcher y Elegibilidad
console.log("Test 4: Emparejador de Capacidades de Nodos");
const sampleNode = {
  id: "AR-BUE-01",
  name: "Buenos Aires Radio Node",
  latitude: -34.6,
  longitude: -58.4,
  freqMinMhz: 1000,
  freqMaxMhz: 1600,
  minElevationDeg: 15.0,
  status: "ONLINE",
  clockPrecisionUs: 1.0
};

// Target 1: HI 1420 MHz visible (RA coincidente con LST actual)
const targetOk = {
  name: "HI Galactic Center",
  frequencyMhz: 1420.4,
  raHours: lstBUE, // En meridiano
  decDeg: -29.0
};
const match1 = FederationCoordinator.matchNodeForTarget(sampleNode, targetOk, testDate);
assert.strictEqual(match1.eligible, true, "Nodo debe ser elegible para HI line visible");

// Target 2: Fuera de banda (VHF 150 MHz)
const targetWrongFreq = {
  name: "Solar Burst VHF",
  frequencyMhz: 150.0,
  raHours: lstBUE,
  decDeg: -20.0
};
const match2 = FederationCoordinator.matchNodeForTarget(sampleNode, targetWrongFreq, testDate);
assert.strictEqual(match2.eligible, false, "Nodo debe ser rechazado si la frecuencia está fuera de cobertura");
assert.ok(match2.issues.length > 0, "Debe registrar motivo de exclusión");
console.log("  -> OK: Capability matching validado.");

// TEST 5: Scheduler de Campaña
console.log("Test 5: Planificador Federado de Campaña");
const campaign = {
  id: "CAMP_SOLAR_01",
  name: "24h Solar Radio Monitoring",
  target: targetOk
};
const proposals = FederationCoordinator.scheduleCampaign([sampleNode], campaign, testDate);
assert.strictEqual(proposals.length, 1, "Debe generar 1 propuesta para el nodo elegible");
assert.strictEqual(proposals[0].status, "PROPOSED", "Estado inicial debe ser PROPOSED");
console.log(`  -> OK: Campaña planificada con job ${proposals[0].jobId}.`);

console.log("\n========================================================");
console.log(" TODOS LOS TESTS DE RADIO-OBSERVATORY-NETWORK PASARON (5/5)");
console.log("========================================================");
