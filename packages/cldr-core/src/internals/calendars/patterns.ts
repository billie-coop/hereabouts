import type { CalendarSchema, PluralType } from '@phensley/cldr-types';
import { createLRU, type LRU, lruGet, lruSet } from '@phensley/cldr-utils';
import { decimal } from '@phensley/decimal';
import { pluralCardinal } from '@phensley/plurals';
import type { LocaleData } from '../../locale-data';
import { type DateTimeNode, parseDatePattern as parseDatePatternRaw } from '../../parsing/date';
import { fieldGet, vectorMapping } from '../../schema/schema/arrows';
import { dateWeekOfMonth, dateWeekOfYear } from '../../systems/calendars/calendar';
import type { CalendarDate } from '../../systems/calendars/types';
import { timeData, timeStrings } from './autogen.timedata';
import { parseDatePattern } from './internal';
import {
  type DatePatternMatcher,
  type DatePatternMatcherEntry,
  type DateSkeleton,
  type DateSkeletonParser,
  datePatternMatcher,
  dateSkeletonParser,
  matcherAdd,
  matcherAdjust,
  matcherMatch,
  matcherSort,
  skeletonParse,
} from './skeleton';

export interface CachedSkeletonRequest {
  dateSkel?: DateSkeleton;
  date?: readonly DateTimeNode[];
  time?: readonly DateTimeNode[];
}

export type StandaloneFieldType = 'dayPeriods' | 'eras' | 'months' | 'quarters' | 'weekdays';

export type TwoLevelMap = { [x: string]: { [y: string]: string } };
export type ThreeLevelMap = { [x: string]: { [y: string]: { [z: string]: string } } };

export interface IntervalSkeleton {
  skeleton: DateSkeleton;
  patterns: any;
}

/**
 * All available date formatting patterns of one locale for a given calendar schema.
 * We must cache all available skeletons in order to perform best-fit matching
 * to a given input skeleton. We also need to cache the standard date and time
 * patterns for use in best-fit matching. Built once per locale data and calendar.
 */
export interface CalendarPatterns {
  readonly data: LocaleData;
  readonly schema: CalendarSchema;
  /** Gregorian patterns select pluralized skeleton patterns ('yw', 'MMMMW') by plural category. */
  readonly gregorian: boolean;
  readonly language: string;
  readonly region: string;
  readonly skeletonParser: DateSkeletonParser;
  readonly dateFormats: { [x: string]: string };
  readonly dateSkeletons: { [x: string]: string };
  readonly timeFormats: { [x: string]: string };
  readonly timeSkeletons: { [x: string]: string };
  readonly wrapperFormats: { [x: string]: string };
  readonly wrapperFormatsAt: { [x: string]: string };
  readonly availableMatcher: DatePatternMatcher<any>;
  readonly intervalMatcher: DatePatternMatcher<IntervalSkeleton>;
  readonly rawIntervalFormats: { [x: string]: { [y: string]: string } };
  readonly intervalFallback: string;
  readonly skeletonRequestCache: LRU<CachedSkeletonRequest>;
  readonly rawAvailableFormats: { [x: string]: string };
  readonly rawPluralFormats: { [x: string]: { [y: string]: string } };
}

/**
 * Build the patterns record for a calendar schema.
 */
export const calendarPatterns = (
  data: LocaleData,
  schema: CalendarSchema,
  gregorian: boolean,
  cacheSize: number = 50,
): CalendarPatterns => {
  const language = data.language;
  const region = data.region;

  // Fetch this locale's main formats
  const dateFormats = vectorMapping(schema.dateFormats, data);
  const timeFormats = vectorMapping(schema.timeFormats, data);

  const p: CalendarPatterns = {
    data,
    schema,
    gregorian,
    language,
    region,
    skeletonParser: buildSkeletonParser(language, region),
    dateFormats,
    dateSkeletons: vectorMapping(schema.dateSkeletons, data),
    timeFormats,
    timeSkeletons: vectorMapping(schema.timeSkeletons, data),
    wrapperFormats: vectorMapping(schema.dateTimeFormats, data),
    wrapperFormatsAt: vectorMapping(schema.dateTimeFormatsAt, data),
    availableMatcher: datePatternMatcher(),
    intervalMatcher: datePatternMatcher(),
    // Fetch skeletons and build best-fit matchers
    rawAvailableFormats: vectorMapping(schema.availableFormats, data),
    rawPluralFormats: vectorMapping(schema.pluralFormats, data),
    rawIntervalFormats: vectorMapping(schema.intervalFormats, data),
    intervalFallback: fieldGet(schema.intervalFormatFallback, data),
    skeletonRequestCache: createLRU<CachedSkeletonRequest>(cacheSize),
  };
  buildAvailableMatcher(p);
  buildIntervalMatcher(p);
  return p;
};

export const patternsDayPeriods = (p: CalendarPatterns): ThreeLevelMap =>
  vectorMapping(p.schema.standAlone.dayPeriods, p.data);

export const patternsEras = (p: CalendarPatterns): ThreeLevelMap =>
  vectorMapping(p.schema.eras, p.data);

export const patternsMonths = (p: CalendarPatterns): TwoLevelMap =>
  vectorMapping(p.schema.standAlone.months, p.data);

export const patternsWeekdays = (p: CalendarPatterns): TwoLevelMap =>
  vectorMapping(p.schema.standAlone.weekdays, p.data);

export const patternsQuarters = (p: CalendarPatterns): TwoLevelMap =>
  vectorMapping(p.schema.standAlone.quarters, p.data);

export const patternsParseSkeleton = (p: CalendarPatterns, raw: string): DateSkeleton =>
  skeletonParse(p.skeletonParser, raw);

