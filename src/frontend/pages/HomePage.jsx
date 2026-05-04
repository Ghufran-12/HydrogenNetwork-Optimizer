import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { METRIC_CONFIG } from "../utils/targets";
import "../styles/home-page.css";

/* ── Helpers ────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

function isToday(ts) {
  const d = new Date(ts), n = new Date();
  return d.getFullYear() === n.getFullYear()
      && d.getMonth()    === n.getMonth()
      && d.getDate()     === n.getDate();
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

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function fmt(val, d = 1) {
  if (val == null || isNaN(Number(val))) return "—";
  return Number(val).toLocaleString("en-US", { maximumFractionDigits: d });
}

function costSavingPct(s) {
  const cur = s.results?.h2_cost, opt = s.optimized_results?.h2_cost;
  if (!cur || !opt || cur <= 0) return null;
  return ((cur - opt) / cur) * 100;
}

function getVal(s, key) {
  return s.optimized_results?.[key] || s.results?.[key] || 0;
}

/* ── SVG Icons ──────────────────────────────────────────────── */
const IconPlus     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconLogout   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IconClock    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconStar     = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9"/></svg>;
const IconUpward   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="21 7 21 14 21 7"/><polyline points="21 7 14 7"/></svg>;
const IconTarget   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const IconTeam     = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
const IconFactory  = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20V10l6-4v4l6-4v4l6-4v14H2z"/><line x1="2" y1="20" x2="22" y2="20"/><line x1="8" y1="20" x2="8" y2="14"/><line x1="14" y1="20" x2="14" y2="14"/><rect x="9" y="14" width="4" height="6"/></svg>;
const IconDashboard = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;

const TODAY_LABEL = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

