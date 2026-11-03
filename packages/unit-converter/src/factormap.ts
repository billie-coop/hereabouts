import { createHeap, heapEmpty, heapPop, heapPush } from '@phensley/cldr-utils';
import {
  decimalAlignexp,
  decimalPrecision,
  type Rational,
  RationalConstants,
  rational,
  rationalAdd,
  rationalCompare,
  rationalDivide,
  rationalInverse,
  rationalMultiply,
  rationalNegate,
} from '@phensley/decimal';
import type { FactorDef } from './types';

type M<T> = { [dst: string]: T | undefined };
type G<T> = { [src: string]: M<T> };

// An edge converts `src` to `dst` as `dst = src × factor + offset`.
type Edge = [Rational, Rational];

type C = [
  number, // cost
  string | undefined, // previous
];

type E = [
  string, // edge
  number, // cost
];

/**
 * Represents a conversion path from source to destination unit, the
 * rational conversion factors, and the combined additive offset.
 *
 * A value `v` in the source unit converts to the destination unit as
 * `v × (factors[0] × factors[1] × ...) + offset`. The offset is only
 * present for affine conversions, e.g. temperature.
 *
 * @public
 */
export interface UnitConversion {
  readonly path: readonly string[];
  readonly factors: readonly Rational[];
  readonly offset?: Rational;
}

/**
 * A closed set of conversion factors between units, e.g. any unit in the set
 * must be convertable into any other unit in the set. There must be a
 * connected path of length 1 or greater between any two units.
 *
 * Gaps in the graph represent conversion factors that are unknown at the
 * time of graph construction. These are incrementally filled in on demand
 * by finding the shortest and lowest-cost conversion path between two units
 * with no direct conversion factor. The path is transformed into a direct
 * conversion factor by multiplying all factors along the path. The factor
 * graph and the derived conversions are built lazily and cached internally,
 * keyed by this record.
 *
 * @public
 */
export interface UnitFactors {
  /** The conversion factors the set was built from. */
  readonly factors: readonly FactorDef[];
  /** Sorted array of all units in the set. */
  readonly units: readonly string[];
  /** Set of all units in the set. */
  readonly unitset: ReadonlySet<string>;
}

/**
 * Factor graph and cache of derived conversion paths for a set of factors.
 */
interface FactorGraph {
  readonly graph: G<Edge>;
  readonly cache: G<UnitConversion>;
}

const GRAPHS: WeakMap<UnitFactors, FactorGraph> = new WeakMap();

const ONE = /*#__PURE__*/ rational(1);

/**
 * Build a set of unit conversion factors.
 *
 * @public
 */
export const unitFactors = (factors: readonly FactorDef[]): UnitFactors => {
  const unitset: Set<string> = new Set();
  for (let i = 0; i < factors.length; i++) {
    const [src, , dst] = factors[i];
    unitset.add(src);
    unitset.add(dst);
  }
  const units: string[] = [];
  unitset.forEach((u) => units.push(u));
  units.sort();
  return { factors, units, unitset };
};

/**
 * Return the factor that converts units of 'src' into 'dst'.
 *
 * @public
 */
export const unitFactorsGet = (
  map: UnitFactors,
  src: string,
  dst: string,
): UnitConversion | undefined => {
  // Units are the same, conversion is 1
  if (src === dst) {
    return { path: [src, dst], factors: [ONE] };
  }

  const { graph, cache } = factorGraph(map);

  // See if a direct conversion exists
  const n = graph[src];
  if (n) {
    const e = n[dst];
    if (e) {
      return {
        path: [src, dst],
        factors: [e[0]],
        offset: rationalCompare(e[1], 0) === 0 ? undefined : e[1],
      };
    }
  }

  // See if a cached path exists
  const res = cache[src];
  if (res) {
    const m = res[dst];
    if (m) {
      return m;
    }
  }

  // Find the shortest, lowest-cost conversion path between
  // the two factors
  const path = shortestPath(graph, src, dst);
  if (path) {
    // Collect the conversion factors, composing the additive
    // offset: after each step `offset = offset × factor + a`
    const factors: Rational[] = [];
    let offset = RationalConstants.ZERO;
    let curr: string | undefined = path[0];
    for (let i = 1; i < path.length; i++) {
      const next = path[i];
      const [r, a] = graph[curr]![next]!;
      factors.push(r);
      offset = rationalAdd(rationalMultiply(offset, r), a);
      curr = next;
    }

    // The offset key is only present for affine conversions
    const r: UnitConversion =
      rationalCompare(offset, 0) !== 0 ? { path, factors, offset } : { path, factors };

    // Record this conversion factor in the cache
    let tmp = cache[src];
    if (!tmp) {
      cache[src] = tmp = {};
    }
    tmp[dst] = r;
    return r;
  }
  // No conversion factor exists
  return undefined;
};

