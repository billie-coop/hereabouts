import { DATE_PATTERN_CHARS, type DateTimeNode } from '../../parsing/date';

import {
  EXTRA_FIELD,
  FIELD_INDEX,
  FIELD_TYPES,
  Field,
  type FieldType,
  getFieldType,
  MISSING_FIELD,
  skeletonFields,
} from './fields';

export interface SkeletonField {
  input: string;
  field: string;
  type: Field;
  width: number;
  repeat: number;
}

/**
 * Represents an abstract date pattern, denoting the fields that appear in
 * the actual pattern. A mutable working record (see skeletonSplit).
 */
export interface DateSkeleton {
  type: number[];
  info: (SkeletonField | undefined)[];
  skeleton: string;
  pattern?: string;
  isDate: boolean;
  isTime: boolean;
}

export const dateSkeleton = (): DateSkeleton => ({
  type: skeletonFields(),
  info: [],
  skeleton: '',
  isDate: false,
  isTime: false,
});

export const skeletonCompound = (s: DateSkeleton): boolean => s.isDate && s.isTime;

export const skeletonHas = (s: DateSkeleton, field: number): boolean => s.type[field] !== 0;

export const skeletonMonthWidth = (s: DateSkeleton): number => {
  const m = s.info[Field.MONTH];
  return m ? m.width : 0;
};

/**
 * Split this compound skeleton, removing all time fields and copying
 * them to another skeleton. Note: this modifies the skeleton passed in.
 */
export const skeletonSplit = (s: DateSkeleton): DateSkeleton => {
  const r = dateSkeleton();
  // Copy time fields to other skeleton and clear them.
  for (let i = Field.DAYPERIOD; i < Field.MAX_TYPE; i++) {
    if (s.type[i] !== 0) {
      r.type[i] = s.type[i];
      // ensure we copy the properties
      const { input, field, type, width, repeat } = s.info[i]!;
      r.info[i] = { input, field, type, width, repeat };
      s.type[i] = 0;
      s.info[i] = undefined;
    }
  }
  s.isTime = false;
  s.skeleton = skeletonCanonical(s);
  r.isTime = true;
  r.skeleton = skeletonCanonical(r);
  return r;
};

/**
 * Build a canonical representation of the skeleton.
 */
export const skeletonCanonical = (s: DateSkeleton): string => {
  let r = '';
  for (let i = 0; i < Field.MAX_TYPE; i++) {
    const info = s.info[i];
    if (info !== undefined) {
      const { field } = info;
      let repeat = info.repeat;
      // Override skeleton repeat for these fields.
      if ('GEzvQ'.indexOf(field) !== -1) {
        repeat = 1;
      }
      for (let j = 0; j < repeat; j++) {
        r += field;
      }
    }
  }
  return r;
};

export const EMPTY = /*#__PURE__*/ dateSkeleton();

/**
 * Parses skeletons, using the locale's preferred and allowed hour formats for the 'j', 'J' and 'C'
 * meta fields.
 */
export interface DateSkeletonParser {
  readonly preferredFlex: readonly DateTimeNode[];
  readonly allowedFlex: readonly DateTimeNode[];
}

export const dateSkeletonParser = (
  preferredFlex: readonly DateTimeNode[],
  allowedFlex: readonly DateTimeNode[],
): DateSkeletonParser => ({
  preferredFlex,
  allowedFlex,
});

export const skeletonParse = (
  p: DateSkeletonParser,
  skeleton: string,
  isPattern: boolean = false,
): DateSkeleton => {
  const s = dateSkeleton();
  parseInto(p, s, skeleton, isPattern);
  return s;
};

