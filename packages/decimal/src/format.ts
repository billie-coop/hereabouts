/**
 * A single part of a multi-part value.
 *
 * @public
 */
export interface Part {
  type: string;
  value: string;
}

/**
 * Accumulates the characters of a formatted decimal. Digits arrive from least- to
 * most-significant, so `render()` reverses them.
 *
 * @public
 */
export interface DecimalFormatter<T> {
  /**
   * Add a new part to the formatted value.
   */
  add(c: string): void;

  /**
   * Finalize and return the formatted value.
   */
  render(): T;
}

/**
 * Formatter that renders a decimal into a string.
 *
 * @public
 */
export const stringDecimalFormatter = (): DecimalFormatter<string> => {
  const parts: string[] = [];
  return {
    add: (c: string): void => {
      parts.push(c);
    },
    render: (): string => parts.reverse().join(''),
  };
};

/**
 * Formatter that renders a decimal into an array of parts.
 *
 * @public
 */
export const partsDecimalFormatter = (decimal: string, group: string): DecimalFormatter<Part[]> => {
  const parts: Part[] = [];
  let curr: string[] = [];
  const current = (): string => curr.reverse().join('');
  return {
    add: (c: string): void => {
      switch (c) {
        case decimal:
          parts.push({ type: 'fraction', value: curr.reverse().join('') });
          parts.push({ type: 'decimal', value: c });
          curr = [];
          break;

        case group:
          parts.push({ type: 'integer', value: current() });
          parts.push({ type: 'group', value: c });
          curr = [];
          break;

        default:
          curr.push(c);
          break;
      }
    },
    render: (): Part[] => {
      if (curr.length > 0) {
        parts.push({ type: 'integer', value: current() });
      }
      return parts.reverse();
    },
  };
};
