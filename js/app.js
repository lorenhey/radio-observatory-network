/**
 * app.js - Lógica visual e interactiva para radio-observatory-network v2.0.0
 */

const NETWORK_NODES = [
  { id: "AR-BUE-01", name: "Buenos Aires Edu Node", country: "Argentina", lat: -34.6, lon: -58.4, freqMinMhz: 1000, freqMaxMhz: 1600, minElevationDeg: 15, status: "ONLINE", dishM: 3.0, clockUs: 0.5 },
  { id: "ZA-CPT-01", name: "Cape Town Deep Space", country: "South Africa", lat: -33.9, lon: 18.4, freqMinMhz: 1200, freqMaxMhz: 1500, minElevationDeg: 15, status: "ONLINE", dishM: 2.5, clockUs: 0.8 },
  { id: "ES-MAD-01", name: "Madrid Radio Station", country: "España", lat: 40.4, lon: -3.7, freqMinMhz: 100, freqMaxMhz: 300, minElevationDeg: 20, status: "ONLINE", dishM: 4.0, clockUs: 1.2 },
  { id: "AU-PKS-01", name: "Parkes Regional Node", country: "Australia", lat: -33.0, lon: 148.2, freqMinMhz: 1200, freqMaxMhz: 1600, minElevationDeg: 15, status: "ONLINE", dishM: 4.5, clockUs: 0.4 },
  { id: "CL-ATA-01", name: "Atacama High Plateau", country: "Chile", lat: -23.0, lon: -67.7, freqMinMhz: 1000, freqMaxMhz: 5000, minElevationDeg: 10, status: "ONLINE", dishM: 6.0, clockUs: 0.2 },
  { id: "US-GVT-01", name: "Green Bank Station", country: "USA", lat: 38.4, lon: -79.8, freqMinMhz: 1000, freqMaxMhz: 1600, minElevationDeg: 15, status: "WEATHER_ALERT", dishM: 3.0, clockUs: 1.0 }
];

const CAMPAIGNS = {
  hi_21cm: {
    id: "CAMP_HI_21CM",
    name: "Sondeo de Hidrógeno Neutro (HI 21cm)",
    description: "Mapeo de la línea de 1420.405 MHz en el plano galáctico para determinación de curva de rotación de la Vía Láctea.",
    target: {
      name: "Sagitario A* / Plano Galáctico",
      frequencyMhz: 1420.4,
      raHours: 17.76,
      decDeg: -29.0,
      integrationSec: 600,
      requiresInterferometry: false
    }
  },
  solar_monitoring: {
    id: "CAMP_SOLAR_VHF",
    name: "Monitoreo Solar Continuo 24h (VHF)",
    description: "Seguimiento global ininterrumpido de ráfagas solares Tipo II y Tipo III en la banda de 150 MHz.",
    target: {
      name: "Sol (Actividad de Ráfagas VHF)",
      frequencyMhz: 150.0,
      raHours: 14.2, // Solar variable
      decDeg: -12.5,
      integrationSec: 300,
      requiresInterferometry: false
    }
  },
  pulsar_folding: {
    id: "CAMP_PULSAR_01",
    name: "Temporización de Púlsar B0329+54",
    description: "Plegado de pulsos sincronizado entre observatorios para monitoreo de Deriva de Dispersión (DM) y astrometría.",
    target: {
      name: "PSR B0329+54",
      frequencyMhz: 1400.0,
      raHours: 3.55,
      decDeg: 54.6,
      integrationSec: 1200,
      requiresInterferometry: true
    }
  }
};

let activeCampaignKey = "hi_21cm";
let activeJobs = [];
let spectrumChart = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCampaignSelector();
  initWorldMap();
  initSpectrumChart();
  renderNodesTable();
  planCampaign();
  attachEventListeners();
});

function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active-tab');
        t.classList.add('inactive-tab');
      });
      btn.classList.add('active-tab');
      btn.classList.remove('inactive-tab');

      const targetId = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach(sec => {
        sec.classList.add('hidden');
      });
      const activeSection = document.getElementById(`tab-${targetId}`);
      if (activeSection) activeSection.classList.remove('hidden');

      if (spectrumChart) spectrumChart.resize();
      drawWorldMap();
    });
  });
}

function initCampaignSelector() {
  const sel = document.getElementById('campaign-selector');
  if (!sel) return;
  sel.innerHTML = Object.keys(CAMPAIGNS).map(k => `
    <option value="${k}" ${k === activeCampaignKey ? 'selected' : ''}>${CAMPAIGNS[k].name}</option>
  `).join('');

  sel.addEventListener('change', (e) => {
    activeCampaignKey = e.target.value;
    updateCampaignHeader();
    planCampaign();
  });
  updateCampaignHeader();
}

