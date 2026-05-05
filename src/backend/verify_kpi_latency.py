#!/usr/bin/env python3
"""
verify_kpi_latency.py

Usage: python3 verify_kpi_latency.py

This script simulates an Aspen data push by creating a history entry via the
FastAPI `/history` endpoint (authenticated), then polls `/analytics` until the
new KPI appears or the timeout (default 10s) is reached. Exits 0 on success,
non-zero on failure.
"""
#!/usr/bin/env python3
import requests
import time
import uuid
import argparse
import sys


def register_if_needed(base, username, password):
    url = f"{base}/register"
    email = f"{username}@test.com"

    try:
        r = requests.post(url, json={
            "username": username,
            "email": email,
            "password": password,
            "role": "engineer"
        }, timeout=5)

        # OK if created, or already exists
        if r.status_code in [200, 400]:
            return True

        print("[REGISTER ERROR]", r.status_code, r.text)
        return False

    except Exception as e:
        print("[REGISTER ERROR]", e)
        return False


def login(base, username, password):
    url = f"{base}/login"
    email = f"{username}@test.com"

    r = requests.post(url, json={
        "email": email,
        "password": password
    }, timeout=5)

    r.raise_for_status()
    return r.json().get("token")


def post_history(base, token, name, inputs, results):
    url = f"{base}/history"
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "name": name,
        "inputs": inputs,
        "results": results,
        "optimized_params": {},
        "recommendations": [],
        "optimized_results": {},
    }

    r = requests.post(url, json=payload, headers=headers, timeout=5)
    r.raise_for_status()
    return r.json()


def get_analytics(base):
    url = f"{base}/analytics"
    r = requests.get(url, timeout=5)
    r.raise_for_status()
    return r.json()


def find_entry_with_value(rows, scenario_name, key, value):
    for r in rows:
        if scenario_name and r.get("scenario_name") == scenario_name:
            if key in r and r.get(key) == value:
                return True

        for v in r.values():
            if v == value:
                return True

    return False


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="https://hydrogennetwork-optimizer-1.onrender.com")
    p.add_argument("--timeout", type=float, default=10.0)
    p.add_argument("--username", default="kpi-tester")
    p.add_argument("--password", default="testpass123")
    args = p.parse_args()

    base = args.base.rstrip("/")
    username = args.username
    password = args.password

    register_if_needed(base, username, password)

    try:
        token = login(base, username, password)
    except Exception as e:
        print("[ERROR] login failed:", e)
        sys.exit(2)

    unique_val = int(time.time() % 100000) + 500000
    scenario_name = f"kpi-test-{uuid.uuid4().hex[:8]}"

    inputs = {
        "ch4_feed": 1000,
        "steam_flowrate": 3000,
        "smr_temp": 800,
        "smr_pressure_kpa": 2500,
        "hts_temp": 340
    }

    results = {
        "h2_production": unique_val,
        "h2_cost": 123456.0,
        "co2_annual_tonnes": 999
    }

    print(f"[INFO] Posting history entry '{scenario_name}' with unique KPI {unique_val}")

    try:
        post_history(base, token, scenario_name, inputs, results)
    except Exception as e:
        print("[ERROR] failed to POST history:", e)
        sys.exit(3)

    start = time.time()
    deadline = start + args.timeout
    found = False

    while time.time() < deadline:
        try:
            rows = get_analytics(base)
        except Exception:
            time.sleep(0.5)
            continue

        if find_entry_with_value(rows, scenario_name, "cur_h2_production", unique_val):
            found = True
            break

        time.sleep(0.5)

    elapsed = time.time() - start

    if found:
        print(f"[OK] Dashboard reflected new KPI in {elapsed:.2f}s (threshold {args.timeout}s)")
        sys.exit(0)
    else:
        print(f"[FAIL] Dashboard did NOT reflect KPI within {args.timeout}s (elapsed {elapsed:.2f}s)")
        sys.exit(4)


if __name__ == "__main__":
    main()