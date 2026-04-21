// Light unit tests for the pure tax helpers inside roth_conversion_tool.html.
// Complements sanity_check.js (invariants over full simulations) and
// verify_html.js (regression on pinned totals). These tests target individual
// functions with hand-computable inputs.
//
// Run:  node unit_tests.js

const fs = require('fs');
const html = fs.readFileSync('roth_conversion_tool.html', 'utf8');
const m = html.match(/<script>\s*\/\*[\s\S]*?<\/script>/g);
const js = m[0].replace(/<\/?script[^>]*>/g, '');
// Stub DOM so the inline script doesn't blow up during eval (readInputs etc.
// are defined but not called here — we only need the helpers in scope).
global.document = {
  getElementById: () => ({ value: 0 }),
  querySelector: () => ({ innerHTML: '' }),
  querySelectorAll: () => [],
  addEventListener: () => {},
};
global.Chart = function(){this.destroy=()=>{};};
global.alert = () => {};
// Evaluate everything up through the helpers (stop before run()).
eval(js.split('function run()')[0]);

let passed = 0, failed = 0;
function eq(actual, expected, label, tol = 0.01) {
  const diff = Math.abs(actual - expected);
  if (diff <= tol) { console.log(`OK:   ${label}  (got ${actual})`); passed++; }
  else { console.log(`FAIL: ${label}  expected ${expected}, got ${actual} (diff ${diff})`); failed++; }
}
function is(actual, expected, label) {
  if (actual === expected) { console.log(`OK:   ${label}  (got ${actual})`); passed++; }
  else { console.log(`FAIL: ${label}  expected ${expected}, got ${actual}`); failed++; }
}
function section(s) { console.log(`\n--- ${s} ---`); }

/* ------------------------------------------------------------------ */
section('bracketTax / topBracket');
// Simple 2-bracket schedule: 10% to 100, 20% above.
const B = [{ top: 100, rate: 0.10 }, { top: Infinity, rate: 0.20 }];
eq(bracketTax(0, B),      0,   'bracketTax: $0 income');
eq(bracketTax(50, B),     5,   'bracketTax: fully in 10% band');
eq(bracketTax(100, B),    10,  'bracketTax: exactly top of 10%');
eq(bracketTax(150, B),    20,  'bracketTax: 100*.10 + 50*.20');
eq(bracketTax(-50, B),    0,   'bracketTax: negative input clamps to 0');
is(topBracket(50, B),     0.10, 'topBracket: within first band');
is(topBracket(150, B),    0.20, 'topBracket: in second band');

/* ------------------------------------------------------------------ */
section('federalTax (MFJ 2026, no inflation)');
// $100,000 taxable, MFJ, 2026: 24,450*.10 + (99,370-24,450)*.12 + (100,000-99,370)*.22
// = 2,445 + 8,990.40 + 138.60 = 11,574
const ft = federalTax(100000, 2026, 'MFJ', 0.025);
eq(ft.tax, 2445 + (99370-24450)*0.12 + (100000-99370)*0.22, 'MFJ $100K hand-computed');
is(ft.topRate, 0.22, 'MFJ $100K top rate = 22%');

// Single, $50K: 12,225*.10 + (49,685-12,225)*.12 + (50,000-49,685)*.22
const fs_ = federalTax(50000, 2026, 'Single', 0.025);
eq(fs_.tax, 1222.50 + (49685-12225)*0.12 + (50000-49685)*0.22, 'Single $50K hand-computed');
is(fs_.topRate, 0.22, 'Single $50K top rate = 22%');

// Inflation: 2030 MFJ, $100K. The 12% top inflates from $99,370 → $99,370 × 1.025^4.
const ft2030 = federalTax(100000, 2030, 'MFJ', 0.025);
const infl4 = Math.pow(1.025, 4);
const top12_2030 = 99370 * infl4;
// $100K still within 12% band in 2030 because 99,370*1.025^4 ≈ 109,681 > 100,000.
is(ft2030.topRate, 0.12, '2030 MFJ $100K drops into 12% band (inflation)');