function updateCampaignHeader() {
  const camp = CAMPAIGNS[activeCampaignKey];
  document.getElementById('camp-desc').textContent = camp.description;
  document.getElementById('camp-target-name').textContent = camp.target.name;
  document.getElementById('camp-freq').textContent = `${camp.target.frequencyMhz} MHz`;
  document.getElementById('camp-ra-dec').textContent = `RA: ${camp.target.raHours.toFixed(2)}h | Dec: ${camp.target.decDeg > 0 ? '+' : ''}${camp.target.decDeg.toFixed(1)}°`;
}

function planCampaign() {
  const camp = CAMPAIGNS[activeCampaignKey];
  const now = new Date();
  activeJobs = FederationCoordinator.scheduleCampaign(NETWORK_NODES, camp, now);

  // KPIs
  document.getElementById('stat-total-nodes').textContent = NETWORK_NODES.length;
  document.getElementById('stat-online-nodes').textContent = NETWORK_NODES.filter(n => n.status === "ONLINE").length;
  document.getElementById('stat-eligible-nodes').textContent = activeJobs.length;
  document.getElementById('stat-active-jobs').textContent = activeJobs.length;

  renderJobsTable();
  drawWorldMap();
  updateSpectrumSimulation();
}

function renderNodesTable() {
  const tbody = document.getElementById('nodes-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  NETWORK_NODES.forEach(n => {
    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";
    
    let statusClass = "badge-online";
    let statusText = "ONLINE";
    if (n.status === "WEATHER_ALERT") {
      statusClass = "badge-warning";
      statusText = "ALERTA CLIMA";
    } else if (n.status === "OFFLINE") {
      statusClass = "badge-offline";
      statusText = "OFFLINE";
    }

    tr.innerHTML = `
      <td class="p-2.5 font-mono font-bold text-slate-200">${n.id}</td>
      <td class="p-2.5 font-bold text-white">${n.name}</td>
      <td class="p-2.5 text-slate-400">${n.country}</td>
      <td class="p-2.5 font-mono">${n.lat > 0 ? '+' : ''}${n.lat.toFixed(1)}°, ${n.lon > 0 ? '+' : ''}${n.lon.toFixed(1)}°</td>
      <td class="p-2.5 font-mono text-sky-400">${n.freqMinMhz} - ${n.freqMaxMhz} MHz</td>
      <td class="p-2.5 font-mono text-slate-300">${n.dishM} m</td>
      <td class="p-2.5">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${statusClass}">${statusText}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderJobsTable() {
  const tbody = document.getElementById('jobs-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (activeJobs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500">Ninguna estación elegible para el objetivo seleccionado en este momento.</td></tr>`;
    return;
  }

  activeJobs.forEach((job, idx) => {
    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-800 text-xs hover:bg-slate-800/40";

    let statusBadge = "badge-warning";
    if (job.status === "ACCEPTED" || job.status === "PUBLISHED") statusBadge = "badge-online";
    if (job.status === "EXECUTING") statusBadge = "badge-observing";

    tr.innerHTML = `
      <td class="p-2.5 font-mono font-bold text-sky-400">${job.jobId}</td>
      <td class="p-2.5 font-bold text-white">${job.nodeName}</td>
      <td class="p-2.5 font-mono text-amber-300">${job.altitudeDeg.toFixed(1)}°</td>
      <td class="p-2.5 font-mono text-slate-300">${job.azimuthDeg.toFixed(1)}°</td>
      <td class="p-2.5">
        <div class="w-full bg-slate-800 rounded-full h-2">
          <div class="bg-sky-500 h-2 rounded-full transition-all duration-300" style="width: ${job.progressPct}%"></div>
        </div>
      </td>
      <td class="p-2.5">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${statusBadge}">${job.status}</span>
      </td>
      <td class="p-2.5 font-mono font-bold ${job.qcResult === 'PASS' ? 'text-emerald-400' : 'text-slate-400'}">${job.qcResult}</td>
    `;
    tbody.appendChild(tr);
  });
}

function attachEventListeners() {
  document.getElementById('run-campaign-btn')?.addEventListener('click', runSimulatedExecution);
  document.getElementById('export-campaign-btn')?.addEventListener('click', exportCampaignManifest);
}

