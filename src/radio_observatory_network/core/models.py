from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class ValidationStatus(str, Enum):
    NOT_RUN = "NOT_RUN"
    PASS = "PASS"
    WARN = "WARN"
    PARTIAL = "PARTIAL"
    FAIL = "FAIL"

class JobStatus(str, Enum):
    PROPOSED = "PROPOSED"
    ACCEPTED = "ACCEPTED"
    SCHEDULED = "SCHEDULED"
    READY = "READY"
    READY_FOR_OPERATOR = "READY_FOR_OPERATOR"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    VALIDATING = "VALIDATING"
    PUBLISHED = "PUBLISHED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

class NodeHealth(str, Enum):
    ONLINE = "ONLINE"
    AVAILABLE_WITH_LIMITATIONS = "AVAILABLE_WITH_LIMITATIONS"
    MAINTENANCE = "MAINTENANCE"
    OFFLINE = "OFFLINE"

class DataPolicy(str, Enum):
    PRIVATE = "PRIVATE"
    CAMPAIGN = "CAMPAIGN"
    NETWORK = "NETWORK"
    PUBLIC = "PUBLIC"
    EMBARGOED = "EMBARGOED"

class CapabilityProfile(BaseModel):
    version: str
    epoch: str # e.g. "2026-01"
    min_frequency_mhz: float
    max_frequency_mhz: float
    min_resolution_khz: float
    time_resolution_ms: float
    modes: List[str]
    products: List[str]
    clock_precision_ms: Optional[float] = None

class Instrument(BaseModel):
    id: str
    name: str
    type: str
    capabilities: CapabilityProfile

class LocationPrivacy(str, Enum):
    PUBLIC_EXACT = "PUBLIC_EXACT"
    PUBLIC_APPROXIMATE = "PUBLIC_APPROXIMATE"
    PRIVATE = "PRIVATE"

class Observatory(BaseModel):
    id: str
    name: str
    organization: str
    country: str
    timezone: str
    contact: str
    location_privacy: LocationPrivacy
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    elevation: Optional[float] = None
    horizon_mask: Optional[List[tuple[float, float]]] = None # [(az, el)]

class NodeManifest(BaseModel):
    node_id: str
    observatory: Observatory
    instruments: List[Instrument]
    agent_version: str

class Target(BaseModel):
    name: str
    type: str  # "celestial", "solar", "fixed"
    ra: Optional[float] = None
    dec: Optional[float] = None
    az: Optional[float] = None
    el: Optional[float] = None

class ObservationRequest(BaseModel):
    request_id: str
    campaign_id: str
    target: Target
    start_time: datetime
    end_time: datetime
    min_frequency_mhz: Optional[float] = None
    max_frequency_mhz: Optional[float] = None
    max_resolution_khz: Optional[float] = None
    clock_precision_ms: Optional[float] = None
    modes: List[str]
    priority: int = 0
    data_policy: DataPolicy

class ObservationJob(BaseModel):
    job_id: str
    request_id: str
    campaign_id: str
    node_id: str
    instrument_id: str
    status: JobStatus
    scheduled_start: datetime
    scheduled_end: datetime
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    decline_reason: Optional[str] = None
    validation_status: ValidationStatus = ValidationStatus.NOT_RUN

class DataProduct(BaseModel):
    product_id: str
    job_id: str
    type: str
    file_path: str
    file_hash_sha256: str
    size_bytes: int
    data_policy: DataPolicy
    is_local: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ValidationManifest(BaseModel):
    job_id: str
    status: ValidationStatus
    flags: List[str]
    science_readiness: float # 0 to 1
    safe_subset: Optional[Dict[str, Any]] = None
    software_versions: Dict[str, str]

class ObservationManifest(BaseModel):
    observation_id: str
    job_id: str
    campaign_id: str
    station_id: str
    instrument_id: str
    configuration_epoch: str
    target: Target
    start_time: datetime
    end_time: datetime
    frequencies_mhz: tuple[float, float]
    products: List[DataProduct]
    validation: Optional[ValidationManifest] = None

class Campaign(BaseModel):
    id: str
    name: str
    scientific_goal: str
    targets: List[Target]
    requirements: Dict[str, Any]
    participants: List[str]
    data_policy: DataPolicy

class MatchResultType(str, Enum):
    MATCH = "MATCH"
    NO_MATCH = "NO_MATCH"
    CONDITIONAL = "CONDITIONAL"

class MatchResult(BaseModel):
    node_id: str
    instrument_id: str
    result: MatchResultType
    reason: str
