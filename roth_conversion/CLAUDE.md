# Context for Claude sessions entering this folder

This is Justin's Roth conversion planning tool for his parents. Before editing anything, read this file, then read `README.md` for user-facing context.

## Project summary

A single-file HTML tool (`roth_conversion_tool.html`) that simulates 25+ years of retirement cash flow and tax for Justin's parents to rank Roth conversion strategies. Self-contained: inline CSS and JS, only external dep is Chart.js from CDN. No build step, no framework. Open in any browser.

Household context baked into defaults:

- Dad (b.1957) — retires 2028, $70K wage through then, $40K SS at 70, $350K traditional IRA with $30K NJ basis
- Mom (b.1961) — retires 2026, $22K wage in 2026, $22K SS at 65, $700K 401(k)
- Joint: $3.25M taxable brokerage, $0 existing Roth, NJ residents
- Heirs: Justin (47.75% marginal) and sister (30.37% marginal), 50/50 split

## Tax logic implemented

Federal 2026 MFJ and Single brackets (TCJA + OBBBA assumed sunset/renewal as of model date). NJ tax with pension exclusion cliff ($100K MAGI hard phaseout) and IRA basis pro-rata recovery. SS provisional income formula for federal taxability (NJ doesn't tax SS). OBBBA senior deduction ($6K/filer age 65+, 2025–2028, 6% phaseout above $150K MFJ MAGI — MAGI = AGI + muni interest). NIIT (3.8% on investment income above $250K MFJ / $200K single). IRMAA tiers ($218K / $274K / $342K / $410K / $750K MFJ for 2026, Part B + Part D combined). Qualified dividends stacked at LTCG preferential rates (0% / 15% / 20%) on top of ordinary income via `federalTaxSplit()`. SECURE Act 10-year rule for inherited IRAs post-2020. Spousal rollover at first death, survivor filing single thereafter (widow tax trap).

## Architecture inside the HTML

All JS is in one `<script>` block. Key functions:

- `readInputs()` — pulls DOM values
- `federalTax(taxable, status)` — ordinary brackets only
- `federalTaxSplit(taxable, qdiv, status)` — splits ordinary vs qdiv, returns combined tax
- `njTax(njIncome)` — NJ brackets
- `njPensionExclusion(njIncome, magi, status)` — $100K MAGI cliff
- `taxableSocialSecurity(ss, otherIncome, muni, status)` — provisional income
- `obbbaSeniorDeduction(magi, age65count, status, year)` — MAGI-based phaseout
- `irmaaSurcharge(magi, status, year)` — tiered lookup
- `niit(agi, invIncome, status)` — 3.8% on lesser of
- `rmd(balance, age)` — Uniform Lifetime Table
- `simulate(inp, strategy, returnOverrides?)` — year-by-year engine, returns totals + series for charts. Optional 3rd arg is an array keyed by year index (0 = startYear) with `{ira, roth, tax}` per-year return overrides; used by the sensitivity panel to stress-test bad sequences. Pass `null`/omit to use flat `inp.retIRA / retRoth / retTax`.
- `renderComparison(results)` — renders the strategy-ranking table; rows are clickable (sets `currentStrategy` and re-runs), active row highlighted, winner starred
- `renderSensitivity(inp, activeStrategy)` — runs 5 return-scale scenarios (0.67× – 1.33×) and 5 sequence-of-returns scenarios (crash → boom, applied to years 0–4 only), renders a table showing net real + Δ vs no-conv for each
- `run()` — entry point, runs all strategies, picks the user-selected one, updates DOM and all charts + the comparison + sensitivity tables

Strategy is a string: `none / 12 / 22 / niit / 24half / 24 / irmaa / 32 / custom`.

Conversion source allocation (`conv_source`): `dad_first / mom_first / prorata` — how to split the target conversion amount between Dad's IRA and Mom's 401(k) each year before the first death.

Display mode (`displayMode`): `real` or `nominal`. Real is inflation-adjusted to 2026 dollars using `infl` input.

## Bugs fixed in the last audit — do not reintroduce

1. **Taxable account must receive wage and SS cash inflows.** The balance update line is:
   ```js
   taxable = taxable * (1 + inp.retTax) + wages + totalSS + totalRMD - totalTaxYr - spend;
   ```
   Previously omitted wages and totalSS — baseline under-counted by ~$3.6M over 25 years.

2. **Mom's NJ basis must be tracked after Dad dies.** When Dad dies mid-sim, `momBasis += dadBasis` AND subsequent RMD/conversion pro-rata exclusion must consult `momBasis`:
   ```js
   if (momIRA > 0 && momBasis > 0) {
     const pct = Math.min(1, momBasis / momIRA);
     momNJExempt = pct * (rmdFromMom + convFromMom);
     momBasis = Math.max(0, momBasis - momNJExempt);
   }
   ```

3. **Qualified dividends stack at LTCG rates, not ordinary.** Always call `federalTaxSplit()`, not `federalTax(fedTaxable)`. If you refactor the tax path, preserve this.

4. **OBBBA phaseout uses MAGI, not AGI.** `const magi = agi + muni; obbbaSeniorDeduction(magi, ...);` — AGI alone is wrong for this deduction.

## Cost basis tracking (taxable account)

As of the April 2026 audit, taxable-brokerage cost basis IS tracked. Inputs: `taxable_basis` (starting basis at beginning of 2026). Each year:

1. Unrealized-gain fraction = `max(0, balance − basis) / balance`
2. Shortfall after inflows = `max(0, tax + spend − wages − SS − RMD)`
3. Realized cap gain = `shortfall × unrealized_pct`
4. Cap gain is iterated (4 passes) because it's circular: tax depends on cap gain, cap gain depends on withdrawal which depends on tax. Converges within $5.
5. Cap gain feeds `federalTaxSplit(ordinary, qdiv+capGain, status)` at LTCG rates, is added to AGI for IRMAA/NIIT/OBBBA, and added to NJ `njGross` as ordinary NJ income (NJ has no preferential LTCG rate but does NOT get pension exclusion on cap gain).
6. End-of-year basis update: `basis += yieldsReinvested + wages + SS + RMD − (outflows − capGain)`, clamped to `[0, balance]`.

The net impact of turning basis tracking on: baseline drops by ~$50–100K at +10, Fill 24% drops by ~$100K. Ranking unchanged because the cap-gain drag applies to all strategies roughly equally.

## Widow spending adjustment

`survivor_spend_pct` input (default 80%) multiplies nominal spend when filing status flips to Single. Raises baseline by ~$60K at +10 and shifts tax-efficiency slightly in favor of the no-conversion path (more uncompounded money sits in Roth/taxable post-first-death). Net ranking unchanged.

## Sensitivity panel

Below the year-by-year table, `renderSensitivity()` runs five scaled-return scenarios (`retIRA × 0.67 / 0.83 / 1.00 / 1.17 / 1.33`, same scale applied to Roth and taxable) for the currently-selected strategy vs no-conversion baseline. Below that, five sequence-of-returns scenarios apply a per-year override ONLY to years 0–4 (the "crucial" retirement window), then let default returns resume. This isolates whether the conversion advantage is robust to a bad first few years.

Validated April 2026: Fill 24% wins in every scenario. Smallest margin: $503K (5-year -10% crash). Largest: $5M (1.33× return scale). No reversals — the conversion strategy is robust.

## Known remaining caveats (NOT bugs — documented limitations)

- Std deduction uses TCJA baseline (~$30,750 MFJ 2026); OBBBA enhancement (~$32,300) not applied
- Heir inherited-IRA growth uses `retIRA` regardless of heir's actual allocation
- Conversions assumed Jan 1 (full year of Roth compounding)
- SS COLA = CPI (model uses one `infl` rate for everything)
- Cap gain iteration is fixed at 4 passes; may slightly under-realize in extreme years (error < $5 on the withdrawal, invisible on totals)

## How to verify changes

Three-tier test setup, all pointing at the live HTML (each extracts the `<script>` block, stubs a minimal DOM, then eval's the code). Run all three after any non-trivial edit:

```bash
cd ~/workspace/claude_projects/roth_conversion
node unit_tests.js && node sanity_check.js && node verify_html.js
```

1. **`unit_tests.js`** — ~48 assertions on the pure tax helpers in isolation: `bracketTax`/`topBracket`, `federalTax` (MFJ + Single, with and without inflation), `federalTaxSplit` (LTCG stacking across 0%/15%/20% bands, including straddle cases), `njTax`, `njPensionExclusion` cliff, `taxableSocialSecurity` provisional-income ramp (including muni), `obbbaSeniorDeduction` phaseout + 2028 sunset, `irmaaTier` tiers 0–5 for MFJ and Single, and `inflate`. Hand-computable inputs — if one of these fails, the tax math itself is wrong, before you even get to simulation state.

2. **`sanity_check.js`** — ~25 invariants over a full `simulate()` run with the config.js defaults: `fedOrdTax + fedLtcgTax == fedTax` every year, `ordTaxable + qdivStack == fedTaxable`, `topFedRate` reflects ordinary-only bracket, IRMAA tier thresholds match the 2026 table, AGI reconciles from components, Fill-24% strategy stays within the 24% bracket, post-conversion years have LTCG in 0% bracket, Single-filer bracket labels correct, widow spend = 80% of MFJ, year-0 capGain = $0 when basis = balance, `state_tax='none'` produces `totalNJTax == 0`, and pinned dollar totals (baseline $12,742,277 and Fill 24% $14,545,957, tolerance $1,000).

3. **`verify_html.js`** — regression on totals across all strategies × 3 allocation policies, plus a "Dad dies at 75" stress test and a no-state-tax (FL) run. Expected baseline net real at +10 (with cost basis + widow spend + 2026 IRMAA Part B+D ON): ~$12.74M. Expected winner: Fill 24% at ~$14.55M. FL scenario `totalNJTax` must be exactly $0.

If unit tests fail, the tax helpers themselves regressed — fix that first before debugging simulation behavior. If unit tests pass but sanity/verify fail, the bug is in the simulation loop (cash flow, basis tracking, year-by-year stacking) not in the pure helpers. If the baseline moves by more than ~$50K from $12.74M, or if the ranking of the top-4 strategies reorders in a way that can't be traced to the edit, something broke. Find it before returning to the user.

When adding a new pure helper, add unit tests. When adding a new simulation invariant (e.g., a new column that should decompose cleanly), add a sanity check. When changing tax-law constants that shift totals, update the pinned numbers in both `sanity_check.js` and this file.

## State tax toggle

`inp.stateTax` is a string: `'NJ'` or `'none'`. All NJ-specific computation (brackets, pension exclusion, IRA basis recovery) is gated on `inp.stateTax === 'NJ'`. When `'none'`, `njtax`, `njGross`, `njTaxable`, and `excl` are all zero. The NJ basis input is hidden via `updateStateTaxUI()`.

If extending to other states (CA, NY, PA): add another value to the dropdown, add a state-specific bracket constant and tax function, add a new branch in the "State tax computation" block in `simulate()`, and filter strategies accordingly. Don't try to parameterize state brackets through config — states' exclusion rules are too idiosyncratic to abstract cleanly.

## Config split (IMPORTANT)

The HTML has generic demo defaults baked into the `value="..."` attributes (safe to share). An optional `config.js` sitting next to the HTML sets `window.PLANNER_CONFIG = { ... }`, and the `applyPlannerConfig()` function (near the bottom of the main script, before the initial `run()`) overwrites any matching DOM input before simulation. Missing keys = demo default stands; missing file = demo defaults stand silently.

Rules when editing:
- If you add a new user input, give it an HTML `id` AND add the key (with a comment) to `config.example.js`. Otherwise the config override won't reach it.
- Never put personal data in the HTML `value="..."` attributes. Demo defaults only. Personal numbers belong in `config.js`.
- `config.js` is Justin's real data. Do NOT rewrite it casually. If you need to add keys, append — don't reformat.
- When explaining to Justin that "the tool" has a value, be precise about whether you mean the demo default (in HTML) or the current config override (in `config.js`).

Internal input IDs use `dad_*` / `mom_*` (for Spouse A / Spouse B, legacy names kept) and `heir_a_*` / `heir_b_*` (fully generic). UI labels say "Spouse A / Spouse B" and "Heir A / Heir B". If renaming further (`dad` → `spouse_a`), remember to update `verify_html.js` defaults and all three files' key lists.

## House style for this file

- Keep everything in one HTML file plus an optional config.js sibling. Don't split into modules, don't add a bundler, don't add React.
- Chart.js from CDN is the one allowed external dependency. Don't add more.
- Tax-law constants (brackets, IRMAA thresholds, OBBBA parameters) are inline with year comments so they're easy to update annually. If you change a constant, add a source comment.
- Prefer readability over cleverness — Justin reviews this code by hand and the tax logic must be auditable.
- Never round inside the simulation loop; round only at display time.

## If Justin asks for a new feature

Typical extensions he may request: additional strategies, different allocation policies, sensitivity sliders, CSV export of the year-by-year table, comparison of two strategies side-by-side, multi-scenario Monte Carlo on returns. Each should be implemented inline in the same HTML file. Run `verify_html.js` after every change.
