// Personal planner config — NOT for sharing. Contains real balances and rates.
// Keys match the input `id` on the HTML form. Any key omitted uses the demo default.
// Internal IDs use "dad_*"/"mom_*" for Spouse A/B and "heir_a_*"/"heir_b_*" for heirs.

window.PLANNER_CONFIG = {
  // Spouses (Spouse A = older, Spouse B = younger)
  dad_birth: 1957,
  mom_birth: 1961,
  dad_retire: 2028,
  mom_retire: 2026,
  dad_death: 90,
  mom_death: 90,

  // Earnings & Social Security
  dad_wage: 70000,
  mom_wage_2026: 22000,
  dad_ss: 40000,
  mom_ss: 22000,
  dad_ss_year: 2027,
  mom_ss_year: 2026,

  // Balances (start of 2026)
  dad_ira: 350000,
  mom_ira: 700000,
  taxable: 3250000,
  roth: 0,
  taxable_basis: 2500000,   // cost basis in taxable brokerage
  dad_nj_basis: 30000,

  // Spending
  survivor_spend_pct: 80,   // spend drops to 80% after first death

  // Taxable-account yields (%)
  yld_int: 1.26,
  yld_qdiv: 0.77,
  yld_muni: 0.52,

  // Returns & inflation (%)
  ret_ira: 7.5,
  ret_roth: 7.5,
  ret_tax: 6.0,
  infl: 2.5,
  spend: 75000,

  // Heirs
  heir_a_share: 50,
  heir_b_share: 50,
  heir_a_rate: 47.75,
  heir_b_rate: 30.37,

  // State tax regime: 'NJ' (brackets + pension exclusion) or 'none' (FL, TX, etc.)
  state_tax: 'NJ',

  // Strategy defaults
  strategy: '24',
  custom_amt: 80000,
  irmaa_cap: 342000,
  conv_source: 'dad_first',
};
