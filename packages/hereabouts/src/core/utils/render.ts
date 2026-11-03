import type { Part } from '../../decimal';
import type { WrapperNode } from '../parsing/wrapper';

/**
 * Accumulates a formatted value as a string or as parts.
 *
 * @internal
 */
export interface AbstractValue<R> {
  length(): number;
  add(type: string, value: string): void;
  get(i: number): string;
  append(value: R): void;
  insert(i: number, type: string, value: string): void;
  render(): R;
  reset(): void;
  join(...elems: R[]): R;
  wrap(pattern: readonly WrapperNode[], args: R[]): void;
  empty(): R;
}

/**
 * Builds a string value.
 *
 * @internal
 */
export const stringValue = (): AbstractValue<string> => {
  let str = '';
  const add = (_type: string, value: string): void => {
    str += value;
  };
  return {
    length: (): number => str.length,
    get: (i: number): string => str[i] || '',
    add,
    append: (value: string): void => {
      str += value;
    },
    insert: (i: number, _type: string, value: string): void => {
      const prefix = str.substring(0, i);
      const suffix = str.substring(i);
      str = `${prefix}${value}${suffix}`;
    },
    render: (): string => {
      const s = str;
      str = '';
      return s;
    },
    reset: (): void => {
      str = '';
    },
    join: (...elems: string[]): string => elems.join(''),
    wrap: (pattern: readonly WrapperNode[], args: string[]): void => {
      for (const n of pattern) {
        if (typeof n === 'string') {
          add('literal', n);
        } else {
          const arg = args[n];
          if (arg) {
            str += arg;
          }
        }
      }
    },
    empty: (): string => '',
  };
};

/**
 * Builds an array of parts.
 *
 * @internal
 */
export const partsValue = (): AbstractValue<Part[]> => {
  let parts: Part[] = [];
  const add = (type: string, value: string): void => {
    parts.push({ type, value });
  };
  return {
    length: (): number => parts.length,
    get: (i: number): string => {
      const p = parts[i];
      return p ? p.value : '';
    },
    add,
    append: (value: Part[]): void => {
      for (const p of value) {
        parts.push(p);
      }
    },
    insert: (i: number, type: string, value: string): void => {
      parts.splice(i, 0, { type, value });
    },
    render: (): Part[] => {
      const p = parts;
      parts = [];
      return p;
    },
    reset: (): void => {
      parts = [];
    },
    join: (...elems: Part[][]): Part[] => ([] as Part[]).concat(...elems),
    wrap: (pattern: readonly WrapperNode[], args: Part[][]): void => {
      for (const n of pattern) {
        if (typeof n === 'string') {
          add('literal', n);
        } else {
          for (const p of args[n] || []) {
            parts.push(p);
          }
        }
      }
    },
    empty: (): Part[] => [],
  };
};
