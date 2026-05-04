import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/smr-studio.css";
import "../styles/shared-page.css";
import PageHeader from "../components/PageHeader";


/* ── Field definitions ── */
const FIELDS = [
  {
    id: "ch4", title: "CH₄ Feed Flowrate", unit: "kgmol/h", group: "feed",
    hint: "Molar flow of methane fed into the SMR. Higher feed increases H₂ output but raises operating cost.",
    min: 500, max: 1350, step: 50,
    impacts: [
      { label: "H₂ Output",      color: "#14532D", dir: "↑" },
      { label: "Operating Cost",  color: "#D97706", dir: "↑" },
    ],
  },
  {
    id: "steam", title: "Steam Flowrate", unit: "kgmol/h", group: "feed",
    hint: "Steam-to-carbon ratio drives methane conversion. Target S/C between 3.0–4.5 for optimal operation.",
    min: 2500, max: 4000, step: 100,
    impacts: [
      { label: "CH₄ Conversion",    color: "#14532D", dir: "↑" },
      { label: "Energy Consumption", color: "#D97706", dir: "↑" },
    ],
  },
  {
    id: "smrTemp", title: "SMR Outlet Temperature", unit: "°C", group: "reactor",
    hint: "Higher temperatures shift equilibrium toward H₂. Above 900 °C risks catalyst sintering.",
    min: 750, max: 900, step: 10,
    impacts: [
      { label: "H₂ Yield",         color: "#14532D", dir: "↑" },
      { label: "Fuel Consumption",  color: "#D97706", dir: "↑" },
    ],
  },
  {
    id: "smrPressure", title: "SMR Outlet Pressure", unit: "kPa", group: "reactor",
    hint: "Lower pressure favours H₂ production (Le Chatelier) but increases downstream compression costs.",
    min: 2000, max: 3000, step: 100,
    impacts: [
      { label: "H₂ Yield",          color: "#DC2626", dir: "↓" },
      { label: "Compression Cost",   color: "#14532D", dir: "↓" },
    ],
  },
  {
    id: "htsTemp", title: "HTS Inlet Temperature", unit: "°C", group: "reactor",
    hint: "Controls the water-gas shift reaction. Must stay within catalyst activity window (320–380 °C).",
    min: 320, max: 380, step: 5,
    impacts: [
      { label: "CO Conversion", color: "#14532D", dir: "↑" },
      { label: "H₂ Purity",    color: "#14532D", dir: "↑" },
    ],
  },
];

const DEFAULTS = { ch4: 1000, steam: 3000, smrTemp: 850, smrPressure: 2500, htsTemp: 350 };

/* ── Helpers ── */
const fmtVal = (v) => Number.isInteger(v) ? v : parseFloat(v).toFixed(1);
const rangePct = (val, min, max) => Math.round(((val - min) / (max - min)) * 100);

