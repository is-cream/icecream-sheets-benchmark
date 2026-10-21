# Engine adapters

The harness is engine-neutral: it never imports a spreadsheet engine
directly. An **adapter** is a small Node module in this directory that
knows how to load one engine, evaluate the corpus workbooks with it,
and hand back computed cell values.

## Contract

Create `harness/engines/<your-engine>.mjs`:

```js
export const engineName = 'My Engine';

export async function evaluate({ corpusDir, engineRoot, requests }) {
  // requests: { 'functions.xlsx': ['Math!B1', ...], 'functions-batch2.xlsx': [...] }
  // return:   { 'functions.xlsx': { 'Math!B1': { kind, value?, code? }, ... }, ... }
}
```

Each returned cell result is normalized:

| Field   | Meaning |
|---------|---------|
| `kind`  | `'number'`, `'string'`, `'boolean'`, `'error'`, or `'blank'` |
| `value` | the computed value for number/string/boolean kinds |
| `code`  | the error code for kind `'error'` (e.g. `'#NAME?'`, `'#DIV/0!'`) |

`--engine-root` / `ICECREAM_SHEETS_ROOT` is passed through for adapters
that load an engine from a local checkout (as the reference
`icecream.mjs` adapter does). Adapters that embed or fetch their engine
may ignore it.

## Run your engine

```bash
node harness/run.mjs --engine <your-engine>
```

This writes `results/<your-engine>.json` (per-file totals, per-function
pass rates, full failure list) and `results/<your-engine>.md`.
Regenerate the leaderboard with `--emit-leaderboard`. **Only engines
that have actually been run appear on the leaderboard with a score.**
