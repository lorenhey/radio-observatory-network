import time
from datetime import datetime, timedelta, timezone

from radio_observatory_network.core.models import (
    NodeManifest, Observatory, Instrument, CapabilityProfile, LocationPrivacy,
    Campaign, Target, ObservationRequest, DataPolicy, JobStatus
)
from radio_observatory_network.node.adapter import DemoSpectrometer
from radio_observatory_network.node.agent import NodeAgent
from radio_observatory_network.coordinator.app import state as coordinator_state

def create_synthetic_network():
    print("--- Initializing Synthetic Radio Observatory Network ---")
    
    # 1. Buenos Aires (Standard)
    ba_cap = CapabilityProfile(
        version="1.0", epoch="2026-01",
        min_frequency_mhz=10.0, max_frequency_mhz=50.0,
        min_resolution_khz=5.0, time_resolution_ms=10.0,
        modes=["tracking", "drift_scan"], products=["spectrum"],
        clock_precision_ms=50.0
    )
    ba_inst = Instrument(id="BA-SPEC-1", name="BA Low Freq Spectrometer", type="spectrograph", capabilities=ba_cap)
    ba_obs = Observatory(
        id="AR-BUE-01", name="Buenos Aires Edu Node", organization="UNLP", country="Argentina",
        timezone="America/Argentina/Buenos_Aires", contact="ba@example.com",
        location_privacy=LocationPrivacy.PUBLIC_EXACT, latitude=-34.9, longitude=-57.9
    )
    ba_manifest = NodeManifest(node_id="AR-BUE-01", observatory=ba_obs, instruments=[ba_inst], agent_version="1.0.0")
    
    # 2. Cape Town (High Res)
    ct_cap = CapabilityProfile(
        version="2.1", epoch="2025-06",
        min_frequency_mhz=20.0, max_frequency_mhz=80.0,
        min_resolution_khz=1.0, time_resolution_ms=5.0,
        modes=["tracking"], products=["spectrum", "dynamic_spectrum"],
        clock_precision_ms=10.0
    )
    ct_inst = Instrument(id="CT-SPEC-1", name="Cape Town High Res", type="spectrograph", capabilities=ct_cap)
    ct_obs = Observatory(
        id="ZA-CPT-01", name="Cape Town Deep Space", organization="SARAO", country="South Africa",
        timezone="Africa/Johannesburg", contact="ct@example.com",
        location_privacy=LocationPrivacy.PUBLIC_EXACT, latitude=-33.9, longitude=18.4
    )
    ct_manifest = NodeManifest(node_id="ZA-CPT-01", observatory=ct_obs, instruments=[ct_inst], agent_version="1.0.0")

    # 3. Madrid (Poor clock, limited frequency)
    md_cap = CapabilityProfile(
        version="1.0", epoch="2024-01",
        min_frequency_mhz=15.0, max_frequency_mhz=30.0,
        min_resolution_khz=20.0, time_resolution_ms=100.0,
        modes=["drift_scan"], products=["spectrum"],
        clock_precision_ms=None # Unknown clock precision
    )
    md_inst = Instrument(id="MD-SPEC-1", name="Madrid SDR", type="SDR", capabilities=md_cap)
    md_obs = Observatory(
        id="ES-MAD-01", name="Madrid Amateur Radio", organization="Independent", country="Spain",
        timezone="Europe/Madrid", contact="mad@example.com",
        location_privacy=LocationPrivacy.PRIVATE
    )
    md_manifest = NodeManifest(node_id="ES-MAD-01", observatory=md_obs, instruments=[md_inst], agent_version="0.9.5")

    # Agents
    nodes = []
    for m in [ba_manifest, ct_manifest, md_manifest]:
        agent = NodeAgent(manifest=m, coordinator_url="local")
        adapter = DemoSpectrometer(capabilities=m.instruments[0].capabilities)
        agent.register_adapter(m.instruments[0].id, adapter)
        nodes.append(agent)
        # Register with coordinator
        coordinator_state.nodes[m.node_id] = m
        print(f"Registered node: {m.observatory.name} ({m.node_id})")
        
    return nodes

def run_demo():
    nodes = create_synthetic_network()
    
    print("\n--- Creating Campaign: 24-hour distributed solar radio campaign ---")
    campaign = Campaign(
        id="solar-2026",
        name="Global Solar Burst Monitor",
        scientific_goal="Continuous multi-site dynamic spectrum of solar bursts",
        targets=[Target(name="Sun", type="solar")],
        requirements={"min_stations": 2},
        participants=["AR-BUE-01", "ZA-CPT-01", "ES-MAD-01"],
        data_policy=DataPolicy.CAMPAIGN
    )
    coordinator_state.campaigns[campaign.id] = campaign
    
    print("\n--- Submitting Observation Request ---")
    start = datetime.now(timezone.utc) + timedelta(minutes=5)
    end = start + timedelta(hours=24)
    
    request = ObservationRequest(
        request_id="req-001",
        campaign_id=campaign.id,
        target=campaign.targets[0],
        start_time=start,
        end_time=end,
        min_frequency_mhz=20.0,
        max_frequency_mhz=30.0,
        max_resolution_khz=10.0, 
        clock_precision_ms=100.0, # Requires good clock
        modes=["tracking"],
        data_policy=DataPolicy.CAMPAIGN
    )
    
    print("Coordinator: Running capability matcher and scheduler...")
    proposed_jobs = coordinator_state.scheduler.plan(request, list(coordinator_state.nodes.values()))
    
    print(f"\nProposed Jobs ({len(proposed_jobs)}):")
    for j in proposed_jobs:
        print(f" - {j.job_id} assigned to {j.node_id} (Status: {j.status.value})")
        
    print("\n--- Simulating Local Node Decisions ---")
    for agent in nodes:
        for job in proposed_jobs:
            if job.node_id == agent.manifest.node_id:
                # We inject local weather failure for Cape Town
                if agent.manifest.node_id == "ZA-CPT-01":
                    print(f"Injecting local weather warning for {agent.manifest.node_id}...")
                    agent.adapters[job.instrument_id].local_weather_safe = False
                    
                agent.receive_job_proposal(job)
                
    print("\nJob status after local review:")
    for j in proposed_jobs:
        print(f" - {j.node_id}: {j.status.value} (Reason: {j.decline_reason})")
        
    print("\n--- Simulating Local Execution Loop (Time travels 5 minutes) ---")
    # Hack the job scheduled times to make them execute now
    for j in proposed_jobs:
        j.scheduled_start = datetime.now() - timedelta(minutes=1)
        j.scheduled_end = datetime.now() + timedelta(minutes=1)
        
    for agent in nodes:
        agent.run_local_loop()
        
    print("\n--- Simulating Network Sync (Store-and-forward) ---")
    for agent in nodes:
        agent.sync_with_coordinator()
        
    print("\n--- Final Campaign Status ---")
    for j in proposed_jobs:
        print(f"Node {j.node_id}: Final Status={j.status.value}, Validation={j.validation_status.value}")

if __name__ == "__main__":
    run_demo()
