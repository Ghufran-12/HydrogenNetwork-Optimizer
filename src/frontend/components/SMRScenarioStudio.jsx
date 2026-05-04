import React, { useMemo, useState } from "react";
import "../styles/smr-studio.css";

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const parseNum = (s) => {
  if (s === "" || s === null || s === undefined) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// يسمح بالكتابة الطبيعية (0. , .5 , 12.)
// ويمنع الحروف
const sanitizeDecimal = (value) => {
  const v = String(value);
  // اقبل أرقام + نقطة واحدة
  const cleaned = v.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  // لو أكثر من نقطة، خذ أول نقطتين فقط
  return parts[0] + "." + parts.slice(1).join("");
};

export default function SMRScenarioStudio({ onSubmit }) {
  const rules = useMemo(
    () => ({
      ch4FeedKmolH: {
        min: 0,
        max: 10000,
        step: 1,
        title: "CH₄ Feed Flowrate",
        unit: "kmol/h",
        hint: "Controls production capacity (higher feed → higher H₂ potential).",
        required: true,
      },
      steamToCarbon: {
        min: 1,
        max: 6,
        step: 0.1,
        title: "Steam-to-Carbon Ratio",
        unit: "ratio",
        hint: "Impacts reforming conversion and CO₂ formation.",
        required: true,
      },
      smrTempC: {
        min: 600,
        max: 1100,
        step: 1,
        title: "SMR Temperature",
        unit: "°C",
        hint: "Impacts equilibrium and furnace duty.",
        required: true,
      },
      smrPressureBar: {
        min: 1,
        max: 60,
        step: 0.1,
        title: "SMR Pressure",
        unit: "bar",
        hint: "Impacts reaction shifting and downstream feasibility.",
        required: true,
      },
      htsConversion: {
        min: 0,
        max: 1,
        step: 0.01,
        title: "HTS Conversion",
        unit: "0–1",
        hint: "Optional: affects CO/CO₂ balance depending on constraints.",
        required: false,
      },
      psaRecovery: {
        min: 0,
        max: 1,
        step: 0.01,
        title: "PSA Recovery",
        unit: "0–1",
        hint: "Optional: improves H₂ utilization; may increase energy/cost.",
        required: false,
      },
    }),
    []
  );

  const [form, setForm] = useState({
    ch4FeedKmolH: "1200",
    steamToCarbon: "3",
    smrTempC: "850",
    smrPressureBar: "25",
    htsConversion: "0.85",
    psaRecovery: "0.85",
  });

  const [touched, setTouched] = useState({});

  const errors = useMemo(() => {
    const e = {};
    const checkReq = (key) => {
      const n = parseNum(form[key]);
      if (n === null) e[key] = "Required";
      else if (n < rules[key].min || n > rules[key].max)
        e[key] = `Must be between ${rules[key].min} and ${rules[key].max}`;
    };

    // required only
    Object.keys(rules).forEach((k) => {
      if (rules[k].required) checkReq(k);
    });

    // optional: validate only if not empty
    ["htsConversion", "psaRecovery"].forEach((k) => {
      if (form[k] === "") return;
      const n = parseNum(form[k]);
      if (n === null) e[k] = "Must be a number";
      else if (n < rules[k].min || n > rules[k].max) e[k] = "Must be between 0 and 1";
    });

    return e;
  }, [form, rules]);

  const isValid = Object.keys(errors).length === 0;

  const setVal = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
  };

  const markTouched = (key) => setTouched((p) => ({ ...p, [key]: true }));

  const onBlurNormalize = (key) => {
    markTouched(key);

    const r = rules[key];
    const n = parseNum(form[key]);

    // لو فاضي وOptional خله فاضي
    if (!r.required && (form[key] === "" || n === null)) return;

    // لو required وفاضي، لا نعدل (خليه يعطي error)
    if (r.required && n === null) return;

    // clamp + format بسيط
    const clamped = clamp(n, r.min, r.max);
    // حافظ على الدقة حسب step
    const decimals = String(r.step).includes(".") ? String(r.step).split(".")[1].length : 0;
    setVal(key, decimals ? clamped.toFixed(decimals) : String(Math.round(clamped)));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // لمس كل الحقول
    const allTouched = {};
    Object.keys(rules).forEach((k) => (allTouched[k] = true));
    setTouched(allTouched);

    if (!isValid) return;

    const payload = {
      ch4FeedKmolH: Number(form.ch4FeedKmolH),
      steamToCarbon: Number(form.steamToCarbon),
      smrTempC: Number(form.smrTempC),
      smrPressureBar: Number(form.smrPressureBar),
      htsConversion: form.htsConversion === "" ? null : clamp(Number(form.htsConversion), 0, 1),
      psaRecovery: form.psaRecovery === "" ? null : clamp(Number(form.psaRecovery), 0, 1),
      mode: "full",
    };

    if (typeof onSubmit === "function") onSubmit(payload);
    else console.log("SMR Payload:", payload);
  };

  const FieldCard = ({ id, optionalTag }) => {
    const r = rules[id];
    const showError = touched[id] && errors[id];

    const sliderValue = (() => {
      const n = parseNum(form[id]);
      return n === null ? r.min : clamp(n, r.min, r.max);
    })();

    return (
      <div className="smr-cardField">
        <div className="smr-cardHead">
          <div className="smr-left">
            <div className="smr-titleRow">
              <div className="smr-cardTitle">{r.title}</div>
              <div className="smr-unit">{r.unit}</div>
              {optionalTag ? <span className="smr-optional">Optional</span> : null}
            </div>
            <div className="smr-hint">{r.hint}</div>
          </div>

          <div className="smr-pill">{form[id] === "" ? "—" : form[id]}</div>
        </div>

        <div className="smr-controls">
          <input
            className={`smr-input ${showError ? "smr-input--error" : ""}`}
            type="text"
            inputMode="decimal"
            value={form[id]}
            onChange={(e) => setVal(id, sanitizeDecimal(e.target.value))}
            onBlur={() => onBlurNormalize(id)}
            placeholder={r.required ? "Enter value" : "Leave empty if not used"}
          />

          <div className="smr-sliderWrap">
            <input
              className="smr-slider"
              type="range"
              min={r.min}
              max={r.max}
              step={r.step}
              value={sliderValue}
              onChange={(e) => setVal(id, String(e.target.value))}
              onMouseUp={() => markTouched(id)}
              onTouchEnd={() => markTouched(id)}
            />
            <div className="smr-sliderMeta">
              <span>{r.min}</span>
              <span>{r.max}</span>
            </div>
          </div>
        </div>

        {showError ? <div className="smr-error">{errors[id]}</div> : null}
      </div>
    );
  };

  return (
    <div className="smr-page">
      <div className="smr-shell">
        <div className="smr-header">
          <div>
            <div className="smr-hTitle">SMR Scenario Inputs</div>
            <div className="smr-hLine" />
          </div>
        </div>

        <form className="smr-grid" onSubmit={handleSubmit}>
          <FieldCard id="ch4FeedKmolH" />
          <FieldCard id="smrTempC" />
          <FieldCard id="steamToCarbon" />
          <FieldCard id="smrPressureBar" />
          <FieldCard id="htsConversion" optionalTag />
          <FieldCard id="psaRecovery" optionalTag />

          <div className="smr-footer">
            <button className="smr-btn" type="submit" disabled={!isValid}>
              Generate Recommendation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}