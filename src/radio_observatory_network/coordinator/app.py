from typing import List, Dict
from datetime import datetime
from fastapi import FastAPI, HTTPException

from radio_observatory_network.core.models import (
    NodeManifest, ObservationRequest, ObservationJob, Campaign
)
from radio_observatory_network.core.scheduler import MaxCoverageScheduler

app = FastAPI(title="Radio Observatory Network Coordinator")

class CoordinatorState:
    def __init__(self):
        self.nodes: Dict[str, NodeManifest] = {}
        self.campaigns: Dict[str, Campaign] = {}
        self.requests: Dict[str, ObservationRequest] = {}
        self.jobs: Dict[str, ObservationJob] = {}
        self.scheduler = MaxCoverageScheduler()

state = CoordinatorState()

@app.post("/nodes/register")
def register_node(manifest: NodeManifest):
    state.nodes[manifest.node_id] = manifest
    return {"status": "registered"}

@app.get("/nodes")
def list_nodes() -> List[NodeManifest]:
    return list(state.nodes.values())

@app.post("/campaigns")
def create_campaign(campaign: Campaign):
    state.campaigns[campaign.id] = campaign
    return {"status": "created"}

@app.post("/requests")
def submit_request(request: ObservationRequest):
    state.requests[request.request_id] = request
    
    # Run scheduler
    proposed_jobs = state.scheduler.plan(request, list(state.nodes.values()))
    
    for job in proposed_jobs:
        state.jobs[job.job_id] = job
        
    return {"status": "scheduled", "jobs_proposed": len(proposed_jobs), "jobs": proposed_jobs}

@app.post("/jobs/{job_id}/sync")
def sync_job_status(job_id: str, updated_job: ObservationJob):
    if job_id not in state.jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    state.jobs[job_id] = updated_job
    return {"status": "synced"}

@app.get("/jobs")
def list_jobs() -> List[ObservationJob]:
    return list(state.jobs.values())
