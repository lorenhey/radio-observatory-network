# radio-observatory-network

`radio-observatory-network` conecta observatorios radioastronómicos independientes en una red federada capaz de coordinar campañas, distribuir observaciones, validar y compartir productos y comparar detecciones entre sitios sin exigir hardware homogéneo ni control centralizado.

```mermaid
graph TD
    C[Campaign] -->|Defines| CO[Coordinator]
    CO -->|Proposes Schedule| N1[Node A\n(Argentina)]
    CO -->|Proposes Schedule| N2[Node B\n(Australia)]
    CO -->|Proposes Schedule| N3[Node C\n(Europe)]
    
    N1 -->|Decides & Executes| R1[Radio Telescope]
    N2 -->|Decides & Executes| R2[Radio Telescope]
    N3 -->|Decides & Executes| R3[Radio Telescope]
    
    R1 -->|Local QC| V1[Validation]
    R2 -->|Local QC| V2[Validation]
    R3 -->|Local QC| V3[Validation]
    
    V1 -->|Store & Forward| FA[(Federated Archive)]
    V2 -->|Store & Forward| FA
    V3 -->|Store & Forward| FA
```

## Quick Start (Demo)

You can run the built-in synthetic network demonstration:

```bash
uv run python -m radio_observatory_network.cli demo
```

Expected output:
```text
Campaign:
24 h Solar Monitoring

Stations discovered:
3

Eligible:
2 (Madrid excluded due to unknown clock precision)

Scheduled:
2

Completed:
1

Validated:
1 PASS

Node ZA-CPT-01 Status: FAILED (Reason: unsafe_weather)
Node AR-BUE-01 Status: PUBLISHED
```

## Node Quick Start

```bash
uv run python -m radio_observatory_network.cli node init
uv run python -m radio_observatory_network.cli node doctor
```

## Core Principles

- **Federated Principle:** The coordinator proposes. The node decides.
- **Node Sovereignty:** Never ignore interlocks, limits, emergency stops, weather constraints, or local policies.
- **Network != Interferometer:** This network does not require phase coherence. It coordinates operations and archives standard data products (spectra, time series).
- **Store-and-Forward:** The node agent survives network loss. Observations continue, results are queued, and synchronization resumes when online.
- **Explainable Scheduler:** No AI black boxes. Every scheduling decision (MATCH, NO_MATCH, CONDITIONAL) is fully explainable based on explicit hardware capabilities, epochs, and constraints.
