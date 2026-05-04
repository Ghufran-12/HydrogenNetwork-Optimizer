#!/usr/bin/env node

/**
 * Debugging Guide for Relative Improvements Chart
 * 
 * The chart shows percentage changes relative to the first (baseline) scenario.
 * If values look wrong, follow these steps:
 */

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║         Relative Improvements Chart - Debugging Guide                     ║
╚════════════════════════════════════════════════════════════════════════════╝

🔍 STEP 1: Check Browser Console (F12 → Console)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You should see logs like:
  [MetricsComparison] Scenario A:
    h2Production: 150.5
    h2Cost: 0.523
    co2Annual: 1.234
    
  [Improvements] Scenario A:
    baseline: { h2Prod: 150.5, h2Cost: 0.523, co2: 1.234 }
    current: { h2Prod: 150.5, h2Cost: 0.523, co2: 1.234 }
    changes: { h2ProdChange: 0, costChange: 0, co2Change: 0 }

  [Improvements] Scenario B:
    baseline: { h2Prod: 150.5, h2Cost: 0.523, co2: 1.234 }
    current: { h2Prod: 180.2, h2Cost: 0.470, co2: 0.950 }
    changes: { h2ProdChange: 19.7, costChange: -10.1, co2Change: -23.0 }


🔍 STEP 2: Verify Data Flow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Bookmarks are being loaded from localStorage
✓ Each bookmark has:
  - form: { ch4, steam, smrTemp, smrPressure, htsTemp }
  - apiResult: { 
      current: { h2_production, h2_cost, co2_annual_tonnes },
      predictions: { h2_production }
    }

If apiResult is missing or null, the metrics will be 0!


🔍 STEP 3: Check Metric Extraction
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The code checks TWO places for h2_production:
  1. bm.apiResult.predictions.h2_production  (optimized)
  2. bm.apiResult.current.h2_production      (actual)

And for costs/emissions:
  1. bm.apiResult.current.h2_cost
  2. bm.apiResult.current.co2_annual_tonnes

If both are missing → metric = 0


🔍 STEP 4: Manual Calculation Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If Scenario A (baseline) has:
  - h2Production = 150
  - h2Cost = 0.5

And Scenario B has:
  - h2Production = 180
  - h2Cost = 0.45

Then expected improvements for Scenario B:
  h2ProdChange = ((180 - 150) / 150) * 100 = 20%
  costChange = ((0.45 - 0.5) / 0.5) * 100 = -10%


🔍 STEP 5: Common Issues & Fixes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Chart shows all zeros?
  → apiResult is missing from bookmarks
  → Check if you properly saved bookmarks with "View Results →" button
  → Verify ResultsPage.jsx passes form + apiResult to bookmark

❌ Chart shows wrong percentages?
  → Wrong field names being extracted
  → Baseline is not the first selected scenario
  → Math error (check logs!)

❌ Chart won't render?
  → improvements array is empty
  → Check fallback message: "Unable to calculate improvements..."
  → Verify metricsComparison has data (check logs)


📊 STEP 6: Test With Real Data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Run a scenario (form inputs)
2. Click "View Results →" and "Save Bookmark"
3. Go back and run ANOTHER scenario with different parameters
4. Click bookmark star and save
5. Go to Bookmarks → Select both → Click "Compare 2 Scenarios"
6. Open F12 Console and look for logs
7. Check if improvements show percentage changes


✅ WHAT SHOULD HAPPEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When comparing Scenario A vs Scenario B:
  - Bar 1 (Scenario A): All zeros (baseline)
  - Bar 2 (Scenario B): Shows +/- percentages
  - Bar 3 (if exists): Shows +/- percentages
  
Example output:
  Scenario A: H₂ Prod: 0%, Cost: 0%, CO₂: 0%
  Scenario B: H₂ Prod: +15%, Cost: -8%, CO₂: -12%
  Scenario C: H₂ Prod: +22%, Cost: +3%, CO₂: -5%


🚨 IF STILL BROKEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Copy console logs and check:
  1. Are the h2Production/h2Cost/co2Annual values being extracted?
  2. Are they the correct magnitudes? (e.g., h2Cost should be ~0.5 for M$/yr, not 500000)
  3. Is baseline different from the other scenarios?
  4. Are the percentage calculations mathematically correct?

The debug logs will tell you exactly what's happening! 🔍
`);
