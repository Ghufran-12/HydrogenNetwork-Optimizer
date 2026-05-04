import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from "recharts";
import "../styles/comparison-page.css";
import "../styles/shared-page.css";
import PageHeader from "../components/PageHeader";

export default function ComparisonPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const bookmarks = location.state?.bookmarks || [];

  if (!bookmarks || bookmarks.length < 2) {
    return (
      <div className="shared-page">
        <div className="shared-shell">
          <PageHeader subtitle="Scenario Comparison" />
          <div className="shared-page-card">
          <div className="page-heading">
            <div className="page-heading-left">
              <button className="page-back-btn" onClick={() => navigate("/bookmarks")}>← Bookmarks</button>
              <div className="page-heading-title">Scenario Comparison</div>
            </div>
          </div>
          <div style={{ padding: "40px", textAlign: "center", color: "#9CA3AF" }}>
            <p>No comparison data available. Please select at least 2 scenarios.</p>
            <button className="comparison-new-btn" onClick={() => navigate("/bookmarks")}>
              Select Scenarios
            </button>
          </div>
          </div> {/* shared-page-card */}
        </div>
      </div>
    );
  }

  const colors = ["#14532D", "#16A34A", "#4B5563"];

  // ─── Extract comparable parameters ───────────────────────────────
  const getParamValue = (form) => {
    if (!form) return {};
    return {
      ch4: form.ch4 ?? "—",
      steam: form.steam ?? "—",
      smrTemp: form.smrTemp ?? "—",
      smrPressure: form.smrPressure ?? "—",
      htsTemp: form.htsTemp ?? "—",
    };
  };

  const allParams = [
    { key: "ch4", label: "CH₄ Feed Flowrate (kgmol/h)" },
    { key: "steam", label: "Steam Flowrate (kgmol/h)" },
    { key: "smrTemp", label: "SMR Outlet Temperature (°C)" },
    { key: "smrPressure", label: "SMR Outlet Pressure (kPa)" },
    { key: "htsTemp", label: "HTS Inlet Temperature (°C)" },
  ];

  const parameterTable = useMemo(() => {
    return allParams.map(param => {
      const row = { param: param.label };
      bookmarks.forEach((bm, idx) => {
        const paramValues = getParamValue(bm.form);
        row[`bm${idx}`] = paramValues[param.key];
      });
      return row;
    });
  }, [bookmarks]);

  // ─── Metrics comparison ────────────────────────────────────────────
  const metricsComparison = useMemo(() => {
    const result = bookmarks.map((bm, idx) => {
      const h2Prod = parseFloat((bm.apiResult?.predictions?.h2_production || bm.apiResult?.current?.h2_production || 0));
      const h2CostVal = parseFloat((bm.apiResult?.current?.h2_cost || 0) / 1e6);
      const co2Val = parseFloat((bm.apiResult?.current?.co2_annual_tonnes || 0) / 1000);
      
      console.log(`[MetricsComparison] ${bm.scenarioName}:`, {
        h2Production: h2Prod,
        h2Cost: h2CostVal,
        co2Annual: co2Val,
        raw: {
          h2_production: bm.apiResult?.predictions?.h2_production || bm.apiResult?.current?.h2_production,
          h2_cost: bm.apiResult?.current?.h2_cost,
          co2_annual_tonnes: bm.apiResult?.current?.co2_annual_tonnes,
        }
      });
      
      return {
        id: bm.id,
        name: bm.scenarioName,
        h2Production: h2Prod,
        h2Cost: h2CostVal,
        co2Annual: co2Val,
      };
    });
    
    console.log("[MetricsComparison] All bookmarks:", result);
    return result;
  }, [bookmarks]);

  // ─── Calculate relative improvements ───────────────────────────────
  const improvements = useMemo(() => {
    if (!metricsComparison || metricsComparison.length === 0) return [];
    
    const baseline = metricsComparison[0];
    
    const result = metricsComparison.map((m) => {
      const baselineH2Prod = baseline.h2Production;
      const baselineH2Cost = baseline.h2Cost;
      const baselineC02 = baseline.co2Annual;
      
      // Safely calculate percentage changes with zero-division handling
      let h2ProdChange = 0;
      let costChange = 0;
      let co2Change = 0;
      
      if (baselineH2Prod !== 0) {
        h2ProdChange = ((m.h2Production - baselineH2Prod) / baselineH2Prod * 100);
      }
      
      if (baselineH2Cost !== 0) {
        costChange = ((m.h2Cost - baselineH2Cost) / baselineH2Cost * 100);
      }
      
      if (baselineC02 !== 0) {
        co2Change = ((m.co2Annual - baselineC02) / baselineC02 * 100);
      }

      const record = {
        scenario: m.name,
        h2ProdChange: parseFloat(h2ProdChange.toFixed(1)),
        costChange: parseFloat(costChange.toFixed(1)),
        co2Change: parseFloat(co2Change.toFixed(1)),
      };
      
      // Debug logging
      console.log(`[Improvements] ${m.name}:`, {
        baseline: { h2Prod: baselineH2Prod, h2Cost: baselineH2Cost, co2: baselineC02 },
        current: { h2Prod: m.h2Production, h2Cost: m.h2Cost, co2: m.co2Annual },
        changes: record,
      });
      
      return record;
    });
    
    console.log("[Improvements] Full data:", result);
    return result;
  }, [metricsComparison]);

  // ─── Chart overlay data ────────────────────────────────────────────
  const chartData = useMemo(() => {
    return metricsComparison.map((m) => ({
      name: m.name,
      h2Production: parseFloat(m.h2Production.toFixed(1)),
      h2Cost: parseFloat(m.h2Cost.toFixed(2)),
      co2Annual: parseFloat(m.co2Annual.toFixed(1)),
    }));
  }, [metricsComparison]);

  return (
    <div className="shared-page">
      <div className="shared-shell">

        <PageHeader subtitle="Scenario Comparison" />

        <div className="shared-page-card">
        <div className="page-heading">
          <div className="page-heading-left">
            <button className="page-back-btn" onClick={() => navigate("/bookmarks")}>← Bookmarks</button>
            <div>
              <div className="page-heading-title">Scenario Comparison</div>
              <div className="page-heading-sub">Side-by-side analysis of {bookmarks.length} scenarios</div>
            </div>
          </div>
        </div>

        {/* ─── Scenario Overview ────────────────────────────────────── */}
        <div className="comparison-overview">
          <h2 className="section-title">Overview</h2>
          <div className="scenarios-summary">
            {metricsComparison.map((m, idx) => (
              <div key={m.id} className="scenario-card">
                <div className="scenario-name">{m.name}</div>
                <div className="scenario-metrics">
                  <div className="metric">
                    <span className="metric-label">H₂ Production</span>
                    <span className="metric-value">{m.h2Production}</span>
                    <span className="metric-unit">kmol/h</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">H₂ Cost</span>
                    <span className="metric-value">${m.h2Cost}</span>
                    <span className="metric-unit">M/yr</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">CO₂ Annual</span>
                    <span className="metric-value">{m.co2Annual}</span>
                    <span className="metric-unit">k t/yr</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Relative Improvements ────────────────────────────────── */}
        <div className="comparison-improvements">
          <h2 className="section-title">Relative Improvements vs. Baseline</h2>
          {improvements && improvements.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={improvements} margin={{ top: 20, right: 30, left: 60, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis 
                  dataKey="scenario" 
                  stroke="#666" 
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis 
                  stroke="#666" 
                  fontSize={12} 
                  label={{ value: "% Change", angle: -90, position: "insideLeft", offset: 10 }}
                />
                <Tooltip 
                  formatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`}
                  contentStyle={{ background: "#fff", border: "1px solid #ccc", borderRadius: "8px" }}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Bar dataKey="h2ProdChange" fill="#16A34A" name="H₂ Production Change %" radius={[4, 4, 0, 0]} />
                <Bar dataKey="costChange" fill="#DC2626" name="Cost Change %" radius={[4, 4, 0, 0]} />
                <Bar dataKey="co2Change" fill="#2563EB" name="CO₂ Change %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
              <p>Unable to calculate improvements. Ensure all scenarios have valid metrics data.</p>
            </div>
          )}
        </div>

        {/* ─── Metrics Comparison ───────────────────────────────────── */}
        <div className="comparison-metrics">
          <h2 className="section-title">Key Performance Metrics</h2>
          <div className="metrics-grid">
            <div className="metric-chart">
              <h3>H₂ Production (kmol/h)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="name" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ccc", borderRadius: "8px" }} />
                  <Bar dataKey="h2Production" fill="#16A34A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="metric-chart">
              <h3>H₂ Cost (M$/yr)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="name" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ccc", borderRadius: "8px" }} />
                  <Bar dataKey="h2Cost" fill="#DC2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="metric-chart">
              <h3>CO₂ Emissions (k t/yr)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="name" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ccc", borderRadius: "8px" }} />
                  <Bar dataKey="co2Annual" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ─── Parameter Comparison Table ───────────────────────────── */}
        <div className="comparison-parameters">
          <h2 className="section-title">Input Parameters</h2>
          <div className="parameters-table-container">
            <table className="parameters-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  {bookmarks.map((bm, idx) => (
                    <th key={bm.id}>{bm.scenarioName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parameterTable.map((row, idx) => (
                  <tr key={idx}>
                    <td className="param-name">{row.param}</td>
                    {bookmarks.map((_, idx) => (
                      <td key={idx} className="param-value">
                        {row[`bm${idx}`]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Scenario Details ─────────────────────────────────────── */}
        <div className="comparison-details">
          <h2 className="section-title">Scenario Details</h2>
          <div className="details-grid">
            {bookmarks.map((bm) => (
              <div key={bm.id} className="detail-card">
                <h3>{bm.scenarioName}</h3>
                {bm.description && (
                  <>
                    <p className="detail-label"><strong>Description:</strong></p>
                    <p className="detail-text">{bm.description}</p>
                  </>
                )}
                {bm.tags && bm.tags.length > 0 && (
                  <>
                    <p className="detail-label"><strong>Tags:</strong></p>
                    <div className="detail-tags">
                      {bm.tags.map(tag => (
                        <span key={tag} className={`detail-tag detail-tag-${tag}`}>{tag}</span>
                      ))}
                    </div>
                  </>
                )}
                {bm.notes && (
                  <>
                    <p className="detail-label"><strong>Notes:</strong></p>
                    <p className="detail-text">{bm.notes}</p>
                  </>
                )}
                <p className="detail-label"><strong>Saved:</strong> {bm.timestamp}</p>
              </div>
            ))}
          </div>
        </div>

        </div> {/* shared-page-card */}
      </div>
    </div>
  );
}