/* ------------------------------------------------------------------ */
section('federalTaxSplit (LTCG stacking)');
// Case A: ord $50K, qdiv $30K, MFJ 2026. Total $80K; LTCG 0% top = $99,370 so
// all qdiv sits in 0% band. qdivTax = 0.
const splitA = federalTaxSplit(50000, 30000, 2026, 'MFJ', 0.025);
eq(splitA.qdivTax, 0, 'MFJ: qdiv entirely in 0% LTCG band');
is(splitA.topRate, 0.12, 'MFJ: top ord rate when ord=$50K is 12%');
// ordTax = 2,445 + (50,000-24,450)*.12 = 2,445 + 3,066 = 5,511
eq(splitA.ordTax, 2445 + (50000-24450)*0.12, 'MFJ split: ord tax');

// Case B: ord $150K, qdiv $30K, MFJ 2026. Top of 0% = 99,370 so stack from
// 150K (> 99,370) entirely in 15% band; qdivTax = 30,000 * 0.15 = 4,500.
const splitB = federalTaxSplit(150000, 30000, 2026, 'MFJ', 0.025);
eq(splitB.qdivTax, 30000 * 0.15, 'MFJ: qdiv entirely in 15% LTCG band');
is(splitB.topRate, 0.22, 'MFJ: top ord rate when ord=$150K is 22%');

// Case C: ord $80K, qdiv $30K → stack spans 80K→110K. 0% ends at 99,370.
// in0 = 99,370-80,000 = 19,370 at 0%; in15 = 30,000-19,370 = 10,630 at 15%.
const splitC = federalTaxSplit(80000, 30000, 2026, 'MFJ', 0.025);
eq(splitC.qdivTax, (30000 - (99370-80000)) * 0.15, 'MFJ: qdiv straddles 0%/15% boundary');

// Case D: very high income pushes qdiv into 20% band (MFJ top15 = 616,675).
const splitD = federalTaxSplit(700000, 50000, 2026, 'MFJ', 0.025);
eq(splitD.qdivTax, 50000 * 0.20, 'MFJ: qdiv entirely in 20% LTCG band');
is(splitD.topRate, 0.35, 'MFJ: top ord rate when ord=$700K is 35%');

// Case E: ordTax + qdivTax must equal .tax total.
eq(splitC.ordTax + splitC.qdivTax, splitC.tax, 'split C: ord + qdiv = total');

/* ------------------------------------------------------------------ */
section('njTax');
// NJ MFJ on $100K: 20K*.014 + 30K*.0175 + 20K*.0245 + 10K*.035 + 20K*.05525
// = 280 + 525 + 490 + 350 + 1105 = 2,750
eq(njTax(100000, 'MFJ'), 2750, 'NJ MFJ $100K hand-computed');
eq(njTax(0, 'MFJ'),      0,    'NJ $0 income');
eq(njTax(-50, 'MFJ'),    0,    'NJ negative income clamps to 0');

/* ------------------------------------------------------------------ */
section('njPensionExclusion (100K cliff, MFJ)');
// Base = $100K for MFJ
eq(njPensionExclusion(80000,  'MFJ'), 100000, 'MFJ ≤ $100K → full $100K');
eq(njPensionExclusion(100000, 'MFJ'), 100000, 'MFJ at $100K boundary → full');
eq(njPensionExclusion(110000, 'MFJ'), 50000,  'MFJ $100K-$125K → 50%');
eq(njPensionExclusion(140000, 'MFJ'), 25000,  'MFJ $125K-$150K → 25%');
eq(njPensionExclusion(150001, 'MFJ'), 0,      'MFJ > $150K → $0');

