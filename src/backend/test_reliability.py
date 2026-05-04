"""
Reliability Test — Requirement: >= 95% valid prediction responses
Run: python test_reliability.py
Expects the FastAPI backend running on https://hydrogennetwork-optimizer-1.onrender.com
"""

import requests
import random
import time

BASE_URL   = "http://https://hydrogennetwork-optimizer-1.onrender.com"
ENDPOINT   = f"{BASE_URL}/predict"
N_REQUESTS = 100          # total requests to send
THRESHOLD  = 95.0         # minimum required success rate (%)

# Parameter ranges that match the model's training distribution
RANGES = {
    "ch4_feed":         (500.0,  1350.0),
    "steam_flowrate":   (2500.0, 4000.0),
    "smr_temp":         (750.0,  900.0),
    "smr_pressure_kpa": (2000.0, 3000.0),
    "hts_temp":         (320.0,  380.0),
}

def random_payload():
    return {k: round(random.uniform(*v), 2) for k, v in RANGES.items()}

def is_valid(response) -> bool:
    """Return True if the response contains all expected output fields."""
    if response.status_code != 200:
        return False
    try:
        body = response.json()
        preds = body.get("predictions", {})
        required = [
            "h2_production", "h2_cost", "co2_annual_tonnes",
            "smr_conversion", "co2_mass_kgh",
        ]
        return all(k in preds and preds[k] is not None for k in required)
    except Exception:
        return False

# ── Run test ──────────────────────────────────────────────────────────────────
print("=" * 60)
print(f"  Hydrogen Network Optimizer — Reliability Test")
print(f"  Endpoint : {ENDPOINT}")
print(f"  Requests : {N_REQUESTS}")
print(f"  Threshold: >= {THRESHOLD}%")
print("=" * 60)

successes   = 0
failures    = 0
latencies   = []
fail_detail = []

for i in range(1, N_REQUESTS + 1):
    payload = random_payload()
    t0 = time.perf_counter()
    try:
        resp = requests.post(ENDPOINT, json=payload, timeout=5)
        latency_ms = (time.perf_counter() - t0) * 1000
        if is_valid(resp):
            successes += 1
            latencies.append(latency_ms)
        else:
            failures += 1
            fail_detail.append(
                f"  #{i:>3}  HTTP {resp.status_code}  body={resp.text[:80]}"
            )
    except Exception as e:
        failures += 1
        fail_detail.append(f"  #{i:>3}  Exception: {e}")

    # progress bar every 10 requests
    if i % 10 == 0:
        pct = successes / i * 100
        bar = "█" * (successes * 20 // i) + "░" * (20 - successes * 20 // i)
        print(f"  [{bar}] {i:>3}/{N_REQUESTS}  success so far: {pct:.1f}%")

# ── Results ───────────────────────────────────────────────────────────────────
success_rate = successes / N_REQUESTS * 100
avg_ms  = sum(latencies) / len(latencies) if latencies else 0
p95_ms  = sorted(latencies)[int(len(latencies) * 0.95) - 1] if latencies else 0
passed  = success_rate >= THRESHOLD

print()
print("=" * 60)
print("  RESULTS")
print("=" * 60)
print(f"  Total requests   : {N_REQUESTS}")
print(f"  Successful       : {successes}  ({success_rate:.1f}%)")
print(f"  Failed           : {failures}")
print(f"  Avg latency      : {avg_ms:.1f} ms")
print(f"  P95 latency      : {p95_ms:.1f} ms")
print()
print(f"  Requirement      : >= {THRESHOLD}% valid responses")
print(f"  Measured         : {success_rate:.1f}%")
print(f"  Status           : {'✓  PASS' if passed else '✗  FAIL'}")
print("=" * 60)

if fail_detail:
    print("\n  Failed request details:")
    for d in fail_detail[:10]:     # show first 10 only
        print(d)
    if len(fail_detail) > 10:
        print(f"  ... and {len(fail_detail) - 10} more")
    print()

# Exit with non-zero code if the requirement is not met (useful for CI)
import sys
sys.exit(0 if passed else 1)
