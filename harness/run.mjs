#!/usr/bin/env node
/**
 * Icecream Sheets Formula Benchmark — scoring harness.
 *
 * ONE command:
 *   node harness/run.mjs --engine icecream [--engine-root <path-to-icecream-sheets>]
 *   npm run benchmark
 *
 * Runs the golden corpus (corpus/*.xlsx) through an engine adapter,
 * compares computed values against the corpus' expected values using
 * the icecream-sheets repo's own comparison rules (harness/compare.mjs),
 * and writes:
 *   results/<engine>.json  — machine-readable scores (per file, per function)
 *   results/<engine>.md    — human-readable summary
 * With --emit-leaderboard it also regenerates leaderboard/index.html
 * from the results of every engine present in results/.
 *
 * Gate mode: --expect "functions.xlsx:419/421,functions-batch2.xlsx:44/44"
 * exits 2 unless the run reproduces those totals exactly.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compareMain, compareBatch2 } from './compare.mjs';

const HARNESS_VERSION = '1.0.0';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpusDir = join(root, 'corpus');
const resultsDir = join(root, 'results');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const engineId = opt('engine', 'icecream');
const engineRoot = opt('engine-root', process.env.ICECREAM_SHEETS_ROOT || resolve(root, '..', 'icecream-sheets'));
const expectSpec = opt('expect', null);
const emitLeaderboard = args.includes('--emit-leaderboard');

// ---- load corpus cases ----
const FILES = [
  { file: 'functions.xlsx', expected: 'functions-expected.json', plan: 'functions-plan.json', rules: 'main' },
  { file: 'functions-batch2.xlsx', expected: 'functions-batch2-expected.json', plan: 'functions-batch2-plan.json', rules: 'batch2' },
];
const cases = [];
for (const f of FILES) {
  const expected = JSON.parse(readFileSync(join(corpusDir, f.expected), 'utf8'));
  const plan = JSON.parse(readFileSync(join(corpusDir, f.plan), 'utf8'));
  const formulaByKey = new Map(plan.map(p => [`${p.sheet}!${p.addr}`, p.formula]));
  for (const [key, exp] of Object.entries(expected)) {
    cases.push({ file: f.file, rules: f.rules, key, exp, formula: formulaByKey.get(key) ?? null });
  }
}

const functionName = (formula) => {
  if (!formula) return '(unknown)';
  const m = String(formula).replace(/^=/, '').match(/^(?:_xlfn\.)?([A-Za-z][A-Za-z0-9_.]*)\s*\(/);
  return m ? m[1].toUpperCase() : '(expression)';
};

// ---- run the engine adapter ----
const adapter = await import(pathToFileURL(join(root, 'harness', 'engines', `${engineId}.mjs`)).href);
const requests = {};
for (const c of cases) (requests[c.file] ??= []).push(c.key);
const values = await adapter.evaluate({ corpusDir, engineRoot, requests });

// ---- compare ----
const perFile = new Map();
const perFunction = new Map();
const failures = [];
for (const c of cases) {
  const got = values[c.file]?.[c.key] ?? { kind: 'missing' };
  const pass = c.rules === 'main' ? compareMain(c.exp, got) : compareBatch2(c.exp, got);
  const pf = perFile.get(c.file) ?? { passed: 0, total: 0 };
  pf.total++; if (pass) pf.passed++;
  perFile.set(c.file, pf);
  const fn = functionName(c.formula);
  const pfn = perFunction.get(fn) ?? { passed: 0, total: 0 };
  pfn.total++; if (pass) pfn.passed++;
  perFunction.set(fn, pfn);
  if (!pass) failures.push({ file: c.file, key: c.key, formula: c.formula, expected: c.exp, got });
}

const filesOut = {};
let totP = 0, totT = 0;
for (const [file, pf] of perFile) {
  filesOut[file] = { passed: pf.passed, total: pf.total, scorePct: +(100 * pf.passed / pf.total).toFixed(2) };
  totP += pf.passed; totT += pf.total;
}
const functionsOut = {};
for (const [fn, p] of [...perFunction.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  functionsOut[fn] = { passed: p.passed, total: p.total, passRatePct: +(100 * p.passed / p.total).toFixed(2) };
}

const result = {
  engine: adapter.engineName ?? engineId,
  harnessVersion: HARNESS_VERSION,
  runAt: new Date().toISOString(),
  overall: { passed: totP, total: totT, scorePct: +(100 * totP / totT).toFixed(2) },
  files: filesOut,
  functions: functionsOut,
  failures,
};
writeFileSync(join(resultsDir, `${engineId}.json`), JSON.stringify(result, null, 1) + '\n');

const md = [
  `# Benchmark results — ${result.engine}`,
  '',
  `Harness v${HARNESS_VERSION} · run ${result.runAt}`,
  '',
  `**Overall: ${totP}/${totT} (${result.overall.scorePct}%)**`,
  '',
  '| Corpus file | Passed | Total | Score |',
  '|---|---|---|---|',
  ...Object.entries(filesOut).map(([f, s]) => `| ${f} | ${s.passed} | ${s.total} | ${s.scorePct}% |`),
  '',
  '## Failures',
  '',
  ...(failures.length
    ? failures.map(f => `- \`${f.key}\` — \`${f.formula ?? ''}\` — expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.got)}`)
    : ['None.']),
  '',
].join('\n');
writeFileSync(join(resultsDir, `${engineId}.md`), md);

console.log(`engine: ${result.engine} (harness v${HARNESS_VERSION})`);
for (const [f, s] of Object.entries(filesOut)) console.log(`  ${f}: ${s.passed}/${s.total} (${s.scorePct}%)`);
console.log(`  OVERALL: ${totP}/${totT} (${result.overall.scorePct}%)`);
if (failures.length) {
  console.log('failures:');
  for (const f of failures) console.log(`  ${f.key} (${f.formula ?? '?'}): expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.got)}`);
}
console.log(`wrote results/${engineId}.json and results/${engineId}.md`);

// ---- optional gate ----
if (expectSpec) {
  let gateOk = true;
  for (const part of expectSpec.split(',')) {
    const [file, want] = part.split(':');
    const [wp, wt] = want.split('/').map(Number);
    const gotF = filesOut[file];
    if (!gotF || gotF.passed !== wp || gotF.total !== wt) {
      gateOk = false;
      console.log(`GATE FAIL: ${file} expected ${wp}/${wt}, got ${gotF ? `${gotF.passed}/${gotF.total}` : 'no result'}`);
    } else {
      console.log(`GATE OK: ${file} ${wp}/${wt}`);
    }
  }
  if (!gateOk) process.exit(2);
}

// ---- optional leaderboard ----
if (emitLeaderboard) {
  const rows = [];
  for (const name of readdirSync(resultsDir).filter(n => n.endsWith('.json'))) {
    const r = JSON.parse(readFileSync(join(resultsDir, name), 'utf8'));
    rows.push(r);
  }
  rows.sort((a, b) => b.overall.scorePct - a.overall.scorePct);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Icecream Sheets Formula Benchmark — Leaderboard</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 2rem auto; max-width: 880px; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.5rem; } table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ddd; padding: .5rem .75rem; text-align: left; }
  th { background: #f5f5f7; } .num { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: #666; } footer { margin-top: 2rem; font-size: .9rem; color: #666; }
</style>
</head>
<body>
<h1>🍦 Icecream Sheets Formula Benchmark — Leaderboard</h1>
<p>Scores are produced <strong>only</strong> by running the benchmark harness against an engine.
Engines that have not been run do not appear with a score. See the repository README for
methodology and tolerance rules.</p>
<table>
<thead><tr><th>Engine</th><th class="num">Overall</th><th class="num">Score</th><th class="num">functions.xlsx</th><th class="num">functions-batch2.xlsx</th><th>Run date (UTC)</th><th>Harness</th></tr></thead>
<tbody>
${rows.map(r => `<tr><td>${esc(r.engine)}</td><td class="num">${r.overall.passed}/${r.overall.total}</td><td class="num">${r.overall.scorePct}%</td><td class="num">${r.files['functions.xlsx'] ? `${r.files['functions.xlsx'].passed}/${r.files['functions.xlsx'].total}` : '—'}</td><td class="num">${r.files['functions-batch2.xlsx'] ? `${r.files['functions-batch2.xlsx'].passed}/${r.files['functions-batch2.xlsx'].total}` : '—'}</td><td>${esc(r.runAt.slice(0, 10))}</td><td>v${esc(r.harnessVersion)}</td></tr>`).join('\n')}
</tbody>
</table>
<p class="muted">Not yet run: Microsoft Excel, Google Sheets, LibreOffice Calc — no scores are shown
for engines the harness has not executed. Add yours with an engine adapter (see
<code>harness/engines/README.md</code>).</p>
<footer>Corpus and methodology: see the repository README. Every number on this page comes from a
committed harness result file in <code>results/</code>.</footer>
</body>
</html>
`;
  writeFileSync(join(root, 'leaderboard', 'index.html'), html);
  console.log('wrote leaderboard/index.html');
}
