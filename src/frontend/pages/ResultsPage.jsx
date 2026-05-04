import React, { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { METRIC_CONFIG, getOptVal } from "../utils/targets";
import "../styles/results-page.css";
import "../styles/shared-page.css";
import PageHeader from "../components/PageHeader";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

function fmt(val, decimals = 0) {
  if (val == null) return "—";
  return Number(val).toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function DeltaBadge({ pct, positiveIsGood = true }) {
  if (pct == null) return null;
  const improved = positiveIsGood ? pct >= 0 : pct <= 0;
  const sign = pct >= 0 ? "+" : "";
  return (
    <div className={`metric-pill ${improved ? "" : "metric-pill-bad"}`}>
      {sign}{pct.toFixed(2)}% {improved ? "improvement" : "increase"}
    </div>
  );
}

function FlowNode({ label, value, unit, accent }) {
  return (
    <div className={`flow-node ${accent ? "flow-node-accent" : ""}`}>
      <div className="flow-node-label">{label}</div>
      <div className="flow-node-value">{value}</div>
      {unit && <div className="flow-node-unit">{unit}</div>}
    </div>
  );
}

function Arrow() {
  return <div className="flow-arrow">→</div>;
}

const SHORT_NAMES = {
  "CH₄ Feed":        "CH₄",
  "Steam Flowrate":  "Steam",
  "SMR Temperature": "SMR Temp",
  "HTS Temperature": "HTS Temp",
};


/* ── Main Page ────────────────────────────────────────────── */
export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const reportRef = useRef(null);
  const chartsRef = useRef(null);
  const { apiResult, form } = location.state || {};

  const [sensitivity,           setSensitivity]           = useState(null);
  const [confidence,            setConfidence]            = useState(null);
  const [emailModal,            setEmailModal]            = useState(false);
  const [emailTo,               setEmailTo]               = useState("");
  const [emailMessage,          setEmailMessage]          = useState("");
  const [emailStatus,           setEmailStatus]           = useState(null);
  const [emailError,            setEmailError]            = useState("");
  const [bookmarks,             setBookmarks]             = useState([]);
  const [isBookmarked,          setIsBookmarked]          = useState(false);
  const [showBookmarks,         setShowBookmarks]         = useState(false);
  const [showAnnotationModal,   setShowAnnotationModal]   = useState(false);
  const [annotationForm,        setAnnotationForm]        = useState({ description: "", tags: [], notes: "" });
  const [recordBadges,          setRecordBadges]          = useState([]);
  const targetImpacts = location.state?.targetImpacts || [];

  // Fetch sensitivity analysis
  useEffect(() => {
    if (!form) return;
    fetch("http://https://hydrogennetwork-optimizer-1.onrender.com/sensitivity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ch4_feed:         form.ch4,
        steam_flowrate:   form.steam,
        smr_temp:         form.smrTemp,
        smr_pressure_kpa: form.smrPressure,
        hts_temp:         form.htsTemp,
      }),
    })
      .then(r => r.json())
      .then(d => setSensitivity(d.sensitivity))
      .catch(() => {});
  }, []);

  // Fetch confidence score
  useEffect(() => {
    if (!form) return;
    const token = localStorage.getItem("smr_token") ?? "";
    fetch("http://https://hydrogennetwork-optimizer-1.onrender.com/confidence", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ch4_feed:         form.ch4,
        steam_flowrate:   form.steam,
        smr_temp:         form.smrTemp,
        smr_pressure_kpa: form.smrPressure,
        hts_temp:         form.htsTemp,
      }),
    })
      .then(r => r.json())
      .then(d => setConfidence(d))
      .catch(() => {});
  }, []);

  // Load bookmarks
  useEffect(() => {
    const saved = localStorage.getItem("smr_bookmarks");
    if (saved) {
      const bms = JSON.parse(saved);
      setBookmarks(bms);
      if (form && location.state?.scenarioName) {
        setIsBookmarked(bms.some(b => b.scenarioName === location.state.scenarioName));
      }
    }
  }, []);

  const handleBookmark = () => {
    if (!form || !apiResult) return;
    const scenarioNameToUse = location.state?.scenarioName || `Scenario ${Date.now()}`;
    const existingIndex = bookmarks.findIndex(b => b.scenarioName === scenarioNameToUse);
    if (existingIndex !== -1) {
      const newBookmarks = bookmarks.filter((_, i) => i !== existingIndex);
      setBookmarks(newBookmarks);
      setIsBookmarked(false);
      localStorage.setItem("smr_bookmarks", JSON.stringify(newBookmarks));
    } else {
      setAnnotationForm({ description: "", tags: [], notes: "" });
      setShowAnnotationModal(true);
    }
  };

  const handleConfirmBookmark = () => {
    if (!form || !apiResult) return;
    const scenarioNameToUse = location.state?.scenarioName || `Scenario ${Date.now()}`;
    const bookmark = {
      id:           Date.now().toString(),
      scenarioName: scenarioNameToUse,
      form,
      apiResult,
      timestamp:    new Date().toLocaleString(),
      description:  annotationForm.description,
      tags:         annotationForm.tags,
      notes:        annotationForm.notes,
    };
    const newBookmarks = [...bookmarks, bookmark];
    setBookmarks(newBookmarks);
    setIsBookmarked(true);
    localStorage.setItem("smr_bookmarks", JSON.stringify(newBookmarks));
    setShowAnnotationModal(false);
  };

  const handleRunBookmark = (bookmark) => {
    navigate("/results", { state: { apiResult: bookmark.apiResult, form: bookmark.form, scenarioName: bookmark.scenarioName } });
  };

  if (!apiResult) {
    return (
      <div className="shared-page">
        <div className="shared-shell">
          <PageHeader subtitle="Optimization Results" />
          <div className="shared-page-card">
          <div className="page-heading">
            <div className="page-heading-left">
              <button className="page-back-btn" onClick={() => navigate("/")}>← Home</button>
              <div className="page-heading-title">No Results</div>
            </div>
          </div>
          <p style={{ padding: "20px", color: "#9CA3AF" }}>No data found. Please go back and run a scenario.</p>
          </div> {/* shared-page-card */}
        </div>
      </div>
    );
  }

  const {
    current, optimized,
    optimized_params, recommendations,
    cost_improvement_pct, h2_improvement_pct,
  } = apiResult;

  const co2Curr    = current.co2_annual_tonnes;
  const co2Opt     = optimized.co2_annual_tonnes;
  const co2ImpPct  = co2Curr > 0 ? ((co2Curr - co2Opt) / co2Curr) * 100 : 0;
  const costCurrM  = (current.h2_cost / 1e6).toFixed(2);
  const costOptM   = (optimized.h2_cost / 1e6).toFixed(2);

  // Chart data
  const barData = [
    { metric: "H₂ Production", Current: parseFloat(fmt(current.h2_production,  1).replace(/,/g, "")), Optimized: parseFloat(fmt(optimized.h2_production, 1).replace(/,/g, "")), unit: "kmol/h" },
    { metric: "H₂ Cost",       Current: parseFloat(costCurrM),                                        Optimized: parseFloat(costOptM),                                           unit: "$M/yr"  },
    { metric: "CO₂ Emissions", Current: parseFloat((co2Curr / 1000).toFixed(1)),                      Optimized: parseFloat((co2Opt  / 1000).toFixed(1)),                        unit: "kt/yr"  },
  ];

  const RANGES = { ch4: [500,1350], steam: [2500,4000], smrTemp: [750,900], htsTemp: [320,380] };
  const norm = (val, [lo, hi]) => Math.round(((val - lo) / (hi - lo)) * 100);
  const radarData = form ? [
    { param: "CH₄ Feed", Current: norm(form.ch4,     RANGES.ch4),     Optimized: norm(optimized_params.ch4_feed,       RANGES.ch4)     },
    { param: "Steam",    Current: norm(form.steam,   RANGES.steam),   Optimized: norm(optimized_params.steam_flowrate, RANGES.steam)   },
    { param: "SMR Temp", Current: norm(form.smrTemp, RANGES.smrTemp), Optimized: norm(optimized_params.smr_temp,       RANGES.smrTemp) },
    { param: "HTS Temp", Current: norm(form.htsTemp, RANGES.htsTemp), Optimized: norm(optimized_params.hts_temp,       RANGES.htsTemp) },
  ] : [];

  // Insight generators (unchanged from original)
  const barInsight = () => {
    const parts = [];
    if (Math.abs(h2_improvement_pct) > 0.1)
      parts.push(`H₂ production ${h2_improvement_pct > 0 ? "increases" : "decreases"} by ${Math.abs(h2_improvement_pct).toFixed(1)}% (${fmt(current.h2_production,1)} → ${fmt(optimized.h2_production,1)} kmol/h).`);
    if (Math.abs(cost_improvement_pct) > 0.1)
      parts.push(`Production cost ${cost_improvement_pct > 0 ? "drops" : "rises"} by ${Math.abs(cost_improvement_pct).toFixed(1)}% ($${costCurrM}M → $${costOptM}M/yr).`);
    if (Math.abs(co2ImpPct) > 0.1)
      parts.push(`CO₂ emissions ${co2ImpPct > 0 ? "reduce" : "increase"} by ${Math.abs(co2ImpPct).toFixed(1)}%.`);
    if (!parts.length) return "Current settings are already near-optimal — the optimizer found minimal room for improvement.";
    return parts.join(" ") + " The dark green bars are your targets for plant operation.";
  };

  const radarInsight = () => {
    if (!radarData.length) return "";
    const sorted  = [...radarData].sort((a, b) => Math.abs(b.Optimized - b.Current) - Math.abs(a.Optimized - a.Current));
    const biggest = sorted[0];
    const stable  = radarData.filter(d => Math.abs(d.Optimized - d.Current) < 5);
    let text = `The largest recommended shift is in ${biggest.param} — moving ${Math.abs(biggest.Optimized - biggest.Current).toFixed(0)} percentage points across its operating range.`;
    if (stable.length)
      text += ` ${stable.map(d => d.param).join(" and ")} ${stable.length > 1 ? "are" : "is"} already near-optimal and require${stable.length > 1 ? "" : "s"} little adjustment.`;
    return text + " The closer the green area matches the grey, the fewer changes are needed.";
  };

  const sensitivityInsight = () => {
    if (!sensitivity) return "";
    const topH2   = [...sensitivity].sort((a, b) => b.h2_score   - a.h2_score)[0];
    const topCost = [...sensitivity].sort((a, b) => b.cost_score - a.cost_score)[0];
    const topCO2  = [...sensitivity].sort((a, b) => b.co2_score  - a.co2_score)[0];
    let text = `${topH2.param} has the strongest influence on H₂ production (${topH2.h2_score}% impact score).`;
    if (topCost.param !== topH2.param)
      text += ` ${topCost.param} is the primary cost driver (${topCost.cost_score}% score).`;
    if (topCO2.param !== topH2.param && topCO2.param !== topCost.param)
      text += ` CO₂ emissions are most sensitive to ${topCO2.param}.`;
    return text + " Focus on high-scoring parameters first — small adjustments there deliver the greatest return.";
  };

  const flowInsight = () => {
    const co2Cars = Math.round((current.co2_annual_tonnes || 0) / 4.6);
    const h2Gain  = Math.round((optimized.h2_production - current.h2_production) * 2.016 * 8760 / 1000);
    let text = `At current settings, ${(current.smr_conversion * 100).toFixed(1)}% of CH₄ feed is converted, delivering ${fmt(current.h2_production,0)} kmol/h to the PSA unit.`;
    text += ` Annual CO₂ output of ${fmt((current.co2_annual_tonnes||0)/1000,1)}k tonnes is equivalent to roughly ${fmt(co2Cars,0)} cars on the road per year.`;
    if (h2Gain > 0) text += ` Applying the optimized settings would add an estimated ${fmt(h2Gain,0)} extra tonnes of H₂ per year.`;
    return text;
  };

  // Export handlers — identical to original, omitted here for brevity
  // (keep your existing handleSendEmail, handleExportPDF, handleExportWord, captureChartImage)
  const handleSendEmail = async () => {
    if (!emailTo.trim()) return;
    setEmailStatus("sending"); setEmailError("");
    try {
      const res = await fetch("http://https://hydrogennetwork-optimizer-1.onrender.com/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: emailTo.trim(), scenario_name: location.state?.scenarioName || "SMR Scenario", current, optimized, optimized_params, recommendations, cost_improvement_pct, h2_improvement_pct, personal_message: emailMessage }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed"); }
      setEmailStatus("sent");
    } catch (e) { setEmailStatus("error"); setEmailError(e.message); }
  };

  const captureChartImage = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(chartsRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.replace("data:image/png;base64,", "");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { dataUrl, bytes, width: canvas.width / 2, height: canvas.height / 2 };
  };

  const handleExportPDF = async () => {
    const { default: jsPDF }      = await import("jspdf");
    const { default: autoTable }  = await import("jspdf-autotable");
    const doc   = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const GREEN = [20, 83, 45], GRAY = [107, 114, 128], LIGHT = [249, 250, 251], W = 190, ML = 10;
    let y = 14;
    doc.setFillColor(...GREEN); doc.rect(0, 0, 210, 22, "F");
    doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont("helvetica","bold");
    doc.text("SMR Scenario Report", ML, 14);
    doc.setFontSize(9); doc.setFont("helvetica","normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()}  |  Hydrogen Network Optimizer`, ML, 20);
    y = 30;
    const sectionTitle = (title) => {
      doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(...GREEN);
      doc.text(title, ML, y); doc.setDrawColor(...GREEN); doc.setLineWidth(0.4);
      doc.line(ML, y+1, ML+W, y+1); doc.setTextColor(0,0,0); y += 6;
    };
    if (confidence) {
      sectionTitle("Prediction Confidence");
      doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.setTextColor(30,30,30);
      doc.text(`Confidence Score: ${confidence.score}% (${confidence.label})`, ML, y); y += 5;
      doc.text(confidence.note, ML, y, { maxWidth: W }); y += 10;
    }
    sectionTitle("Cost & Emissions Summary");
    autoTable(doc, {
      startY: y, margin: { left: ML, right: ML },
      head: [["Metric","Current","Optimized"]],
      body: [
        ["H₂ Cost (USD/year)", `$${costCurrM}M`, `$${costOptM}M`],
        ["CO₂ Emissions (tonnes/year)", fmt(co2Curr,0), fmt(co2Opt,0)],
        ["H₂ Production (kmol/h)", fmt(current.h2_production,1), fmt(optimized.h2_production,1)],
        ["SMR Conversion", `${(current.smr_conversion*100).toFixed(2)}%`, `${(optimized.smr_conversion*100).toFixed(2)}%`],
      ],
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9 }, alternateRowStyles: { fillColor: LIGHT },
      columnStyles: { 0: { cellWidth: 90 }, 1: { halign: "center" }, 2: { halign: "center", textColor: GREEN, fontStyle: "bold" } },
    });
    y = doc.lastAutoTable.finalY + 8;
    sectionTitle("AI Recommendations");
    (recommendations || []).forEach((rec, i) => {
      if (y + 8 > 280) { doc.addPage(); y = 14; }
      doc.setFillColor(...GREEN); doc.circle(ML+2.5, y+1.5, 2.5, "F");
      doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont("helvetica","bold");
      doc.text(String(i+1), ML+2.5, y+2.2, { align: "center" });
      doc.setTextColor(30,30,30); doc.setFontSize(9); doc.setFont("helvetica","normal");
      doc.text(rec, ML+8, y+2.2); y += 8;
    });
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...GRAY);
      doc.text(`Hydrogen Network Optimizer  |  Page ${i} of ${pageCount}`, 105, 290, { align: "center" });
    }
    doc.save("SMR_Scenario_Report.pdf");
  };

  const handleExportWord = async () => {
    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const cellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
    const makeRow = (label, curr, opt) => new TableRow({ children: [
      new TableCell({ borders: cellBorders, width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 22 })] })] }),
      new TableCell({ borders: cellBorders, width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: curr, alignment: AlignmentType.CENTER })] }),
      new TableCell({ borders: cellBorders, width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: opt, alignment: AlignmentType.CENTER })] }),
    ]});
    const { bytes: chartBytes, width: chartW, height: chartH } = await captureChartImage();
    const maxW = 500, scale = Math.min(1, maxW / chartW);
    const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children: [
      new Paragraph({ text: "SMR Scenario Report", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString()}`, color: "888888", size: 20 })], spacing: { after: 300 } }),
      ...(confidence ? [
        new Paragraph({ text: "Prediction Confidence", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ children: [new TextRun({ text: `${confidence.score}% — ${confidence.label}. ${confidence.note}`, size: 20 })], spacing: { after: 300 } }),
      ] : []),
      new Paragraph({ text: "Cost & Emissions Summary", heading: HeadingLevel.HEADING_2 }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        makeRow("H₂ Cost (USD/year)", `$${costCurrM}M`, `$${costOptM}M`),
        makeRow("CO₂ Emissions (tonnes/year)", fmt(co2Curr,0), fmt(co2Opt,0)),
        makeRow("H₂ Production (kmol/h)", fmt(current.h2_production,1), fmt(optimized.h2_production,1)),
      ]}),
      new Paragraph({ text: "", spacing: { after: 300 } }),
      new Paragraph({ text: "Performance Charts", heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ children: [new ImageRun({ data: chartBytes, transformation: { width: Math.round(chartW*scale), height: Math.round(chartH*scale) } })], spacing: { after: 300 } }),
      new Paragraph({ text: "AI Recommendations", heading: HeadingLevel.HEADING_2 }),
      ...(recommendations || []).map((rec, i) => new Paragraph({ children: [new TextRun({ text: `${i+1}.  ${rec}`, size: 22 })], spacing: { after: 120 } })),
    ]}]});
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "SMR_Scenario_Report.docx");
  };

  return (
    <div className="shared-page">
      <div className="shared-shell">

        <PageHeader subtitle="Optimization Results" />

        <div className="shared-page-card">
        <div className="page-heading">
          <div className="page-heading-left">
            <button className="page-back-btn" onClick={() => navigate("/")}>← Home</button>
            <div>
              <div className="page-heading-title">SMR Scenario Results</div>
              <div className="page-heading-sub">Current vs optimized performance · AI recommendations</div>
            </div>
          </div>
          <div className="page-heading-actions">
            <button
              className={`top-bookmark-star ${isBookmarked ? "active" : ""}`}
              onClick={handleBookmark}
              disabled={isBookmarked}
              title={isBookmarked ? "Already bookmarked" : "Bookmark this scenario"}
            >
              {isBookmarked ? "★ Saved" : "☆ Save"}
            </button>
            <button className="page-btn page-btn-solid" onClick={() => navigate("/smr")}>+ New Scenario</button>
          </div>
        </div>

        {/* ── Team Target Impact banners ── */}
        {targetImpacts.filter(imp => imp.is_new_record || imp.pct_delta > 0).map((imp, i) => (
          <div key={i} className={`record-banner${imp.is_new_record ? " record-banner-gold" : ""}`}>
            <span className="record-banner-trophy">{imp.is_new_record ? "🏆" : "⬆"}</span>
            <div className="record-banner-body">
              <span className="record-banner-title">
                {imp.is_new_record ? "New Team Record!" : "Target Progress"}
              </span>
              <span className="record-banner-text">
                <strong>{imp.label}</strong>:{" "}
                {imp.is_new_record
                  ? <>Best team value: <strong>{imp.new_val} {imp.unit}</strong></>
                  : <>Target "<em>{imp.target_name}</em>" advanced by <strong>+{imp.pct_delta}%</strong> → now at {imp.target_pct}%</>
                }
              </span>
            </div>
          </div>
        ))}

        <div className="results-grid" ref={reportRef} id="report-content">
          <div className="results-left">

            {/* H₂ Cost row */}
            <div className="cards-row">
              <div className="metric-card">
                <div className="metric-label">H₂ Cost — Current</div>
                <div className="metric-value">${costCurrM}M</div>
                <div className="metric-sub">/year</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">H₂ Cost — Optimized</div>
                <div className="metric-value">${costOptM}M</div>
                <div className="metric-sub">/year</div>
                <DeltaBadge pct={cost_improvement_pct} positiveIsGood={true} />
              </div>
            </div>

            {/* CO₂ row */}
            <div className="cards-row">
              <div className="metric-card">
                <div className="metric-label">CO₂ Emissions — Current</div>
                <div className="metric-value">{fmt(co2Curr / 1000, 1)}k</div>
                <div className="metric-sub">tonnes/year</div>
                <div className="metric-sub">{fmt(current.co2_mass_kgh, 0)} kg/h</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">CO₂ Emissions — Optimized</div>
                <div className="metric-value">{fmt(co2Opt / 1000, 1)}k</div>
                <div className="metric-sub">tonnes/year</div>
                <div className="metric-sub">{fmt(optimized.co2_mass_kgh, 0)} kg/h</div>
                <DeltaBadge pct={co2ImpPct} positiveIsGood={true} />
              </div>
            </div>

            {/* Performance KPIs */}
            <div className="section-title">Performance KPIs</div>
            <div className="kpi-card">
              <div>
                <div className="metric-label">H₂ Production — Current</div>
                <div className="kpi-value">{fmt(current.h2_production, 1)} kmol/h</div>
              </div>
              <div>
                <div className="metric-label">H₂ Production — Optimized</div>
                <div className="kpi-value green">{fmt(optimized.h2_production, 1)} kmol/h</div>
              </div>
              <div>
                <div className="metric-label">SMR Conversion</div>
                <div className="kpi-value">{(current.smr_conversion * 100).toFixed(2)}%</div>
              </div>
              <div>
                <div className="metric-label">CH₄ Slip</div>
                <div className="kpi-value">{(current.ch4_slip * 100).toFixed(2)}%</div>
              </div>
            </div>

            {/* Charts */}
            <div className="section-title">Performance Analysis</div>
            <div className="charts-row" ref={chartsRef}>
              <div className="chart-card">
                <div className="chart-label">Current vs Optimized</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: 10 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #E5E7EB" }} formatter={(val, name, props) => [`${val} ${props.payload.unit}`, name]} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 14 }} />
                    <Bar dataKey="Current"   fill="#9CA3AF" radius={[6,6,0,0]} />
                    <Bar dataKey="Optimized" fill="#14532D" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="chart-insight">
                  <span className="chart-insight-icon">💡</span>
                  <p className="chart-insight-text">{barInsight()}</p>
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-label">Your Inputs vs Optimized Inputs (% of range)</div>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData} margin={{ top: 8, right: 24, left: 24, bottom: 10 }}>
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis dataKey="param" tick={{ fontSize: 11, fontWeight: 600, fill: "#374151" }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "#9CA3AF" }} />
                    <Radar name="Current"   dataKey="Current"   stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.25} />
                    <Radar name="Optimized" dataKey="Optimized" stroke="#14532D" fill="#14532D" fillOpacity={0.35} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 14 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #E5E7EB" }} formatter={(val) => `${val}%`} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="chart-insight">
                  <span className="chart-insight-icon">💡</span>
                  <p className="chart-insight-text">{radarInsight()}</p>
                </div>
              </div>
            </div>

            {/* Sensitivity Analysis */}
            <div className="section-title">Parameter Influence Analysis</div>
            {!sensitivity ? (
              <div className="sens-loading">Analyzing parameter influence…</div>
            ) : (
              <div className="chart-card">
                <div className="chart-label">How much each input drives H₂ production, cost &amp; CO₂ (% of max impact)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sensitivity.map(d => ({ ...d, param: SHORT_NAMES[d.param] || d.param }))} margin={{ top: 8, right: 16, left: 0, bottom: 16 }} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="param" tick={{ fontSize: 12, fontWeight: 600, fill: "#374151" }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #E5E7EB" }} formatter={(val, name) => [`${val}%`, name]} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 14 }} />
                    <Bar dataKey="h2_score"   name="H₂ Production" fill="#14532D" radius={[4,4,0,0]} />
                    <Bar dataKey="cost_score" name="H₂ Cost"       fill="#F59E0B" radius={[4,4,0,0]} />
                    <Bar dataKey="co2_score"  name="CO₂ Emissions" fill="#6B7280" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="chart-insight">
                  <span className="chart-insight-icon">💡</span>
                  <p className="chart-insight-text">{sensitivityInsight()}</p>
                </div>
              </div>
            )}

            {/* Flow Network */}
            <div className="section-title">Predicted Hydrogen Flow Network</div>
            <div className="flow-diagram">
              <div className="flow-inputs">
                <FlowNode label="CH₄ Feed" value={fmt(current.h2_production / (current.smr_conversion || 1), 0)} unit="kmol/h" />
                <FlowNode label="Steam"    value={fmt(current.steam_consumption, 0)}                            unit="kmol/h" />
              </div>
              <Arrow />
              <FlowNode label="SMR Reactor" value={fmt(current.syngas_flow, 0)}  unit="kmol/h syngas" accent />
              <Arrow />
              <FlowNode label="PSA Unit"    value={fmt(current.h2_to_psa, 0)}    unit="kmol/h H₂ in"  accent />
              <Arrow />
              <div className="flow-outputs">
                <FlowNode label="H₂ Product" value={fmt(current.h2_production, 0)} unit="kmol/h" />
                <FlowNode label="CO₂ Out"    value={fmt(current.co2_flow_kmolh, 0)} unit="kmol/h" />
              </div>
            </div>
            <div className="chart-insight" style={{ marginTop: 12 }}>
              <span className="chart-insight-icon">💡</span>
              <p className="chart-insight-text">{flowInsight()}</p>
            </div>

          </div>

          {/* ── Right sidebar ── */}
          <div className="results-right">

            {/* Optimized Parameters */}
            <div className="side-card">
              <div className="section-title">Optimized Parameters</div>
              <div className="opt-params-list">
                {[
                  ["CH₄ Feed",       optimized_params.ch4_feed,         "kgmol/h"],
                  ["Steam Flowrate", optimized_params.steam_flowrate,   "kgmol/h"],
                  ["SMR Temperature",optimized_params.smr_temp,         "°C"],
                  ["SMR Pressure",   optimized_params.smr_pressure_kpa, "kPa"],
                  ["HTS Temperature",optimized_params.hts_temp,         "°C"],
                ].map(([label, val, unit]) => (
                  <div className="opt-param-row" key={label}>
                    <span className="opt-param-label">{label}</span>
                    <span className="opt-param-value">{val} <em>{unit}</em></span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="side-card">
              <div className="section-title">AI Recommendations</div>
              <div className="ai-rec-list">
                {(recommendations || []).map((rec, i) => (
                  <div className="ai-rec-item" key={i}>
                    <div className="ai-rec-index">{i + 1}</div>
                    <div className="ai-rec-body">
                      <div className="ai-rec-text">{rec}</div>
                      <div className="ai-rec-meta">
                        REC-{String(i + 1).padStart(3, "0")} &bull;{" "}
                        {i === 0 ? "High Priority" : i === 1 ? "Medium Priority" : "Standard"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Optimized Outputs */}
            <div className="side-card" style={{ marginTop: 14 }}>
              <div className="section-title">Optimized Outputs</div>
              <div className="opt-params-list">
                {[
                  ["H₂ Production",  `${fmt(optimized.h2_production, 1)} kmol/h`, true],
                  ["H₂ Cost",        `$${(optimized.h2_cost / 1e6).toFixed(2)}M /yr`, true],
                  ["CO₂ Emissions",  `${fmt(co2Opt / 1000, 1)}k t/yr`, false],
                  ["SMR Conversion", `${(optimized.smr_conversion * 100).toFixed(2)}%`, false],
                ].map(([label, val, green]) => (
                  <div className="opt-param-row" key={label}>
                    <span className="opt-param-label">{label}</span>
                    <span className={`opt-param-value${green ? " green" : ""}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Export bar */}
        <div className="export-bar">
          <div className="export-group">
            <div className="export-group-label">Export Report</div>
            <div className="export-group-btns">
              <button className="export-btn export-btn-pdf" onClick={handleExportPDF}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                <div className="export-btn-text"><span className="export-btn-title">Export PDF</span><span className="export-btn-sub">Visual report with charts</span></div>
              </button>
              <button className="export-btn export-btn-word" onClick={handleExportWord}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <div className="export-btn-text"><span className="export-btn-title">Export Word</span><span className="export-btn-sub">Tables, charts & data</span></div>
              </button>
              <button className="export-btn export-btn-email" onClick={() => { setEmailModal(true); setEmailStatus(null); setEmailTo(""); setEmailMessage(""); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <div className="export-btn-text"><span className="export-btn-title">Email Report</span><span className="export-btn-sub">Send to any inbox</span></div>
              </button>
            </div>
          </div>
        </div>

        {/* Annotation Modal — unchanged from original */}
        {showAnnotationModal && (
          <div className="annotation-overlay" onClick={() => setShowAnnotationModal(false)}>
            <div className="annotation-modal" onClick={e => e.stopPropagation()}>
              <div className="annotation-modal-header">
                <h2>Save Scenario</h2>
                <button className="annotation-modal-close" onClick={() => setShowAnnotationModal(false)}>✕</button>
              </div>
              <div className="annotation-modal-body">
                <div className="annotation-form-group">
                  <label className="annotation-label">Description (optional)</label>
                  <input type="text" className="annotation-input" placeholder="Brief description…" value={annotationForm.description} onChange={e => setAnnotationForm({ ...annotationForm, description: e.target.value })} />
                </div>
                <div className="annotation-form-group">
                  <label className="annotation-label">Tags</label>
                  <div className="annotation-tags">
                    {["baseline","optimized","experimental"].map(tag => (
                      <label key={tag} className="annotation-tag-label">
                        <input type="checkbox" checked={annotationForm.tags.includes(tag)} onChange={e => setAnnotationForm({ ...annotationForm, tags: e.target.checked ? [...annotationForm.tags, tag] : annotationForm.tags.filter(t => t !== tag) })} />
                        <span className={`annotation-tag-badge annotation-tag-${tag}`}>{tag}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="annotation-form-group">
                  <label className="annotation-label">Notes (optional)</label>
                  <textarea className="annotation-textarea" placeholder="Add notes…" value={annotationForm.notes} onChange={e => setAnnotationForm({ ...annotationForm, notes: e.target.value })} rows={4} />
                </div>
              </div>
              <div className="annotation-modal-footer">
                <button className="annotation-cancel-btn" onClick={() => setShowAnnotationModal(false)}>Cancel</button>
                <button className="annotation-save-btn" onClick={handleConfirmBookmark}>Save Bookmark</button>
              </div>
            </div>
          </div>
        )}

        {/* Email Modal — unchanged from original */}
        {emailModal && (
          <div className="email-overlay" onClick={() => setEmailModal(false)}>
            <div className="email-modal" onClick={e => e.stopPropagation()}>
              <div className="email-modal-header">
                <div>
                  <div className="email-modal-title">Email Report</div>
                  <div className="email-modal-sub">Send results to any email address</div>
                </div>
                <button className="email-modal-close" onClick={() => setEmailModal(false)}>✕</button>
              </div>
              {emailStatus === "sent" ? (
                <div className="email-success">
                  <div className="email-success-icon">✓</div>
                  <div className="email-success-title">Report sent!</div>
                  <div className="email-success-sub">Check <strong>{emailTo}</strong> for the report.</div>
                  <button className="email-done-btn" onClick={() => setEmailModal(false)}>Done</button>
                </div>
              ) : (
                <>
                  <div className="email-modal-body">
                    <label className="email-label">Recipient email</label>
                    <input className="email-input" type="email" placeholder="engineer@company.com" value={emailTo} onChange={e => { setEmailTo(e.target.value); setEmailStatus(null); }} autoFocus />
                    <label className="email-label" style={{ marginTop: 14 }}>Personal message <span style={{ fontWeight: 500, color: "#9CA3AF" }}>(optional)</span></label>
                    <textarea className="email-input email-textarea" placeholder="Add a note…" value={emailMessage} onChange={e => setEmailMessage(e.target.value)} rows={3} />
                    {emailStatus === "error" && <div className="email-error">{emailError || "Failed to send."}</div>}
                  </div>
                  <div className="email-modal-footer">
                    <button className="email-cancel-btn" onClick={() => setEmailModal(false)}>Cancel</button>
                    <button className="email-send-btn" onClick={handleSendEmail} disabled={emailStatus === "sending" || !emailTo.trim()}>{emailStatus === "sending" ? "Sending…" : "Send Report"}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        </div> {/* shared-page-card */}
      </div>
    </div>
  );
}
