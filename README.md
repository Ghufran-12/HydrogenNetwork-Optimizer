---

# 🧪 Hydrogen Network Optimizer

Industrial Decision Support System for Hydrogen Network Optimization
ICS Final Design Project

---

## 📌 Project Overview

The **Hydrogen Network Optimizer** is a React-based industrial decision-support interface designed to simulate and optimize Steam Methane Reforming (SMR) operations within a hydrogen refinery network.

This frontend system connects to a FastAPI backend that runs:

* AI Digital Twin predictions
* Optimization algorithms
* Cost & CO₂ performance evaluation

The system does **not directly control plant hardware**.
It provides structured operational scenarios for optimization analysis.

---

# 🏗️ Project Architecture

The complete ICS system consists of:

1. **AI Digital Twin Model**
2. **Python Optimization Engine**
3. **FastAPI Backend Layer**
4. **React Decision-Support Interface (This Repository)**

---

# 📂 Project File Structure

```
HYDROGENNETWORK/
│
├── public/
│   └── index.html
│
├── src/
│   ├── components/
│   │   ├── SMR.jsx
│   │   └── SMRScenarioStudio.jsx
│   │
│   ├── pages/
│   │   └── SMRPage.jsx
│   │
│   ├── styles/
│   │   └── smr-studio.css
│   │
│   ├── App.jsx
│   └── index.js
│
├── package.json
└── package-lock.json
```

---

# 🧠 Module Description

## 🔹 SMRScenarioStudio.jsx

Main decision-support interface that allows users to:

* Configure SMR operating variables
* Toggle advanced controls
* View live estimated trends
* Generate AI-based recommendations

This is the core UI module.

---

## 🔹 SMR.jsx

Reusable SMR component logic (if applicable).
Contains internal modular UI logic for SMR-related elements.

---

## 🔹 SMRPage.jsx

Page-level container that renders the SMR Scenario Studio.

Example usage inside `App.jsx`:

```javascript
import SMRPage from "./pages/SMRPage";

function App() {
  return <SMRPage />;
}

export default App;
```

---

## 🔹 smr-studio.css

Professional industrial UI styling:

* Clean white layout
* Structured input sections
* Industrial green primary action button
* Minimal visual noise
* Safety validation highlighting

---

# ⚙️ SMR Controllable Variables

## Basic Controls

| Variable                   | Description                                        |
| -------------------------- | -------------------------------------------------- |
| CH₄ Feed Flowrate (kmol/h) | Controls hydrogen production capacity              |
| Steam-to-Carbon Ratio      | Affects reforming conversion & CO₂ formation       |
| SMR Temperature (°C)       | Impacts equilibrium & furnace duty                 |
| SMR Pressure (bar)         | Influences reaction shift & downstream feasibility |
| HTS Conversion (0–1)       | Water-Gas Shift conversion efficiency              |
| PSA Recovery (0–1)         | Hydrogen recovery efficiency                       |
---


# 📤 Example Payload Sent to Backend

```json
{
  "ch4FeedKmolH": 1200,
  "steamToCarbon": 3,
  "smrTempC": 850,
  "smrPressureBar": 25,
  "htsConversion": 0.85,
  "psaRecovery": 0.85,
  "mode": "advanced"
}
```

---

# 🔗 Backend Integration (FastAPI)

Example connection:

```javascript
const response = await fetch("http://localhost:8000/recommend", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const data = await response.json();
```

Backend responsibilities:

* AI prediction
* Optimization calculations
* CO₂ reduction analysis
* Cost evaluation
* Recommendation generation

---

# 🛡️ Validation & Safety Rules

The frontend enforces:

* Required input validation
* Operational safety bounds
* Error highlighting

### Example Constraints

| Variable        | Min   | Max    |
| --------------- | ----- | ------ |
| CH₄ Feed        | 0     | 10000  |
| Steam-to-Carbon | 1     | 6      |
| Temperature     | 600°C | 1100°C |
| Pressure        | 1 bar | 60 bar |
| HTS             | 0     | 1      |
| PSA             | 0     | 1      |


---

# 🚀 How to Run the Project

## 1️⃣ Install Dependencies

```bash
npm install
```

## 2️⃣ Start Development Server

```bash
npm start
```

The app runs on:

```
http://localhost:3000
```

---

# 🧩 Future Enhancements

* Arabic / English bilingual support
* Scenario comparison (Baseline vs Optimized)
* Real-time KPI visualization panel
* Export recommendation report (PDF)
* Save & load scenario history
* Role-based access control

---






