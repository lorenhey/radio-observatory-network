from abc import ABC, abstractmethod
from typing import Optional
from datetime import datetime

from radio_observatory_network.core.models import (
    CapabilityProfile, ObservationJob, JobStatus, DataProduct
)

class InstrumentAdapter(ABC):
    """
    Base interface for all observatory instruments.
    Must enforce local safety constraints.
    """
    
    @abstractmethod
    def get_capabilities(self) -> CapabilityProfile:
        pass
        
    @abstractmethod
    def can_execute(self, job: ObservationJob) -> tuple[bool, Optional[str]]:
        """
        Check local interlocks, weather, maintenance mode, etc.
        Returns (True, None) if safe, (False, "reason") otherwise.
        """
        pass
        
    @abstractmethod
    def prepare(self, job: ObservationJob) -> None:
        pass
        
    @abstractmethod
    def observe(self, job: ObservationJob) -> None:
        """Starts the observation. May be blocking or async depending on implementation."""
        pass
        
    @abstractmethod
    def stop(self) -> None:
        """Emergency stop or graceful abort."""
        pass
        
    @abstractmethod
    def get_status(self) -> str:
        pass
        
    @abstractmethod
    def fetch_results(self, job: ObservationJob) -> list[DataProduct]:
        pass

class DemoSpectrometer(InstrumentAdapter):
    """
    A mock instrument for the synthetic network and demo purposes.
    """
    def __init__(self, capabilities: CapabilityProfile, local_weather_safe: bool = True):
        self._capabilities = capabilities
        self.local_weather_safe = local_weather_safe
        self.is_observing = False
        
    def get_capabilities(self) -> CapabilityProfile:
        return self._capabilities
        
    def can_execute(self, job: ObservationJob) -> tuple[bool, Optional[str]]:
        if not self.local_weather_safe:
            return False, "unsafe_weather"
        # In a real adapter, check physical interlocks here
        return True, None
        
    def prepare(self, job: ObservationJob) -> None:
        print(f"DemoSpectrometer: Preparing for job {job.job_id}")
        
    def observe(self, job: ObservationJob) -> None:
        print(f"DemoSpectrometer: Starting observation {job.job_id}")
        self.is_observing = True
        
    def stop(self) -> None:
        print("DemoSpectrometer: Stopping observation")
        self.is_observing = False
        
    def get_status(self) -> str:
        return "OBSERVING" if self.is_observing else "IDLE"
        
    def fetch_results(self, job: ObservationJob) -> list[DataProduct]:
        print(f"DemoSpectrometer: Fetching results for {job.job_id}")
        # Return mock data product
        return []