function scInfo(steam, ch4) {
  const ratio = steam / ch4;
  if (ratio < 2.5) return { ratio, label: "Too Low — Carbon Deposition Risk", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" };
  if (ratio < 3.0) return { ratio, label: "Below Optimal",                    color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" };
  if (ratio <= 4.5) return { ratio, label: "Optimal Operating Range",          color: "#14532D", bg: "#F0FDF4", border: "#BBF7D0" };
  return              { ratio, label: "High — Excess Energy Use",              color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" };
}

/* ── FieldCard ── */
function FieldCard({ f, value, error, onChange }) {
  const pct     = rangePct(value, f.min, f.max);
  const isError = !!error;
  const zone    = pct < 33 ? "Low" : pct < 67 ? "Mid" : "High";

  return (
    <div className={`smr-card${isError ? " smr-card-err" : ""}`}>
      <div className="smr-card-top">
        <div className="smr-card-meta">
          <div className="smr-card-title-row">
            <span className={`smr-card-title${isError ? " smr-card-title-err" : ""}`}>{f.title}</span>
            <span className={`smr-card-unit${isError ? " smr-card-unit-err" : ""}`}>{f.unit}</span>
          </div>
          <p className={`smr-card-hint${isError ? " smr-card-hint-err" : ""}`}>
            {isError ? `Valid range: ${f.min}–${f.max} ${f.unit}` : f.hint}
          </p>
          <div className="smr-card-impacts">
            {f.impacts.map((imp, i) => (
              <span
                key={i}
                className="smr-impact"
                style={{ color: imp.color, background: imp.color + "18", border: `1px solid ${imp.color}30` }}
              >
                {imp.dir} {imp.label}
              </span>
            ))}
          </div>
        </div>
        <div className={`smr-card-pill${isError ? " smr-card-pill-err" : ""}`}>
          {fmtVal(value)}
        </div>
      </div>

      <div className="smr-card-controls">
        <input
          className={`smr-num-input${isError ? " smr-num-input-err" : ""}`}
          type="number" min={f.min} max={f.max} step={f.step} value={value}
          onChange={e => onChange(f.id, Number(e.target.value))}
        />
        <div className="smr-slider-wrap">
          <input
            type="range"
            className="smr-range"
            min={f.min} max={f.max} step={f.step}
            value={Math.min(f.max, Math.max(f.min, value))}
            style={{ "--pct": `${pct}%` }}
            onChange={e => onChange(f.id, Number(e.target.value))}
          />
          <div className="smr-range-meta">
            <span>{f.min}</span>
            <span className={`smr-range-zone smr-zone-${zone.toLowerCase()}`}>{zone} Range</span>
            <span>{f.max}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function SMRPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, authFetch } = useAuth();

  const [loading,      setLoading]      = useState(false);
  const [loadStep,     setLoadStep]     = useState(0);
  const [error,        setError]        = useState("");
  const [scenarioName, setScenarioName] = useState("");

  const prefill   = location.state?.prefill;
  const replaceId = location.state?.replaceId;

  const [form, setForm] = useState({
    ch4:         prefill?.ch4_feed         ?? DEFAULTS.ch4,
    steam:       prefill?.steam_flowrate   ?? DEFAULTS.steam,
    smrTemp:     prefill?.smr_temp         ?? DEFAULTS.smrTemp,
    smrPressure: prefill?.smr_pressure_kpa ?? DEFAULTS.smrPressure,
    htsTemp:     prefill?.hts_temp         ?? DEFAULTS.htsTemp,
  });

  const fieldErrors = {};
  FIELDS.forEach(f => {
    if (form[f.id] < f.min || form[f.id] > f.max)
      fieldErrors[f.id] = true;
  });
  const hasErrors = Object.keys(fieldErrors).length > 0;

  const sc = scInfo(form.steam, form.ch4);

  const handleChange = (id, val) => {
    setForm(prev => ({ ...prev, [id]: val }));
  };

  const handleReset = () => {
    setForm({ ...DEFAULTS });
  };

  const LOAD_MSGS = [
    "Sending parameters to optimizer…",
    "Computing AI recommendations…",
    "Finalizing results…",
  ];

  const handleSubmit = async () => {
    if (hasErrors) return;
    setError("");
    setLoading(true);
    setLoadStep(0);

    const t1 = setTimeout(() => setLoadStep(1), 1400);
    const t2 = setTimeout(() => setLoadStep(2), 3200);

    try {
      const payload = {
        ch4_feed: form.ch4, steam_flowrate: form.steam,
        smr_temp: form.smrTemp, smr_pressure_kpa: form.smrPressure, hts_temp: form.htsTemp,
      };
      const response = await fetch("http://localhost:8000/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();

      let targetImpacts = [];
      try {
        const histRes = await authFetch(
          replaceId ? `http://localhost:8000/history/${replaceId}` : "http://localhost:8000/history",
          {
            method: replaceId ? "PUT" : "POST",
            body: JSON.stringify({
              name:              scenarioName.trim() || `Scenario ${new Date().toLocaleTimeString()}`,
              inputs:            payload,
              results:           data.current,
              optimized_results: data.optimized,
              optimized_params:  data.optimized_params,
              recommendations:   data.recommendations,
            }),
          }
        );
        const histData = await histRes.json();
        targetImpacts = histData.target_impacts || [];
      } catch { /* non-fatal */ }

      navigate("/results", { state: { form, fields: FIELDS, apiResult: data, scenarioName: scenarioName.trim(), targetImpacts } });
    } catch {
      setError("Could not connect to the backend. Make sure the server is running on port 8000.");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setLoading(false);
      setLoadStep(0);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !loading && !hasErrors)
        handleSubmit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loading, hasErrors, form, scenarioName]);

  const feedFields    = FIELDS.filter(f => f.group === "feed");
  const reactorFields = FIELDS.filter(f => f.group === "reactor");

  return (
    <div className="shared-page">
      <div className="shared-shell">

        <PageHeader subtitle="SMR Scenario Studio" />

        <div className="shared-page-card">
        <div className="page-heading">
          <div className="page-heading-left">
            <button className="page-back-btn" onClick={() => navigate("/")}>← Home</button>
            <div>
              <div className="page-heading-title">New Scenario</div>
              <div className="page-heading-sub">Set parameters and generate AI-powered optimisation recommendations</div>
            </div>
          </div>
        </div>

        {/* ── Scenario name + presets ── */}
        <div className="smr-setup-bar">
          <div className="smr-name-wrap">
            <label className="smr-label">Scenario Name <span className="smr-label-opt">(optional)</span></label>
            <input
              className="smr-name-input"
              type="text"
              placeholder='e.g. "High Steam Test"  ·  "Q3 Baseline"'
              value={scenarioName}
              onChange={e => setScenarioName(e.target.value)}
              maxLength={60}
            />
          </div>
        </div>

        {/* ── S/C ratio badge ── */}
        <div
          className="smr-sc-bar"
          style={{ background: sc.bg, borderColor: sc.border }}
        >
          <div className="smr-sc-left">
            <span className="smr-sc-label">Steam-to-Carbon Ratio</span>
            <span className="smr-sc-value" style={{ color: sc.color }}>{sc.ratio.toFixed(2)}</span>
            <span className="smr-sc-status" style={{ color: sc.color, background: sc.color + "18", borderColor: sc.color + "40" }}>
              {sc.label}
            </span>
          </div>
          <div className="smr-sc-hint">
            Optimal range: 3.0–4.5 · Below 2.5 risks carbon deposition on catalyst
          </div>
        </div>

        {/* ── Feed Conditions ── */}
        <div className="smr-section">
          <div className="smr-section-hdr">
            <div className="smr-section-line" />
            <div className="smr-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
              Feed Conditions
            </div>
            <div className="smr-section-line" />
          </div>
          <div className="smr-grid smr-grid-2">
            {feedFields.map(f => (
              <FieldCard key={f.id} f={f} value={form[f.id]} error={fieldErrors[f.id]} onChange={handleChange} />
            ))}
          </div>
        </div>

        {/* ── Reactor Conditions ── */}
        <div className="smr-section">
          <div className="smr-section-hdr">
            <div className="smr-section-line" />
            <div className="smr-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 9H17v1.5c0 .83-.67 1.5-1.5 1.5S14 11.33 14 10.5v-5"/><path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z"/><path d="M8.5 15H7v-1.5c0-.83.67-1.5 1.5-1.5S10 12.67 10 13.5v5"/></svg>
              Reactor Conditions
            </div>
            <div className="smr-section-line" />
          </div>
          <div className="smr-grid smr-grid-3">
            {reactorFields.map(f => (
              <FieldCard key={f.id} f={f} value={form[f.id]} error={fieldErrors[f.id]} onChange={handleChange} />
            ))}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="smr-error-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="smr-footer">
          <button className="smr-reset-btn" onClick={handleReset} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.63"/></svg>
            Reset to Defaults
          </button>

          <div className="smr-submit-col">
            {loading && (
              <div className="smr-load-row">
                <span className="smr-spinner" />
                <span className="smr-load-text">{LOAD_MSGS[loadStep]}</span>
              </div>
            )}
            <button
              className="smr-submit-btn"
              onClick={handleSubmit}
              disabled={loading || hasErrors}
            >
              {loading ? "Optimizing…" : (
                <>
                  Generate Recommendation
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </>
              )}
            </button>
          </div>
        </div>

        </div> {/* shared-page-card */}
      </div>
    </div>
  );
}