function runSimulatedExecution() {
  const btn = document.getElementById('run-campaign-btn');
  if (btn) btn.disabled = true;

  activeJobs.forEach(j => {
    j.status = "ACCEPTED";
    j.progressPct = 10;
  });
  renderJobsTable();

  setTimeout(() => {
    activeJobs.forEach(j => {
      j.status = "EXECUTING";
      j.progressPct = 50;
    });
    renderJobsTable();
    updateSpectrumSimulation(true);
  }, 1000);

  setTimeout(() => {
    activeJobs.forEach(j => {
      j.status = "VALIDATING";
      j.progressPct = 85;
      j.qcResult = "PASS";
    });
    renderJobsTable();
  }, 2200);

  setTimeout(() => {
    activeJobs.forEach(j => {
      j.status = "PUBLISHED";
      j.progressPct = 100;
    });
    renderJobsTable();
    if (btn) btn.disabled = false;
  }, 3200);
}

function initWorldMap() {
  window.addEventListener('resize', drawWorldMap);
  drawWorldMap();
}

function drawWorldMap() {
  const canvas = document.getElementById('worldMapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Fondo espacial profundo
  ctx.fillStyle = "#030712";
  ctx.fillRect(0, 0, w, h);

  // Grilla de coordenadas (meridianos y paralelos)
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const y = ((90 - lat) / 180) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Ecuador y Meridiano de Greenwich
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();

  // Líneas de base interferométricas entre nodos activos
  ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i < NETWORK_NODES.length; i++) {
    for (let j = i + 1; j < NETWORK_NODES.length; j++) {
      const n1 = NETWORK_NODES[i];
      const n2 = NETWORK_NODES[j];
      if (n1.status === "ONLINE" && n2.status === "ONLINE") {
        const x1 = ((n1.lon + 180) / 360) * w;
        const y1 = ((90 - n1.lat) / 180) * h;
        const x2 = ((n2.lon + 180) / 360) * w;
        const y2 = ((90 - n2.lat) / 180) * h;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);

  // Dibujar Nodos
  NETWORK_NODES.forEach(n => {
    const x = ((n.lon + 180) / 360) * w;
    const y = ((90 - n.lat) / 180) * h;

    // Halo
    const isEligible = activeJobs.some(j => j.nodeId === n.id);
    ctx.beginPath();
    ctx.arc(x, y, isEligible ? 8 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isEligible ? "rgba(56, 189, 248, 0.3)" : (n.status === "ONLINE" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)");
    ctx.fill();

    // Punto central
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = isEligible ? "#38bdf8" : (n.status === "ONLINE" ? "#10b981" : "#ef4444");
    ctx.fill();

    // Etiqueta
    ctx.font = "9px Consolas";
    ctx.fillStyle = isEligible ? "#38bdf8" : "#9ca3af";
    ctx.fillText(n.id, x + 8, y + 3);
  });
}

function initSpectrumChart() {
  const ctx = document.getElementById('spectrumChart')?.getContext('2d');
  if (!ctx) return;

  spectrumChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Flujo de Radio Normalizado (dB)',
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          fill: true,
          data: [],
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9ca3af' } }
      },
      scales: {
        x: {
          title: { display: true, text: 'Frecuencia (MHz)', color: '#9ca3af' },
          ticks: { color: '#9ca3af' },
          grid: { color: '#1f2937' }
        },
        y: {
          title: { display: true, text: 'Densidad de Flujo (dB)', color: '#38bdf8' },
          ticks: { color: '#38bdf8' },
          grid: { color: '#1f2937' },
          min: 0,
          max: 30
        }
      }
    }
  });
}

function updateSpectrumSimulation(withPeak = true) {
  if (!spectrumChart) return;
  const camp = CAMPAIGNS[activeCampaignKey];
  const centerFreq = camp.target.frequencyMhz;
  const span = 2.0; // MHz
  const pts = 50;
  const step = span / pts;

  const labels = [];
  const data = [];

  for (let f = centerFreq - span / 2; f <= centerFreq + span / 2; f += step) {
    labels.push(f.toFixed(3));
    const noise = Math.random() * 2.5 + 2.0;
    // Perfil pico de emisión
    const dist = Math.abs(f - centerFreq);
    const peak = withPeak ? 18.0 * Math.exp(-Math.pow(dist / 0.15, 2)) : 0;
    data.push(Math.round((noise + peak) * 10) / 10);
  }

  spectrumChart.data.labels = labels;
  spectrumChart.data.datasets[0].data = data;
  spectrumChart.update();
}

function exportCampaignManifest() {
  const manifest = {
    campaign: CAMPAIGNS[activeCampaignKey],
    timestamp: new Date().toISOString(),
    nodes: NETWORK_NODES,
    jobs: activeJobs
  };

  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `radio_federation_manifest_${CAMPAIGNS[activeCampaignKey].id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
