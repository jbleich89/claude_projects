// Comprehensive sanity check after recent edits.
const fs = require('fs');
const html = fs.readFileSync('roth_conversion_tool.html', 'utf8');
const m = html.match(/<script>\s*\/\*[\s\S]*?<\/script>/g);
const js = m[0].replace(/<\/?script[^>]*>/g, '');
const defaults = {
  dad_birth: 1957, mom_birth: 1961, dad_retire: 2028, mom_retire: 2026,
  dad_death: 90, mom_death: 90, dad_wage: 70000, mom_wage_2026: 22000,
  dad_ss: 40000, mom_ss: 22000, dad_ss_year: 2027, mom_ss_year: 2026,
  dad_ira: 350000, mom_ira: 700000, taxable: 3250000, roth: 0,
  taxable_basis: 2500000, survivor_spend_pct: 80,
  dad_nj_basis: 30000, yld_int: 1.26, yld_qdiv: 0.77, yld_muni: 0.52,
  ret_ira: 7.5, ret_roth: 7.5, ret_tax: 6.0, infl: 2.5, spend: 75000,
  heir_a_share: 50, heir_b_share: 50, heir_a_rate: 47.75, heir_b_rate: 30.37,
  strategy: '24', custom_amt: 0, irmaa_cap: 342000,
  conv_source: 'dad_first', state_tax: 'NJ'
};
global.document = {
  getElementById: (id) => ({ value: defaults[id] }),
  querySelector: () => ({ innerHTML: '' }),
  querySelectorAll: () => [],
  addEventListener: () => {},
};
global.Chart = function(){this.destroy=()=>{};};
global.alert = () => {};
const funcCode = js.split('function run()')[0];
eval(funcCode);

let issues = 0;
const fail = (msg) => { console.log('FAIL: ' + msg); issues++; };
const ok = (msg) => console.log('OK:   ' + msg);

// Test 1: fedOrdTax + fedLtcgTax == fedTax for every year, every strategy
const strategies = ['none','12','22','fixed100','fixed150','niit','24half','24','irmaa','32'];
for (const s of strategies) {
  const sim = simulate(readInputs(), s);
  let maxDiff = 0, maxYr = 0;
  for (const y of sim.years) {
    const d = Math.abs((y.fedOrdTax + y.fedLtcgTax) - y.fedTax);
    if (d > maxDiff) { maxDiff = d; maxYr = y.year; }
  }
  if (maxDiff > 1) fail(`${s}: fedOrd+fedLtcg vs fedTax diff $${maxDiff.toFixed(2)} in ${maxYr}`);
  else ok(`${s}: fedOrd + fedLtcg = fedTax (max diff $${maxDiff.toFixed(2)})`);
}

// Test 2: ordTaxable + qdivStack == fedTaxable
const sim = simulate(readInputs(), '24');
let maxStackDiff = 0;
for (const y of sim.years) {
  const d = Math.abs((y.ordTaxable + y.qdivStack) - y.fedTaxable);
  if (d > maxStackDiff) maxStackDiff = d;
}
if (maxStackDiff > 1) fail(`ordTaxable + qdivStack != fedTaxable (max $${maxStackDiff.toFixed(2)})`);
else ok(`ordTaxable + qdivStack = fedTaxable (max $${maxStackDiff.toFixed(2)})`);

// Test 3: topFedRate reflects ordinary only
function topOrdBracketMFJ(ord, year) {
  const inflF = Math.pow(1.025, year - 2026);
  const tops = [[23850,0.10],[96950,0.12],[206700,0.22],[394600,0.24],[501050,0.32],[751600,0.35],[Infinity,0.37]];
  for (const [t, r] of tops) if (ord <= t * inflF) return r;
  return 0.37;
}
function topOrdBracketSingle(ord, year) {
  const inflF = Math.pow(1.025, year - 2026);
  const tops = [[11925,0.10],[48475,0.12],[103350,0.22],[197300,0.24],[250525,0.32],[626350,0.35],[Infinity,0.37]];
  for (const [t, r] of tops) if (ord <= t * inflF) return r;
  return 0.37;
}
let badRate = 0;
const badRows = [];
for (const y of sim.years) {
  const expected = y.status === 'MFJ' ? topOrdBracketMFJ(y.ordTaxable, y.year) : topOrdBracketSingle(y.ordTaxable, y.year);
  if (Math.abs(expected - y.topFedRate) > 0.001) {
    badRate++;
    if (badRows.length < 3) badRows.push(`  ${y.year} ${y.status}: ord=$${Math.round(y.ordTaxable)} expected ${expected*100}% got ${y.topFedRate*100}%`);
  }
}
if (badRate > 0) { fail(`${badRate} year(s) topFedRate mismatches ord-only bracket`); badRows.forEach(r => console.log(r)); }
else ok('topFedRate correctly = ord-only bracket for all years (MFJ + Single)');

// Test 4: IRMAA 2026 tiers match Humana table (irmaaTier returns ANNUAL per person: monthly * 12)
const checks = [
  [217999, 0,              'tier 0 (<=$218K)'],
  [218001, 95.70 * 12,     'tier 1 ($218K-$274K)'],
  [274001, 240.40 * 12,    'tier 2 ($274K-$342K)'],
  [342001, 385.00 * 12,    'tier 3 ($342K-$410K)'],
  [410001, 533.10 * 12,    'tier 4 ($410K-$750K)'],
  [750001, 573.80 * 12,    'tier 5 (>$750K)'],
];
for (const [magi, expected, label] of checks) {
  const r = irmaaTier(magi, 'MFJ', 2026, 0.025);
  if (Math.abs(r.surcharge - expected) > 0.01) fail(`IRMAA ${label}: expected $${expected}/yr/person, got $${r.surcharge}`);
  else ok(`IRMAA ${label}: $${expected.toFixed(2)}/yr/person ($${(expected/12).toFixed(2)}/mo)`);
}

