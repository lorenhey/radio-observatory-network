from typing import List, Tuple

from radio_observatory_network.core.models import (
    ObservationRequest,
    NodeManifest,
    MatchResult,
    MatchResultType,
)

def match_node_to_request(manifest: NodeManifest, request: ObservationRequest) -> List[MatchResult]:
    """
    Evaluates whether a node (and its instruments) can fulfill an ObservationRequest.
    Returns a list of MatchResult, explaining why it matches or doesn't.
    """
    results = []
    
    for instrument in manifest.instruments:
        cap = instrument.capabilities
        
        # Check frequency coverage
        if request.min_frequency_mhz is not None and cap.min_frequency_mhz > request.min_frequency_mhz:
            results.append(MatchResult(
                node_id=manifest.node_id,
                instrument_id=instrument.id,
                result=MatchResultType.NO_MATCH,
                reason=f"Insufficient low frequency coverage: can only reach {cap.min_frequency_mhz} MHz"
            ))
            continue
            
        if request.max_frequency_mhz is not None and cap.max_frequency_mhz < request.max_frequency_mhz:
            results.append(MatchResult(
                node_id=manifest.node_id,
                instrument_id=instrument.id,
                result=MatchResultType.NO_MATCH,
                reason=f"Insufficient high frequency coverage: can only reach {cap.max_frequency_mhz} MHz"
            ))
            continue
            
        # Check spectral resolution
        if request.max_resolution_khz is not None and cap.min_resolution_khz > request.max_resolution_khz:
            results.append(MatchResult(
                node_id=manifest.node_id,
                instrument_id=instrument.id,
                result=MatchResultType.NO_MATCH,
                reason=f"Frequency resolution insufficient: requires <= {request.max_resolution_khz} kHz, has {cap.min_resolution_khz} kHz"
            ))
            continue
            
        # Check clock precision
        if request.clock_precision_ms is not None:
            if cap.clock_precision_ms is None:
                results.append(MatchResult(
                    node_id=manifest.node_id,
                    instrument_id=instrument.id,
                    result=MatchResultType.CONDITIONAL,
                    reason=f"Clock precision unknown, request requires ±{request.clock_precision_ms} ms"
                ))
                continue
            elif cap.clock_precision_ms > request.clock_precision_ms:
                results.append(MatchResult(
                    node_id=manifest.node_id,
                    instrument_id=instrument.id,
                    result=MatchResultType.NO_MATCH,
                    reason=f"Clock precision insufficient: requires ±{request.clock_precision_ms} ms, has ±{cap.clock_precision_ms} ms"
                ))
                continue
                
        # Check modes
        missing_modes = set(request.modes) - set(cap.modes)
        if missing_modes:
            results.append(MatchResult(
                node_id=manifest.node_id,
                instrument_id=instrument.id,
                result=MatchResultType.NO_MATCH,
                reason=f"Missing required modes: {missing_modes}"
            ))
            continue
            
        # If we got here, it's a match!
        results.append(MatchResult(
            node_id=manifest.node_id,
            instrument_id=instrument.id,
            result=MatchResultType.MATCH,
            reason="Capabilities meet all request constraints"
        ))
        
    return results