/* ------------------------------------------------------------------ */
section('taxableSocialSecurity');
// MFJ thresholds: t1=$32K, t2=$44K. SS below t1 → $0.
// ss=20K, other=0: prov = 0.5*20K = 10K ≤ 32K → $0 taxable
eq(taxableSocialSecurity(20000, 0, 0, 'MFJ'), 0, 'MFJ low income: 0% of SS taxable');
// ss=20K, other=30K: prov = 30K + 0 + 10K = 40K. Between t1/t2.
// taxable = min(0.5*(40K-32K), 0.5*20K) = min(4,000, 10,000) = 4,000
eq(taxableSocialSecurity(20000, 30000, 0, 'MFJ'), 4000, 'MFJ mid income: 50% ramp');
// ss=20K, other=60K: prov = 60K + 10K = 70K > 44K.
// part1 = min(0.5*20K, 0.5*(44K-32K)) = min(10K, 6K) = 6K
// part2 = 0.85*(70K-44K) = 22.1K; total = 28.1K; cap = 0.85*20K = 17K → 17K
eq(taxableSocialSecurity(20000, 60000, 0, 'MFJ'), 17000, 'MFJ high income: capped at 85%');
// Muni interest counts toward provisional income:
// ss=20K, other=20K, muni=20K: prov = 20K + 20K + 10K = 50K > 44K → same calc
// part1 = 6K, part2 = 0.85*(50K-44K) = 5.1K, total 11.1K (< 17K cap) → 11.1K
eq(taxableSocialSecurity(20000, 20000, 20000, 'MFJ'), 11100, 'MFJ: muni interest counts toward provisional');

/* ------------------------------------------------------------------ */
section('obbbaSeniorDeduction');
// 2 qualifying, MFJ, MAGI = $100K (< $150K phase start) → full $12K
eq(obbbaSeniorDeduction(100000, 2, 'MFJ', 2026), 12000, 'MFJ MAGI<$150K: full $12K for 2 seniors');
// MAGI = $200K → phaseout = ($200K - $150K)*.06 = $3,000 → $12K - $3K = $9K
eq(obbbaSeniorDeduction(200000, 2, 'MFJ', 2026), 9000,  'MFJ MAGI $200K: $3K phaseout');
// MAGI high enough to fully phase out: base/rate + start
eq(obbbaSeniorDeduction(400000, 2, 'MFJ', 2026), 0,     'MFJ high MAGI: fully phased out');
// After 2028 sunset → $0 regardless
eq(obbbaSeniorDeduction(100000, 2, 'MFJ', 2029), 0,     'Post-2028 sunset: $0');
// Only one qualifying senior
eq(obbbaSeniorDeduction(100000, 1, 'MFJ', 2026), 6000,  '1 qualifying senior: $6K');

/* ------------------------------------------------------------------ */
section('irmaaTier (2026 MFJ, no inflation applied to 2026)');
// Function returns ANNUAL surcharge per beneficiary (monthly * 12).
eq(irmaaTier(150000, 'MFJ', 2026, 0.025).surcharge, 0,              'Tier 0 (<=$218K): $0');
eq(irmaaTier(250000, 'MFJ', 2026, 0.025).surcharge, (81.20+14.50)*12,  'Tier 1 ($218-274K)');
eq(irmaaTier(300000, 'MFJ', 2026, 0.025).surcharge, (202.90+37.50)*12, 'Tier 2 ($274-342K)');
eq(irmaaTier(400000, 'MFJ', 2026, 0.025).surcharge, (324.60+60.40)*12, 'Tier 3 ($342-410K)');
eq(irmaaTier(600000, 'MFJ', 2026, 0.025).surcharge, (446.30+86.80)*12, 'Tier 4 ($410-750K)');
eq(irmaaTier(900000, 'MFJ', 2026, 0.025).surcharge, (487.00+86.80)*12, 'Tier 5 (>$750K)');
// Single thresholds = MFJ/2. At $110K single, that's above tier-0 top of $109K.
eq(irmaaTier(110000, 'Single', 2026, 0.025).surcharge, (81.20+14.50)*12, 'Single tier 1 (MFJ/2)');

/* ------------------------------------------------------------------ */
section('inflate');
eq(inflate(100, 2026, 0.025), 100,                     'inflate: year 0 = identity');
eq(inflate(100, 2027, 0.025), 102.5,                   'inflate: +1 year at 2.5%');
eq(inflate(100, 2036, 0.025), 100 * Math.pow(1.025,10), 'inflate: +10 years compounding', 0.001);

/* ------------------------------------------------------------------ */
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
