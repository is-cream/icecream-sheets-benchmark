# Benchmark results — icecream-sheets

Harness v1.0.0 · run 2026-10-21T23:38:02.926Z

**Overall: 463/465 (99.57%)**

| Corpus file | Passed | Total | Score |
|---|---|---|---|
| functions.xlsx | 419 | 421 | 99.52% |
| functions-batch2.xlsx | 44 | 44 | 100% |

## Failures

- `Math!B26` — `INT(-7.1)` — expected {"value":-8}, got {"kind":"number","value":-7}
- `Math!B38` — `MOD(-10,3)` — expected {"value":2}, got {"kind":"number","value":-1}