// Test 5: LTCG stack sits in 0% bracket in post-conversion years (verify stealth benefit)
const postConvYrs = sim.years.filter(y => y.year >= 2031 && y.year <= 2040);
const zeroLtcgYrs = postConvYrs.filter(y => y.fedLtcgTax < 10);
if (zeroLtcgYrs.length < 2) fail(`expected multiple post-conv years with ~$0 LTCG tax, got ${zeroLtcgYrs.length}`);
else ok(`${zeroLtcgYrs.length}/${postConvYrs.length} post-conv years have ~$0 LTCG tax (stack in 0% bracket)`);

// Test 6: (removed — marginal-rate chart was deleted; no marginalRate field on year rows)

// Test 7: Fill 24% keeps ord <= 24% bracket top (within tolerance)
let max24Violation = 0;
for (const y of sim.years) {
  if (y.conversion > 0 && y.status === 'MFJ') {
    const top24 = 394600 * Math.pow(1.025, y.year - 2026);
    if (y.ordTaxable > top24 * 1.01) max24Violation = Math.max(max24Violation, y.ordTaxable - top24);
  }
}
if (max24Violation > 100) fail(`Fill 24% ord taxable exceeds 24% bracket top by $${Math.round(max24Violation)}`);
else ok('Fill 24% keeps ordinary taxable at or below 24% bracket top');

// Test 8: Expected totals
const baseNet = simulate(readInputs(), 'none').netFamilyReal;
const fill24Net = sim.netFamilyReal;
if (Math.abs(baseNet - 12742280) > 1000) fail(`baseline $${Math.round(baseNet)} vs expected $12,742,280`);
else ok(`baseline net real at +10 = $${Math.round(baseNet).toLocaleString()}`);
if (Math.abs(fill24Net - 14545969) > 1000) fail(`Fill 24% $${Math.round(fill24Net)} vs expected $14,545,969`);
else ok(`Fill 24% net real at +10 = $${Math.round(fill24Net).toLocaleString()}`);

// Test 9: AGI consistency — reconciles across every year
let agiFailures = 0;
let maxAgiDiff = 0;
for (const y of sim.years) {
  const reconAGI = y.wages + y.ordInt + y.qdiv + y.totalRMD + y.conversion + y.capGain + y.ssTax;
  const d = Math.abs(reconAGI - y.agi);
  if (d > maxAgiDiff) maxAgiDiff = d;
  if (d > 1) agiFailures++;
}
if (agiFailures > 0) fail(`AGI reconstruction fails in ${agiFailures} years (max diff $${maxAgiDiff.toFixed(2)})`);
else ok(`AGI = wages + ordInt + qdiv + RMD + conv + capGain + ssTax for all years (max diff $${maxAgiDiff.toFixed(2)})`);

// Test 10: NJ state=none → totalNJTax must be $0
defaults.state_tax = 'none';
defaults.dad_nj_basis = 0;
const flSim = simulate(readInputs(), '24');
if (flSim.totalNJTax !== 0) fail(`FL totalNJTax should be $0, got $${flSim.totalNJTax}`);
else ok('state_tax=none → totalNJTax = $0');
// Restore NJ
defaults.state_tax = 'NJ';
defaults.dad_nj_basis = 30000;

// Test 11: Single-filer widow years should have correct bracket labels
const singleYears = sim.years.filter(y => y.status === 'Single');
let singleBadRate = 0;
for (const y of singleYears) {
  const expected = topOrdBracketSingle(y.ordTaxable, y.year);
  if (Math.abs(expected - y.topFedRate) > 0.001) singleBadRate++;
}
if (singleYears.length === 0) console.log('NOTE: No Single-filer years in this scenario');
else if (singleBadRate > 0) fail(`${singleBadRate}/${singleYears.length} Single years have wrong bracket`);
else ok(`${singleYears.length} Single-filer years all have correct bracket labels`);

// Test 12: Spending in Single years should be 80% of MFJ-equivalent (survivor adjustment)
if (singleYears.length > 0 && postConvYrs.length > 0) {
  // Find first single year and a nearby MFJ year
  const firstSingle = singleYears[0];
  const sameYearMFJ = sim.years.find(y => y.year === firstSingle.year - 1 && y.status === 'MFJ');
  if (sameYearMFJ) {
    const ratio = firstSingle.spend / (sameYearMFJ.spend * 1.025);  // +1yr inflation
    if (Math.abs(ratio - 0.80) > 0.02) fail(`widow spend ratio ${(ratio*100).toFixed(1)}% not ~80%`);
    else ok(`widow spend ratio in ${firstSingle.year}: ${(ratio*100).toFixed(1)}% of prior-year inflated spend`);
  }
}

// Test 13: Year-0 capGain must be $0 when starting basis = starting balance
// (Later years legitimately accrue unrealized gain as total return > yield)
const testInp = readInputs();
testInp.taxBasis = testInp.taxable;
const noGainSim = simulate(testInp, '24');
const year0 = noGainSim.years[0];
if (year0.capGain > 0.01) fail(`year 0 capGain should be $0 when basis=balance at start, got $${year0.capGain.toFixed(2)}`);
else ok('year 0 capGain = $0 when starting basis = starting balance');

console.log('\n' + (issues === 0 ? 'ALL CHECKS PASSED ✓' : issues + ' ISSUE(S) FOUND'));