export const patternsGetCachedRequest = (
  p: CalendarPatterns,
  key: string,
): CachedSkeletonRequest | undefined => lruGet(p.skeletonRequestCache, key);

export const patternsSetCachedRequest = (
  p: CalendarPatterns,
  key: string,
  req: CachedSkeletonRequest,
): void => {
  lruSet(p.skeletonRequestCache, key, req);
};

export const patternsDatePattern = (p: CalendarPatterns, width: string): readonly DateTimeNode[] =>
  parseDatePattern(p.dateFormats[width] || '');

export const patternsTimePattern = (p: CalendarPatterns, width: string): readonly DateTimeNode[] =>
  parseDatePattern(p.timeFormats[width] || '');

export const patternsWrapperPattern = (
  p: CalendarPatterns,
  width: string,
  atTime: boolean,
): string => {
  const w = p.wrapperFormatsAt[width];
  return atTime && w ? w : p.wrapperFormats[width] || '';
};

/**
 * Pattern for a skeleton. For the gregorian calendar this applies pluralization rules to select a
 * skeleton pattern. Note: this is slightly future-proofing since at the time of this writing these
 * patterns don't actually differ based on the plural category. This is here so the design has a
 * chance of supporting pluralization of skeleton patterns in the future.
 */
export const patternsAvailablePattern = (
  p: CalendarPatterns,
  d: CalendarDate,
  s: DateSkeleton,
): readonly DateTimeNode[] => {
  if (!p.gregorian) {
    const pattern = s.pattern
      ? s.pattern
      : p.rawAvailableFormats[s.skeleton] || (p.rawPluralFormats.other || {})[s.skeleton];
    return parseDatePattern(pattern || '');
  }

  let plural: PluralType = 'other';
  let pattern = s.pattern;
  if (!pattern) {
    switch (s.skeleton) {
      case 'MMMMW':
      case 'yw': {
        const week = decimal(s.skeleton === 'yw' ? dateWeekOfYear(d) : dateWeekOfMonth(d));
        plural = pluralCardinal(p.data.plurals, week) as PluralType;
        pattern = p.rawPluralFormats[plural][s.skeleton];
        break;
      }
      default:
        pattern = p.rawAvailableFormats[s.skeleton];
        break;
    }
  }
  return parseDatePattern(pattern);
};

export const patternsIntervalPattern = (
  p: CalendarPatterns,
  field: string,
  skeleton: string,
): readonly DateTimeNode[] => {
  const group = p.rawIntervalFormats[field];
  const pattern = group ? group[skeleton] : '';
  return parseDatePattern(pattern || '');
};

export const patternsIntervalFallback = (p: CalendarPatterns): string => p.intervalFallback;

export const patternsAdjust = (
  pattern: readonly DateTimeNode[],
  skeleton: DateSkeleton,
  matched: DateSkeleton,
  decimalSymbol: string,
): readonly DateTimeNode[] => matcherAdjust(pattern, skeleton, matched, decimalSymbol);

export const patternsMatchAvailable = (p: CalendarPatterns, skeleton: DateSkeleton): DateSkeleton =>
  matcherMatch(p.availableMatcher, skeleton).skeleton;

export const patternsMatchInterval = (
  p: CalendarPatterns,
  skeleton: DateSkeleton,
): DatePatternMatcherEntry<IntervalSkeleton> | undefined =>
  matcherMatch(p.intervalMatcher, skeleton);

export const patternsTimeData = (p: CalendarPatterns): [string, string] =>
  timeDataFor(p.language, p.region);

const timeDataFor = (language: string, region: string): [string, string] => {
  const world = timeData['']['001'];
  let r: number | undefined;
  const lang = timeData[language];
  if (lang !== undefined) {
    r = lang[region];
  }
  if (r === undefined) {
    r = timeData[''][region];
  }
  return timeStrings[r !== undefined ? r : world].split('|') as [string, string];
};

const buildSkeletonParser = (language: string, region: string): DateSkeletonParser => {
  const pair = timeDataFor(language, region);
  const allowed = pair[0].split(' ').map(parseDatePatternRaw);
  const preferred = parseDatePatternRaw(pair[1]);
  return dateSkeletonParser(preferred, allowed[0]);
};

const buildAvailableMatcher = (p: CalendarPatterns): void => {
  for (const width of Object.keys(p.dateFormats)) {
    const ds = skeletonParse(p.skeletonParser, p.dateFormats[width], true);
    const dkey = p.dateSkeletons[width];
    if (dkey) ds.skeleton = dkey; // CLDR-authoritative key
    matcherAdd(p.availableMatcher, ds);
    const ts = skeletonParse(p.skeletonParser, p.timeFormats[width], true);
    const tkey = p.timeSkeletons[width];
    if (tkey) ts.skeleton = tkey; // CLDR-authoritative key
    matcherAdd(p.availableMatcher, ts);
  }

  // For the pluralized formats use the 'other' category which will
  // be populated for every locale.
  for (const formats of [p.rawAvailableFormats, p.rawPluralFormats.other || {}]) {
    for (const skeleton of Object.keys(formats)) {
      matcherAdd(p.availableMatcher, skeletonParse(p.skeletonParser, skeleton));
    }
  }
  matcherSort(p.availableMatcher);
};

const buildIntervalMatcher = (p: CalendarPatterns): void => {
  for (const rawSkeleton of Object.keys(p.rawIntervalFormats)) {
    const patterns = p.rawIntervalFormats[rawSkeleton];
    if (Object.keys(patterns).length === 0) {
      continue;
    }
    const skeleton = skeletonParse(p.skeletonParser, rawSkeleton);
    matcherAdd(p.intervalMatcher, skeleton, { skeleton, patterns });
  }
  matcherSort(p.intervalMatcher);
};
