import { createHeap, heapEmpty, heapPop, heapPush } from '../../src/utils';
import { RandString } from './rng';

const CHARS = 'abcdefghijklmnopqrstuvwxyz';

test('basic min heap', () => {
  const rng = new RandString('myseed', CHARS);
  const strings: string[] = [];
  for (let i = 0; i < 200; i++) {
    strings.push(rng.rand(10));
  }

  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

  // Add half the strings on construction
  const heap = createHeap(cmp, strings.slice(0, 100));

  // Push the rest onto the heap
  for (let i = 100; i < 200; i++) {
    heapPush(heap, strings[i]);
  }

  // Pop all strings
  const res: string[] = [];
  while (!heapEmpty(heap)) {
    res.push(heapPop(heap)!);
  }

  // Compare to sorted input
  strings.sort(cmp);
  expect(strings).toEqual(res);
});
