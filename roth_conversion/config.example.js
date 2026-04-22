// Example planner config. Copy this file to `config.js` in the same folder
// as roth_conversion_tool.html, then edit the numbers to match your situation.
// Any key you omit falls back to the demo default hardcoded in the HTML.
//
// Keys must match the input `id` on the HTML form (not the visible label).
// "dad_*" = Spouse A (older in the UI), "mom_*" = Spouse B (younger in the UI).
// "heir_a_*" = Heir A, "heir_b_*" = Heir B.
//
// All dollar values are in current (2026) dollars. Percentages are written
// as the whole number you'd type in the form (e.g. 7.5 means 7.5%, not 0.075).

window.PLANNER_CONFIG = {
  // --- Spouses -----------------------------------------------------------
  dad_birth: 1960,          // Spouse A birth year
  mom_birth: 1962,          // Spouse B birth year
  dad_retire: 2026,         // year Spouse A retires (end of year)
  mom_retire: 2026,         // year Spouse B retires (mid year)
  dad_death: 90,            // assumed death age Spouse A
  mom_death: 92,            // assumed death age Spouse B

  // --- Earnings & Social Security ----------------------------------------
  dad_wage: 0,              // Spouse A W-2 $/yr while still working (0 if retired)
  mom_wage_2026: 0,         // Spouse B partial W-2 in 2026 only
  dad_ss: 35000,            // Spouse A SS annual benefit (today's $)
  mom_ss: 25000,            // Spouse B SS annual benefit (today's $)
  dad_ss_year: 2027,        // year Spouse A starts claiming
  mom_ss_year: 2027,        // year Spouse B starts claiming

  // --- Starting balances (beginning of 2026) -----------------------------
  dad_ira: 500000,          // Spouse A Traditional IRA
  mom_ira: 500000,          // Spouse B 401(k) or Traditional IRA
  taxable: 1500000,         // joint taxable brokerage
  roth: 0,                  // existing Roth IRA
  taxable_basis: 1000000,   // cost basis in taxable brokerage (unrealized gain = balance − basis)
  dad_nj_basis: 0,          // NJ after-tax basis in Traditional IRA (if NJ resident)

  // --- Spending behavior --------------------------------------------------
  survivor_spend_pct: 80,   // spend × this % after first death (typical 70–80%)

  // --- Taxable-account yields (% of balance/yr) --------------------------
  yld_int: 1.26,            // ordinary interest
  yld_qdiv: 0.77,           // qualified dividends
  yld_muni: 0.52,           // muni (tax-exempt) interest

  // --- Expected returns & inflation (%) ----------------------------------
  ret_ira: 7.5,             // Traditional IRA/401(k) expected return
  ret_roth: 7.5,            // Roth expected return
  ret_tax: 6.0,             // taxable account expected return (post-drag)
  infl: 2.5,                // assumed inflation
  spend: 75000,             // annual real spending (today's $)

  // --- Heirs --------------------------------------------------------------
  heir_a_share: 50,         // Heir A share of inheritance (%)
  heir_b_share: 50,         // Heir B share of inheritance (%)
  heir_a_rate: 32,          // Heir A marginal tax rate on inherited-IRA $
  heir_b_rate: 24,          // Heir B marginal tax rate on inherited-IRA $

  // --- State tax regime ---------------------------------------------------
  // 'NJ'   = New Jersey brackets, pension exclusion cliff, IRA basis recovery
  // 'none' = no state income tax (FL, TX, WA, TN, NV, SD, WY, AK, NH)
  state_tax: 'NJ',

  // --- Strategy defaults --------------------------------------------------
  // Valid strategy values: 'none', '12', '22', 'niit', '24half', '24',
  //                        'irmaa', '32', 'custom'
  strategy: '24',
  custom_amt: 80000,        // used only if strategy === 'custom'
  irmaa_cap: 342000,        // MAGI cap if strategy === 'irmaa' — $342K = top of 2026 MFJ tier 2
  conv_source: 'dad_first', // 'dad_first' | 'mom_first' | 'prorata'
};
