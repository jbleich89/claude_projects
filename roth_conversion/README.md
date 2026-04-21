# Roth Conversion Planner

Interactive tool for deciding how much to convert from traditional IRA / 401(k) to Roth each year for my parents (Dad b.1957, Mom b.1961, NJ residents). Self-contained HTML — no install, no server.

## How to use

Double-click `roth_conversion_tool.html` to open it in a browser. All inputs are editable at the top of the page; results update when you click **Run simulation**.

Core inputs worth re-checking before every use:

- Birth years, retirement years, and assumed death ages (defaults: both 90)
- Current balances: Dad's IRA, Mom's 401(k), joint taxable brokerage, existing Roth
- Yields on the taxable account (ordinary interest, qualified dividends, muni interest)
- Expected returns: traditional IRA, Roth, taxable, and inflation
- Annual real spending in retirement (default $75K)
- Heirs' marginal rates (for inherited-IRA distribution tax in the 10-year window)
- Strategy dropdown and, if using the IRMAA-cap strategy, the MAGI ceiling ($300K default)
- Conversion source allocation: Dad-first / Mom-first / pro-rata
- Display mode: real (inflation-adjusted) or nominal

Click **Run simulation**. The tool runs the chosen strategy plus the "do nothing" baseline and shows:

- Net family wealth at second death (real and nominal)
- Net family wealth +10 years after second death (real and nominal — accounts for heir-level taxes on inherited IRA)
- Per-year breakdown of income, taxes, balances, RMDs, conversions
- Charts of account balances, taxes paid, and cumulative conversions

## What the strategies mean

- **none** — do nothing, take RMDs only
- **12 / 22 / 24 / 32** — each year convert up to the top of that federal bracket
- **24half** — convert up to the midpoint of the 24% bracket
- **irmaa** — convert up to the MAGI cap you set (default $300K, avoiding the steep IRMAA cliff)
- **nj100** — convert only enough to stay under NJ's $100K pension-exclusion MAGI cliff

After the latest audit (see CLAUDE.md), the top 4 strategies (fill 22 through fill 32) are all within ~$50K of each other on a $14.6M+ outcome. The IRMAA $300K cap is the cleanest real-world choice.

## Caveats

The tool models federal 2026 MFJ/Single brackets (TCJA+OBBBA), NJ tax with pension exclusion cliff phaseout, NJ IRA basis pro-rata recovery, SS taxability, OBBBA senior deduction with MAGI phaseout, NIIT, IRMAA tiers, the SECURE 10-year rule, qualified-dividend LTCG stacking, and spousal rollover at first death.

It does NOT model: cost basis in the taxable account (so conversion-tax liquidations are treated as basis-neutral), OBBBA-enhanced standard deduction (uses TCJA baseline ~$30,750), SS COLA divergence from CPI, widow spending adjustments, mid-year convert timing (assumes Jan 1), state changes, or Medicare Part B/D premium changes beyond the IRMAA surcharge.

Use it as a ranking tool, not a point estimate.

## Files

- `roth_conversion_tool.html` — the tool (open in any browser). Has generic demo defaults baked in. **Safe to share.**
- `config.js` — my personal numbers (parents' balances, SS, heir rates). **Do not share.** If present in the same folder, overrides the demo defaults.
- `config.example.js` — annotated template. Copy to `config.js` and edit.
- `verify_html.js` — Node script that runs the embedded simulation headless and prints a strategy comparison plus a stress test. Run with `node verify_html.js`.
- `CLAUDE.md` — context for future Claude sessions that pick this project up.

## How the config override works

The HTML has a `<script src="config.js">` tag near the top. If a file named `config.js` exists next to the HTML and sets `window.PLANNER_CONFIG`, the tool overwrites every form field whose ID matches a key in that object before running the initial simulation. Missing or absent config.js → demo defaults stand.

## State tax

The tool supports two state-tax regimes today, selected via the "State tax regime" dropdown in the UI or `state_tax` in config.js:

- `'NJ'` — New Jersey brackets, $100K pension-exclusion cliff, and IRA-basis pro-rata recovery. The `nj100` strategy and NJ basis input appear.
- `'none'` — no state income tax (FL, TX, WA, TN, NV, SD, WY, AK, NH). All state tax calcs are zeroed, NJ basis input hides, `nj100` strategy hides.

Federal tax, NIIT, IRMAA, heir taxes, SS federal taxability, OBBBA senior deduction — all of those are computed identically in both regimes, so only the state layer changes. If your friend lives in another state with an income tax (CA, NY, etc.), treat the tool as directional only — the federal ranking still holds but absolute numbers will be off by their state's cut.

## Sharing with a friend

Email or upload ONLY `roth_conversion_tool.html`. Don't include `config.js`. They'll see the demo numbers when they open it and can type their own in — or make their own `config.js` next to their copy to persist them. Remind them to flip the state-tax dropdown if they're not in NJ.

## Verification

To re-run the sanity check:

```bash
cd ~/workspace/claude_projects/roth_conversion
node verify_html.js
```

Expected output: 8 strategies × 3 allocation policies, then the same under a stress test. Fill 24% should come out on top at ~$14.67M net real at +10, with the baseline around $12.69M.