const parseInto = (
  p: DateSkeletonParser,
  s: DateSkeleton,
  raw: string,
  isPattern: boolean,
): void => {
  const len = raw.length;
  let noDayPeriod = false;
  let field = '';
  let width = 0;
  let inquote = false;
  let i = 0;
  while (i < len) {
    const ch = raw[i];
    if (inquote) {
      if (ch === "'") {
        inquote = false;
      }
      i++;
      continue;
    }
    if (ch === "'") {
      inquote = true;
    } else if (DATE_PATTERN_CHARS[ch] > 0) {
      if (ch !== field) {
        if (field) {
          noDayPeriod = setDayPeriod(p, s, field, width, noDayPeriod);
        }
        field = ch;
        width = 1;
      } else {
        width++;
      }
    }

    // Lenient parse.. skip all non-field charaters.
    i++;
  }

  // Push the last field. For a non-empty skeleton this will always
  // be true.
  if (width > 0 && field) {
    noDayPeriod = setDayPeriod(p, s, field, width, noDayPeriod);
  }

  // Handle some special hour cycle / day period behaviors
  const hour = s.info[Field.HOUR];
  const dayPeriod = s.info[Field.DAYPERIOD];
  if (noDayPeriod) {
    clearField(s, Field.DAYPERIOD);
  } else if (hour && hour.field) {
    // If we have a 12-hour-cycle but no dayperiod, add the default.
    if (hour.field === 'h' || hour.field === 'K') {
      if (!dayPeriod) {
        // Add the default day period
        const idx = FIELD_INDEX.get('a')![0];
        const row = FIELD_TYPES[idx];
        s.type[Field.DAYPERIOD] = row[2];
        s.info[Field.DAYPERIOD] = {
          input: 'a',
          field: 'a',
          type: Field.DAYPERIOD,
          width: row[3],
          repeat: row[3],
        };
      }
    } else if (dayPeriod && dayPeriod.field) {
      clearField(s, Field.DAYPERIOD);
    }
  }

  s.skeleton = isPattern ? skeletonCanonical(s) : raw;
  if (isPattern) {
    s.pattern = raw;
  }
};

const setDayPeriod = (
  p: DateSkeletonParser,
  s: DateSkeleton,
  field: string,
  width: number,
  noDayPeriod: boolean,
): boolean => {
  if ('jJC'.indexOf(field) !== -1) {
    noDayPeriod = field === 'J';
    setMeta(p, s, field);
  } else {
    setField(s, field, field, width);
  }
  return noDayPeriod;
};

const setMeta = (p: DateSkeletonParser, s: DateSkeleton, field: string): void => {
  const meta = field === 'C' ? p.allowedFlex : p.preferredFlex;
  for (const n of meta) {
    /* istanbul ignore else -- @preserve */
    if (typeof n !== 'string') {
      setField(s, field, n[0], n[1]);
    }
  }
};

const setField = (s: DateSkeleton, input: string, field: string, width: number): void => {
  const ft = getFieldType(field, width);
  // Will never fail as field types are whitelisted at a higher call point
  /* istanbul ignore else -- @preserve */
  if (ft !== undefined) {
    indexField(s, input, field, width, ft);
  }
};

const clearField = (s: DateSkeleton, field: number): void => {
  s.type[field] = 0;
  s.info[field] = undefined;
};

const indexField = (
  s: DateSkeleton,
  input: string,
  field: string,
  width: number,
  ft: FieldType,
): void => {
  const idx = ft[1];
  s.type[idx] = ft[2] + (ft[2] > 0 ? width : 0);
  s.info[idx] = { input, field, type: idx, width, repeat: ft[3] };
  s.isDate = s.isDate || idx < Field.DAYPERIOD;
  s.isTime = s.isTime || idx >= Field.DAYPERIOD;
};

const cmp = (a: number, b: number): number => (a < b ? -1 : a > b ? 1 : 0);

export interface DatePatternMatcherEntry<T> {
  skeleton: DateSkeleton;
  data?: T;
}

export const NONE: DatePatternMatcherEntry<any> = {
  skeleton: /*#__PURE__*/ dateSkeleton(),
};

// Save some work for exact matches.

// Array for matching by distances

/**
 * Cache of date patterns and skeletons with ICU-compatible best-fit matching (mutable: filled
 * with matcherAdd, then matcherSort).
 */
export interface DatePatternMatcher<T> {
  // Save some work for exact matches.
  readonly exact: { [x: string]: DatePatternMatcherEntry<T> };
  // Array for matching by distances
  readonly entries: DatePatternMatcherEntry<T>[];
}

export const datePatternMatcher = <T>(): DatePatternMatcher<T> => ({ exact: {}, entries: [] });

export const matcherAdd = <T>(m: DatePatternMatcher<T>, skeleton: DateSkeleton, data?: T): void => {
  const key = skeleton.skeleton;
  // Avoid adding patterns with duplicate skeletons
  if (m.exact[key] === undefined) {
    const entry: DatePatternMatcherEntry<T> = {
      skeleton,
      data,
    };
    m.exact[key] = entry;
    m.entries.push(entry);
  }
};

/**
 * Sort entries once they have all been added.
 */
export const matcherSort = <T>(m: DatePatternMatcher<T>): void => {
  m.entries.sort((a, b) => cmp(a.skeleton.skeleton.length, b.skeleton.skeleton.length));
};

// TODO: future options to control the match

