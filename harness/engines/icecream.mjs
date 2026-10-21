/**
 * Engine adapter: Icecream Sheets.
 *
 * Loads the engine from an icecream-sheets checkout (its built
 * packages/engine/dist and packages/xlsx-adapter/dist — build the
 * checkout first with `npm run build`) and evaluates the corpus
 * workbooks exactly the way the repo's own samples/validate-golden*.mjs
 * scripts do.
 *
 * Adapter contract (see README.md in this directory):
 *   export async function evaluate({ corpusDir, engineRoot, requests })
 *     requests: { [xlsxFile]: ['Sheet!A1', ...] }
 *     returns:  { [xlsxFile]: { 'Sheet!A1': { kind, value?, code? } } }
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const engineName = 'icecream-sheets';

function parseA1(addr) {
  const m = addr.match(/^([A-Z]+)(\d+)$/);
  const col = [...m[1]].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const row = +m[2] - 1;
  return { row, col };
}

export async function evaluate({ corpusDir, engineRoot, requests }) {
  if (!engineRoot) {
    throw new Error(
      'icecream adapter needs the icecream-sheets checkout: pass --engine-root <path> ' +
      'or set ICECREAM_SHEETS_ROOT (default: ../icecream-sheets next to this repo).');
  }
  const { XlsxAdapter } = await import(
    pathToFileURL(join(engineRoot, 'packages/xlsx-adapter/dist/index.js')).href);
  const { EngineWorkbook } = await import(
    pathToFileURL(join(engineRoot, 'packages/engine/dist/index.js')).href);

  const out = {};
  for (const [file, keys] of Object.entries(requests)) {
    const adapter = new XlsxAdapter();
    const data = adapter.read(new Uint8Array(readFileSync(join(corpusDir, file))));
    const initial = {};
    for (const sheet of data.sheets) initial[sheet.name] = sheet.rows;
    const wb = new EngineWorkbook(initial);
    const results = {};
    for (const key of keys) {
      const [sheet, addr] = key.split('!');
      const { row, col } = parseA1(addr);
      const got = wb.getValue({ sheet, row, col });
      results[key] = got
        ? { kind: got.kind, ...(got.value !== undefined ? { value: got.value } : {}),
            ...(got.code !== undefined ? { code: got.code } : {}) }
        : { kind: 'blank' };
    }
    out[file] = results;
  }
  return out;
}
