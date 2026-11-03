import type {
  ContextTransformFieldType,
  ContextType,
  ListPatternPositionType,
  Vector1Arrow,
} from '@phensley/cldr-types';
import { type Cache, cacheGet, createCache } from '@phensley/cldr-utils';
import type { ListPatternType } from '../../common/general';
import type { ContextTransformInfo } from '../../common/private';
import type { LocaleData } from '../../locale-data';
import { parseWrapperPattern, type WrapperNode } from '../../parsing/wrapper';
import { vectorMapping } from '../../schema/schema/arrows';
import type { AbstractValue } from '../../utils/render';

/**
 * Size of the shared caches of parsed patterns.
 *
 * @internal
 */
export const PATTERN_CACHE_SIZE = 200;

let wrapperPatternCache: Cache<readonly WrapperNode[]> | undefined;

/**
 * Parse a wrapper pattern like '{0} {1}' (cached).
 *
 * @internal
 */
export const parseWrapper = (raw: string): readonly WrapperNode[] =>
  cacheGet(
    wrapperPatternCache ||
      (wrapperPatternCache = createCache(parseWrapperPattern, PATTERN_CACHE_SIZE)),
    raw,
  );

/**
 * Contextually transform a string,
 *
 * @internal
 */
export const contextTransform = (
  value: string,
  info: ContextTransformInfo,
  context?: ContextType,
  field?: ContextTransformFieldType,
): string => {
  if (!value) {
    return value;
  }

  const flag = field ? info[field] : '';
  let title = false;
  switch (context) {
    case 'begin-sentence':
      title = true;
      break;
    case 'standalone':
      title = flag !== undefined && flag[0] === 'T';
      break;
    case 'ui-list-or-menu':
      title = flag !== undefined && flag[1] === 'T';
      break;
  }

  return title ? value[0].toUpperCase() + value.slice(1) : value;
};

/**
 * Format a list of items (strings or parts) using the locale's list pattern.
 *
 * @internal
 */
export const formatListValue = <R>(
  data: LocaleData,
  value: AbstractValue<R>,
  items: R[],
  type: ListPatternType,
): R => {
  const pattern = vectorMapping(selectListPattern(data, type), data);
  let len = items.length;
  if (len < 2) {
    return len === 1 ? items[0] : value.empty();
  }

  if (len === 2) {
    return wrap(pattern.two, value, [items[0], items[1]]);
  }

  let res = wrap(pattern.end, value, [items[len - 2], items[len - 1]]);
  len -= 2;
  while (len-- > 1) {
    res = wrap(pattern.middle, value, [items[len], res]);
  }
  return wrap(pattern.start, value, [items[0], res]);
};

/**
 * Fill a wrapper pattern with string arguments.
 *
 * @internal
 */
export const formatWrapper = (format: string, args: string[]): string => {
  const pattern = parseWrapper(format);
  let res = '';
  for (const node of pattern) {
    if (typeof node === 'string') {
      res += node;
    } else {
      const s = args[node];
      if (s) {
        res += s;
      }
    }
  }
  return res;
};

const wrap = <R>(pattern: string, value: AbstractValue<R>, args: R[]): R => {
  const wrapper = parseWrapper(pattern);
  value.wrap(wrapper, args);
  return value.render();
};

const selectListPattern = (
  data: LocaleData,
  type: ListPatternType,
): Vector1Arrow<ListPatternPositionType> => {
  const p = data.schema.ListPatterns;
  switch (type) {
    case 'unit-long':
      return p.unitLong;
    case 'unit-narrow':
      return p.unitNarrow;
    case 'unit-short':
      return p.unitShort;
    case 'or':
      return p.or;
    case 'and-short':
      return p.andShort;
    case 'and':
    default:
      return p.and;
  }
};