/* ── Main component ─────────────────────────────────────────── */
export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout, authFetch } = useAuth();

  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [targets,    setTargets]    = useState([]);
  const [mgrData,    setMgrData]    = useState(null);
  const [baseline,   setBaseline]   = useState(null);
  const [mgrLoading, setMgrLoading] = useState(false);

  const isManager = user?.role === "manager";

  useEffect(() => {
    authFetch("http://https://hydrogennetwork-optimizer-1.onrender.com/history")
      .then(r => r.json())
      .then(d => { setHistory(d.history || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => {
    authFetch("http://https://hydrogennetwork-optimizer-1.onrender.com/targets/team")
      .then(r => r.json())
      .then(d => setTargets(d.targets || []))
      .catch(() => {});
  }, [authFetch]);

  useEffect(() => {
    if (!isManager) return;
    setMgrLoading(true);
    Promise.all([
      authFetch("http://https://hydrogennetwork-optimizer-1.onrender.com/manager/dashboard").then(r => r.json()),
      authFetch("http://https://hydrogennetwork-optimizer-1.onrender.com/plant/baseline").then(r => r.json()),
    ])
      .then(([mgr, bl]) => { setMgrData(mgr); setBaseline(bl.baseline || null); })
      .catch(() => {})
      .finally(() => setMgrLoading(false));
  }, [authFetch, isManager]);

  const sliderRef = useRef(null);
  const slide = (dir) => sliderRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const displayName    = user?.username?.split("@")[0] || user?.username || "there";
  const greeting       = getGreeting();
  const todayRuns      = history.filter(s => isToday(s.timestamp));
  const totalScenarios = history.length;
  const bestH2         = history.length ? Math.max(...history.map(s => getVal(s, "h2_production"))) : 0;
  const costValues     = history.map(s => getVal(s, "h2_cost")).filter(v => v > 0);
  const lowestCost     = costValues.length ? Math.min(...costValues) : 0;
  const allSavings     = history.map(costSavingPct).filter(v => v != null);
  const avgSaving      = allSavings.length
    ? (allSavings.reduce((a, b) => a + b, 0) / allSavings.length).toFixed(1)
    : null;

  const recent5 = history.slice(0, 5);

  const handleRerun = (entry) =>
    navigate("/smr", { state: { prefill: entry.inputs, replaceId: entry.id } });

  const handleViewResults = (entry) => {
    const cur = entry.results, opt = entry.optimized_results;
    const costImp = cur?.h2_cost && opt?.h2_cost
      ? ((cur.h2_cost - opt.h2_cost) / cur.h2_cost) * 100 : 0;
    const h2Imp = cur?.h2_production && opt?.h2_production
      ? ((opt.h2_production - cur.h2_production) / cur.h2_production) * 100 : 0;
    navigate("/results", {
      state: {
        apiResult: {
          current: cur, optimized: opt,
          optimized_params: entry.optimized_params,
          recommendations:  entry.recommendations,
          cost_improvement_pct: costImp,
          h2_improvement_pct:   h2Imp,
        },
      },
    });
  };

  /* Manager alerts */
  const alerts = useMemo(() => {
    if (!isManager || !mgrData) return [];
    const out = [];
    if (!baseline)
      out.push({ type: "warn", msg: "Plant baseline not set — progress % will be inaccurate.", action: "Fix", to: "/plant-setup" });
    const stalled = (mgrData.targets || []).filter(t => (t.progress?.pct ?? 0) === 0 && !t.progress?.achieved);
    if (stalled.length)
      out.push({ type: "info", msg: `${stalled.length} target${stalled.length > 1 ? "s have" : " has"} no progress.`, action: "View", to: "/targets" });
    const overdue = (mgrData.targets || []).filter(t => t.deadline && new Date(t.deadline) < new Date() && !t.progress?.achieved);
    if (overdue.length)
      out.push({ type: "warn", msg: `${overdue.length} target${overdue.length > 1 ? "s are" : " is"} overdue.`, action: "View", to: "/targets" });
    const inactive = (mgrData.leaderboard || []).filter(m => m.scenarios === 0);
    if (inactive.length)
      out.push({ type: "info", msg: `${inactive.length} member${inactive.length > 1 ? "s haven't" : " hasn't"} run scenarios yet.`, action: "Team", to: "/team" });
    return out;
  }, [isManager, mgrData, baseline]);

  return (
    <div className="home-page">
      <div className="home-shell">

        {/* ── Top bar ── */}
        <div className="home-topbar">
          <div className="home-brand">
            <div className="home-brand-logo">H₂</div>
            <div>
              <div className="home-brand-name">Hydrogen Network</div>
              <div className="home-brand-sub">SMR Optimization Platform</div>
            </div>
          </div>
          <div className="home-topbar-right">
            <div className="home-user-info">
              <div className="home-avatar">{user?.username?.[0]?.toUpperCase()}</div>
              <span className="home-username">{user?.username}</span>
              {isManager && <span className="home-role-badge">Manager</span>}
            </div>
            <button className="home-signout-btn" onClick={handleLogout}>
              <IconLogout /> Sign Out
            </button>
          </div>
        </div>

        {/* ── Main content card ── */}
        <div className="home-page-card">

        {/* ── Hero ── */}
        <div className="home-hero">
          <div className="home-hero-left">
            <div className="home-hero-greeting">
              {greeting}, <span>{displayName}</span>
            </div>
            <div className="home-hero-date">{TODAY_LABEL}</div>
            <div className="home-hero-kpis">
              <div className="home-hero-kpi">
                <div className="home-hero-kpi-val">{loading ? "—" : totalScenarios}</div>
                <div className="home-hero-kpi-label">Scenarios</div>
              </div>
              {bestH2 > 0 && (
                <div className="home-hero-kpi">
                  <div className="home-hero-kpi-val home-hero-kpi-val-accent">{fmt(bestH2, 0)}</div>
                  <div className="home-hero-kpi-label">Best H₂ <em>kmol/h</em></div>
                </div>
              )}
              {lowestCost > 0 && (
                <div className="home-hero-kpi">
                  <div className="home-hero-kpi-val">${fmt(lowestCost / 1e6, 2)}M</div>
                  <div className="home-hero-kpi-label">Lowest Cost</div>
                </div>
              )}
              {avgSaving && (
                <div className="home-hero-kpi">
                  <div className="home-hero-kpi-val home-hero-kpi-val-accent">{avgSaving}%</div>
                  <div className="home-hero-kpi-label">Avg Saving</div>
                </div>
              )}
            </div>
          </div>
          <div className="home-hero-cta">
            <button className="home-new-btn" onClick={() => navigate("/smr")}>
              <IconPlus /> New Scenario
            </button>
            {todayRuns.length > 0 && (
              <div className="home-today-chip">
                {todayRuns.length} run{todayRuns.length !== 1 ? "s" : ""} today
              </div>
            )}
          </div>
        </div>

        {/* ── Quick actions slider ── */}
        <div className="home-slider-wrap">
          <button className="home-slider-arrow" onClick={() => slide(-1)}>‹</button>
          <div className="home-slider" ref={sliderRef}>
            {[
              ...(isManager ? [{ label: "Manager Dashboard", icon: <IconDashboard />, to: "/manager-dashboard" }] : []),
              { label: "Analytics",   icon: <IconUpward />,  to: "/dashboard"   },
              { label: "History",     icon: <IconClock />,   to: "/history"     },
              { label: "Targets",     icon: <IconTarget />,  to: "/targets"     },
              { label: "My Team",     icon: <IconTeam />,    to: "/team"        },
              { label: "Plant Setup", icon: <IconFactory />, to: "/plant-setup" },
              { label: "Bookmarks",   icon: <IconStar />,    to: "/bookmarks"   },
            ].map(({ label, icon, to }) => (
              <button key={to} className="home-action-card" onClick={() => navigate(to)}>
                <span className="home-action-card-icon">{icon}</span>
                <span className="home-action-card-label">{label}</span>
              </button>
            ))}
          </div>
          <button className="home-slider-arrow" onClick={() => slide(1)}>›</button>
        </div>

        {/* ── Body ── */}
        <div className="home-body">

          {/* Left — Recent scenarios */}
          <div>
            <div className="home-section-hd">
              <span className="home-section-title">Recent Scenarios</span>
              {history.length > 5 && (
                <button className="home-section-link" onClick={() => navigate("/history")}>
                  View all {history.length} →
                </button>
              )}
            </div>

            {loading && (
              <div className="home-empty-scenarios">
                <div className="home-empty-scenarios-icon">⏳</div>
                Loading…
              </div>
            )}

            {!loading && recent5.length === 0 && (
              <div className="home-empty-scenarios">
                <div className="home-empty-scenarios-icon">🔬</div>
                No scenarios yet — click New Scenario to get started.
              </div>
            )}

            {!loading && recent5.length > 0 && (
              <div className="home-scenarios">
                {recent5.map((s, i) => {
                  const saving = costSavingPct(s);
                  const isLatest = i === 0;
                  return (
                    <div key={s.id} className={`home-scenario-card${isLatest ? " home-scenario-card-latest" : ""}`}>
                      <div className="home-scenario-accent" />
                      <div className="home-scenario-body">
                        <div className="home-scenario-top">
                          <div className="home-scenario-meta">
                            {isLatest && (
                              <div className="home-scenario-badges">
                                <span className="home-scenario-badge-latest">Latest</span>
                              </div>
                            )}
                            <div className="home-scenario-name">{s.name || `Scenario ${history.length - i}`}</div>
                            <div className="home-scenario-time">{timeAgo(s.timestamp)}</div>
                          </div>
                          <div className="home-scenario-actions">
                            <button className="home-sc-btn home-sc-btn-solid" onClick={() => handleRerun(s)}>Re-run</button>
                            <button className="home-sc-btn home-sc-btn-outline" onClick={() => handleViewResults(s)}>Results</button>
                          </div>
                        </div>
                        <div className="home-scenario-metrics">
                          <div className="home-sc-metric">
                            <span className="home-sc-metric-label">H₂</span>
                            <span className="home-sc-metric-val">{fmt(getVal(s, "h2_production"), 0)} <em>kmol/h</em></span>
                          </div>
                          <div className="home-sc-metric">
                            <span className="home-sc-metric-label">Cost</span>
                            <span className="home-sc-metric-val">${fmt(getVal(s, "h2_cost") / 1e6, 2)}M</span>
                          </div>
                          <div className="home-sc-metric">
                            <span className="home-sc-metric-label">CO₂</span>
                            <span className="home-sc-metric-val">{fmt(getVal(s, "co2_annual_tonnes") / 1000, 1)} <em>kt/yr</em></span>
                          </div>
                          {saving !== null && (
                            <div className="home-sc-metric home-sc-metric-saving">
                              <span className="home-sc-metric-label">Saving</span>
                              <span className="home-sc-metric-val">↓{saving.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right — Sidebar */}
          <div className="home-sidebar">

            {/* Manager alerts */}
            {isManager && !mgrLoading && alerts.length > 0 && (
              <div className="home-alerts">
                {alerts.map((a, i) => (
                  <div key={i} className={`home-alert home-alert-${a.type}`}>
                    <span className="home-alert-icon">{a.type === "warn" ? "⚠" : "ℹ"}</span>
                    <span className="home-alert-msg">{a.msg}</span>
                    <button className="home-alert-link" onClick={() => navigate(a.to)}>{a.action} →</button>
                  </div>
                ))}
              </div>
            )}

            {/* Team Pulse (manager) */}
            {isManager && !mgrLoading && mgrData && (
              <div className="home-side-card home-team-card">
                <div className="home-side-card-hd">
                  <span className="home-side-card-title">
                    Team Pulse
                    {mgrData.team && <span style={{ fontWeight: 600, color: "#9CA3AF", textTransform: "none", letterSpacing: 0 }}> · {mgrData.team.name}</span>}
                  </span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="home-side-card-link" onClick={() => navigate("/manager-dashboard")}>Full Dashboard →</button>
                    <button className="home-side-card-link" onClick={() => navigate("/team")}>Team →</button>
                  </div>
                </div>

                <div className="home-pulse-stats">
                  <div className="home-pulse-stat">
                    <div className="home-pulse-val">{mgrData.team?.member_count ?? 0}</div>
                    <div className="home-pulse-label">Members</div>
                  </div>
                  <div className="home-pulse-stat">
                    <div className="home-pulse-val">{mgrData.total_scenarios ?? 0}</div>
                    <div className="home-pulse-label">Scenarios</div>
                  </div>
                  <div className="home-pulse-stat">
                    <div className="home-pulse-val">{(mgrData.targets || []).length}</div>
                    <div className="home-pulse-label">Targets</div>
                  </div>
                  <div className="home-pulse-stat home-pulse-stat-green">
                    <div className="home-pulse-val">{(mgrData.targets || []).filter(t => t.progress?.achieved).length}</div>
                    <div className="home-pulse-label">Achieved</div>
                  </div>
                </div>

                {/* Plant baseline */}
                <div className={`home-bl-card ${baseline ? "home-bl-set" : "home-bl-unset"}`}>
                  <div className="home-bl-status">
                    <span className="home-bl-dot" />
                    {baseline ? "Baseline active" : "No baseline set"}
                  </div>
                  {baseline ? (
                    <>
                      <div className="home-bl-metrics">
                        <div className="home-bl-metric">
                          <span className="home-bl-metric-val">${baseline.display.h2_cost}M</span>
                          <span className="home-bl-metric-label">H₂ Cost</span>
                        </div>
                        <div className="home-bl-metric">
                          <span className="home-bl-metric-val">{baseline.display.smr_conversion}%</span>
                          <span className="home-bl-metric-label">SMR Conv.</span>
                        </div>
                        <div className="home-bl-metric">
                          <span className="home-bl-metric-val">{baseline.display.h2_production}</span>
                          <span className="home-bl-metric-label">kmol/h</span>
                        </div>
                      </div>
                      <div className="home-bl-meta">
                        Updated {fmtDate(baseline.updated_at)} by {baseline.updated_by?.split("@")[0]}
                        <button className="home-bl-edit" onClick={() => navigate("/plant-setup")}>Edit →</button>
                      </div>
                    </>
                  ) : (
                    <button className="home-bl-cta" onClick={() => navigate("/plant-setup")}>Configure →</button>
                  )}
                </div>

                {/* Leaderboard */}
                {(mgrData.leaderboard || []).length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", marginBottom: 8, marginTop: 14 }}>
                      Leaderboard
                    </div>
                    <div className="home-lb">
                      {(mgrData.leaderboard || []).map((member, idx) => (
                        <div key={member.email} className={`home-lb-row${idx === 0 ? " home-lb-row-top" : ""}`}>
                          <div className={`home-lb-rank ${idx === 0 ? "gold" : idx === 1 ? "silver" : idx === 2 ? "bronze" : ""}`}>
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                          </div>
                          <div className="home-lb-avatar">{(member.username || member.email).charAt(0).toUpperCase()}</div>
                          <div className="home-lb-info">
                            <div className="home-lb-name">{member.username || member.email}</div>
                            <div className="home-lb-stats">
                              {member.scenarios} scenario{member.scenarios !== 1 ? "s" : ""}
                              {member.best_cost !== null && <> · ${member.best_cost}M</>}
                            </div>
                          </div>
                          {idx === 0 && <div className="home-lb-crown">Top</div>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Goals & Targets */}
            {targets.length > 0 && (
              <div className="home-side-card">
                <div className="home-side-card-hd">
                  <span className="home-side-card-title">{isManager ? "Team Goals" : "Team Targets"}</span>
                  <button className="home-side-card-link" onClick={() => navigate("/targets")}>
                    {isManager ? "Manage →" : "View all →"}
                  </button>
                </div>
                <div className="home-target-list">
                  {targets.slice(0, 4).map(t => {
                    const cfg = METRIC_CONFIG[t.metric];
                    const p   = t.progress || {};
                    const pct = p.pct ?? 0;
                    const achieved = p.achieved ?? false;
                    const barColor = achieved ? "#16A34A" : pct >= 66 ? "#2563EB" : pct >= 33 ? "#D97706" : "#9CA3AF";
                    const fmtGoal  = cfg?.fmtVal ? cfg.fmtVal(t.goal_value) : `${t.goal_value} ${cfg?.unit || ""}`;
                    return (
                      <div key={t.id} className="home-target-row" onClick={() => navigate("/targets")}>
                        <div className="home-target-row-top">
                          <span className="home-target-name">{t.label}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {achieved && <span className="home-target-done-chip">✓</span>}
                            <span className="home-target-pct">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="home-target-bar-bg">
                          <div className="home-target-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
                        </div>
                        <div className="home-target-sub">
                          {t.direction === "min" ? "Reduce to" : "Reach"} {fmtGoal}
                          {p.best != null && <> · Best: <strong>{cfg?.fmtVal ? cfg.fmtVal(p.best) : p.best}</strong></>}
                        </div>
                      </div>
                    );
                  })}
                  {targets.length > 4 && (
                    <button className="home-targets-more" onClick={() => navigate("/targets")}>
                      +{targets.length - 4} more →
                    </button>
                  )}
                </div>
              </div>
            )}

            {targets.length === 0 && isManager && (
              <div className="home-side-card" style={{ textAlign: "center" }}>
                <div className="home-side-card-hd" style={{ justifyContent: "center" }}>
                  <span className="home-side-card-title">Team Targets</span>
                </div>
                <div className="home-side-empty">No targets set yet.</div>
                <button
                  className="home-sc-btn home-sc-btn-solid"
                  style={{ marginTop: 10 }}
                  onClick={() => navigate("/targets")}
                >
                  + Add Target
                </button>
              </div>
            )}

          </div>
        </div>

        </div> {/* home-page-card */}
      </div>
    </div>
  );
}
