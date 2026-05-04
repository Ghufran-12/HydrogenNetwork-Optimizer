import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { METRIC_CONFIG, computeProgress } from "../utils/targets";
import "../styles/history-page.css";
import "../styles/shared-page.css";
import PageHeader from "../components/PageHeader";

function fmt(val, dec = 0) {
  if (val == null) return "—";
  return Number(val).toLocaleString("en-US", { maximumFractionDigits: dec });
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HistoryPage() {
  const navigate               = useNavigate();
  const { user, authFetch } = useAuth();
  const [history, setHistory]  = useState([]);
  const [loading, setLoading]  = useState(true);
  const [expanded, setExpanded]= useState(null);
  const [selected, setSelected]= useState([]); // ids for comparison
  const [targets, setTargets]  = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("smr_targets");
    if (saved) { try { setTargets(JSON.parse(saved)); } catch {} }
  }, []);

  useEffect(() => {
    authFetch("http://localhost:8000/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id)
        : prev.length < 2 ? [...prev, id] : [prev[1], id]
    );
  };

  const compEntries = history.filter((h) => selected.includes(h.id));
  const isComparing = compEntries.length === 2;

  const handleRerun = (entry) => navigate("/smr", { state: { prefill: entry.inputs, replaceId: entry.id } });

  // Map from scenario ID → array of target names it holds the record for
  const recordMap = useMemo(() => {
    const map = {};
    for (const target of targets) {
      const { bestScenario } = computeProgress(target, history);
      if (bestScenario?.id) {
        if (!map[bestScenario.id]) map[bestScenario.id] = [];
        map[bestScenario.id].push({ targetName: target.name, metric: target.metric });
      }
    }
    return map;
  }, [targets, history]);

  // ── Comparison helpers ──
  const win = (aVal, bVal, higherIsBetter = true) => {
    if (!aVal || !bVal || aVal === bVal) return "tie";
    return higherIsBetter ? (aVal > bVal ? "a" : "b") : (aVal < bVal ? "a" : "b");
  };

  const pctDiff = (a, b) => b ? (((a - b) / b) * 100).toFixed(1) : null;

  const A = compEntries[0], B = compEntries[1];

  const outputRows = [
    { label: "H₂ Production", icon: "⚡",
      aVal: A?.results?.h2_production, bVal: B?.results?.h2_production,
      aStr: fmt(A?.results?.h2_production, 1) + " kmol/h",
      bStr: fmt(B?.results?.h2_production, 1) + " kmol/h", hi: true },
    { label: "H₂ Cost", icon: "💰",
      aVal: A?.results?.h2_cost, bVal: B?.results?.h2_cost,
      aStr: `$${((A?.results?.h2_cost||0)/1e6).toFixed(2)}M/yr`,
      bStr: `$${((B?.results?.h2_cost||0)/1e6).toFixed(2)}M/yr`, hi: false },
    { label: "CO₂ Emissions", icon: "🌿",
      aVal: A?.results?.co2_annual_tonnes, bVal: B?.results?.co2_annual_tonnes,
      aStr: fmt(A?.results?.co2_annual_tonnes, 0) + " t/yr",
      bStr: fmt(B?.results?.co2_annual_tonnes, 0) + " t/yr", hi: false },
    { label: "SMR Conversion", icon: "🔄",
      aVal: A?.results?.smr_conversion, bVal: B?.results?.smr_conversion,
      aStr: `${((A?.results?.smr_conversion||0)*100).toFixed(2)}%`,
      bStr: `${((B?.results?.smr_conversion||0)*100).toFixed(2)}%`, hi: true },
    { label: "CH₄ Slip", icon: "📉",
      aVal: A?.results?.ch4_slip, bVal: B?.results?.ch4_slip,
      aStr: `${((A?.results?.ch4_slip||0)*100).toFixed(3)}%`,
      bStr: `${((B?.results?.ch4_slip||0)*100).toFixed(3)}%`, hi: false },
  ];

  const inputRows = [
    { label: "CH₄ Feed",        aStr: fmt(A?.inputs?.ch4_feed,0)+" kgmol/h",        bStr: fmt(B?.inputs?.ch4_feed,0)+" kgmol/h" },
    { label: "Steam Flowrate",  aStr: fmt(A?.inputs?.steam_flowrate,0)+" kgmol/h",   bStr: fmt(B?.inputs?.steam_flowrate,0)+" kgmol/h" },
    { label: "SMR Temperature", aStr: fmt(A?.inputs?.smr_temp,0)+" °C",              bStr: fmt(B?.inputs?.smr_temp,0)+" °C" },
    { label: "SMR Pressure",    aStr: fmt(A?.inputs?.smr_pressure_kpa,0)+" kPa",     bStr: fmt(B?.inputs?.smr_pressure_kpa,0)+" kPa" },
    { label: "HTS Temperature", aStr: fmt(A?.inputs?.hts_temp,0)+" °C",              bStr: fmt(B?.inputs?.hts_temp,0)+" °C" },
  ];

  // ── Auto-generated insight ──
  const generateInsight = () => {
    if (!A || !B) return "";
    const aName = A.name || "Scenario A", bName = B.name || "Scenario B";
    const aH2 = A.results?.h2_production||0, bH2 = B.results?.h2_production||0;
    const aCost = A.results?.h2_cost||0,     bCost = B.results?.h2_cost||0;
    const aCO2 = A.results?.co2_annual_tonnes||0, bCO2 = B.results?.co2_annual_tonnes||0;
    const parts = [];
    if (Math.abs(aH2 - bH2) > 0.1) {
      const [winner, loser, diff] = aH2 > bH2 ? [aName, bName, pctDiff(aH2,bH2)] : [bName, aName, pctDiff(bH2,aH2)];
      parts.push(`${winner} produces ${Math.abs(diff)}% more hydrogen than ${loser} (${fmt(Math.max(aH2,bH2),1)} vs ${fmt(Math.min(aH2,bH2),1)} kmol/h).`);
    }
    if (Math.abs(aCost - bCost) > 1000) {
      const [winner, loser, diff] = aCost < bCost ? [aName, bName, pctDiff(bCost,aCost)] : [bName, aName, pctDiff(aCost,bCost)];
      parts.push(`${winner} is ${Math.abs(diff)}% cheaper than ${loser} ($${(Math.min(aCost,bCost)/1e6).toFixed(2)}M vs $${(Math.max(aCost,bCost)/1e6).toFixed(2)}M/yr).`);
    }
    if (Math.abs(aCO2 - bCO2) > 100) {
      const [winner, loser, diff] = aCO2 < bCO2 ? [aName, bName, pctDiff(bCO2,aCO2)] : [bName, aName, pctDiff(aCO2,bCO2)];
      parts.push(`${winner} emits ${Math.abs(diff)}% less CO₂ than ${loser} (${fmt(Math.min(aCO2,bCO2)/1000,1)}k vs ${fmt(Math.max(aCO2,bCO2)/1000,1)}k t/yr).`);
    }
    let aWins = 0, bWins = 0;
    if (aH2 > bH2) aWins++; else if (bH2 > aH2) bWins++;
    if (aCost < bCost) aWins++; else if (bCost < aCost) bWins++;
    if (aCO2 < bCO2) aWins++; else if (bCO2 < aCO2) bWins++;
    if (aWins > bWins) parts.push(`Overall, ${aName} leads across ${aWins}/3 key performance indicators.`);
    else if (bWins > aWins) parts.push(`Overall, ${bName} leads across ${bWins}/3 key performance indicators.`);
    else parts.push("Both scenarios are evenly matched — your choice depends on whether you prioritise production volume, cost efficiency, or emissions reduction.");
    return parts.join(" ");
  };

  return (
    <div className="shared-page">
      <div className="shared-shell">

        <PageHeader subtitle="Scenario History" />

        <div className="shared-page-card">
        <div className="page-heading">
          <div className="page-heading-left">
            <button className="page-back-btn" onClick={() => navigate("/")}>← Home</button>
            <div>
              <div className="page-heading-title">Scenario History</div>
              <div className="page-heading-sub">Welcome back, <strong>{user?.username}</strong></div>
            </div>
          </div>
          <div className="page-heading-actions">
            <button className="page-btn page-btn-solid" onClick={() => navigate("/smr")}>+ New Scenario</button>
          </div>
        </div>

        <div className="history-line" />

        {/* Comparison panel */}
        {selected.length > 0 && (
          <div className="compare-banner">
            <div className="compare-banner-left">
              <span className="compare-badge">{selected.length}/2 selected</span>
              <span className="compare-hint">
                {selected.length < 2 ? "Select one more scenario to compare" : "Ready to compare"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {isComparing && (
                <button className="hist-btn hist-btn-solid" onClick={() => setExpanded("__compare__")}>
                  Compare Side by Side
                </button>
              )}
              <button className="hist-btn hist-btn-ghost" onClick={() => { setSelected([]); setExpanded(null); }}>
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Comparison table */}
        {isComparing && expanded === "__compare__" && (
          <div className="compare-wrap">

            {/* Scenario header cards */}
            <div className="compare-header">
              <div className="compare-header-spacer" />
              <div className="compare-scenario-card compare-scenario-a">
                <div className="compare-scenario-tag">A</div>
                <div>
                  <div className="compare-scenario-name">{A?.name || "Scenario A"}</div>
                  <div className="compare-scenario-time">{new Date(A?.timestamp).toLocaleString()}</div>
                </div>
              </div>
              <div className="compare-scenario-card compare-scenario-b">
                <div className="compare-scenario-tag">B</div>
                <div>
                  <div className="compare-scenario-name">{B?.name || "Scenario B"}</div>
                  <div className="compare-scenario-time">{new Date(B?.timestamp).toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Outputs section */}
            <div className="compare-section-label">Performance Outputs</div>
            {outputRows.map((row) => {
              const w = win(row.aVal, row.bVal, row.hi);
              return (
                <div key={row.label} className="compare-row">
                  <div className="compare-row-label">
                    <span className="compare-row-icon">{row.icon}</span>
                    {row.label}
                  </div>
                  <div className={`compare-cell ${w === "a" ? "compare-cell-win" : w === "b" ? "compare-cell-lose" : ""}`}>
                    {row.aStr}
                    {w === "a" && <span className="compare-win-badge">✓ better</span>}
                  </div>
                  <div className={`compare-cell ${w === "b" ? "compare-cell-win" : w === "a" ? "compare-cell-lose" : ""}`}>
                    {row.bStr}
                    {w === "b" && <span className="compare-win-badge">✓ better</span>}
                  </div>
                </div>
              );
            })}

            {/* Inputs section */}
            <div className="compare-section-label" style={{ marginTop: 10 }}>Input Parameters</div>
            {inputRows.map((row) => (
              <div key={row.label} className="compare-row compare-row-input">
                <div className="compare-row-label">{row.label}</div>
                <div className="compare-cell compare-cell-neutral">{row.aStr}</div>
                <div className="compare-cell compare-cell-neutral">{row.bStr}</div>
              </div>
            ))}

            {/* Insight paragraph */}
            <div className="compare-insight">
              <div className="compare-insight-header">
                <span className="compare-insight-icon">💡</span>
                <span className="compare-insight-title">What this comparison tells you</span>
              </div>
              <p className="compare-insight-text">{generateInsight()}</p>
            </div>

            {/* Actions */}
            <div className="compare-actions">
              <button className="hist-btn hist-btn-solid"    onClick={() => handleRerun(A)}>↺ Re-run {A?.name || "A"}</button>
              <button className="hist-btn hist-btn-outline"  onClick={() => handleRerun(B)}>↺ Re-run {B?.name || "B"}</button>
              <button className="hist-btn hist-btn-ghost"    onClick={() => setExpanded(null)}>Close</button>
            </div>
          </div>
        )}

        {/* Body */}
        {loading && <div className="history-empty">Loading history…</div>}

        {!loading && history.length === 0 && (
          <div className="history-empty">
            <div className="history-empty-icon">📊</div>
            <div className="history-empty-text">No scenarios yet</div>
            <div className="history-empty-sub">Run your first scenario to see it here.</div>
            <button className="hist-btn hist-btn-solid" onClick={() => navigate("/smr")}>Start Now</button>
          </div>
        )}

        {!loading && history.length > 0 && (
          <div className="history-list">
            {history.map((entry, i) => {
              const isOpen    = expanded === entry.id;
              const isChecked = selected.includes(entry.id);
              const co2       = entry.results?.co2_annual_tonnes;
              return (
                <div key={entry.id} className={`history-card ${isOpen ? "history-card-open" : ""} ${isChecked ? "history-card-selected" : ""}`}>

                  <div className="history-card-row">
                    {/* Checkbox for comparison */}
                    <input
                      type="checkbox"
                      className="history-checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(entry.id)}
                      title="Select to compare"
                    />

                    <div className="history-card-index" onClick={() => setExpanded(isOpen ? null : entry.id)}>#{history.length - i}</div>

                    <div className="history-card-meta" onClick={() => setExpanded(isOpen ? null : entry.id)}>
                      <div className="history-card-name-row">
                        <span className="history-card-name">{entry.name || `Scenario ${history.length - i}`}</span>
                        {recordMap[entry.id]?.map((r, ri) => (
                          <span key={ri} className="history-record-badge" title={`Record for: ${r.targetName}`}>
                            🏆 {METRIC_CONFIG[r.metric]?.label}
                          </span>
                        ))}
                      </div>
                      <div className="history-card-time">{new Date(entry.timestamp).toLocaleString()}</div>
                      <div className="history-card-ago">{timeAgo(entry.timestamp)}</div>
                    </div>

                    <div className="history-kpis" onClick={() => setExpanded(isOpen ? null : entry.id)}>
                      <div className="history-kpi">
                        <span className="history-kpi-label">H₂ Production</span>
                        <span className="history-kpi-value">{fmt(entry.results?.h2_production, 1)} <em>kmol/h</em></span>
                      </div>
                      <div className="history-kpi">
                        <span className="history-kpi-label">H₂ Cost</span>
                        <span className="history-kpi-value">${((entry.results?.h2_cost || 0) / 1e6).toFixed(1)}M <em>/yr</em></span>
                      </div>
                      <div className="history-kpi">
                        <span className="history-kpi-label">CO₂</span>
                        <span className="history-kpi-value">{fmt((co2 || 0) / 1000, 1)}k <em>t/yr</em></span>
                      </div>
                    </div>

                    <div className={`history-chevron ${isOpen ? "open" : ""}`} onClick={() => setExpanded(isOpen ? null : entry.id)}>›</div>
                  </div>

                  {isOpen && (
                    <div className="history-detail">
                      <div className="history-detail-cols">
                        <div className="history-detail-section">
                          <div className="history-detail-title">Inputs Used</div>
                          {[["CH₄ Feed", entry.inputs?.ch4_feed, "kgmol/h"], ["Steam", entry.inputs?.steam_flowrate, "kgmol/h"], ["SMR Temp", entry.inputs?.smr_temp, "°C"], ["Pressure", entry.inputs?.smr_pressure_kpa, "kPa"], ["HTS Temp", entry.inputs?.hts_temp, "°C"]].map(([label, val, unit]) => (
                            <div className="history-detail-row" key={label}><span>{label}</span><strong>{fmt(val, 0)} <em>{unit}</em></strong></div>
                          ))}
                        </div>
                        <div className="history-detail-section">
                          <div className="history-detail-title">Optimized Parameters</div>
                          {[["CH₄ Feed", entry.optimized_params?.ch4_feed, "kgmol/h"], ["Steam", entry.optimized_params?.steam_flowrate, "kgmol/h"], ["SMR Temp", entry.optimized_params?.smr_temp, "°C"], ["Pressure", entry.optimized_params?.smr_pressure_kpa, "kPa"], ["HTS Temp", entry.optimized_params?.hts_temp, "°C"]].map(([label, val, unit]) => (
                            <div className="history-detail-row" key={label}><span>{label}</span><strong className="green">{fmt(val, 0)} <em>{unit}</em></strong></div>
                          ))}
                        </div>
                        <div className="history-detail-section">
                          <div className="history-detail-title">AI Recommendations</div>
                          {(entry.recommendations || []).map((rec, j) => (
                            <div className="history-rec-item" key={j}>
                              <span className="history-rec-dot">{j + 1}</span>
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="history-detail-actions">
                        <button className="hist-btn hist-btn-solid" onClick={() => handleRerun(entry)}>↺ Re-run this Scenario</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        </div> {/* shared-page-card */}
      </div>
    </div>
  );
}
