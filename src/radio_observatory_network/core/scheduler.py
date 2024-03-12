from datetime import datetime, timedelta
from typing import List, Dict, Optional

from radio_observatory_network.core.models import (
    ObservationRequest, NodeManifest, ObservationJob, JobStatus, MatchResultType
)
from radio_observatory_network.core.matcher import match_node_to_request

def calculate_visibility_window(manifest: NodeManifest, target_az: float, target_el: float) -> bool:
    """
    Very simplified placeholder for astronomy calculation.
    In a real implementation, we would use astropy to calculate altitude over time
    and check against the observatory's horizon_mask.
    """
    if target_el < 10.0:  # simplistic horizon limit
        return False
    return True

class SchedulerStrategy:
    def plan(self, request: ObservationRequest, nodes: List[NodeManifest]) -> List[ObservationJob]:
        raise NotImplementedError

class MaxCoverageScheduler(SchedulerStrategy):
    """
    Greedy scheduler to maximize temporal coverage.
    """
    def plan(self, request: ObservationRequest, nodes: List[NodeManifest]) -> List[ObservationJob]:
        jobs = []
        
        # 1. Filter by capability
        eligible_nodes = []
        for node in nodes:
            matches = match_node_to_request(node, request)
            for m in matches:
                if m.result in (MatchResultType.MATCH, MatchResultType.CONDITIONAL):
                    # We accept conditional (e.g. unknown clock precision) for the plan, 
                    # but it would be flagged in the UI.
                    eligible_nodes.append((node, m.instrument_id))
                    
        # 2. Simplistic time allocation (Follow-the-target/Coverage)
        # We split the request duration into 1-hour chunks (or whatever) and assign to eligible nodes.
        # For this prototype, we'll assign the full window to all eligible nodes to maximize redundancy 
        # and simultaneous observation, unless they have local visibility constraints.
        
        job_id_counter = 1
        for node, inst_id in eligible_nodes:
            # Check visibility (Mock implementation)
            if request.target.el is not None and request.target.az is not None:
                visible = calculate_visibility_window(node, request.target.az, request.target.el)
                if not visible:
                    continue
            
            jobs.append(
                ObservationJob(
                    job_id=f"job_{request.request_id}_{job_id_counter}",
                    request_id=request.request_id,
                    campaign_id=request.campaign_id,
                    node_id=node.node_id,
                    instrument_id=inst_id,
                    status=JobStatus.PROPOSED,
                    scheduled_start=request.start_time,
                    scheduled_end=request.end_time,
                )
            )
            job_id_counter += 1
            
        return jobs
