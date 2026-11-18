/**
 * Shared pieces for the conformance case generators in this directory.
 *
 * Each generator is a file `<name>.ts` exporting `cases(): ConformanceCase[]`; its cases go to
 * `conformance/<name>.json` at the repository root. Files starting with `_` are helpers.
 */

export interface ConformanceCase {
  fn: string;
  args: unknown[];
  result: unknown;
}

/** Small seeded generator (mulberry32), so cases never change between runs. */
export const random = (seed: number) => {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  return { next, int, pick };
};

export type Random = ReturnType<typeof random>;

/**
 * Collects cases. `add` runs `f` and records its result, or `{ error: message }` if it throws.
 * Results must be plain JSON data (no undefined, functions or class instances).
 */
export const collector = () => {
  const cases: ConformanceCase[] = [];
  const add = (fn: string, args: unknown[], f: () => unknown): void => {
    let result: unknown;
    try {
      result = f();
    } catch (e) {
      result = { error: (e as Error).message };
    }
    cases.push({ fn, args, result: result === undefined ? null : result });
  };
  return { cases, add };
};

/** The file contents: one case per line, so diffs stay readable. */
export const renderCases = (cases: ConformanceCase[]): string =>
  '[\n' + cases.map((c) => JSON.stringify(c)).join(',\n') + '\n]\n';
