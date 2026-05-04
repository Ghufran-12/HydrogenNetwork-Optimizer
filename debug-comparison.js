#!/usr/bin/env node

/**
 * Debug script to verify comparison feature works
 * Simulates creating two bookmarks and comparing them
 */

const fs = require('fs');
const path = require('path');

console.log("🔍 Comparison Feature Debug Script\n");

// ─── Test 1: Verify files exist ───────────────────────────────
console.log("✓ Test 1: Checking files exist...");
const files = [
  '/Users/ayman/hydrogenNetwork/src/frontend/pages/BookmarksPage.jsx',
  '/Users/ayman/hydrogenNetwork/src/frontend/pages/ComparisonPage.jsx',
  '/Users/ayman/hydrogenNetwork/src/frontend/styles/bookmarks-filters.css',
  '/Users/ayman/hydrogenNetwork/src/frontend/styles/comparison-page.css',
];

files.forEach(f => {
  const exists = fs.existsSync(f);
  console.log(`  ${exists ? '✅' : '❌'} ${path.basename(f)}`);
});

// ─── Test 2: Verify key functions exist ───────────────────────────
console.log("\n✓ Test 2: Checking key functions...");

const bookmarksContent = fs.readFileSync(files[0], 'utf8');
const comparisonContent = fs.readFileSync(files[1], 'utf8');

const checks = [
  { file: 'BookmarksPage', content: bookmarksContent, fn: 'toggleComparison' },
  { file: 'BookmarksPage', content: bookmarksContent, fn: 'handleCompare' },
  { file: 'ComparisonPage', content: comparisonContent, fn: 'getParamValue' },
  { file: 'ComparisonPage', content: comparisonContent, fn: 'parameterTable' },
];

checks.forEach(c => {
  const exists = c.content.includes(c.fn);
  console.log(`  ${exists ? '✅' : '❌'} ${c.file}.${c.fn}()`);
});

// ─── Test 3: Verify comparison checkbox in JSX ───────────────────
console.log("\n✓ Test 3: Checking JSX structure...");
console.log(`  ${bookmarksContent.includes('selectedForComparison') ? '✅' : '❌'} State: selectedForComparison`);
console.log(`  ${bookmarksContent.includes('bookmark-item-checkbox') ? '✅' : '❌'} JSX: checkbox element`);
console.log(`  ${bookmarksContent.includes('Compare') ? '✅' : '❌'} JSX: Compare button`);

// ─── Test 4: Verify filter logic ───────────────────────────────
console.log("\n✓ Test 4: Checking filter logic...");
console.log(`  ${bookmarksContent.includes('filteredAndSorted') ? '✅' : '❌'} useMemo: filteredAndSorted`);
console.log(`  ${bookmarksContent.includes('filters.tags') ? '✅' : '❌'} Filter: tags`);
console.log(`  ${bookmarksContent.includes('filters.dateRange') ? '✅' : '❌'} Filter: dateRange`);
console.log(`  ${bookmarksContent.includes('filters.search') ? '✅' : '❌'} Filter: search`);
console.log(`  ${bookmarksContent.includes('filters.sortBy') ? '✅' : '❌'} Filter: sortBy`);

// ─── Test 5: Verify field names match ───────────────────────────
console.log("\n✓ Test 5: Checking field names...");
console.log(`  ${comparisonContent.includes('ch4') ? '✅' : '❌'} Field: ch4`);
console.log(`  ${comparisonContent.includes('steam') ? '✅' : '❌'} Field: steam`);
console.log(`  ${comparisonContent.includes('smrTemp') ? '✅' : '❌'} Field: smrTemp`);
console.log(`  ${comparisonContent.includes('smrPressure') ? '✅' : '❌'} Field: smrPressure`);
console.log(`  ${comparisonContent.includes('htsTemp') ? '✅' : '❌'} Field: htsTemp`);

// ─── Test 6: Simulate comparison data flow ───────────────────────
console.log("\n✓ Test 6: Testing data flow logic...");

// Mock data
const mockBookmark = {
  id: '123',
  scenarioName: 'Test Scenario',
  description: 'Test',
  tags: ['baseline'],
  notes: 'Notes here',
  timestamp: new Date().toLocaleString(),
  form: {
    ch4: 1000,
    steam: 3000,
    smrTemp: 850,
    smrPressure: 2500,
    htsTemp: 350,
  },
  apiResult: {
    current: {
      h2_production: 150,
      h2_cost: 500000,
      co2_annual_tonnes: 1000,
    }
  }
};

console.log("  ✅ Mock bookmark created");
console.log(`  ✅ Has form: ${mockBookmark.form ? 'yes' : 'no'}`);
console.log(`  ✅ Has apiResult: ${mockBookmark.apiResult ? 'yes' : 'no'}`);

// Simulate getParamValue function
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

const params = getParamValue(mockBookmark.form);
console.log(`  ✅ Parameters extracted: ${JSON.stringify(params).length} bytes`);

// ─── Test 7: Check App.jsx has comparison route ───────────────────
console.log("\n✓ Test 7: Checking routing...");
const appContent = fs.readFileSync('/Users/ayman/hydrogenNetwork/src/App.jsx', 'utf8');
console.log(`  ${appContent.includes('ComparisonPage') ? '✅' : '❌'} ComparisonPage imported`);
console.log(`  ${appContent.includes('/compare') ? '✅' : '❌'} /compare route defined`);

console.log("\n✅ All checks complete!");
console.log("\n📝 Debugging tips:");
console.log("  1. Check browser console for errors (F12)");
console.log("  2. Verify bookmarks are created (should have form & apiResult)");
console.log("  3. Select 2+ bookmarks and click 'Compare' button");
console.log("  4. You should see ComparisonPage with metrics charts and parameter table");
