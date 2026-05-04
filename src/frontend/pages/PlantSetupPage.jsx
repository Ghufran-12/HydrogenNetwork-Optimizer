import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/plant-setup.css";
import "../styles/shared-page.css";
import PageHeader from "../components/PageHeader";

const FIELDS = [
  {
    key:   "ch4_feed",
    label: "CH₄ Feed Flowrate",
    unit:  "kgmol/h",
    min:   500,
    max:   1350,
    step:  10,
    hint:  "Methane feed to the SMR reactor",
  },
  {
    key:   "steam_flowrate",
    label: "Steam Flowrate",
    unit:  "kgmol/h",
    min:   2500,
    max:   4000,
    step:  50,
    hint:  "Steam fed to the reformer",
  },
  {
    key:   "smr_temp",
    label: "SMR Outlet Temperature",
    unit:  "°C",
    min:   750,
    max:   900,
    step:  5,
    hint:  "Temperature at SMR reactor outlet",
  },
  {
    key:   "smr_pressure_kpa",
    label: "SMR Outlet Pressure",
    unit:  "kPa",
    min:   2000,
    max:   3000,
    step:  50,
    hint:  "Pressure at SMR reactor outlet",
  },
  {
    key:   "hts_temp",
    label: "HTS Inlet Temperature",
    unit:  "°C",
    min:   320,
    max:   380,
    step:  2,
    hint:  "Temperature entering the high-temperature shift reactor",
  },
];

const DEFAULTS = {
  ch4_feed:         1000,
  steam_flowrate:   3000,
  smr_temp:         850,
  smr_pressure_kpa: 2500,
  hts_temp:         350,
};

function MetricCard({ label, value, unit, sub, highlight }) {
  return (
    <div className={`ps-metric-card${highlight ? " ps-metric-highlight" : ""}`}>
      <div className="ps-metric-label">{label}</div>
      <div className="ps-metric-value">{value}</div>
      <div className="ps-metric-unit">{unit}</div>
      {sub && <div className="ps-metric-sub">{sub}</div>}
    </div>
  );
}

