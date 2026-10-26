# radio-observatory-network (v2.0.0)

[![GitHub Pages Deployment](https://img.shields.io/badge/GitHub%20Pages-Live%20v2.0.0-emerald)](https://lorenhey.github.io/radio-observatory-network/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Architecture: Federated Store--and--Forward](https://img.shields.io/badge/Architecture-Federated%20Store--and--Forward-amber.svg)](https://lorenhey.github.io/radio-observatory-network/)

> **Núcleo Federado de Coordinación, Campañas Radioastronómicas & Archivo Descentralizado.**  
> Conecta observatorios radioastronómicos independientes en una red cooperativa capaz de coordinar campañas de 24 horas continuas, distribuir tareas de observación según visibilidad de horizonte, validar espectros locales y cotejar detecciones sin servidor centralizado ni hardware homogéneo.

🔗 **Workbench Web Interactiva:** [https://lorenhey.github.io/radio-observatory-network/](https://lorenhey.github.io/radio-observatory-network/)

---

## 📡 Capacidades Principales (v2.0.0)

1. **Mapa Global de Estaciones & Líneas de Base:**
   * Visualización interactiva en tiempo real de nodos en coordenadas geodésicas (Argentina, Sudáfrica, España, Australia, Chile, USA).
   * Cálculo exacto de líneas de base interferométricas transcontinentales ($B \approx 6800\text{–}12000\text{ km}$).
   * Línea de terminador solar (día/noche) calculada dinámicamente según tiempo UTC.

2. **Astrometría Posicional & Emparejador de Capacidades (Capability Matcher):**
   * Determinación de Tiempo Sidéreo Local (LST) y coordenadas horizontales (Altura y Azimut):
     $$\sin(\text{Alt}) = \sin(\phi)\sin(\delta) + \cos(\phi)\cos(\delta)\cos(H)$$
   * Filtrado automático de nodos elegibles según:
     * Frecuencia de recepción ($100\text{ MHz}$ a $5\text{ GHz}$)
     * Máscara de elevación de horizonte local ($> 15^\circ$)
     * Estado operativo y sensores meteorológicos locales (viento, lluvia, tormenta eléctrica)
     * Precisión de reloj de referencia para VLBI ($< 1\,\mu\text{s}$)

3. **Ciclo de Vida Store-and-Forward:**
   * `PROPOSED` $\to$ `ACCEPTED / REJECTED` $\to$ `EXECUTING` $\to$ `VALIDATING` $\to$ `PUBLISHED`.
   * Preserva la soberanía de cada observatorio individual con validación de calidad previa a la publicación en el archivo federado.

4. **Monitoreo de Espectro & Línea de Emisión:**
   * Visualizador dinámico de espectro para hidrógeno neutro (HI $1420.405\text{ MHz}$), ráfagas solares VHF y perfiles integrados de púlsares.

---

## 🧪 Pruebas Unitarias

```bash
# Tests de la suite JavaScript / Web
node tests/test_network_engine.js

# Demostración del motor CLI Python
python -m radio_observatory_network.cli demo
```

---

## 📄 Licencia

Código abierto bajo licencia [MIT](LICENSE). Desarrollado por **Lorenzo Perez** ([@lorenhey](https://github.com/lorenhey)).
