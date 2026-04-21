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

Federal 2026 MFJ and Single brackets (TCJA + OBBBA assumed sunset/renewal as of model date). NJ tax with pension exclusion cliff ($100K MAGI hard phaseout) and IRA basis pro-rata recovery. SS provisional income formula for federal taxability (NJ doesn't tax SS). OBBBA senior deduction ($6K/filer age 65+, 2025–2028, 6% phaseout above $150K MFJ MAGI — MAGI = AGI + muni interest). NIIT (3.8% on investment income above $250K MFJ / $200K single). IRMAA tiers ($212K / $266K / $334K / $400K / $750K MFJ for 2026). Qualified dividends stacked at LTCG preferential rates (0% / 15% / 20%) on top of ordinary income via `federalTaxSplit()`. SECURE Act 10-year rule for inherited IRAs post-2020. Spousal rollover at first death, survivor filing single thereafter (widow tax trap).

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
- `simulate(inp, strategy)` — year-by-year engine, returns totals + series for charts
- `run()` — entry point, runs chosen strategy + baseline, updates DOM and charts

Strategy is a string: `none / 12 / 22 / 24half / 24 / irmaa / 32 / nj100 / custom`.

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

## Known remaining caveats (NOT bugs — documented limitations)

- Std deduction uses TCJA baseline (~$30,750 MFJ 2026); OBBBA enhancement (~$32,300) not applied
- Cost basis in taxable account not tracked — conversion-tax liquidations treated as basis-neutral
- Heir inherited-IRA growth uses `retIRA` regardless of heir's actual allocation
- Spending held flat post-first-death (no widow adjustment)
- Conversions assumed Jan 1 (full year of Roth compounding)
- SS COLA = CPI (model uses one `infl` rate for everything)

## How to verify changes

`verify_html.js` extracts the JS from the HTML, stubs DOM, and runs `simulate()` across all strategies × 3 allocation policies plus a "Dad dies at 75" stress test. Expected baseline net real at +10: ~$12.69M. Expected winner: Fill 24% at ~$14.67M.

Run after any non-trivial edit:

```bash
cd ~/workspace/claude_projects/roth_conversion
node verify_html.js
```

If the baseline moves by more than ~$50K from $12.69M, or if the ranking of the top-4 strategies reorders in a way that can't be traced to the edit, something broke. Find it before returning to the user.

## State tax toggle

`inp.stateTax` is a string: `'NJ'` or `'none'`. All NJ-specific computation (brackets, pension exclusion, IRA basis recovery, nj100 strategy) is gated on `inp.stateTax === 'NJ'`. When `'none'`, `njtax`, `njGross`, `njTaxable`, and `excl` are all zero and the `nj100` strategy is filtered out of the strategies list in `run()`. The NJ basis input and nj100 `<option>` are hidden via `updateStateTaxUI()`.

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