export const matcherMatch = <T>(
  m: DatePatternMatcher<T>,
  input: DateSkeleton,
): DatePatternMatcherEntry<T> => {
  const match = m.exact[input.skeleton];
  if (match !== undefined) {
    return match;
  }

  let best: DatePatternMatcherEntry<T> = NONE;
  let bestDist: number = Number.MAX_SAFE_INTEGER;
  let bestKind: number = 0;

  for (const entry of m.entries) {
    const dist = getDistance(entry.skeleton, input);
    if (dist < bestDist) {
      best = entry;
      bestDist = dist;
      bestKind = getKindDistance(entry.skeleton, input);
      if (dist === 0) {
        break;
      }
    } else if (dist === bestDist) {
      // Tie on field distance: prefer the candidate that does not
      // change the width class of a date field (month, year, day).
      const kind = getKindDistance(entry.skeleton, input);
      if (kind < bestKind) {
        best = entry;
        bestKind = kind;
      }
    }
  }
  return best;
};

/**
 * Secondary comparison value for candidates that tie on getDistance.
 * Sums the field width differences for the date fields (month, year,
 * day) that are present in both skeletons.
 *
 * ICU's best-fit matching prefers candidates that do not change the
 * width class of date fields. For input 'yMMMMdE' (long month, short
 * weekday) this selects the pattern with the long month, adjusting the
 * weekday width, over the pattern with the abbreviated month, adjusting
 * the weekday exactly. The adjusted wider pattern carries the literals
 * (e.g. 'de' in es, 'den' in da) that the narrower pattern lacks, and
 * keeps a named month where the narrower pattern renders digits.
 */
const getKindDistance = (a: DateSkeleton, b: DateSkeleton): number => {
  let result = 0;
  for (const i of [Field.MONTH, Field.YEAR, Field.DAY]) {
    const atype = a.type[i];
    const btype = b.type[i];
    if (atype !== 0 && btype !== 0) {
      result += Math.abs(atype - btype);
    }
  }
  return result;
};

/**
 * Make field width adjustments to pattern using the given skeleton.
 */
export const matcherAdjust = (
  pattern: readonly DateTimeNode[],
  skeleton: DateSkeleton,
  matched: DateSkeleton,
  decimal: string,
): readonly DateTimeNode[] => {
  const r: DateTimeNode[] = [];
  for (const n of pattern) {
    if (typeof n === 'string') {
      r.push(n);
      continue;
    }

    const [field, width] = n;
    const p = getFieldType(field, width)!;

    // Adjust field and width to match skeleton below
    let adjfield = field;
    let adjwidth = width;

    const i = p[1];

    // For hour, minute and second we use the width from the pattern.
    if (i === Field.HOUR || i === Field.MINUTE || i === Field.SECOND) {
      r.push([adjfield, adjwidth]);

      // See if skeleton requested fractional seconds and augment the seconds field.
      if (i === Field.SECOND) {
        const info = skeleton.info[Field.FRACTIONAL_SECOND];
        if (info !== undefined) {
          r.push(decimal);
          r.push([info.field, info.width]);
        }
      }
      continue;
    }

    const ptype = p[2];
    const stype = skeleton.type[i];
    // TR35 "Matching Skeletons": when the matched pattern's skeleton field
    // length equals the requested field length, the pattern's field length
    // is authoritative (locale data overrides the requested length).
    // Type equality covers both digit count (numeric) and width class (named).
    if (stype !== 0 && matched.type[i] === stype) {
      r.push(n);
      continue;
    }
    // Ensure magnitudes are the same
    if ((ptype < 0 && stype < 0) || (ptype > 0 && stype > 0)) {
      const _info = skeleton.info[i];
      // Since the 'i' comes from a parsed date pattern, this should
      // always be defined.
      /* istanbul ignore else -- @preserve */
      if (_info) {
        adjfield = _info.field;
        adjwidth = _info.width;
      }
    }

    r.push([adjfield, adjwidth]);
  }

  // TODO: handle appending missing fields
  return r;
};

// TODO: mask is currently unused
const getDistance = (a: DateSkeleton, b: DateSkeleton, _mask: number = 0): number => {
  let result = 0;
  for (let i = 0; i < Field.MAX_TYPE; i++) {
    // const atype = mask > 0 && (mask & (1 << i)) === 0 ? 0 : a.type[i];
    const atype = a.type[i];
    const btype = b.type[i];
    if (atype === btype) {
      continue;
    }
    if (atype === 0) {
      result += EXTRA_FIELD;
    } else if (btype === 0) {
      result += MISSING_FIELD;
    } else {
      // Named field types already bucket equivalent widths together
      // (E/EE/EEE all parse to the same 'short' type), so only short <>
      // long (and narrow/shorter) widths differ here.
      result += Math.abs(atype - btype);
    }
  }
  return result;
};