/**
 * Return the factor graph for the set, constructing it on first use.
 */
const factorGraph = (map: UnitFactors): FactorGraph => {
  let res = GRAPHS.get(map);
  if (res) {
    return res;
  }

  const graph: G<Edge> = {};
  for (const factor of map.factors) {
    const [src, raw, dst, rawOffset] = factor;
    const rat = typeof raw === 'string' ? rational(raw) : raw;
    const off =
      rawOffset === undefined
        ? RationalConstants.ZERO
        : typeof rawOffset === 'string'
          ? rational(rawOffset)
          : rawOffset;

    // Convert src -> dst
    let m = graph[src];
    if (!m) {
      graph[src] = m = {};
    }
    m[dst] = [rat, off];

    // Convert dst -> src, if an explicit mapping does not already exist.
    // Inverting `dst = src × r + a` gives `src = dst × (1/r) − a/r`.
    m = graph[dst];
    if (!m) {
      graph[dst] = m = {};
    }
    const tmp = m[src];
    if (!tmp) {
      m[src] = [rationalInverse(rat), rationalNegate(rationalDivide(off, rat))];
    }
  }

  res = { graph, cache: {} };
  GRAPHS.set(map, res);
  return res;
};

/**
 * Calculates the shortest path between a source and destination factor
 * using Dijkstra's algorithm. The cost of a path is the minimized
 * precision of the conversion factors.
 */
const shortestPath = (graph: G<Edge>, src: string, dst: string): string[] | undefined => {
  const heap = createHeap(cmp, [[src, 0]]);
  const edges: M<C> = {};
  edges[src] = [0, undefined];

  while (!heapEmpty(heap)) {
    const [edge, cost] = heapPop(heap)!;
    if (edge === dst) {
      break;
    }
    const nbr = graph[edge];
    if (!nbr) {
      continue;
    }

    for (const n of Object.keys(nbr)) {
      const [r] = nbr[n]!;
      const newcost = cost + precision(r);
      const path = edges[n];
      if (!path || newcost < path[0]) {
        edges[n] = [newcost, edge];
        heapPush<E>(heap, [n, newcost]);
      }
    }
  }

  const res = edges[dst];
  return res ? extractpath(edges, dst) : undefined;
};

/**
 * Compare edge cost
 */
const cmp = (x: E, y: E) => (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0);

/**
 * Return the digit cost of a rational: the number of decimal digits its
 * numerator and denominator contribute. Uses absolute magnitudes so the
 * cost is always positive (Dijkstra's algorithm requires non-negative
 * edge costs; e.g. `0.001` must not cost less than `1000`).
 */
const precision = (r: Rational) => {
  const n = r.numerator;
  const d = r.denominator;
  return (
    Math.abs(decimalPrecision(n) + decimalAlignexp(n)) +
    Math.abs(decimalPrecision(d) + decimalAlignexp(d))
  );
};

/**
 * Extract the path from the edges, tracking backwards from the
 * destination node to the source.
 */
const extractpath = (edges: M<C>, dst: string) => {
  const r: string[] = [];
  for (let c: string | undefined = dst; c; c = edges[c]![1]) {
    r.unshift(c);
  }
  return r;
};
