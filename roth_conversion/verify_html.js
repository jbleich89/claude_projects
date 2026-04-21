// Extract and run the HTML tool's simulation in node to confirm parity
const fs = require('fs');
const html = fs.readFileSync('roth_conversion_tool.html', 'utf8');
const m = html.match(/<script>\s*\/\*[\s\S]*?<\/script>/g);
if (!m) { console.log('No script match'); process.exit(1); }
const js = m[0].replace(/<\/?script[^>]*>/g, '');

const defaults = {
  dad_birth: 1957, mom_birth: 1961, dad_retire: 2028, mom_retire: 2026,
  dad_death: 90, mom_death: 90, dad_wage: 70000, mom_wage_2026: 22000,
  dad_ss: 40000, mom_ss: 22000, dad_ss_year: 2027, mom_ss_year: 2026,
  dad_ira: 350000, mom_ira: 700000, taxable: 3250000, roth: 0,
  dad_nj_basis: 30000, yld_int: 1.26, yld_qdiv: 0.77, yld_muni: 0.52,
  ret_ira: 7.5, ret_roth: 7.5, ret_tax: 6.0, infl: 2.5, spend: 75000,
  heir_a_share: 50, heir_b_share: 50, heir_a_rate: 47.75, heir_b_rate: 30.37,
  strategy: '24', custom_amt: 0, irmaa_cap: 300000,
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

const strategies = ['none','12','22','24half','24','irmaa','32','nj100'];
const policies = ['dad_first','mom_first','prorata'];

function runWithPolicy(policy) {
  defaults.conv_source = policy;
  const inp = readInputs();
  const baseline = simulate(inp, 'none');
  const rows = [];
  for (const s of strategies) {
    const sim = simulate(inp, s);
    const tot = sim.totalFedTax + sim.totalNJTax + sim.totalNIIT + sim.totalIRMAA;
    rows.push({
      strategy: s,
      netReal: sim.netFamilyReal,
      delta: sim.netFamilyReal - baseline.netFamilyReal,
      tax: tot,
    });
  }
  return rows;
}

const results = {};
for (const p of policies) results[p] = runWithPolicy(p);

console.log('\nAllocation-policy comparison (net family real $, by strategy):');
console.log('Strategy'.padEnd(12) + 'Dad-first'.padEnd(18) + 'Mom-first'.padEnd(18) + 'Pro-rata'.padEnd(18) + 'Max diff');
for (let i = 0; i < strategies.length; i++) {
  const s = strategies[i];
  const df = results.dad_first[i].netReal;
  const mf = results.mom_first[i].netReal;
  const pr = results.prorata[i].netReal;
  const maxDiff = Math.max(df, mf, pr) - Math.min(df, mf, pr);
  console.log(
    s.padEnd(12) +
    ('$' + Math.round(df).toLocaleString()).padEnd(18) +
    ('$' + Math.round(mf).toLocaleString()).padEnd(18) +
    ('$' + Math.round(pr).toLocaleString()).padEnd(18) +
    '$' + Math.round(maxDiff).toLocaleString()
  );
}

// Also stress-test with Dad dying young (age 75)
console.log('\n--- STRESS TEST: Dad dies at 75 ---');
defaults.dad_death = 75;
for (const p of policies) results[p] = runWithPolicy(p);
console.log('Strategy'.padEnd(12) + 'Dad-first'.padEnd(18) + 'Mom-first'.padEnd(18) + 'Pro-rata'.padEnd(18) + 'Max diff');
for (let i = 0; i < strategies.length; i++) {
  const s = strategies[i];
  const df = results.dad_first[i].netReal;
  const mf = results.mom_first[i].netReal;
  const pr = results.prorata[i].netReal;
  const maxDiff = Math.max(df, mf, pr) - Math.min(df, mf, pr);
  console.log(
    s.padEnd(12) +
    ('$' + Math.round(df).toLocaleString()).padEnd(18) +
    ('$' + Math.round(mf).toLocaleString()).padEnd(18) +
    ('$' + Math.round(pr).toLocaleString()).padEnd(18) +
    '$' + Math.round(maxDiff).toLocaleString()
  );
}

// Restore age and run a no-state-tax scenario (e.g., Florida)
console.log('\n--- STRESS TEST: same scenario, state_tax = none (FL) ---');
defaults.dad_death = 90;
defaults.state_tax = 'none';
defaults.dad_nj_basis = 0;
// nj100 strategy doesn't apply when there's no state tax
const flStrategies = strategies.filter(s => s !== 'nj100');
const flBaseline = simulate(readInputs(), 'none');
console.log('Strategy'.padEnd(12) + 'Net real at +10'.padEnd(20) + 'Δ vs baseline'.padEnd(18) + 'Total tax (nom)');
for (const s of flStrategies) {
  const sim = simulate(readInputs(), s);
  const tot = sim.totalFedTax + sim.totalNJTax + sim.totalNIIT + sim.totalIRMAA;
  console.log(
    s.padEnd(12) +
    ('$' + Math.round(sim.netFamilyReal).toLocaleString()).padEnd(20) +
    ('$' + Math.round(sim.netFamilyReal - flBaseline.netFamilyReal).toLocaleString()).padEnd(18) +
    '$' + Math.round(tot).toLocaleString()
  );
}
// Sanity: total NJ tax in the no-state-tax scenario should be exactly 0
const sanityNJ = simulate(readInputs(), '24').totalNJTax;
console.log('\nSanity: totalNJTax in state_tax=none scenario =', '$' + Math.round(sanityNJ).toLocaleString(),
  sanityNJ === 0 ? '✓' : 'FAIL — should be $0');