export default function PlantSetupPage() {
  const navigate   = useNavigate();
  const { user, authFetch } = useAuth();
  const isManager  = user?.role === "manager";

  const [form, setForm]           = useState(DEFAULTS);
  const [preview, setPreview]     = useState(null);
  const [existing, setExisting]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => { loadExisting(); }, []);

  async function loadExisting() {
    try {
      const res  = await authFetch("http://localhost:8000/plant/baseline");
      const data = await res.json();
      if (data.baseline) {
        setExisting(data.baseline);
        setForm(data.baseline.inputs);
        setPreview(data.baseline);
      }
    } catch {}
    finally { setLoading(false); }
  }

  function handleChange(key, value) {
    setForm(f => ({ ...f, [key]: Number(value) }));
    setPreview(null);
    setSaved(false);
  }

  async function handlePreview() {
    setPreviewing(true);
    setError("");
    try {
      const res  = await fetch("http://localhost:8000/predict", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ch4_feed:         form.ch4_feed,
          steam_flowrate:   form.steam_flowrate,
          smr_temp:         form.smr_temp,
          smr_pressure_kpa: form.smr_pressure_kpa,
          hts_temp:         form.hts_temp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Prediction failed");
      const m = data.predictions;
      setPreview({
        display: {
          h2_cost:           (m.h2_cost / 1e6).toFixed(2),
          co2_annual_tonnes: (m.co2_annual_tonnes / 1000).toFixed(1),
          smr_conversion:    (m.smr_conversion * 100).toFixed(2),
          h2_production:     m.h2_production.toFixed(1),
        },
        metrics: m,
      });
    } catch (e) {
      setError(e.message || "Could not connect to the backend.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res  = await authFetch("http://localhost:8000/plant/setup", {
        method: "POST",
        body:   JSON.stringify({
          ch4_feed:         form.ch4_feed,
          steam_flowrate:   form.steam_flowrate,
          smr_temp:         form.smr_temp,
          smr_pressure_kpa: form.smr_pressure_kpa,
          hts_temp:         form.hts_temp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save");
      setSaved(true);
      await loadExisting();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const scRatio    = (form.steam_flowrate / form.ch4_feed).toFixed(2);
  const scOk       = scRatio >= 3.0 && scRatio <= 4.5;
  const scWarning  = scRatio < 2.5;

  return (
    <div className="shared-page">
      <div className="shared-shell">

        <PageHeader subtitle="Plant Setup" />

        <div className="shared-page-card">
        <div className="page-heading">
          <div className="page-heading-left">
            <button className="page-back-btn" onClick={() => navigate("/")}>← Home</button>
            <div>
              <div className="page-heading-title">Plant Setup</div>
              <div className="page-heading-sub">Define your plant's real operating conditions — the fixed baseline for all team targets</div>
            </div>
          </div>
        </div>

        <div className="ps-line" />

        {/* Existing baseline notice */}
        {existing && !saved && (
          <div className="ps-notice">
            <span className="ps-notice-icon">📋</span>
            <div>
              <strong>Baseline set</strong> — last updated {new Date(existing.updated_at).toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} by {existing.updated_by}.
              {isManager && " You can update it below."}
            </div>
          </div>
        )}

        {saved && (
          <div className="ps-success">
            <span>✓</span> Plant baseline saved successfully. All team targets now use these conditions as their starting point.
          </div>
        )}

        {error && <div className="ps-error">{error}</div>}

        <div className="ps-body">

          {/* Input section */}
          <div className="ps-inputs-section">
            <div className="ps-section-title">Current Plant Conditions</div>
            <div className="ps-section-sub">
              Enter the actual operating parameters of your SMR plant today.
            </div>

            <div className="ps-fields">
              {FIELDS.map(f => {
                const pct = ((form[f.key] - f.min) / (f.max - f.min)) * 100;
                return (
                  <div key={f.key} className="ps-field">
                    <div className="ps-field-header">
                      <div>
                        <div className="ps-field-label">{f.label}</div>
                        <div className="ps-field-hint">{f.hint}</div>
                      </div>
                      <div className="ps-field-val">
                        <span>{form[f.key]}</span>
                        <em>{f.unit}</em>
                      </div>
                    </div>
                    <input
                      type="range"
                      className="ps-range"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={form[f.key]}
                      onChange={e => handleChange(f.key, e.target.value)}
                      style={{ "--pct": `${pct}%` }}
                      disabled={!isManager}
                    />
                    <div className="ps-range-bounds">
                      <span>{f.min} {f.unit}</span>
                      <span>{f.max} {f.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* S/C ratio badge */}
            <div className={`ps-sc-badge ${scWarning ? "ps-sc-bad" : scOk ? "ps-sc-ok" : "ps-sc-warn"}`}>
              <span className="ps-sc-label">Steam-to-Carbon Ratio</span>
              <span className="ps-sc-val">{scRatio}</span>
              <span className="ps-sc-status">
                {scWarning ? "⚠ Too Low — Carbon Deposition Risk" : scOk ? "✓ Optimal Range" : "Below Optimal"}
              </span>
            </div>

            {/* Action buttons */}
            {isManager && (
              <div className="ps-actions">
                <button
                  className="ps-btn ps-btn-outline"
                  onClick={handlePreview}
                  disabled={previewing || saving}
                >
                  {previewing ? "Calculating…" : "Preview Baseline Metrics"}
                </button>
                <button
                  className="ps-btn ps-btn-solid"
                  onClick={handleSave}
                  disabled={saving || previewing}
                >
                  {saving ? "Saving…" : existing ? "Update Baseline" : "Save as Baseline"}
                </button>
              </div>
            )}
          </div>

          {/* Preview panel */}
          {preview && (
            <div className="ps-preview-section">
              <div className="ps-section-title">
                Predicted Plant Performance
                {existing && !saved && <span className="ps-preview-tag">preview — not yet saved</span>}
                {(saved || (existing && !preview?.metrics)) && <span className="ps-saved-tag">current baseline</span>}
              </div>
              <div className="ps-section-sub">
                These are the model-predicted outputs at your specified conditions. Saving these sets the starting point for all team target progress calculations.
              </div>

              <div className="ps-metrics-grid">
                <MetricCard
                  label="H₂ Production Cost"
                  value={`$${preview.display.h2_cost}M`}
                  unit="per year"
                  highlight
                />
                <MetricCard
                  label="CO₂ Emissions"
                  value={`${preview.display.co2_annual_tonnes}k`}
                  unit="tonnes / year"
                />
                <MetricCard
                  label="SMR Conversion"
                  value={`${preview.display.smr_conversion}%`}
                  unit="CH₄ converted"
                  highlight
                />
                <MetricCard
                  label="H₂ Production Rate"
                  value={preview.display.h2_production}
                  unit="kmol / h"
                />
              </div>

              <div className="ps-baseline-info">
                <span className="ps-baseline-icon">ℹ</span>
                <p>
                  These values become the <strong>baseline (0%)</strong> for all team targets.
                  Progress is measured as how much the team's best scenario has improved relative to this starting point toward each goal.
                </p>
              </div>
            </div>
          )}

          {/* Empty state when no preview yet and no existing baseline */}
          {!preview && !loading && (
            <div className="ps-empty-preview">
              <div className="ps-empty-icon">🏭</div>
              <div className="ps-empty-title">No baseline set yet</div>
              <div className="ps-empty-sub">
                {isManager
                  ? "Adjust the sliders to your plant's current conditions, then click \"Preview Baseline Metrics\" to see the predicted performance."
                  : "Your manager hasn't configured the plant baseline yet. The targets page will show progress once they do."}
              </div>
            </div>
          )}

        </div>

        </div> {/* shared-page-card */}
      </div>
    </div>
  );
}
