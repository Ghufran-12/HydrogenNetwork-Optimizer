import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { METRIC_CONFIG } from "../utils/targets";
import "../styles/targets-page.css";
import "../styles/shared-page.css";
import PageHeader from "../components/PageHeader";

/* ── Icons ── */
const IconTarget = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

/* ── TargetCard ── */
function TargetCard({ target, onDelete, isManager }) {
  const cfg = METRIC_CONFIG[target.metric];
  const p   = target.progress || {};
  const pct = p.pct ?? 0;
  const achieved = p.achieved ?? false;

  const daysLeft = target.deadline
    ? Math.ceil((new Date(target.deadline) - Date.now()) / 86400000)
    : null;

  const barColor = achieved
    ? "#16A34A"
    : pct >= 66 ? "#2563EB"
    : pct >= 33 ? "#D97706"
    : "#9CA3AF";

  const unitLabel = cfg?.unit ?? "";
  const fmtGoal = cfg?.fmtVal ? cfg.fmtVal(target.goal_value) : `${target.goal_value} ${unitLabel}`;

  return (
    <div className={`target-card${achieved ? " target-card-achieved" : ""}`}>
      <div className="target-card-header">
        <div className="target-card-title-row">
          <span className="target-card-icon"><IconTarget /></span>
          <div>
            <div className="target-card-name">{target.label}</div>
            <div className="target-card-metric">{cfg?.label ?? target.metric} · {unitLabel}</div>
          </div>
        </div>
        <div className="target-card-right">
          {achieved && <span className="target-achieved-badge">Goal Reached!</span>}
          {daysLeft != null && (
            <span className={`target-deadline-badge${daysLeft < 7 && !achieved ? " target-deadline-urgent" : ""}`}>
              {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? "Due today" : "Overdue"}
            </span>
          )}
          {isManager && (
            <button className="target-delete-btn" onClick={() => onDelete(target.id)} title="Delete this target">
              <IconTrash />
            </button>
          )}
        </div>
      </div>

      <div className="target-stats-row">
        <div className="target-stat">
          <span className="target-stat-label">Direction</span>
          <span className="target-stat-val">{target.direction === "min" ? "Minimize" : "Maximize"}</span>
        </div>
        <span className="target-stat-arrow">→</span>
        <div className="target-stat">
          <span className="target-stat-label">Goal</span>
          <span className="target-stat-val target-stat-goal">{fmtGoal}</span>
        </div>
        {p.best != null && (
          <>
            <span className="target-stat-sep">·</span>
            <div className="target-stat">
              <span className="target-stat-label">Team Best</span>
              <span className="target-stat-val target-stat-best">
                {cfg?.fmtVal ? cfg.fmtVal(p.best) : `${p.best} ${unitLabel}`}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="target-progress-row">
        <div className="target-progress-track">
          <div
            className="target-progress-fill"
            style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
          />
        </div>
        <span className="target-progress-pct">{pct.toFixed(0)}%</span>
      </div>

      <div className="target-footer-row">
        <div className="target-footer-left">
          {p.remaining > 0
            ? <span>Gap remaining: <strong>{p.remaining} {unitLabel}</strong></span>
            : achieved
            ? <span className="target-footer-exceeded">Target achieved!</span>
            : <span>No team data yet</span>}
        </div>
        <div className="target-footer-right">
          {p.best_scenario && (
            <span className="target-best-scenario">
              Best by: <strong>{p.best_scenario}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function TargetsPage() {
  const navigate = useNavigate();
  const { user, authFetch } = useAuth();

  const [targets, setTargets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [apiError, setApiError]   = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving]       = useState(false);

  const isManager = user?.role === "manager";

  const [form, setForm] = useState({
    label:      "",
    metric:     "h2_cost",
    goal_value: "",
    direction:  "min",
    deadline:   "",
  });

  useEffect(() => { loadTargets(); }, []);

  async function loadTargets() {
    setLoading(true);
    setApiError("");
    try {
      const res  = await authFetch("http://localhost:8000/targets/team");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load targets");
      setTargets(data.targets || []);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleMetricChange(metric) {
    const cfg = METRIC_CONFIG[metric];
    const dir = cfg?.direction === "maximize" ? "max" : "min";
    setForm(f => ({ ...f, metric, direction: dir }));
  }

  async function handleAdd() {
    setFormError("");
    if (!form.label.trim())  { setFormError("Please enter a target name."); return; }
    if (!form.goal_value)    { setFormError("Please enter a goal value.");   return; }
    const goalNum = parseFloat(form.goal_value);
    if (isNaN(goalNum))      { setFormError("Goal value must be a number."); return; }

    setSaving(true);
    try {
      const res  = await authFetch("http://localhost:8000/targets/create", {
        method: "POST",
        body: JSON.stringify({
          metric:     form.metric,
          goal_value: goalNum,
          direction:  form.direction,
          deadline:   form.deadline || "",
          label:      form.label.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create target");
      setForm({ label: "", metric: "h2_cost", goal_value: "", direction: "min", deadline: "" });
      setShowForm(false);
      await loadTargets();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this target?")) return;
    try {
      const res  = await authFetch(`http://localhost:8000/targets/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to delete");
      await loadTargets();
    } catch (err) {
      setApiError(err.message);
    }
  }

  const activeTargets  = targets.filter(t => !t.progress?.achieved);
  const reachedTargets = targets.filter(t =>  t.progress?.achieved);
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="shared-page">
      <div className="shared-shell">

        <PageHeader subtitle="Goals &amp; Targets" />

        <div className="shared-page-card">
        {/* ── Page heading ── */}
        <div className="page-heading">
          <div className="page-heading-left">
            <button className="page-back-btn" onClick={() => navigate("/")}>← Home</button>
            <div>
              <div className="page-heading-title">Goals &amp; Targets</div>
              <div className="page-heading-sub">
                {isManager
                  ? "Set team goals. Every simulation is automatically tracked against them."
                  : "Track your team's shared optimization goals and progress."}
              </div>
            </div>
          </div>
          {isManager && !showForm && (
            <div className="page-heading-actions">
              <button
                className="targets-new-btn"
                onClick={() => {setShowForm(true); setFormError("");}}
              >
                <IconPlus /> New Target
              </button>
            </div>
          )}
        </div>

        {apiError && <div className="target-form-error" style={{ marginBottom: 16 }}>{apiError}</div>}

        {/* ── Add target form (manager only) ── */}
        {showForm && isManager && (
          <div className="target-form-card">
            <div className="target-form-title">Define a New Target</div>
            <div className="target-form-grid">
              <div className="target-form-field target-form-span2">
                <label>Target Name</label>
                <input
                  type="text"
                  placeholder="e.g. Q2 Cost Reduction Drive"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div className="target-form-field">
                <label>Metric to Track</label>
                <select value={form.metric} onChange={e => handleMetricChange(e.target.value)}>
                  {Object.entries(METRIC_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label} ({cfg.unit})</option>
                  ))}
                </select>
              </div>
              <div className="target-form-field">
                <label>Direction</label>
                <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
                  <option value="min">Minimize (lower is better)</option>
                  <option value="max">Maximize (higher is better)</option>
                </select>
              </div>
              <div className="target-form-field">
                <label>
                  Goal Value
                  <span className="target-form-unit"> ({METRIC_CONFIG[form.metric]?.unit})</span>
                </label>
                <input
                  type="number"
                  placeholder={METRIC_CONFIG[form.metric]?.placeholder}
                  value={form.goal_value}
                  onChange={e => setForm(f => ({ ...f, goal_value: e.target.value }))}
                />
                <div className="target-form-hint">
                  {METRIC_CONFIG[form.metric]?.direction === "minimize"
                    ? "Target to beat — should be achievable but ambitious."
                    : "Target to reach — should be achievable but ambitious."}
                </div>
              </div>
              <div className="target-form-field">
                <label>Deadline <span className="target-form-optional">(optional)</span></label>
                <input
                  type="date"
                  min={todayStr}
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                />
              </div>
            </div>
            {formError && <div className="target-form-error">{formError}</div>}
            <div className="target-form-footer">
              <button
                className="targets-cancel-btn"
                onClick={() => {setShowForm(false); setFormError("");}} 
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="targets-new-btn targets-save-btn"
                onClick={handleAdd}
                disabled={saving || !form.label.trim() || !form.goal_value}
              >
               {saving ? "Saving…" : "Save Target"}
              </button>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && <div className="targets-empty-msg">Loading targets…</div>}

        {/* ── Engineer: no team yet ── */}
        {!loading && !isManager && targets.length === 0 && (
          <div className="targets-zero-state">
            <div className="targets-zero-icon">🎯</div>
            <div className="targets-zero-title">No team targets yet</div>
            <div className="targets-zero-sub">
              Your manager hasn't set any targets yet. Check back after they've defined goals for the team.
            </div>
          </div>
        )}

        {/* ── Manager: no targets ── */}
        {!loading && isManager && targets.length === 0 && !showForm && (
          <div className="targets-zero-state">
            <div className="targets-zero-icon">🎯</div>
            <div className="targets-zero-title">No targets set yet</div>
            <div className="targets-zero-sub">
              Set your first goal to turn every simulation run into measurable team progress.
            </div>
            <button className="targets-new-btn" onClick={() => setShowForm(true)}>
              <IconPlus /> Set First Target
            </button>
          </div>
        )}

        {/* ── Active targets ── */}
        {!loading && activeTargets.length > 0 && (
          <div className="targets-section">
            <div className="targets-section-label">
              Active Targets <span className="targets-count">{activeTargets.length}</span>
            </div>
            <div className="targets-list">
              {activeTargets.map(t => (
                <TargetCard key={t.id} target={t} onDelete={handleDelete} isManager={isManager} />
              ))}
            </div>
          </div>
        )}

        {/* ── Reached targets ── */}
        {!loading && reachedTargets.length > 0 && (
          <div className="targets-section">
            <div className="targets-section-label targets-section-label-reached">
              Goals Reached <span className="targets-count targets-count-reached">{reachedTargets.length}</span>
            </div>
            <div className="targets-list">
              {reachedTargets.map(t => (
                <TargetCard key={t.id} target={t} onDelete={handleDelete} isManager={isManager} />
              ))}
            </div>
          </div>
        )}

        </div> {/* shared-page-card */}
      </div>
    </div>
  );
}
