import time
from typing import Dict, Optional, List
from datetime import datetime

from radio_observatory_network.core.models import (
    NodeManifest, ObservationJob, JobStatus, NodeHealth, ValidationManifest, ValidationStatus
)
from radio_observatory_network.node.adapter import InstrumentAdapter

class NodePolicyEngine:
    def __init__(self):
        self.maintenance_mode = False
        self.allow_public = True

    def evaluate(self, job: ObservationJob) -> tuple[bool, Optional[str]]:
        if self.maintenance_mode:
            return False, "maintenance"
        if not self.allow_public and job.data_policy == "PUBLIC":
            return False, "policy_denied: public data not allowed"
        return True, None

class NodeAgent:
    def __init__(self, manifest: NodeManifest, coordinator_url: str):
        self.manifest = manifest
        self.coordinator_url = coordinator_url
        self.adapters: Dict[str, InstrumentAdapter] = {}
        self.policy_engine = NodePolicyEngine()
        self.job_queue: List[ObservationJob] = []
        self.completed_jobs: List[ObservationJob] = []
        
    def register_adapter(self, instrument_id: str, adapter: InstrumentAdapter):
        self.adapters[instrument_id] = adapter
        
    def receive_job_proposal(self, job: ObservationJob) -> ObservationJob:
        """
        Called when coordinator proposes a job. Node decides to accept or decline.
        """
        print(f"Node {self.manifest.node_id}: Received proposal for job {job.job_id}")
        
        # 1. Check Policy
        policy_ok, policy_reason = self.policy_engine.evaluate(job)
        if not policy_ok:
            job.status = JobStatus.FAILED
            job.decline_reason = policy_reason
            return job
            
        # 2. Check Instrument availability and safety
        adapter = self.adapters.get(job.instrument_id)
        if not adapter:
            job.status = JobStatus.FAILED
            job.decline_reason = "instrument_unavailable"
            return job
            
        safe, safety_reason = adapter.can_execute(job)
        if not safe:
            job.status = JobStatus.FAILED
            job.decline_reason = safety_reason
            return job
            
        # Accept
        job.status = JobStatus.ACCEPTED
        self.job_queue.append(job)
        return job

    def run_local_loop(self):
        """
        Simulates the local execution loop. 
        Survives network loss because it only checks local queue.
        """
        now = datetime.now()
        for job in self.job_queue:
            if job.status == JobStatus.ACCEPTED and job.scheduled_start <= now <= job.scheduled_end:
                self._execute_job(job)

    def _execute_job(self, job: ObservationJob):
        adapter = self.adapters[job.instrument_id]
        
        # Re-check safety right before execution (Rule 60)
        safe, reason = adapter.can_execute(job)
        if not safe:
            job.status = JobStatus.CANCELLED
            job.decline_reason = f"pre_exec_safety: {reason}"
            return

        print(f"Node {self.manifest.node_id}: Executing job {job.job_id}")
        job.status = JobStatus.RUNNING
        job.actual_start = datetime.now()
        
        adapter.prepare(job)
        adapter.observe(job)
        
        # Simulating completion instantly for the mock
        adapter.stop()
        job.actual_end = datetime.now()
        
        # Fetch results
        products = adapter.fetch_results(job)
        
        # Validation
        job.status = JobStatus.VALIDATING
        self._validate_job(job)
        
        job.status = JobStatus.COMPLETED
        self.completed_jobs.append(job)
        self.job_queue.remove(job)

    def _validate_job(self, job: ObservationJob):
        # Mock local validation integration (radio-observation-validator)
        job.validation_status = ValidationStatus.PASS
        print(f"Node {self.manifest.node_id}: Job {job.job_id} passed validation")

    def sync_with_coordinator(self):
        """
        Store and forward sync.
        Attempts to push completed jobs and metadata to coordinator.
        """
        # Mock network call
        for job in self.completed_jobs:
            if job.status == JobStatus.COMPLETED:
                print(f"Node {self.manifest.node_id}: Syncing job {job.job_id} to coordinator")
                job.status = JobStatus.PUBLISHED
