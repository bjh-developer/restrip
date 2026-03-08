import os
import time
import json
import requests
from requests.auth import HTTPBasicAuth


# Grafana Cloud Loki
LOKI_URL = os.getenv("LOKI_URL")
LOKI_USERNAME = os.getenv("LOKI_USERNAME")
LOKI_API_KEY = os.getenv("GRAFANA_API_KEY")


def push_loki(request_id: str, duration_ms: float, status: str, error: str = None):
    """Push log to Grafana Cloud Loki."""
    if not all([LOKI_URL, LOKI_USERNAME, LOKI_API_KEY]):
        return

    log_line = json.dumps({
        "request_id": request_id,
        "duration_ms": duration_ms,
        "status": status,
        **( {"error": error} if error else {} )  # only include error if it exists
    })

    # Loki expects nanosecond timestamps
    timestamp_ns = str(int(time.time() * 1e9))

    payload = {
        "streams": [
            {
                "stream": {
                    "service": "runpod-handler",
                    "status": status,
                    "detected_level": "error" if (error and error.strip()) else "info",
                },
                "values": [
                    [timestamp_ns, log_line]
                ]
            }
        ]
    }

    try:
        response = requests.post(
            LOKI_URL,
            json=payload,
            auth=HTTPBasicAuth(LOKI_USERNAME, LOKI_API_KEY),
            headers={"Content-Type": "application/json"},
            timeout=3
        )
        if response.status_code not in (200, 204):
            print(f"Loki push failed: {response.status_code} {response.text}")
    except Exception as e:
        print(f"Loki push error: {e}")


def push_metric(request_id: str, duration_ms: float, status: str, error: str = None):
    """Push to Better Stack and Grafana Cloud Loki."""
    push_loki(request_id, duration_ms, status, error)
