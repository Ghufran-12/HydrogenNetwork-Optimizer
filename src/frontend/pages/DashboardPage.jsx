import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import "../styles/dashboard-page.css";
import "../styles/shared-page.css";
import PageHeader from "../components/PageHeader";

function fmt(val, d = 1) {
  if (val == null || isNaN(Number(val))) return "—";
  return Number(val).toLocaleString("en-US", { maximumFractionDigits: d });
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

function getVal(s, key) {
  return s.optimized_results?.[key] || s.results?.[key] || 0;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("https://hydrogennetwork-optimizer-1.onrender.com/history")
      .then(r => r.json())
      .then(d => { setHistory(d.history || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [authFetch]);

  /* ── Analytics ── */
  const chrono   = [...history].reverse(); // oldest → newest for trend charts
  const last15   = chrono.slice(-15);
  const hasOptData = history.some(s => s.optimized_results?.h2_production);

  const trendData = last15.map((s, i) => ({
    name:    `S${chrono.indexOf(s) + 1}`,
    label:   s.name || `Scenario ${i + 1}`,
    curH2:   Math.round(s.results?.h2_production || 0),
    optH2:   Math.round(s.optimized_results?.h2_production || 0) || undefined,
    curCost: parseFloat(((s.results?.h2_cost || 0) / 1e6).toFixed(2)),
    optCost: s.optimized_results?.h2_cost
      ? parseFloat((s.optimized_results.h2_cost / 1e6).toFixed(2))
      : undefined,
  }));

  const bestH2    = history.length ? Math.max(...history.map(s => getVal(s, "h2_production")))    : 0;
  const lowestCost = history.length
    ? Math.min(...history.filter(s => getVal(s, "h2_cost") > 0).map(s => getVal(s, "h2_cost")))
    : 0;
  const lowestCO2 = history.length
    ? Math.min(...history.filter(s => getVal(s, "co2_annual_tonnes") > 0).map(s => getVal(s, "co2_annual_tonnes")))
    : 0;

  const improvements = history
    .filter(s => s.results?.h2_cost > 0 && s.optimized_results?.h2_cost > 0)
    .map(s => ((s.results.h2_cost - s.optimized_results.h2_cost) / s.results.h2_cost) * 100);
  const avgImprovement = improvements.length
    ? (improvements.reduce((a, b) => a + b, 0) / improvements.length).toFixed(1)
    : null;

  const topScenarios = [...history]
    .sort((a, b) => getVal(b, "h2_production") - getVal(a, "h2_production"))
    .slice(0, 5);

  /* ── Render ── */
  return (
    <div className="shared-page">
      <div className="shared-shell">

        <PageHeader subtitle="Analytics Dashboard" />

        <div className="shared-page-card">
        <div className="page-heading">
          <div className="page-heading-left">
            <button className="page-back-btn" onClick={() => navigate("/")}>← Home</button>
            <div>
              <div className="page-heading-title">Analytics Dashboard</div>
              <div className="page-heading-sub">Scenario insights · Performance tracking &amp; optimization trends</div>
            </div>
          </div>
          <div className="page-heading-actions">
            <button className="page-btn page-btn-solid" onClick={() => navigate("/smr")}>+ New Scenario</button>
          </div>
        </div>

        {/* Loading */}
        {loading && <div className="dash-loading">Loading analytics…</div>}

        {/* Empty state */}
        {!loading && history.length === 0 && (
          <div className="dash-empty">
            <div className="dash-empty-icon">📊</div>
            <div className="dash-empty-title">No scenarios yet</div>
            <div className="dash-empty-sub">Run your first scenario in SMR Studio to start seeing analytics here.</div>
            <button className="dash-run-btn" onClick={() => navigate("/smr")}>Go to SMR Studio</button>
          </div>
        )}

        {/* Dashboard content */}
        {!loading && history.length > 0 && (
          <>
            {/* KPI Summary */}
            <div className="dash-kpi-row">
              <div className="dash-kpi-card">
                <div className="dash-kpi-label">Total Scenarios</div>
                <div className="dash-kpi-value">{history.length}</div>
                <div className="dash-kpi-sub">runs analyzed</div>
              </div>
              <div className="dash-kpi-card dash-kpi-accent">
                <div className="dash-kpi-label">Best H₂ Production</div>
                <div className="dash-kpi-value">{fmt(bestH2, 0)}</div>
                <div className="dash-kpi-sub">kmol/h optimized</div>
              </div>
              <div className="dash-kpi-card">
                <div className="dash-kpi-label">Lowest H₂ Cost</div>
                <div className="dash-kpi-value">${fmt(lowestCost / 1e6, 2)}M</div>
                <div className="dash-kpi-sub">per year optimized</div>
              </div>
              {avgImprovement !== null ? (
                <div className="dash-kpi-card dash-kpi-accent">
                  <div className="dash-kpi-label">Avg Cost Saving</div>
                  <div className="dash-kpi-value">{avgImprovement}%</div>
                  <div className="dash-kpi-sub">current → optimized</div>
                </div>
              ) : (
                <div className="dash-kpi-card">
                  <div className="dash-kpi-label">Lowest CO₂</div>
                  <div className="dash-kpi-value">{fmt(lowestCO2 / 1000, 1)}k</div>
                  <div className="dash-kpi-sub">tonnes/year optimized</div>
                </div>
              )}
            </div>

            {/* Trend Charts */}
            <div className="dash-charts-row">

              {/* H₂ Production Trend */}
              <div className="dash-chart-card">
                <div className="dash-chart-title">H₂ Production Trend</div>
                <div className="dash-chart-sub">Last {last15.length} scenarios — kmol/h</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #E5E7EB" }}
                      labelFormatter={(_, p) => p?.[0]?.payload?.label || ""}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="curH2" name="Current H₂"   stroke="#9CA3AF" strokeWidth={2}   dot={{ r: 3 }} connectNulls />
                    {hasOptData && (
                      <Line type="monotone" dataKey="optH2" name="Optimized H₂" stroke="#14532D" strokeWidth={2.5} dot={{ r: 3, fill: "#14532D" }} connectNulls />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Cost Trend */}
              <div className="dash-chart-card">
                <div className="dash-chart-title">H₂ Cost Trend</div>
                <div className="dash-chart-sub">Last {last15.length} scenarios — $M/year</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} unit="M" />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #E5E7EB" }}
                      formatter={(val) => [`$${val}M`, undefined]}
                      labelFormatter={(_, p) => p?.[0]?.payload?.label || ""}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="curCost" name="Current Cost"   fill="#9CA3AF" radius={[4,4,0,0]} />
                    {hasOptData && (
                      <Bar dataKey="optCost" name="Optimized Cost" fill="#14532D" radius={[4,4,0,0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>

            {/* Top Scenarios */}
            <div className="dash-section-title">Top Performing Scenarios</div>
            <div className="dash-top-list">
              {topScenarios.map((s, i) => (
                <div key={s.id} className="dash-top-item">
                  <div className={`dash-rank ${i === 0 ? "dash-rank-gold" : i === 1 ? "dash-rank-silver" : "dash-rank-n"}`}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i + 1}
                  </div>
                  <div className="dash-top-info">
                    <div className="dash-top-name">{s.name || `Scenario ${i + 1}`}</div>
                    <div className="dash-top-time">{timeAgo(s.timestamp)}</div>
                  </div>
                  <div className="dash-top-metrics">
                    <div className="dash-top-metric">
                      <span className="dash-metric-label">H₂ Optimized</span>
                      <span className="dash-metric-val green">{fmt(getVal(s, "h2_production"), 0)} <em>kmol/h</em></span>
                    </div>
                    <div className="dash-top-metric">
                      <span className="dash-metric-label">Cost</span>
                      <span className="dash-metric-val">${fmt(getVal(s, "h2_cost") / 1e6, 2)}M</span>
                    </div>
                    <div className="dash-top-metric">
                      <span className="dash-metric-label">CO₂</span>
                      <span className="dash-metric-val">{fmt(getVal(s, "co2_annual_tonnes") / 1000, 1)}k <em>t/yr</em></span>
                    </div>
                  </div>
                  <button
                    className="dash-rerun-btn"
                    onClick={() => navigate("/smr", { state: { prefill: s.inputs, replaceId: s.id } })}
                  >
                    Re-run
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        </div> {/* shared-page-card */}
      </div>
    </div>
  );
}
