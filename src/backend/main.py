from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import warnings
import json
import uuid
import os
from datetime import datetime
import hashlib, secrets
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import base64
import re

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{h}"

def verify_password(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split(":", 1)
        return hashlib.sha256((salt + password).encode()).hexdigest() == h
    except Exception:
        return False

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model  = joblib.load("./hydrogen_digital_twin_model.pkl")
scaler = joblib.load("./scaler.pkl")

USERS_FILE    = "./users.json"
HISTORY_FILE  = "./history.json"
SESSIONS_FILE = "./sessions.json"
TEAMS_FILE    = "./teams.json"
TARGETS_FILE  = "./targets.json"
PLANT_FILE    = "./plant_baseline.json"

def load_json(path):
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f)

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def load_sessions() -> dict:
    return load_json(SESSIONS_FILE)

def save_sessions(sessions: dict):
    save_json(SESSIONS_FILE, sessions)

def get_email(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    sessions = load_sessions()
    email = sessions.get(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return email

# Keep old name as alias for backward compat
def get_username(authorization: str = Header(None)) -> str:
    return get_email(authorization)

def get_full_user(authorization: str) -> tuple:
    """Returns (email, user_dict). Raises 401 if not authenticated."""
    email = get_email(authorization)
    users = load_json(USERS_FILE)
    user = users.get(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return email, user

def require_manager(authorization: str):
    """Raises 403 if the caller is not a manager."""
    email, user = get_full_user(authorization)
    if user.get("role") != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return email, user

def get_team_history(team_id: str) -> list:
    """Aggregate history entries for all members of a team."""
    teams = load_json(TEAMS_FILE)
    team = teams.get(team_id)
    if not team:
        return []
    members = team.get("members", [])
    history = load_json(HISTORY_FILE)
    all_entries = []
    for member_email in members:
        for entry in history.get(member_email, []):
            all_entries.append({**entry, "_user": member_email})
    all_entries.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return all_entries

METRIC_DISPLAY = {
    "h2_cost":           {"label": "H₂ Production Cost", "unit": "$M/yr",  "direction": "minimize", "scale": lambda v: v / 1e6},
    "co2_annual_tonnes": {"label": "CO₂ Emissions",       "unit": "kt/yr",  "direction": "minimize", "scale": lambda v: v / 1000},
    "smr_conversion":    {"label": "SMR Conversion",       "unit": "%",      "direction": "maximize", "scale": lambda v: v * 100},
    "h2_production":     {"label": "H₂ Production Rate",  "unit": "kmol/h", "direction": "maximize", "scale": lambda v: v},
}

def get_plant_baseline_val(team_id: str, metric: str) -> float | None:
    """Return the scaled plant baseline value for a metric, or None if not set."""
    plant = load_json(PLANT_FILE)
    entry = plant.get(team_id)
    if not entry:
        return None
    cfg = METRIC_DISPLAY.get(metric, {})
    scale = cfg.get("scale", lambda v: v)
    raw = entry.get("metrics", {}).get(metric)
    if raw is None:
        return None
    return scale(raw)

def compute_target_progress(target: dict, team_history: list) -> dict:
    """Compute progress toward a target given a list of history entries.
    Uses plant baseline as the starting point when available."""
    metric = target.get("metric")
    goal = target.get("goal_value")
    direction = target.get("direction", "min")
    team_id = target.get("team_id")
    cfg = METRIC_DISPLAY.get(metric, {})
    scale = cfg.get("scale", lambda v: v)

    values = []
    for entry in team_history:
        opt = entry.get("optimized_results") or entry.get("results") or {}
        raw = opt.get(metric)
        if raw is not None:
            val = scale(raw)
            values.append((val, entry))

    # Prefer plant baseline; fall back to worst scenario value in history
    plant_baseline_val = get_plant_baseline_val(team_id, metric) if team_id else None

    if not values and plant_baseline_val is None:
        return {"pct": 0, "achieved": False, "best": None, "best_scenario": None,
                "remaining": None, "baseline": None}

    if direction == "min":
        best_val, best_entry = min(values, key=lambda x: x[0]) if values else (None, None)
        baseline = plant_baseline_val if plant_baseline_val is not None else max(v for v, _ in values)
        effective_best = best_val if best_val is not None else baseline
        if goal >= baseline:
            pct = 0.0
        elif baseline == goal:
            pct = 100.0
        else:
            pct = min(100.0, max(0.0, (baseline - effective_best) / (baseline - goal) * 100))
        achieved = effective_best <= goal
    else:
        best_val, best_entry = max(values, key=lambda x: x[0]) if values else (None, None)
        baseline = plant_baseline_val if plant_baseline_val is not None else min(v for v, _ in values)
        effective_best = best_val if best_val is not None else baseline
        if goal <= baseline:
            pct = 0.0
        elif baseline == goal:
            pct = 100.0
        else:
            pct = min(100.0, max(0.0, (effective_best - baseline) / (goal - baseline) * 100))
        achieved = effective_best >= goal

    return {
        "pct":           round(pct, 1),
        "achieved":      achieved,
        "best":          round(best_val, 3) if best_val is not None else None,
        "best_scenario": best_entry.get("name") if best_entry else None,
        "remaining":     round(abs(effective_best - goal), 3) if not achieved else 0,
        "baseline":      round(baseline, 3) if baseline is not None else None,
        "baseline_source": "plant" if plant_baseline_val is not None else "history",
    }

def compute_target_impacts(email: str, new_entry: dict) -> list:
    """For a newly saved scenario, compute how it moves team targets."""
    users = load_json(USERS_FILE)
    user = users.get(email, {})
    team_id = user.get("team_id")
    if not team_id:
        return []

    targets = load_json(TARGETS_FILE)
    team_targets = [t for t in targets.values() if t.get("team_id") == team_id]
    if not team_targets:
        return []

    team_history = get_team_history(team_id)
    impacts = []
    cfg_map = METRIC_DISPLAY

    for target in team_targets:
        metric = target.get("metric")
        cfg = cfg_map.get(metric, {})
        scale = cfg.get("scale", lambda v: v)
        direction = target.get("direction", "min")
        goal = target.get("goal_value")

        opt = new_entry.get("optimized_results") or new_entry.get("results") or {}
        raw_new = opt.get(metric)
        if raw_new is None:
            continue

        new_val = scale(raw_new)

        prev_history = [e for e in team_history if e.get("id") != new_entry.get("id")]
        prev_values = []
        for entry in prev_history:
            prev_opt = entry.get("optimized_results") or entry.get("results") or {}
            pv = prev_opt.get(metric)
            if pv is not None:
                prev_values.append(scale(pv))

        is_new_record = False
        if prev_values:
            if direction == "min":
                is_new_record = new_val < min(prev_values) - 0.001
            else:
                is_new_record = new_val > max(prev_values) + 0.001
        elif prev_values == []:
            is_new_record = True

        prev_pct = compute_target_progress(target, prev_history)["pct"]
        new_pct = compute_target_progress(target, team_history)["pct"]
        pct_delta = round(new_pct - prev_pct, 1)

        impacts.append({
            "metric": metric,
            "label": cfg.get("label", metric),
            "unit": cfg.get("unit", ""),
            "new_val": round(new_val, 3),
            "is_new_record": is_new_record,
            "pct_delta": pct_delta,
            "target_name": target.get("label", ""),
            "target_pct": round(new_pct, 1),
        })

    return impacts

FEATURE_RANGES = [
    (500.0,  1350.0),
    (2500.0, 4000.0),
    (750.0,  900.0),
    (2000.0, 3000.0),
    (320.0,  380.0),
]

OUTPUT_NAMES = [
    "h2_production", "smr_conversion", "steam_consumption",
    "co2_fraction",  "syngas_flow",    "ch4_slip",
    "h2_to_psa",     "h2_cost",
]

def scale_inputs(x: list) -> np.ndarray:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return scaler.transform([x])

def predict_outputs(x_raw: list) -> dict:
    pred = model.predict(scale_inputs(x_raw))[0]
    result = {name: float(val) for name, val in zip(OUTPUT_NAMES, pred)}
    co2_kmolh = result["co2_fraction"] * result["syngas_flow"]
    result["co2_flow_kmolh"]    = round(co2_kmolh, 2)
    result["co2_mass_kgh"]      = round(co2_kmolh * 44.0, 1)
    result["co2_annual_tonnes"] = round(co2_kmolh * 44.0 * 8760 / 1000, 0)
    return result

def objective(x_raw: list) -> float:
    pred = model.predict(scale_inputs(x_raw))[0]
    h2   = max(pred[0], 1.0)
    cost = pred[7]
    co2  = pred[3] * pred[4] * 44.0
    return 0.5 * (cost / 160_000_000) - 0.3 * (h2 / 2500.0) + 0.2 * (co2 / 43_000.0)

def run_optimizer(x0: list) -> list:
    best_x, best_val = list(x0), objective(x0)
    for ch4   in np.linspace(FEATURE_RANGES[0][0], FEATURE_RANGES[0][1], 5):
        for steam in np.linspace(FEATURE_RANGES[1][0], FEATURE_RANGES[1][1], 10):
            for temp  in np.linspace(FEATURE_RANGES[2][0], FEATURE_RANGES[2][1], 4):
                for hts in np.linspace(FEATURE_RANGES[4][0], FEATURE_RANGES[4][1], 4):
                    x = [ch4, steam, temp, x0[3], hts]
                    val = objective(x)
                    if val < best_val:
                        best_val = val
                        best_x = x[:]
    return best_x

# ─── Pydantic Models ────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "engineer"

class LoginRequest(BaseModel):
    email: str
    password: str

class PredictRequest(BaseModel):
    ch4_feed: float
    steam_flowrate: float
    smr_temp: float
    smr_pressure_kpa: float
    hts_temp: float

class HistorySaveRequest(BaseModel):
    name: str
    inputs: dict
    results: dict
    optimized_params: dict
    recommendations: list
    optimized_results: dict = {}

class CreateTeamRequest(BaseModel):
    name: str

class AddMemberRequest(BaseModel):
    email: str

class RemoveMemberRequest(BaseModel):
    email: str

class CreateTargetRequest(BaseModel):
    metric: str
    goal_value: float
    direction: str = "min"
    deadline: str = ""
    label: str = ""

class PlantSetupRequest(BaseModel):
    ch4_feed: float
    steam_flowrate: float
    smr_temp: float
    smr_pressure_kpa: float
    hts_temp: float

# ─── Auth Endpoints ──────────────────────────────────────────────────────────

@app.post("/register")
def register(req: RegisterRequest):
    users = load_json(USERS_FILE)
    if req.email in users:
        raise HTTPException(status_code=400, detail="Email already exists")
    users[req.email] = {
        "username": req.username,
        "password": hash_password(req.password),
        "role": "engineer",
        "team_id": None,
    }
    save_json(USERS_FILE, users)
    return {"message": "Account created successfully"}

@app.post("/auth/claim-manager")
def claim_manager(authorization: str = Header(None)):
    """First-time bootstrap: promotes the caller to manager if no managers exist yet."""
    email = get_email(authorization)
    users = load_json(USERS_FILE)
    existing_managers = [e for e, u in users.items() if u.get("role") == "manager"]
    if existing_managers:
        raise HTTPException(status_code=403, detail="A manager already exists. Ask them to promote you.")
    users[email]["role"] = "manager"
    save_json(USERS_FILE, users)
    sessions = load_sessions()
    return {"message": "You are now a manager.", "role": "manager"}

@app.post("/teams/promote-manager")
def promote_manager(req: AddMemberRequest, authorization: str = Header(None)):
    """Manager promotes a team member to manager role."""
    manager_email, manager = require_manager(authorization)
    manager_team_id = manager.get("team_id")
    users = load_json(USERS_FILE)
    target = users.get(req.email)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("team_id") != manager_team_id:
        raise HTTPException(status_code=403, detail="User is not on your team")
    users[req.email]["role"] = "manager"
    save_json(USERS_FILE, users)
    return {"message": f"{req.email} is now a manager"}

@app.post("/login")
def login(req: LoginRequest):
    users = load_json(USERS_FILE)
    user = users.get(req.email)
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = str(uuid.uuid4())
    sessions = load_sessions()
    sessions[token] = req.email
    save_sessions(sessions)
    return {
        "token":    token,
        "username": user["username"],
        "role":     user.get("role", "engineer"),
        "team_id":  user.get("team_id"),
    }

@app.post("/logout")
def logout(authorization: str = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        sessions = load_sessions()
        sessions.pop(token, None)
        save_sessions(sessions)
    return {"message": "Logged out"}

@app.get("/auth/me")
def auth_me(authorization: str = Header(None)):
    email, user = get_full_user(authorization)
    return {
        "email":    email,
        "username": user.get("username"),
        "role":     user.get("role", "engineer"),
        "team_id":  user.get("team_id"),
    }

# ─── History Endpoints ────────────────────────────────────────────────────────

@app.get("/history")
def get_history(authorization: str = Header(None)):
    username = get_username(authorization)
    history  = load_json(HISTORY_FILE)
    return {"history": sorted(history.get(username, []), key=lambda x: x["timestamp"], reverse=True)}

@app.post("/history")
def save_history(req: HistorySaveRequest, authorization: str = Header(None)):
    email   = get_email(authorization)
    history = load_json(HISTORY_FILE)
    if email not in history:
        history[email] = []
    entry = {
        "id":                str(uuid.uuid4()),
        "timestamp":         datetime.now().isoformat(),
        "name":              req.name or f"Scenario {len(history[email]) + 1}",
        "inputs":            req.inputs,
        "results":           req.results,
        "optimized_params":  req.optimized_params,
        "optimized_results": req.optimized_results,
        "recommendations":   req.recommendations,
    }
    history[email].append(entry)
    save_json(HISTORY_FILE, history)

    target_impacts = compute_target_impacts(email, entry)
    return {"message": "Saved", "id": entry["id"], "target_impacts": target_impacts}

@app.put("/history/{entry_id}")
def replace_history(entry_id: str, req: HistorySaveRequest, authorization: str = Header(None)):
    username = get_username(authorization)
    history  = load_json(HISTORY_FILE)
    entries  = history.get(username, [])
    idx = next((i for i, e in enumerate(entries) if e["id"] == entry_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    entries[idx] = {
        "id":                entry_id,
        "timestamp":         datetime.now().isoformat(),
        "name":              req.name or entries[idx].get("name", f"Scenario {idx + 1}"),
        "inputs":            req.inputs,
        "results":           req.results,
        "optimized_results": req.optimized_results,
        "optimized_params":  req.optimized_params,
        "recommendations":   req.recommendations,
    }
    history[username] = entries
    save_json(HISTORY_FILE, history)
    return {"message": "Replaced", "id": entry_id}

# ─── Team Endpoints ───────────────────────────────────────────────────────────

@app.post("/teams/create")
def create_team(req: CreateTeamRequest, authorization: str = Header(None)):
    manager_email, manager = require_manager(authorization)
    teams = load_json(TEAMS_FILE)
    team_id = f"team_{uuid.uuid4().hex[:8]}"
    teams[team_id] = {
        "name":    req.name,
        "manager": manager_email,
        "members": [manager_email],
    }
    save_json(TEAMS_FILE, teams)

    users = load_json(USERS_FILE)
    if manager_email in users:
        users[manager_email]["team_id"] = team_id
        save_json(USERS_FILE, users)

    return {"team_id": team_id, "name": req.name}

@app.post("/teams/add-member")
def add_member(req: AddMemberRequest, authorization: str = Header(None)):
    manager_email, manager = require_manager(authorization)
    manager_team_id = manager.get("team_id")
    if not manager_team_id:
        raise HTTPException(status_code=400, detail="Manager has no team")

    users = load_json(USERS_FILE)
    target_user = users.get(req.email)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    teams = load_json(TEAMS_FILE)
    team = teams.get(manager_team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if req.email not in team["members"]:
        team["members"].append(req.email)
        save_json(TEAMS_FILE, teams)

    users[req.email]["team_id"] = manager_team_id
    save_json(USERS_FILE, users)

    return {"message": f"{req.email} added to team"}

@app.post("/teams/remove-member")
def remove_member(req: RemoveMemberRequest, authorization: str = Header(None)):
    manager_email, manager = require_manager(authorization)
    manager_team_id = manager.get("team_id")
    if not manager_team_id:
        raise HTTPException(status_code=400, detail="Manager has no team")

    if req.email == manager_email:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the team")

    teams = load_json(TEAMS_FILE)
    team = teams.get(manager_team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team["members"] = [m for m in team["members"] if m != req.email]
    save_json(TEAMS_FILE, teams)

    users = load_json(USERS_FILE)
    if req.email in users:
        users[req.email]["team_id"] = None
        save_json(USERS_FILE, users)

    return {"message": f"{req.email} removed from team"}

@app.get("/teams/my-team")
def my_team(authorization: str = Header(None)):
    email, user = get_full_user(authorization)
    team_id = user.get("team_id")
    if not team_id:
        return {"team": None}

    teams = load_json(TEAMS_FILE)
    team = teams.get(team_id)
    if not team:
        return {"team": None}

    users = load_json(USERS_FILE)
    members = []
    for member_email in team.get("members", []):
        u = users.get(member_email, {})
        members.append({
            "email":    member_email,
            "username": u.get("username", member_email),
            "role":     u.get("role", "engineer"),
        })

    return {
        "team": {
            "id":      team_id,
            "name":    team["name"],
            "manager": team["manager"],
            "members": members,
        }
    }

# ─── Targets Endpoints ────────────────────────────────────────────────────────

@app.post("/targets/create")
def create_target(req: CreateTargetRequest, authorization: str = Header(None)):
    manager_email, manager = require_manager(authorization)
    team_id = manager.get("team_id")
    if not team_id:
        raise HTTPException(status_code=400, detail="Manager has no team")

    if req.metric not in METRIC_DISPLAY:
        raise HTTPException(status_code=400, detail=f"Unknown metric: {req.metric}")

    cfg = METRIC_DISPLAY[req.metric]
    targets = load_json(TARGETS_FILE)
    target_id = f"tgt_{uuid.uuid4().hex[:10]}"
    targets[target_id] = {
        "id":         target_id,
        "team_id":    team_id,
        "metric":     req.metric,
        "label":      req.label or cfg["label"],
        "goal_value": req.goal_value,
        "direction":  req.direction,
        "deadline":   req.deadline,
        "created_at": datetime.now().isoformat(),
        "created_by": manager_email,
    }
    save_json(TARGETS_FILE, targets)
    return {"target_id": target_id, **targets[target_id]}

@app.get("/targets/team")
def get_team_targets(authorization: str = Header(None)):
    email, user = get_full_user(authorization)
    team_id = user.get("team_id")
    if not team_id:
        return {"targets": []}

    targets = load_json(TARGETS_FILE)
    team_targets = [t for t in targets.values() if t.get("team_id") == team_id]

    team_history = get_team_history(team_id)
    result = []
    for target in team_targets:
        progress = compute_target_progress(target, team_history)
        result.append({**target, "progress": progress})

    return {"targets": result}

@app.delete("/targets/{target_id}")
def delete_target(target_id: str, authorization: str = Header(None)):
    manager_email, manager = require_manager(authorization)
    team_id = manager.get("team_id")

    targets = load_json(TARGETS_FILE)
    target = targets.get(target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    if target.get("team_id") != team_id:
        raise HTTPException(status_code=403, detail="Not your team's target")

    del targets[target_id]
    save_json(TARGETS_FILE, targets)
    return {"message": "Target deleted"}

# ─── Plant Baseline ──────────────────────────────────────────────────────────

@app.post("/plant/setup")
def plant_setup(req: PlantSetupRequest, authorization: str = Header(None)):
    manager_email, manager = require_manager(authorization)
    team_id = manager.get("team_id")
    if not team_id:
        raise HTTPException(status_code=400, detail="Manager has no team")

    x = [req.ch4_feed, req.steam_flowrate, req.smr_temp, req.smr_pressure_kpa, req.hts_temp]
    metrics = predict_outputs(x)

    plant = load_json(PLANT_FILE)
    plant[team_id] = {
        "team_id":    team_id,
        "inputs": {
            "ch4_feed":         req.ch4_feed,
            "steam_flowrate":   req.steam_flowrate,
            "smr_temp":         req.smr_temp,
            "smr_pressure_kpa": req.smr_pressure_kpa,
            "hts_temp":         req.hts_temp,
        },
        "metrics":    metrics,
        "updated_at": datetime.now().isoformat(),
        "updated_by": manager_email,
    }
    save_json(PLANT_FILE, plant)

    display = {
        "h2_cost":           round(metrics["h2_cost"] / 1e6, 2),
        "co2_annual_tonnes": round(metrics["co2_annual_tonnes"] / 1000, 1),
        "smr_conversion":    round(metrics["smr_conversion"] * 100, 2),
        "h2_production":     round(metrics["h2_production"], 1),
    }
    return {"message": "Plant baseline saved", "metrics": metrics, "display": display}

@app.get("/plant/baseline")
def get_plant_baseline(authorization: str = Header(None)):
    email, user = get_full_user(authorization)
    team_id = user.get("team_id")
    if not team_id:
        return {"baseline": None}
    plant = load_json(PLANT_FILE)
    entry = plant.get(team_id)
    if not entry:
        return {"baseline": None}
    metrics = entry.get("metrics", {})
    display = {
        "h2_cost":           round(metrics.get("h2_cost", 0) / 1e6, 2),
        "co2_annual_tonnes": round(metrics.get("co2_annual_tonnes", 0) / 1000, 1),
        "smr_conversion":    round(metrics.get("smr_conversion", 0) * 100, 2),
        "h2_production":     round(metrics.get("h2_production", 0), 1),
    }
    return {"baseline": {**entry, "display": display}}

# ─── Manager Dashboard ────────────────────────────────────────────────────────

@app.get("/manager/dashboard")
def manager_dashboard(authorization: str = Header(None)):
    manager_email, manager = require_manager(authorization)
    team_id = manager.get("team_id")
    if not team_id:
        return {"team": None, "targets": [], "leaderboard": [], "recent_activity": []}

    teams = load_json(TEAMS_FILE)
    team = teams.get(team_id, {})

    team_history = get_team_history(team_id)
    targets = load_json(TARGETS_FILE)
    team_targets = [t for t in targets.values() if t.get("team_id") == team_id]

    targets_with_progress = []
    for target in team_targets:
        progress = compute_target_progress(target, team_history)
        targets_with_progress.append({**target, "progress": progress})

    users_data = load_json(USERS_FILE)
    member_emails = team.get("members", [])
    history_data = load_json(HISTORY_FILE)

    leaderboard = []
    for member_email in member_emails:
        u = users_data.get(member_email, {})
        entries = history_data.get(member_email, [])
        if not entries:
            leaderboard.append({
                "email":        member_email,
                "username":     u.get("username", member_email),
                "scenarios":    0,
                "best_cost":    None,
                "best_h2":      None,
                "best_co2":     None,
                "best_smr":     None,
                "last_active":  None,
            })
            continue

        costs, h2s, co2s, smrs, timestamps = [], [], [], [], []
        for e in entries:
            opt = e.get("optimized_results") or e.get("results") or {}
            if opt.get("h2_cost")           is not None: costs.append(opt["h2_cost"])
            if opt.get("h2_production")     is not None: h2s.append(opt["h2_production"])
            if opt.get("co2_annual_tonnes") is not None: co2s.append(opt["co2_annual_tonnes"])
            if opt.get("smr_conversion")    is not None: smrs.append(opt["smr_conversion"])
            if e.get("timestamp"):                       timestamps.append(e["timestamp"])

        leaderboard.append({
            "email":       member_email,
            "username":    u.get("username", member_email),
            "scenarios":   len(entries),
            "best_cost":   round(min(costs) / 1e6, 2)       if costs else None,
            "best_h2":     round(max(h2s), 1)               if h2s   else None,
            "best_co2":    round(min(co2s) / 1000, 1)       if co2s  else None,
            "best_smr":    round(max(smrs) * 100, 2)        if smrs  else None,
            "last_active": max(timestamps)                   if timestamps else None,
        })

    leaderboard.sort(key=lambda x: (x["best_cost"] is None, x["best_cost"] or 0))

    recent_activity = team_history

    return {
        "team": {
            "id":      team_id,
            "name":    team["name"],
            "manager": manager_email,
            "member_count": len(member_emails),
        },
        "targets":         targets_with_progress,
        "leaderboard":     leaderboard,
        "recent_activity": recent_activity,
        "total_scenarios": len(team_history),
    }

# ─── Simulation Endpoints ─────────────────────────────────────────────────────

@app.post("/predict")
def predict(req: PredictRequest):
    x = [req.ch4_feed, req.steam_flowrate, req.smr_temp, req.smr_pressure_kpa, req.hts_temp]
    return {"predictions": predict_outputs(x)}

@app.post("/recommend")
def recommend(req: PredictRequest):
    x0        = [req.ch4_feed, req.steam_flowrate, req.smr_temp, req.smr_pressure_kpa, req.hts_temp]
    current   = predict_outputs(x0)
    opt_x     = run_optimizer(x0)
    optimized = predict_outputs(opt_x)

    param_meta = [
        ("CH₄ Feed",             "kgmol/h", 0),
        ("Steam Flowrate",        "kgmol/h", 0),
        ("SMR Temperature",       "°C",      0),
        ("SMR Pressure",          "kPa",     0),
        ("HTS Inlet Temperature", "°C",      0),
    ]
    recommendations = []
    for i, (label, unit, dec) in enumerate(param_meta):
        diff = opt_x[i] - x0[i]
        if abs(diff) / max(abs(x0[i]), 1e-6) * 100 > 0.5:
            recommendations.append(f"{'Increase' if diff > 0 else 'Decrease'} {label} to {round(opt_x[i], dec)} {unit}")
    if not recommendations:
        recommendations.append("Current parameters are already near-optimal.")

    return {
        "current":   current,
        "optimized": optimized,
        "optimized_params": {
            "ch4_feed":         round(opt_x[0], 0),
            "steam_flowrate":   round(opt_x[1], 0),
            "smr_temp":         round(opt_x[2], 0),
            "smr_pressure_kpa": round(opt_x[3], 0),
            "hts_temp":         round(opt_x[4], 0),
        },
        "recommendations":      recommendations,
        "cost_improvement_pct": round((current["h2_cost"] - optimized["h2_cost"]) / max(current["h2_cost"], 1) * 100, 2),
        "h2_improvement_pct":   round((optimized["h2_production"] - current["h2_production"]) / max(current["h2_production"], 1) * 100, 2),
    }

@app.get("/analytics")
def analytics():
    history = load_json(HISTORY_FILE)
    rows = []
    for username, entries in history.items():
        for e in entries:
            cur  = e.get("results", {})
            opt  = e.get("optimized_results", {})
            inp  = e.get("inputs", {})
            rows.append({
                "id":                      e.get("id", ""),
                "timestamp":               e.get("timestamp", ""),
                "scenario_name":           e.get("name", ""),
                "user":                    username,
                "ch4_feed":                inp.get("ch4_feed"),
                "steam_flowrate":          inp.get("steam_flowrate"),
                "smr_temp":                inp.get("smr_temp"),
                "smr_pressure_kpa":        inp.get("smr_pressure_kpa"),
                "hts_temp":                inp.get("hts_temp"),
                "cur_h2_production":       round(cur.get("h2_production", 0), 2),
                "cur_h2_cost":             round(cur.get("h2_cost", 0), 2),
                "cur_co2_annual_tonnes":   round(cur.get("co2_annual_tonnes", 0), 2),
                "cur_smr_conversion":      round(cur.get("smr_conversion", 0) * 100, 2),
                "cur_ch4_slip":            round(cur.get("ch4_slip", 0) * 100, 4),
                "cur_steam_consumption":   round(cur.get("steam_consumption", 0), 2),
                "opt_h2_production":       round(opt.get("h2_production", 0), 2)  if opt else None,
                "opt_h2_cost":             round(opt.get("h2_cost", 0), 2)         if opt else None,
                "opt_co2_annual_tonnes":   round(opt.get("co2_annual_tonnes", 0), 2) if opt else None,
                "opt_smr_conversion":      round(opt.get("smr_conversion", 0) * 100, 2) if opt else None,
                "cost_saving_usd":         round(cur.get("h2_cost", 0) - opt.get("h2_cost", 0), 2) if opt else None,
                "cost_saving_pct":         round((cur.get("h2_cost", 0) - opt.get("h2_cost", 0)) / max(cur.get("h2_cost", 1), 1) * 100, 2) if opt else None,
                "h2_gain_kmolh":           round(opt.get("h2_production", 0) - cur.get("h2_production", 0), 2) if opt else None,
                "co2_reduction_tonnes":    round(cur.get("co2_annual_tonnes", 0) - opt.get("co2_annual_tonnes", 0), 2) if opt else None,
            })
    rows.sort(key=lambda r: r["timestamp"])
    return rows

@app.post("/sensitivity")
def sensitivity_analysis(req: PredictRequest):
    x0 = [req.ch4_feed, req.steam_flowrate, req.smr_temp, req.smr_pressure_kpa, req.hts_temp]

    controllable = [
        (0, "CH₄ Feed"),
        (1, "Steam Flowrate"),
        (2, "SMR Temperature"),
        (4, "HTS Temperature"),
    ]

    rows = []
    for idx, name in controllable:
        lo, hi = FEATURE_RANGES[idx]
        step = (hi - lo) * 0.1

        x_hi = x0[:]
        x_hi[idx] = min(hi, x0[idx] + step)
        p_hi = predict_outputs(x_hi)

        x_lo = x0[:]
        x_lo[idx] = max(lo, x0[idx] - step)
        p_lo = predict_outputs(x_lo)

        rows.append({
            "param":      name,
            "h2_delta":   round(abs(p_hi["h2_production"]     - p_lo["h2_production"]),     1),
            "cost_delta": round(abs(p_hi["h2_cost"]           - p_lo["h2_cost"])     / 1e6, 4),
            "co2_delta":  round(abs(p_hi["co2_annual_tonnes"] - p_lo["co2_annual_tonnes"]),  0),
        })

    max_h2   = max(r["h2_delta"]   for r in rows) or 1
    max_cost = max(r["cost_delta"] for r in rows) or 1
    max_co2  = max(r["co2_delta"]  for r in rows) or 1

    for r in rows:
        r["h2_score"]   = round(r["h2_delta"]   / max_h2   * 100, 1)
        r["cost_score"] = round(r["cost_delta"] / max_cost * 100, 1)
        r["co2_score"]  = round(r["co2_delta"]  / max_co2  * 100, 1)

    return {"sensitivity": rows}

SMTP_HOST     = "smtp.gmail.com"
SMTP_PORT     = 465
SMTP_USER     = "hydogennetwork.repots@gmail.com"
SMTP_PASSWORD = "gvwcqduppiiqoxpt"

class EmailReportRequest(BaseModel):
    to_email:       str
    scenario_name:  str
    current:        dict
    optimized:      dict
    optimized_params: dict
    recommendations: list
    cost_improvement_pct: float
    h2_improvement_pct:   float
    personal_message: str = ""

def _do_send(req: EmailReportRequest):
    co2_curr = req.current.get("co2_annual_tonnes", 0)
    co2_opt  = req.optimized.get("co2_annual_tonnes", 0)
    co2_imp  = round((co2_curr - co2_opt) / max(co2_curr, 1) * 100, 2) if co2_curr else 0

    recs_html = "".join(
        f"<li style='margin-bottom:6px'>{r}</li>"
        for r in req.recommendations
    )

    html = f"""
    <div style="font-family:system-ui,Arial;max-width:640px;margin:0 auto;color:#111827">
      <div style="background:linear-gradient(135deg,#14532D,#16A34A);padding:24px 28px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;color:#fff;font-size:20px">SMR Scenario Report</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px">
          {req.scenario_name} &nbsp;·&nbsp; Generated {datetime.now().strftime("%d %b %Y, %H:%M")}
        </p>
      </div>
      <div style="border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:24px 28px">

        {f'''<div style="background:#F0FDF4;border:1px solid #D1FAE5;border-radius:10px;padding:16px 20px;margin-bottom:24px">
          <p style="margin:0 0 4px;font-size:11px;font-weight:800;color:#065F46;text-transform:uppercase;letter-spacing:0.06em">Personal Message</p>
          <p style="margin:0;font-size:14px;color:#111827;line-height:1.6;white-space:pre-wrap">{req.personal_message}</p>
        </div>''' if req.personal_message.strip() else ''}

        <h2 style="font-size:14px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em">Optimization Summary</h2>
        <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse:collapse;font-size:14px">
          <tr style="background:#F0FDF4">
            <th style="text-align:left;border-bottom:1px solid #E5E7EB">Metric</th>
            <th style="text-align:center;border-bottom:1px solid #E5E7EB">Current</th>
            <th style="text-align:center;border-bottom:1px solid #E5E7EB;color:#14532D">Optimized</th>
          </tr>
          <tr>
            <td>H₂ Production</td>
            <td style="text-align:center">{round(req.current.get("h2_production",0),1)} kmol/h</td>
            <td style="text-align:center;color:#14532D;font-weight:700">{round(req.optimized.get("h2_production",0),1)} kmol/h <span style="font-size:11px;background:#D1FAE5;padding:2px 7px;border-radius:999px">+{req.h2_improvement_pct:.1f}%</span></td>
          </tr>
          <tr style="background:#F9FAFB">
            <td>H₂ Cost</td>
            <td style="text-align:center">${req.current.get("h2_cost",0)/1e6:.2f}M/yr</td>
            <td style="text-align:center;color:#14532D;font-weight:700">${req.optimized.get("h2_cost",0)/1e6:.2f}M/yr <span style="font-size:11px;background:#D1FAE5;padding:2px 7px;border-radius:999px">-{req.cost_improvement_pct:.1f}%</span></td>
          </tr>
          <tr>
            <td>CO₂ Emissions</td>
            <td style="text-align:center">{round(co2_curr/1000,1)}k t/yr</td>
            <td style="text-align:center;color:#14532D;font-weight:700">{round(co2_opt/1000,1)}k t/yr <span style="font-size:11px;background:#D1FAE5;padding:2px 7px;border-radius:999px">-{co2_imp:.1f}%</span></td>
          </tr>
          <tr style="background:#F9FAFB">
            <td>SMR Conversion</td>
            <td style="text-align:center">{req.current.get("smr_conversion",0)*100:.2f}%</td>
            <td style="text-align:center;color:#14532D;font-weight:700">{req.optimized.get("smr_conversion",0)*100:.2f}%</td>
          </tr>
        </table>

        <h2 style="font-size:14px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-top:24px">Optimized Parameters</h2>
        <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:13px">
          {"".join(f"<tr style='border-bottom:1px solid #F3F4F6'><td style='color:#374151'>{p}</td><td style='text-align:right;font-weight:700;color:#14532D'>{v}</td></tr>" for p,v in [
            ("CH₄ Feed", f"{req.optimized_params.get('ch4_feed','')} kgmol/h"),
            ("Steam Flowrate", f"{req.optimized_params.get('steam_flowrate','')} kgmol/h"),
            ("SMR Temperature", f"{req.optimized_params.get('smr_temp','')} °C"),
            ("SMR Pressure", f"{req.optimized_params.get('smr_pressure_kpa','')} kPa"),
            ("HTS Temperature", f"{req.optimized_params.get('hts_temp','')} °C"),
          ])}
        </table>

        <h2 style="font-size:14px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-top:24px">AI Recommendations</h2>
        <ol style="padding-left:20px;font-size:13px;color:#374151;line-height:1.8">{recs_html}</ol>

        <p style="margin-top:28px;font-size:11px;color:#9CA3AF;border-top:1px solid #F3F4F6;padding-top:16px">
          Sent by Hydrogen Network Optimizer &nbsp;·&nbsp; {datetime.now().strftime("%d %b %Y")}
        </p>
      </div>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"SMR Report: {req.scenario_name}"
    msg["From"]    = SMTP_USER
    msg["To"]      = req.to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, req.to_email, msg.as_string())
        print(f"[EMAIL] ✓ Sent to {req.to_email}")
    except Exception as e:
        print(f"[EMAIL] ✗ Failed: {e}")

@app.post("/send-report")
def send_report(req: EmailReportRequest, background_tasks: BackgroundTasks):
    if not SMTP_USER or not SMTP_PASSWORD:
        raise HTTPException(status_code=500, detail="Email not configured on server.")
    background_tasks.add_task(_do_send, req)
    return {"message": f"Report queued for {req.to_email}"}

def compute_confidence(x_raw: list) -> dict:
    details = []
    total_penalty = 0.0

    for i, (val, (lo, hi)) in enumerate(zip(x_raw, FEATURE_RANGES)):
        norm      = (val - lo) / (hi - lo)
        dist_edge = abs(norm - 0.5) * 2
        penalty   = dist_edge ** 2
        total_penalty += penalty
        details.append({
            "param":     ["CH₄ Feed", "Steam Flowrate", "SMR Temp", "SMR Pressure", "HTS Temp"][i],
            "norm":      round(norm * 100, 1),
            "penalty":   round(dist_edge * 100, 1),
        })

    avg_penalty = total_penalty / len(x_raw)
    score = max(0, min(100, round((1 - avg_penalty) * 100)))

    if score >= 85:
        label = "High";   color = "#14532D"; bg = "#F0FDF4"; border = "#BBF7D0"
        note  = "Inputs are well within the model's training distribution. Predictions are reliable."
    elif score >= 65:
        label = "Moderate"; color = "#92400E"; bg = "#FFFBEB"; border = "#FDE68A"
        note  = "Some inputs are near the edges of the training range. Predictions are generally reliable but treat with some caution."
    else:
        label = "Low";    color = "#991B1B"; bg = "#FEF2F2"; border = "#FECACA"
        note  = "One or more inputs are near the boundary of the training data. The AI model is extrapolating — verify results with Aspen HYSYS before acting."

    return {"score": score, "label": label, "color": color, "bg": bg, "border": border, "note": note, "details": details}

@app.post("/confidence")
def confidence(req: PredictRequest):
    x = [req.ch4_feed, req.steam_flowrate, req.smr_temp, req.smr_pressure_kpa, req.hts_temp]
    return compute_confidence(x)
