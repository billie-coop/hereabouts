const DEFAULT_CAPACITY = 100;

/**
 * @public
 */
export type Key = string | number;

// Note next / prev will always be set internally, but are undefined
// temporarily when inserting a new node into the list.
type Node<V> = { key: Key; val: V; next?: Node<V>; prev?: Node<V> };

/**
 * Least-recently-used cache. This is a mutable container: lruSet and lruGet update it in place.
 *
 * @public
 */
export interface LRU<V> {
  readonly storage: Map<Key, Node<V>>;
  readonly root: Node<V>;
  readonly capacity: number;
}

/**
 * Create an empty cache holding at most `capacity` entries.
 *
 * @public
 */
export const createLRU = <V>(capacity: number = DEFAULT_CAPACITY): LRU<V> => {
  const root = {} as Node<V>;
  root.next = root;
  root.prev = root;
  return { storage: new Map(), root, capacity };
};

/**
 * Number of entries in the cache.
 *
 * @public
 */
export const lruSize = <V>(lru: LRU<V>): number => lru.storage.size;

/**
 * Get a value, marking it most-recently used.
 *
 * @public
 */
export const lruGet = <V>(lru: LRU<V>, key: Key): V | undefined => {
  const n = lru.storage.get(key);
  if (!n) {
    return undefined;
  }
  moveFront(lru, n);
  return n.val;
};

/**
 * Set a value, evicting the least-recently used entry when full.
 *
 * @public
 */
export const lruSet = <V>(lru: LRU<V>, key: Key, val: V): void => {
  if (lru.capacity === 0) {
    return;
  }

  let n = lru.storage.get(key);

  // Key already exists, so replace its value and bump it
  // to the front. Size does not change.
  if (n) {
    n.val = val;
    moveFront(lru, n);
    return;
  }

  // The lru is full, so reuse the oldest node to keep the
  // total node allocation stable.
  if (lru.storage.size === lru.capacity) {
    const old = lru.root.prev!;
    lru.storage.delete(old.key);
    lru.storage.set(key, old);
    old.key = key;
    old.val = val;
    moveFront(lru, old);
    return;
  }

  // The lru is not full, so allocate a new node.
  n = { key, val };
  lru.storage.set(key, n);
  insert(n, lru.root);
};

/**
 * Entries from most- to least-recently used, as 'key=value' pairs.
 *
 * @public
 */
export const lruToString = <V>(lru: LRU<V>): string => {
  let res = '';
  let n = lru.root.next;
  while (n && n !== lru.root) {
    if (res.length > 0) {
      res += ' ';
    }
    res += `${n.key}=${n.val}`;
    n = n.next;
  }
  return res;
};

const moveFront = <V>(lru: LRU<V>, n: Node<V>): void => {
  insert(remove(n), lru.root);
};

const insert = <V>(e: Node<V>, at: Node<V>): Node<V> => {
  const n = at.next;
  at.next = e;
  e.prev = at;
  e.next = n;
  n!.prev = e;
  return e;
};

const remove = <V>(n: Node<V>): Node<V> => {
  n.prev!.next = n.next;
  n.next!.prev = n.prev;
  n.prev = n.next = undefined;
  return n;
};
