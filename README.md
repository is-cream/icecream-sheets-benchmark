# Icecream Sheets Formula Benchmark

A public, reproducible benchmark for Excel-formula calculation
engines, built from the validated golden corpus of
[icecream-sheets](https://github.com/is-cream/icecream-sheets).

The corpus is 465 formula cases in two workbooks, with expected values
computed independently of any engine. Any engine can be scored through
a small adapter; scores exist **only** for engines the harness has
actually run.

## Corpus

| File | Cases | Contents |
|---|---|---|
| `corpus/functions.xlsx` | 421 | 13 sheets (Math, Stats, Text, Logic, Lookup, Dates, Finance, Info, Eng, More, More3, …) |
| `corpus/functions-batch2.xlsx` | 44 | Database, text, stats, math, financial and lookup functions |

Expected values live beside each workbook
(`functions-expected.json`, `functions-batch2-expected.json`), keyed
`Sheet!A1`. Entries are `{value}`, `{error}`, `{smoke, type}` (main
file) or a raw scalar / `{approx, tol}` / `{error}` (batch 2).
`corpus/CORPUS-NOTES.md` documents coverage and the known-gap triage;
the `*-plan.json` files map every case to its formula (regenerated
from the workbooks).

## Run it

Prerequisite for the reference adapter: a checkout of icecream-sheets
with its packages built (`npm run build` there), placed next to this
repo or pointed to with `--engine-root` / `ICECREAM_SHEETS_ROOT`.

```bash
npm run benchmark        # score icecream-sheets + regenerate the leaderboard
# or explicitly:
node harness/run.mjs --engine icecream --engine-root /path/to/icecream-sheets
```

Output: `results/<engine>.json` (per-file totals, per-function pass
rates, full failure list) and `results/<engine>.md`. The leaderboard
in `leaderboard/index.html` is generated from those result files —
never edited by hand.

## Methodology & tolerance rules

The comparison rules are the icecream-sheets repo's own golden-set
rules, ported verbatim (`harness/compare.mjs`):

- **functions.xlsx, exact values:** numbers pass when
  `|got − expected| ≤ 1e-9 × max(1, |got|, |expected|)` (a relative
  tolerance that absorbs last-ulp floating-point differences between
  engines); strings and booleans must match exactly; error entries
  must produce the identical error code.
- **functions.xlsx, smoke entries:** pass when the formula evaluates
  to something other than a `#NAME?` error and, where a type is
  declared, returns a value of that type.
- **functions-batch2.xlsx:** `{approx, tol}` entries pass within the
  stated absolute tolerance; raw numeric expectations allow < 0.001
  absolute difference; errors must match by code.

## Score another engine

Write one adapter module implementing the contract in
[`harness/engines/README.md`](harness/engines/README.md), then run
`node harness/run.mjs --engine <yours>`. No adapter, no score: engines
that have not been run are listed on the leaderboard as "not yet run",
without numbers.

## License

MIT (harness and documentation). The corpus workbooks and expected
values are published for benchmark use.
