/**
 * @public
 */
export type Comparator<T> = (a: T, b: T) => number;

const parent = (i: number) => (i - 1) >> 1;
const left = (i: number) => (i << 1) + 1;
const right = (i: number) => (i << 1) + 2;

/**
 * Binary min-heap (mutable container).
 *
 * @public
 */
export interface Heap<T> {
  readonly cmp: Comparator<T>;
  readonly items: T[];
}

/**
 * Build a heap from the given items.
 *
 * @public
 */
export const createHeap = <T>(cmp: Comparator<T>, data: T[]): Heap<T> => {
  const h: Heap<T> = { cmp, items: data.slice(0) };
  for (let i = parent(data.length - 1); i >= 0; i--) {
    down(h, i);
  }
  return h;
};

/**
 * @public
 */
export const heapEmpty = <T>(h: Heap<T>): boolean => !h.items.length;

/**
 * @public
 */
export const heapPush = <T>(h: Heap<T>, item: T): void => {
  h.items.push(item);
  up(h);
};

/**
 * Remove and return the smallest item.
 *
 * @public
 */
export const heapPop = <T>(h: Heap<T>): T | undefined => {
  const items = h.items;
  if (items.length <= 1) {
    return items.pop();
  }
  const r = items[0];
  items[0] = items.pop()!;
  down(h);
  return r;
};

const down = <T>(h: Heap<T>, i: number = 0): void => {
  const { items, cmp } = h;
  const len = items.length;
  for (;;) {
    const lx = left(i);
    if (lx >= len) {
      break;
    }
    const rx = right(i);
    const sm = rx < len ? (cmp(items[lx], items[rx]) === -1 ? lx : rx) : lx;

    if (cmp(items[sm], items[i]) >= 0) {
      break;
    }
    swap(items, sm, i);
    i = sm;
  }
};

const up = <T>(h: Heap<T>): void => {
  const { items, cmp } = h;
  let i = items.length - 1;
  while (i > 0) {
    const px = parent(i);
    if (cmp(items[i], items[px]) !== -1) {
      break;
    }
    swap(items, i, px);
    i = px;
  }
};

const swap = <T>(items: T[], i: number, j: number): void => {
  const tmp = items[i];
  items[i] = items[j];
  items[j] = tmp;
};
