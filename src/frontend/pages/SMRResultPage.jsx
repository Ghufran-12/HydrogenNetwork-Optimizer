import React, { useMemo } from "react";
import "../styles/smr-results.css";

const fmt = (n, digits = 2) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const num = Number(n);
  return digits === 0 ? Math.round(num).toLocaleString() : num.toFixed(digits);
};

export default function SMRResultsPage({ payload, onBack }) {
  // Mock recommendation + network numbers (بدّلها لاحقًا من API)
  const data = useMemo(() => {
    const baseProd = 20000; // kg/hr (example)
    const ch4 = Number(payload?.ch4FeedKmolH ?? 1200);

    // Example simple scaling (placeholder)
    const prod = Math.round(15000 + (ch4 / 10000) * 10000); // 15000..25000
    const total = Math.round((prod + baseProd) / 2); // just to have a stable number

    const production = [
      { name: "Steam Methane\nReformer 1", value: Math.round(total * 0.50) },
      { name: "Steam Methane\nReformer 2", value: Math.round(total * 0.33) },
      { name: "Pressure Swing\nAdsorption", value: Math.round(total * 0.17) },
    ];

    const consumption = [
      { name: "Hydrocracker Unit", value: Math.round(total * 0.39) },
      { name: "Hydrotreater", value: Math.round(total * 0.46) },
      { name: "Diesel\nHydrodesulfurization", value: Math.round(total * 0.15) },
    ];

    const recs = [
      "Maximize Pressure Swing Adsorption utilization to improve hydrogen purity and reduce loss.",
      "Recover hydrogen from off-gas streams to reduce overall emissions and improve utilization.",
      "Schedule SMR operations during low carbon-intensity power periods to reduce CO₂ footprint.",
      "If demand increases, prioritize SMR feed tuning (CH₄ + S/C) before raising pressure.",
    ];

    return { total, production, consumption, recs };
  }, [payload]);

  return (
    <div className="res-page">
      <div className="res-topbar">
        <div className="res-titleWrap">
          <div className="res-title">Hydrogen Network Optimizer</div>
          <div className="res-sub">Recommendation Results</div>
        </div>

        <div className="res-actions">
          <button className="res-back" type="button" onClick={onBack}>
            Back to Inputs
          </button>
        </div>
      </div>

      {/* Optional: show the chosen inputs briefly */}
      <div className="res-miniCard">
        <div className="res-miniGrid">
          <Mini label="CH₄ Feed" value={`${fmt(payload?.ch4FeedKmolH, 0)} kmol/h`} />
          <Mini label="S/C Ratio" value={fmt(payload?.steamToCarbon, 2)} />
          <Mini label="Temp" value={`${fmt(payload?.smrTempC, 0)} °C`} />
          <Mini label="Pressure" value={`${fmt(payload?.smrPressureBar, 2)} bar`} />
          <Mini label="HTS" value={payload?.htsConversion == null ? "—" : fmt(payload?.htsConversion, 2)} />
          <Mini label="PSA" value={payload?.psaRecovery == null ? "—" : fmt(payload?.psaRecovery, 2)} />
        </div>
      </div>

      <div className="res-grid">
        {/* Hydrogen Flow Network */}
        <section className="net-card">
          <div className="net-head">
            <div>
              <div className="net-title">Hydrogen Flow Network</div>
              <div className="net-sub">Optimized routing visualization</div>
            </div>
            <div className="net-icon">∿</div>
          </div>

          <div className="net-columns">
            <div>
              <div className="net-label">PRODUCTION</div>
              <div className="net-list">
                {data.production.map((x) => (
                  <FlowItem key={x.name} name={x.name} value={x.value} tone="prod" />
                ))}
              </div>
            </div>

            <div className="net-center">
              <div className="ring">
                <div className="ringInner">
                  <div className="ringTag">NETWORK</div>
                  <div className="ringVal">{fmt(data.total, 1)}k</div>
                  <div className="ringUnit">kg/hr</div>
                </div>
              </div>
            </div>

            <div>
              <div className="net-label net-label-right">CONSUMPTION</div>
              <div className="net-list">
                {data.consumption.map((x) => (
                  <FlowItem key={x.name} name={x.name} value={x.value} tone="cons" />
                ))}
              </div>
            </div>
          </div>

          <div className="net-bottom">
            <div className="net-total">
              <div className="net-totalLabel">TOTAL PRODUCTION</div>
              <div className="net-totalVal">{fmt(data.total * 1000, 0)}</div>
              <div className="net-totalUnit">kg/hr</div>
            </div>
            <div className="net-total net-total2">
              <div className="net-totalLabel">TOTAL CONSUMPTION</div>
              <div className="net-totalVal">{fmt(data.total * 1000, 0)}</div>
              <div className="net-totalUnit">kg/hr</div>
            </div>
          </div>
        </section>

        {/* Optimization Recommendations */}
        <section className="rec-card">
          <div className="rec-head">
            <div className="rec-icon">✦</div>
            <div>
              <div className="rec-title">Optimization Recommendations</div>
              <div className="rec-sub">Strategic insights for your hydrogen network</div>
            </div>
          </div>

          <div className="rec-list">
            {data.recs.map((t, i) => (
              <div className="rec-item" key={i}>
                <div className="rec-num">{i + 1}</div>
                <div className="rec-text">{t}</div>
              </div>
            ))}
          </div>

          <div className="rec-foot">
            <span className="rec-dot" />
            <span>{data.recs.length} optimization strategies identified</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="res-mini">
      <div className="res-miniLabel">{label}</div>
      <div className="res-miniValue">{value}</div>
    </div>
  );
}

function FlowItem({ name, value, tone }) {
  const pct = Math.max(6, Math.min(100, (value / 10000) * 100));
  return (
    <div className={`flow-item ${tone}`}>
      <div className="flow-top">
        <div className="flow-name">{name}</div>
        <div className="flow-val">{value.toLocaleString()} kg/hr</div>
      </div>
      <div className="flow-bar">
        <div className="flow-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}