/**
 * network-engine.js - Motor de Federación de Observatorios Radioastronómicos
 * Implementa astronomía posicional (LST, Alt/Az), matching de capacidades,
 * cálculo de líneas de base interferométricas y ciclo de vida Store-and-Forward.
 */

class AstroPosEngine {
  static DEG2RAD = Math.PI / 180;
  static RAD2DEG = 180 / Math.PI;

  /**
   * Cálculo de Fecha Juliana (JD) a partir de fecha UTC
   */
  static dateToJulianDate(date) {
    const d = new Date(date);
    return (d.getTime() / 86400000) + 2440587.5;
  }

  /**
   * Greenwich Mean Sidereal Time (GMST) en grados [0, 360)
   */
  static calculateGMST(date) {
    const jd = this.dateToJulianDate(date);
    const d = jd - 2451545.0; // Días desde J2000.0
    let gmst = 280.46061837 + 360.98564736629 * d;
    gmst = ((gmst % 360) + 360) % 360;
    return gmst;
  }

  /**
   * Local Sidereal Time (LST) en horas [0, 24)
   * LST = GMST + LongitudeDeg
   */
  static calculateLST(date, longitudeDeg) {
    const gmst = this.calculateGMST(date);
    let lstDeg = gmst + Number(longitudeDeg);
    lstDeg = ((lstDeg % 360) + 360) % 360;
    return lstDeg / 15.0; // Convertir grados a horas sidéreas
  }

  /**
   * Coordenadas Horizontales (Alt / Az)
   * latDeg, decDeg, haHours (Hour Angle = LST - RA)
   */
  static calculateAltAz(latDeg, decDeg, haHours) {
    const phi = Number(latDeg) * this.DEG2RAD;
    const delta = Number(decDeg) * this.DEG2RAD;
    const h = (Number(haHours) * 15.0) * this.DEG2RAD;

    // Altura (Elevation)
    const sinAlt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(h);
    const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const altDeg = altRad * this.RAD2DEG;

    // Azimut (desde el Norte hacia el Este)
    const cosAlt = Math.cos(altRad);
    let azDeg = 0;
    if (cosAlt > 1e-6) {
      const cosAz = (Math.sin(delta) - Math.sin(phi) * sinAlt) / (Math.cos(phi) * cosAlt);
      const sinAz = -Math.cos(delta) * Math.sin(h) / cosAlt;
      azDeg = Math.atan2(sinAz, cosAz) * this.RAD2DEG;
      azDeg = ((azDeg % 360) + 360) % 360;
    }

    return {
      altitudeDeg: Math.round(altDeg * 100) / 100,
      azimuthDeg: Math.round(azDeg * 100) / 100,
      isVisible: altDeg >= 15.0 // Máscara de horizonte estándar 15°
    };
  }

  /**
   * Distancia de Gran Círculo (Línea de base interferométrica en km)
   */
  static baselineDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371.0; // Radio medio terrestre en km
    const dLat = (lat2 - lat1) * this.DEG2RAD;
    const dLon = (lon2 - lon1) * this.DEG2RAD;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * this.DEG2RAD) * Math.cos(lat2 * this.DEG2RAD) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }
}

class FederationCoordinator {
  /**
   * Emparejador de capacidades (Capability Matcher)
   */
  static matchNodeForTarget(node, targetReq, currentUtcDate) {
    const issues = [];

    // 1. Cobertura de frecuencia
    const fReq = Number(targetReq.frequencyMhz);
    if (fReq < node.freqMinMhz || fReq > node.freqMaxMhz) {
      issues.push(`Frecuencia fuera de rango (${fReq} MHz ∉ [${node.freqMinMhz}, ${node.freqMaxMhz}])`);
    }

    // 2. Visibilidad y Altura sobre el horizonte
    const lst = AstroPosEngine.calculateLST(currentUtcDate, node.longitude);
    const ha = (lst - targetReq.raHours + 24) % 24;
    const horiz = AstroPosEngine.calculateAltAz(node.latitude, targetReq.decDeg, ha);

    if (horiz.altitudeDeg < (node.minElevationDeg || 15.0)) {
      issues.push(`Bajo el horizonte local (Alt: ${horiz.altitudeDeg}° < ${node.minElevationDeg || 15}°)`);
    }

    // 3. Estado de la estación
    if (node.status === "OFFLINE") {
      issues.push("Estación fuera de servicio");
    } else if (node.status === "WEATHER_ALERT") {
      issues.push("Alerta meteorológica local (viento o tormenta)");
    }

    // 4. Precisión de reloj
    if (targetReq.requiresInterferometry && (!node.clockPrecisionUs || node.clockPrecisionUs > 5.0)) {
      issues.push("Precisión de reloj insuficiente para VLBI");
    }

    const eligible = issues.length === 0;
    return {
      nodeId: node.id,
      nodeName: node.name,
      eligible,
      issues,
      altitudeDeg: horiz.altitudeDeg,
      azimuthDeg: horiz.azimuthDeg,
      lstHours: Math.round(lst * 100) / 100
    };
  }

  /**
   * Crea y planifica un lote de Jobs de observación para una Campaña
   */
  static scheduleCampaign(nodes, campaign, currentUtcDate) {
    const proposals = [];

    nodes.forEach(node => {
      const match = this.matchNodeForTarget(node, campaign.target, currentUtcDate);
      if (match.eligible) {
        proposals.push({
          jobId: `JOB_${campaign.id}_${node.id}`,
          campaignId: campaign.id,
          campaignName: campaign.name,
          nodeId: node.id,
          nodeName: node.name,
          targetName: campaign.target.name,
          frequencyMhz: campaign.target.frequencyMhz,
          integrationSec: campaign.target.integrationSec || 600,
          altitudeDeg: match.altitudeDeg,
          azimuthDeg: match.azimuthDeg,
          status: "PROPOSED", // PROPOSED -> ACCEPTED -> EXECUTING -> VALIDATING -> PUBLISHED
          qcResult: "NOT_RUN",
          progressPct: 0
        });
      }
    });

    return proposals;
  }
}

// Exportación compatible Node y Browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AstroPosEngine, FederationCoordinator };
}
