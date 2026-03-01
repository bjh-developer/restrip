import os
import time
import requests
from requests.auth import HTTPBasicAuth

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL")
PROMETHEUS_USERNAME = os.getenv("PROMETHEUS_USERNAME")
GRAFANA_API_KEY = os.getenv("GRAFANA_API_KEY")

def push_metric(request_id: str, duration_ms: float, status: str, error: str = None):
    """Push a single invocation metric to Grafana Cloud via Prometheus remote write."""
    if not all([PROMETHEUS_URL, PROMETHEUS_USERNAME, GRAFANA_API_KEY]):
        return  # silently skip if not configured

    timestamp_ms = int(time.time() * 1000)
    status_label = "success" if status == "success" else "error"

    # Build Prometheus exposition format
    metrics = f"""
# HELP runpod_request_duration_ms Duration of RunPod handler invocation in milliseconds
# TYPE runpod_request_duration_ms gauge
runpod_request_duration_ms{{status="{status_label}"}} {duration_ms} {timestamp_ms}

# HELP runpod_request_total Total number of RunPod handler invocations
# TYPE runpod_request_total counter
runpod_request_total{{status="{status_label}"}} 1 {timestamp_ms}
"""

    try:
        response = requests.post(
            PROMETHEUS_URL,
            data=metrics.strip(),
            auth=HTTPBasicAuth(PROMETHEUS_USERNAME, GRAFANA_API_KEY),
            headers={"Content-Type": "text/plain"},
            timeout=3  # don't slow down the handler if Grafana is unreachable
        )
        if response.status_code != 204:
            print(f"Metrics push failed: {response.status_code} {response.text}")
    except Exception as e:
        print(f"Metrics push error: {e}")  # never let metrics crash the handler