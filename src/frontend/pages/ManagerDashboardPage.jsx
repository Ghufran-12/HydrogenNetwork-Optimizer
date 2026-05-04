import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/manager-dashboard.css";
import "../styles/shared-page.css";
import PageHeader from "../components/PageHeader";

/* ── Helpers ── */
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function getVal(entry, key) {
  return entry.optimized_results?.[key] ?? entry.results?.[key] ?? null;
}

/* ── Progress ring ── */
function ProgressRing({ pct, size = 64, stroke = 6 }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  const color = pct >= 100 ? "#14532D" : pct >= 60 ? "#16A34A" : pct >= 30 ? "#D97706" : "#DC2626";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    </svg>
  );
}

/* ── Activity bar chart ── */
function ActivityChart({ activity }) {
  const days = useMemo(() => {
    const out = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(d.toDateString());
    }
    return out;
  }, []);

  const counts = useMemo(() =>
    days.map(day => activity.filter(s => new Date(s.timestamp).toDateString() === day).length),
    [days, activity]
  );

  const maxCount = Math.max(...counts, 1);
  const chartH = 100;
  const barW   = 22;
  const gap    = 5;
  const totalW = days.length * (barW + gap) - gap;

  return (
    <div className="mgrd-chart-wrap">
      <div className="mgrd-chart-inner">
        <svg width={totalW} height={chartH + 36} style={{ overflow: "visible", display: "block" }}>
          {counts.map((count, i) => {
            const barH  = count > 0 ? Math.max(6, (count / maxCount) * chartH) : 3;
            const x     = i * (barW + gap);
            const y     = chartH - barH;
            const date  = new Date(days[i]);
            const isToday   = i === days.length - 1;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const showLabel = i % 4 === 0 || isToday;
            const fill = count === 0
              ? "#F3F4F6"
              : isToday ? "#14532D"
              : isWeekend ? "#BBF7D0"
              : "#16A34A";

            return (
              <g key={i}>
                <rect x={x} y={y} width={barW} height={barH} rx={4} ry={4} fill={fill} />
                {count > 0 && (
                  <text x={x + barW / 2} y={y - 5} textAnchor="middle"
                    fontSize={10} fontWeight={700} fill="#374151">
                    {count}
                  </text>
                )}
                {showLabel && (
                  <text x={x + barW / 2} y={chartH + 22} textAnchor="middle"
                    fontSize={9} fill={isToday ? "#14532D" : "#9CA3AF"}
                    fontWeight={isToday ? 800 : 500}>
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ── Target deep card ── */
function TargetCard({ target, onDelete }) {
  const p   = target.progress || {};
  const pct = Math.min(100, Math.max(0, p.pct ?? 0));

  /* Progress track positions */
  const baseline = p.baseline ?? null;
  const best     = p.best     ?? null;
  const goal     = target.goal_value;
  const isMin    = target.direction === "min";

  let bestPct = 0;
  if (baseline != null && best != null && goal != null) {
    const span = Math.abs(baseline - goal);
    if (span > 0) {
      bestPct = Math.min(100, Math.max(0, (Math.abs(baseline - best) / span) * 100));
    }
  }

  /* Trajectory */
  let trajectory = null;
  if (pct > 0 && pct < 100 && target.created_at) {
    const daysElapsed = (Date.now() - new Date(target.created_at).getTime()) / 86400000;
    if (daysElapsed > 0.5) {
      const rate          = pct / daysElapsed;
      const daysRemaining = (100 - pct) / rate;
      const estDate       = new Date(Date.now() + daysRemaining * 86400000);
      trajectory = { days: Math.round(daysRemaining), estDate };
    }
  }

  /* Status badge */
  let badge = null;
  if (p.achieved) {
    badge = { cls: "mgrd-badge-achieved", label: "✓ Achieved" };
  } else if (target.deadline && new Date(target.deadline) < new Date()) {
    badge = { cls: "mgrd-badge-overdue", label: "⚠ Overdue" };
  } else if (trajectory && trajectory.days <= 14) {
    badge = { cls: "mgrd-badge-ontrack", label: "On Track" };
  } else if (pct === 0) {
    badge = { cls: "mgrd-badge-behind", label: "Not Started" };
  } else if (pct < 30) {
    badge = { cls: "mgrd-badge-behind", label: "Behind" };
  }

  const metricLabel = {
    h2_cost: "H₂ Cost", co2_annual_tonnes: "CO₂ Emissions",
    smr_conversion: "SMR Conversion", h2_production: "H₂ Production",
  }[target.metric] || target.metric;

  const fmtVal = (v) => {
    if (v == null) return "—";
    if (target.metric === "h2_cost")           return `$${(v / 1e6).toFixed(2)}M`;
    if (target.metric === "co2_annual_tonnes") return `${(v / 1000).toFixed(1)}kt`;
    if (target.metric === "smr_conversion")    return `${(v * 100).toFixed(1)}%`;
    return v.toFixed(1);
  };

  return (
    <div className={`mgrd-target-card${p.achieved ? " mgrd-target-card-achieved" : ""}`}>
      <div className="mgrd-target-top">
        <div className="mgrd-target-ring-wrap">
          <ProgressRing pct={pct} size={68} stroke={6} />
          <div className="mgrd-target-ring-pct">{pct.toFixed(0)}%</div>
        </div>
        <div className="mgrd-target-body">
          <div className="mgrd-target-name">{target.label}</div>
          <div className="mgrd-target-meta">
            {metricLabel} · {isMin ? "Minimize" : "Maximize"} to {fmtVal(goal)}
            {target.deadline && <> · Due {fmtShort(target.deadline)}</>}
          </div>
          {badge && <div className="mgrd-target-badges"><span className={`mgrd-badge ${badge.cls}`}>{badge.label}</span></div>}
        </div>
        <button className="mgrd-target-delete" onClick={() => onDelete(target.id)} title="Delete target">✕</button>
      </div>

      {/* 3-step progress bar: baseline ──●── goal */}
      {baseline != null && (
        <div>
          <div className="mgrd-steps-track">
            <div className="mgrd-steps-fill" style={{ width: `${bestPct}%` }} />
            {best != null && bestPct > 0 && bestPct < 100 && (
              <>
                <div className="mgrd-steps-best-dot" style={{ left: `${bestPct}%` }} />
                <div className="mgrd-steps-best-label" style={{ left: `${bestPct}%` }}>
                  {fmtVal(best)}
                </div>
              </>
            )}
            <div className="mgrd-steps-goal-line" style={{ left: "100%" }} />
          </div>
          <div className="mgrd-steps-labels">
            <span>Baseline: {fmtVal(baseline)}</span>
            <span>Goal: {fmtVal(goal)}</span>
          </div>
        </div>
      )}

      {/* Trajectory */}
      {trajectory && !p.achieved && (
        <div className="mgrd-trajectory">
          <span className="mgrd-traj-icon">📈</span>
          <span className="mgrd-traj-text">
            At current pace — ~{trajectory.days} day{trajectory.days !== 1 ? "s" : ""} to goal
          </span>
          <span className="mgrd-traj-date">
            Est. {trajectory.estDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
      )}

      {/* Best contributor */}
      {p.best_scenario && (
        <div className="mgrd-best-contributor">
          Best scenario: <strong>"{p.best_scenario}"</strong>
          {p.best != null && <> · {fmtVal(p.best)}</>}
        </div>
      )}
    </div>
  );
}

/* ── Member card ── */
function MemberCard({ member, maxScenarios, rank }) {
  const barPct    = maxScenarios > 0 ? (member.scenarios / maxScenarios) * 100 : 0;
  const rankClass = rank === 0 ? "gold" : rank === 1 ? "silver" : rank === 2 ? "bronze" : "";
  const emoji     = rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `#${rank + 1}`;
  const hasData   = member.scenarios > 0;

  return (
    <div className={`mgrd-member-card${rank === 0 ? " mgrd-member-card-top" : ""}`}>
      <div className="mgrd-member-header">
        <div className={`mgrd-member-rank ${rankClass}`}>{emoji}</div>
        <div className={`mgrd-member-avatar ${hasData ? "mgrd-member-avatar-eng" : "mgrd-member-avatar-none"}`}>
          {(member.username || member.email).charAt(0).toUpperCase()}
        </div>
        <div className="mgrd-member-info">
          <div className="mgrd-member-name">{member.username || member.email}</div>
          <div className="mgrd-member-sub">
            {member.scenarios} scenario{member.scenarios !== 1 ? "s" : ""}
            {member.last_active && <> · Last active {timeAgo(member.last_active)}</>}
            {!hasData && " · No activity yet"}
          </div>
        </div>
      </div>
      <div className="mgrd-member-metrics">
        <div className="mgrd-member-metric">
          <div className="mgrd-mm-label">Best Cost</div>
          <div className={`mgrd-mm-val${!member.best_cost ? " mgrd-mm-none" : ""}`}>
            {member.best_cost != null ? `$${member.best_cost}M` : "—"}
          </div>
        </div>
        <div className="mgrd-member-metric">
          <div className="mgrd-mm-label">Best H₂</div>
          <div className={`mgrd-mm-val${!member.best_h2 ? " mgrd-mm-none" : ""}`}>
            {member.best_h2 != null ? `${member.best_h2}` : "—"}
          </div>
        </div>
        <div className="mgrd-member-metric">
          <div className="mgrd-mm-label">Best SMR</div>
          <div className={`mgrd-mm-val${!member.best_smr ? " mgrd-mm-none" : ""}`}>
            {member.best_smr != null ? `${member.best_smr}%` : "—"}
          </div>
        </div>
      </div>
      <div className="mgrd-member-bar-bg">
        <div className="mgrd-member-bar-fill" style={{ width: `${barPct}%` }} />
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res  = await authFetch("http://https://hydrogennetwork-optimizer-1.onrender.com/manager/dashboard");
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to load");
      setData(json);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDelete(targetId) {
    if (!window.confirm("Delete this target?")) return;
    try {
      const res  = await authFetch(`http://https://hydrogennetwork-optimizer-1.onrender.com/targets/${targetId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to delete");
      await load();
    } catch (err) { setError(err.message); }
  }

  /* Derived stats */
  const thisWeek = useMemo(() => {
    if (!data) return 0;
    const cutoff = Date.now() - 7 * 86400000;
    return (data.recent_activity || []).filter(s => new Date(s.timestamp).getTime() > cutoff).length;
  }, [data]);

  const achievedCount = useMemo(() =>
    (data?.targets || []).filter(t => t.progress?.achieved).length, [data]);

  const maxScenarios = useMemo(() =>
    Math.max(...(data?.leaderboard || []).map(m => m.scenarios), 1), [data]);

  /* ── Loading ── */
  if (loading) return (
    <div className="shared-page">
      <div className="shared-shell">
        <PageHeader subtitle="Manager Dashboard" />
        <div className="shared-page-card">
        <div className="mgrd-loading"><div className="mgrd-spinner" /><span>Loading dashboard…</span></div>
        </div> {/* shared-page-card */}
      </div>
    </div>
  );

  if (error) return (
    <div className="shared-page">
      <div className="shared-shell">
        <PageHeader subtitle="Manager Dashboard" />
        <div className="shared-page-card">
        <div className="page-heading">
          <button className="page-back-btn" onClick={() => navigate("/")}>← Home</button>
        </div>
        <div className="mgrd-error">{error}</div>
        </div> {/* shared-page-card */}
      </div>
    </div>
  );

  const { team, targets, leaderboard, recent_activity, total_scenarios } = data;

  return (
    <div className="shared-page">
      <div className="shared-shell">

        <PageHeader subtitle="Manager Dashboard" />

        <div className="shared-page-card">
        <div className="page-heading">
          <div className="page-heading-left">
            <button className="page-back-btn" onClick={() => navigate("/")}>← Home</button>
            <div>
              <div className="page-heading-title">Manager Dashboard</div>
              <div className="page-heading-sub">{team ? team.name : "No team"} · Deep analytics &amp; progress tracking</div>
            </div>
          </div>
          <div className="page-heading-actions">
            <button className="page-btn page-btn-outline" onClick={() => navigate("/plant-setup")}>Plant Setup</button>
            <button className="page-btn page-btn-outline" onClick={() => navigate("/team")}>Team Settings</button>
            <button className="page-btn page-btn-solid" onClick={() => navigate("/targets")}>+ Add Target</button>
          </div>
        </div>

        {/* ── Summary stats ── */}
        <div className="mgrd-stats-row">
          <div className="mgrd-stat">
            <div className="mgrd-stat-val">{team?.member_count ?? 0}</div>
            <div className="mgrd-stat-label">Team Members</div>
          </div>
          <div className="mgrd-stat">
            <div className="mgrd-stat-val">{total_scenarios}</div>
            <div className="mgrd-stat-label">Total Scenarios</div>
          </div>
          <div className="mgrd-stat">
            <div className="mgrd-stat-val">{thisWeek}</div>
            <div className="mgrd-stat-label">This Week</div>
            <div className="mgrd-stat-sub">last 7 days</div>
          </div>
          <div className="mgrd-stat">
            <div className="mgrd-stat-val">{targets.length}</div>
            <div className="mgrd-stat-label">Active Targets</div>
          </div>
          <div className="mgrd-stat mgrd-stat-green">
            <div className="mgrd-stat-val">{achievedCount}</div>
            <div className="mgrd-stat-label">Goals Achieved</div>
          </div>
        </div>

        {/* ── Activity chart ── */}
        <div className="mgrd-card">
          <div className="mgrd-card-hd">
            <div>
              <div className="mgrd-card-title">Team Activity</div>
              <div className="mgrd-card-sub">Scenarios submitted per day · last 28 days</div>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexShrink: 0 }}>
              {[
                { color: "#14532D", label: "Today" },
                { color: "#16A34A", label: "Weekday" },
                { color: "#BBF7D0", label: "Weekend" },
                { color: "#F3F4F6", label: "No activity" },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
          {recent_activity.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF", fontSize: 13, fontWeight: 500 }}>
              No scenarios submitted yet.
            </div>
          ) : (
            <ActivityChart activity={recent_activity} />
          )}
        </div>

        {/* ── Body grid: targets + members ── */}
        <div className="mgrd-body-grid">

          {/* Left: Target deep dive */}
          <div className="mgrd-card">
            <div className="mgrd-card-hd">
              <div>
                <div className="mgrd-card-title">Target Progress</div>
                <div className="mgrd-card-sub">Detailed per-target view with trajectory forecasts</div>
              </div>
              <button className="mgrd-card-link" onClick={() => navigate("/targets")}>Manage →</button>
            </div>
            {targets.length === 0 ? (
              <div className="mgrd-target-empty">No targets set yet.</div>
            ) : (
              <div className="mgrd-targets-list">
                {targets.map(t => (
                  <TargetCard key={t.id} target={t} onDelete={handleDelete} />
                ))}
              </div>
            )}
            <button className="mgrd-add-btn" onClick={() => navigate("/targets")}>+ Add Target</button>
          </div>

          {/* Right: Member performance */}
          <div className="mgrd-card">
            <div className="mgrd-card-hd">
              <div>
                <div className="mgrd-card-title">Member Performance</div>
                <div className="mgrd-card-sub">Ranked by best H₂ cost achieved</div>
              </div>
              <button className="mgrd-card-link" onClick={() => navigate("/team")}>Manage →</button>
            </div>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF", fontSize: 13 }}>No members.</div>
            ) : (
              <div className="mgrd-member-list">
                {leaderboard.map((member, idx) => (
                  <MemberCard
                    key={member.email}
                    member={member}
                    rank={idx}
                    maxScenarios={maxScenarios}
                  />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── Activity feed ── */}
        <div className="mgrd-card">
          <div className="mgrd-card-hd">
            <div>
              <div className="mgrd-card-title">Recent Team Activity</div>
              <div className="mgrd-card-sub">Latest scenarios submitted by team members</div>
            </div>
          </div>
          {recent_activity.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF", fontSize: 13 }}>
              No activity yet.
            </div>
          ) : (
            <div className="mgrd-feed">
              {recent_activity.slice(0, 12).map((entry, i) => {
                const cost = getVal(entry, "h2_cost");
                const h2   = getVal(entry, "h2_production");
                const co2  = getVal(entry, "co2_annual_tonnes");
                const isRecent = i < 3;
                return (
                  <div key={entry.id || i} className="mgrd-feed-row">
                    <div className={`mgrd-feed-dot${isRecent ? "" : " mgrd-feed-dot-dim"}`} />
                    <div className="mgrd-feed-info">
                      <div className="mgrd-feed-name">{entry.name || `Scenario ${i + 1}`}</div>
                      <div className="mgrd-feed-meta">
                        {entry._user?.split("@")[0] || entry._user}
                        &nbsp;·&nbsp;{timeAgo(entry.timestamp)}
                        &nbsp;·&nbsp;{fmtDate(entry.timestamp)}
                      </div>
                    </div>
                    <div className="mgrd-feed-metrics">
                      {cost != null && (
                        <div className="mgrd-feed-metric">
                          <div className="mgrd-feed-metric-val">${(cost / 1e6).toFixed(2)}M</div>
                          <div className="mgrd-feed-metric-label">H₂ Cost</div>
                        </div>
                      )}
                      {h2 != null && (
                        <div className="mgrd-feed-metric">
                          <div className="mgrd-feed-metric-val mgrd-feed-metric-green">{h2.toFixed(0)}</div>
                          <div className="mgrd-feed-metric-label">kmol/h</div>
                        </div>
                      )}
                      {co2 != null && (
                        <div className="mgrd-feed-metric">
                          <div className="mgrd-feed-metric-val">{(co2 / 1000).toFixed(1)}kt</div>
                          <div className="mgrd-feed-metric-label">CO₂/yr</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        </div> {/* shared-page-card */}
      </div>
    </div>
  );
}
