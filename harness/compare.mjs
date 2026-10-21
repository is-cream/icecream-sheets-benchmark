/**
 * Comparison rules — ported EXACTLY from the icecream-sheets repo's own
 * golden-set validators (samples/validate-golden.mjs and
 * samples/validate-golden-batch2.mjs). The benchmark reproduces the
 * repo's recorded baselines by construction: same rules, same order.
 *
 * A "got" value is a normalized cell result:
 *   { kind: 'number'|'string'|'boolean'|'error'|'blank'|..., value?, code? }
 */

// ---- functions.xlsx rules (validate-golden.mjs) ----
const EPS = 1e-9;
const closeMain = (a, b) =>
  a === b ||
  (typeof a === 'number' && typeof b === 'number' &&
    Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b)));

export function compareMain(exp, got) {
  const gk = got?.kind;
  if (exp.smoke) {
    const ok = gk !== 'error' || got.code !== '#NAME?';
    const typeOk = !ok
      ? true
      : exp.type === 'number' ? gk === 'number'
      : exp.type === 'string' ? gk === 'string'
      : true;
    return ok && typeOk;
  }
  if ('value' in exp) {
    const ev = exp.value;
    return gk === 'number' && typeof ev === 'number' ? closeMain(got.value, ev)
      : gk === 'string' && typeof ev === 'string' ? got.value === ev
      : gk === 'boolean' && typeof ev === 'boolean' ? got.value === ev
      : false;
  }
  if ('error' in exp) {
    return gk === 'error' && got.code === exp.error;
  }
  return false;
}

// ---- functions-batch2.xlsx rules (validate-golden-batch2.mjs) ----
export function compareBatch2(exp, got) {
  const actual = got.kind === 'error' ? { error: got.code } : got.value;
  if (exp && typeof exp === 'object' && 'approx' in exp) {
    return typeof actual === 'number' && Math.abs(actual - exp.approx) < exp.tol;
  }
  if (exp && typeof exp === 'object' && 'error' in exp) {
    return got.kind === 'error' && got.code === exp.error;
  }
  return actual === exp ||
    (typeof actual === 'number' && typeof exp === 'number' && Math.abs(actual - exp) < 0.001);
}
