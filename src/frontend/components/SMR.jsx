import React, { useMemo, useState } from "react";

/**
 * SMR Inputs – Clean & Modern
 * Always shows:
 * - CH4 Feed Flowrate (kmol/h)
 * - Steam-to-Carbon Ratio
 * - SMR Temperature (°C)
 * - SMR Pressure (bar)
 * - HTS Conversion (optional)
 * - PSA Recovery (optional)
 */

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const toNumberOrNull = (val) => {
  if (val === "" || val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
};

// يسمح بالكتابة الطبيعية (مثل: 0. ، 13. ، .5) بدون ما يوقف
const sanitizeDecimal = (value) => {
  const v = String(value);

  // خلّي فقط أرقام ونقطة
  const cleaned = v.replace(/[^\d.]/g, "");

  // امنع أكثر من نقطة
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;

  return parts[0] + "." + parts.slice(1).join("");
};

export default function SMR({ onSubmit }) {
  const [form, setForm] = useState({
    ch4FeedKmolH: "1200",
    steamToCarbon: "3",
    smrTempC: "850",
    smrPressureBar: "25",
    htsConversion: "0.85",
    psaRecovery: "0.85",
  });

  const [touched, setTouched] = useState({});

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
        min: 1.0,
        max: 6.0,
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
        unit: "",
        hint: "Optional: affects CO/CO₂ balance depending on constraints.",
        optional: true,
        required: false,
      },
      psaRecovery: {
        min: 0,
        max: 1,
        step: 0.01,
        title: "PSA Recovery",
        unit: "",
        hint: "Optional: improves H₂ utilization; may increase energy/cost.",
        optional: true,
        required: false,
      },
    }),
    []
  );

  const errors = useMemo(() => {
    const e = {};

    const checkRequired = (key) => {
      const v = toNumberOrNull(form[key]);
      if (v === null) e[key] = "Required";
      else if (v < rules[key].min || v > rules[key].max)
        e[key] = `Must be between ${rules[key].min} and ${rules[key].max}`;
    };

    // Required fields
    checkRequired("ch4FeedKmolH");
    checkRequired("steamToCarbon");
    checkRequired("smrTempC");
    checkRequired("smrPressureBar");

    // Optional fields: validate only if not empty
    const hts = toNumberOrNull(form.htsConversion);
    if (form.htsConversion !== "" && hts !== null && (hts < 0 || hts > 1))
      e.htsConversion = "Must be between 0 and 1";
    if (form.htsConversion !== "" && hts === null) e.htsConversion = "Must be a number";

    const psa = toNumberOrNull(form.psaRecovery);
    if (form.psaRecovery !== "" && psa !== null && (psa < 0 || psa > 1))
      e.psaRecovery = "Must be between 0 and 1";
    if (form.psaRecovery !== "" && psa === null) e.psaRecovery = "Must be a number";

    return e;
  }, [form, rules]);

  const isValid = Object.keys(errors).length === 0;

  const setVal = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const markTouched = (key) => setTouched((p) => ({ ...p, [key]: true }));

  const handleSubmit = (e) => {
    e.preventDefault();

    setTouched({
      ch4FeedKmolH: true,
      steamToCarbon: true,
      smrTempC: true,
      smrPressureBar: true,
      htsConversion: true,
      psaRecovery: true,
    });

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
    else console.log("SMR Inputs Payload:", payload);
  };

  const FieldCard = ({ id }) => {
    const r = rules[id];
    const showError = touched[id] && errors[id];

    // Determine if out of range (for red highlight)
    const n = toNumberOrNull(form[id]);
    const outOfRange = n !== null && (n < r.min || n > r.max);

    // slider value safe حتى لو المستخدم كتب "."
    const sliderValue = n === null ? r.min : clamp(n, r.min, r.max);

    return (
      <div style={ui.cardField}>
        <div style={ui.cardHead}>
          <div style={{ minWidth: 0 }}>
            <div style={ui.cardTitleRow}>
              <div style={ui.cardTitle}>{r.title}</div>
              <div style={ui.cardUnit}>{r.unit}</div>
              {r.optional ? <div style={ui.optionalTag}>Optional</div> : null}
            </div>
            <div style={ui.cardHint}>{r.hint}</div>
          </div>

          <div style={ui.valuePill}>{form[id] === "" ? "—" : form[id]}</div>
        </div>

        {/* ✅ مرن: يتغير لعمود واحد بالموبايل */}
        <div style={ui.controlsRow}>
          {/* ✅ ما يوقف الكتابة */}
          <input
            type="text"
            inputMode="decimal"
            value={form[id]}
            onChange={(e) => setVal(id, sanitizeDecimal(e.target.value))}
            onBlur={() => markTouched(id)}
            placeholder={r.optional ? "Leave empty if not used" : "Enter value"}
            style={{
              ...ui.input,
              ...(showError || outOfRange ? ui.inputError : {}),
            }}
          />

          <div style={ui.sliderWrap}>
            <input
              type="range"
              min={r.min}
              max={r.max}
              step={r.step}
              value={sliderValue}
              onChange={(e) => setVal(id, String(e.target.value))}
              onMouseUp={() => markTouched(id)}
              onTouchEnd={() => markTouched(id)}
              style={{
                ...ui.slider,
                ...(showError || outOfRange ? ui.inputError : {}),
              }}
            />
            <div style={ui.sliderMeta}>
              <span>{r.min}</span>
              <span>{r.max}</span>
            </div>
          </div>
        </div>

        {showError ? <div style={ui.error}>{errors[id]}</div> : null}
      </div>
    );
  };

  return (
    <div style={ui.page}>
      <div style={ui.shell}>
        <div style={ui.header}>
          <div>
            <div style={ui.hTitle}>SMR Scenario Inputs</div>
            <div style={ui.hLine} />
          </div>
        </div>

        <form onSubmit={handleSubmit} style={ui.grid}>
          <FieldCard id="ch4FeedKmolH" />
          <FieldCard id="smrTempC" />
          <FieldCard id="steamToCarbon" />
          <FieldCard id="smrPressureBar" />
          <FieldCard id="htsConversion" />
          <FieldCard id="psaRecovery" />

          <div style={ui.footer}>
            <button type="submit" disabled={!isValid} style={{ ...ui.primaryBtn, ...(isValid ? {} : ui.disabledBtn) }}>
              Generate Recommendation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ui = {
  page: {
    minHeight: "100vh",
    padding: "34px 16px",
    background:
      "radial-gradient(900px 600px at 15% 10%, rgba(20,83,45,0.10), transparent 65%), radial-gradient(900px 600px at 85% 0%, rgba(16,185,129,0.08), transparent 60%), #F3F4F6",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "#111827",
    boxSizing: "border-box",
  },

  shell: {
    maxWidth: 1180,
    margin: "0 auto",
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 16px 36px rgba(17,24,39,0.10)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 18,
  },

  hTitle: { fontSize: 30, fontWeight: 950, letterSpacing: "-0.6px" },
  hLine: {
    height: 4,
    width: 86,
    borderRadius: 999,
    marginTop: 10,
    background: "linear-gradient(90deg, #14532D, rgba(20,83,45,0.25))",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },

  cardField: {
    border: "1px solid #E5E7EB",
    background: "linear-gradient(180deg, #FFFFFF, #FBFBFB)",
    borderRadius: 18,
    padding: 16,
  },

  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  cardTitleRow: { display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" },
  cardTitle: { fontSize: 16, fontWeight: 950 },
  cardUnit: { fontSize: 12, color: "#6B7280", fontWeight: 900 },

  optionalTag: {
    fontSize: 11,
    fontWeight: 900,
    color: "#065F46",
    background: "#ECFDF5",
    border: "1px solid #BBF7D0",
    padding: "4px 8px",
    borderRadius: 999,
  },

  cardHint: { marginTop: 6, fontSize: 13, color: "#4B5563", lineHeight: 1.35 },

  valuePill: {
    fontSize: 13,
    fontWeight: 950,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    padding: "8px 10px",
    borderRadius: 14,
    background: "#F3F4F6",
    border: "1px solid #E5E7EB",
    minWidth: 72,
    textAlign: "center",
    flexShrink: 0,
  },

  // ✅ هنا حل التداخل: عمود أول مرن + إذا الشاشة صغيرة يصير عمود واحد تلقائيًا
  controlsRow: {
    display: "grid",
    gridTemplateColumns: "minmax(160px, 220px) 1fr",
    gap: 12,
    alignItems: "center",
    marginTop: 14,
  },

  input: {
    width: "100%",
    border: "1px solid #D1D5DB",
    borderRadius: 14,
    padding: "12px 12px",
    fontSize: 14,
    outline: "none",
    background: "#FFFFFF",
    boxSizing: "border-box",
  },
  inputError: { borderColor: "#EF4444" },

  sliderWrap: { display: "grid", gap: 8, minWidth: 0 },
  slider: { width: "100%", accentColor: "#14532D" },
  sliderMeta: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#6B7280",
    fontWeight: 800,
  },

  error: { marginTop: 10, color: "#EF4444", fontSize: 12, fontWeight: 900 },

  footer: {
    gridColumn: "1 / -1",
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: 16,
    marginTop: 6,
    borderTop: "1px solid #E5E7EB",
  },

  primaryBtn: {
    border: "none",
    background: "#14532D",
    color: "#FFFFFF",
    borderRadius: 16,
    padding: "14px 20px",
    fontSize: 16,
    fontWeight: 950,
    cursor: "pointer",
    minWidth: 280,
  },
  disabledBtn: { opacity: 0.55, cursor: "not-allowed" },
};