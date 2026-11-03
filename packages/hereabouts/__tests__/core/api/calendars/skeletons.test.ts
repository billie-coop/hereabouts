import {
  type DateSkeleton,
  datePatternMatcher,
  dateSkeletonParser,
  matcherAdd,
  matcherMatch,
  matcherSort,
  skeletonCanonical,
  skeletonCompound,
  skeletonParse,
  skeletonSplit,
} from '../../../../src/core/internals/calendars/skeleton';

const PARSER = dateSkeletonParser([['h', 1]], [['h', 1]]);
const parse = (s: string, isPattern: boolean = false) => skeletonParse(PARSER, s, isPattern);

test('parsing skeleton hour cycle selection', () => {
  let parser = dateSkeletonParser([['H', 1]], [['H', 1]]);

  expect(skeletonCanonical(skeletonParse(parser, 'j'))).toEqual('H');
  expect(skeletonCanonical(skeletonParse(parser, 'J'))).toEqual('H');
  expect(skeletonCanonical(skeletonParse(parser, 'C'))).toEqual('H');

  parser = dateSkeletonParser([['h', 1]], [['h', 1]]);

  expect(skeletonCanonical(skeletonParse(parser, 'jm'))).toEqual('ahm');
  expect(skeletonCanonical(skeletonParse(parser, 'Jm'))).toEqual('hm');
  expect(skeletonCanonical(skeletonParse(parser, 'Cm'))).toEqual('ahm');
});

test('compound split', () => {
  let d: DateSkeleton;
  let t: DateSkeleton;

  // empty
  d = parse('');
  expect(skeletonCompound(d)).toEqual(false);
  expect(d.isDate).toEqual(false);
  expect(d.isTime).toEqual(false);

  d = parse('GyMMMdhmsv');

  expect(skeletonCompound(d)).toEqual(true);
  expect(d.isDate).toEqual(true);
  expect(d.isTime).toEqual(true);

  t = skeletonSplit(d);
  expect(skeletonCompound(d)).toEqual(false);
  expect(d.isDate).toEqual(true);
  expect(d.isTime).toEqual(false);
  expect(skeletonCanonical(d)).toEqual('GyMMMd');

  expect(skeletonCompound(t)).toEqual(false);
  expect(t.isDate).toEqual(false);
  expect(t.isTime).toEqual(true);
  expect(skeletonCanonical(t)).toEqual('ahmsv');
});

test('parsing skeletons', () => {
  // date: full, long, medium, short
  expect(skeletonCanonical(parse('EEEE, MMMM d, y', true))).toEqual('yMMMMEd');
  expect(skeletonCanonical(parse('MMMM d, y', true))).toEqual('yMMMMd');
  expect(skeletonCanonical(parse('MMM d, y', true))).toEqual('yMMMd');
  expect(skeletonCanonical(parse('M/d/yy', true))).toEqual('yMd');

  // time: full, long, medium, short
  expect(skeletonCanonical(parse('h:mm:ss a zzzz', true))).toEqual('ahmsz');
  expect(skeletonCanonical(parse('h:mm:ss a z', true))).toEqual('ahmsz');
  expect(skeletonCanonical(parse('h:mm:ss a', true))).toEqual('ahms');
  expect(skeletonCanonical(parse('h:mm a', true))).toEqual('ahm');

  // patterns that equal their skeletons (not all are, for backwards-compat reasons)
  expect(skeletonCanonical(parse('h B', true))).toEqual('Bh');
  expect(skeletonCanonical(parse('h:mm B', true))).toEqual('Bhm');
  expect(skeletonCanonical(parse('h:mm:ss B', true))).toEqual('Bhms');
  expect(skeletonCanonical(parse('d', true))).toEqual('d');
  expect(skeletonCanonical(parse('E, MMM d, y G', true))).toEqual('GyMMMEd');
  expect(skeletonCanonical(parse(`'week' W 'of' MMMM`, true))).toEqual('MMMMW');
  expect(skeletonCanonical(parse('yMMMd', true))).toEqual('yMMMd');
  expect(skeletonCanonical(parse('h:mm:ss a v', true))).toEqual('ahmsv');
});

test('matching small fields', () => {
  const skeletons = ['H', 'Hm', 'h', 'hm', 'y', 'M', 'd'];
  const matcher = datePatternMatcher<any>();
  skeletons.map((s) => parse(s)).forEach((s) => matcherAdd(matcher, s));

  // 'H' ranks above 'h' in the field scoring.
  const skel = (s: string) => matcherMatch(matcher, parse(s)).skeleton.skeleton;
  expect(skel('m')).toEqual('Hm');
  expect(skel('s')).toEqual('H');
  expect(skel('v')).toEqual('H');
});

test('matching field widths', () => {
  const skeletons = [
    'y',
    'yM',
    'yMEd',
    'yMMM',
    'yMMMEEEEd',
    'yMMMEd',
    'yMMMM',
    'yMMMMEEEEd',
    'yMMMMEd',
    'yMMMMd',
    'yMMMd',
    'yMd',
  ];
  const matcher = datePatternMatcher<any>();
  skeletons.map((s) => parse(s)).forEach((s) => matcherAdd(matcher, s));

  const skel = (s: string) => matcherMatch(matcher, parse(s)).skeleton.skeleton;
  expect(skel('yMEd')).toEqual('yMEd');
  expect(skel('yMEEd')).toEqual('yMEd');
  expect(skel('yMMEEd')).toEqual('yMEd');
  expect(skel('yMMMEEd')).toEqual('yMMMEd');
  expect(skel('yMMMEEEd')).toEqual('yMMMEd');
  expect(skel('yMMMMEEEEd')).toEqual('yMMMMEEEEd');
  // Field width constraints enforced
  expect(skel('yMMMMMMEEEEEEd')).toEqual('yMMMEd');
});

test('matching ties prefer unchanged date field widths', () => {
  const matcher = datePatternMatcher<any>();

  // Model the standard 'full' format shadowing the available 'yMMMMEd'
  // skeleton: both canonicalize to the same key, but the full pattern
  // carries a long weekday (EEEE) and the full pattern's literals.
  matcherAdd(matcher, parse('EEEE, MMMM d, y', true));
  matcherAdd(matcher, parse('yMMMEd'));
  matcherAdd(matcher, parse('yMMMd'));
  matcherAdd(matcher, parse('yMd'));
  matcherSort(matcher);

  const skel = (s: string) => matcherMatch(matcher, parse(s)).skeleton.skeleton;

  // Long month + short weekday ties between the long-month pattern
  // (weekday width off by one) and the short-month pattern (month width
  // off by one). The long-month pattern must win: adjusting the weekday
  // width keeps the pattern's literals, while widening the month cannot
  // restore them (and can degenerate a named month to digits).
  expect(skel('yMMMMdE')).toEqual('yMMMMEd');
  expect(skel('EdMMMMy')).toEqual('yMMMMEd');

  // Short month + short weekday still selects the short-month pattern,
  // as does a numeric month (never the long-month pattern).
  expect(skel('yEEEMMMd')).toEqual('yMMMEd');
  expect(skel('yMMEEd')).toEqual('yMMMEd');

  // Long weekday matches the long-month pattern exactly.
  expect(skel('yMMMMEEEEd')).toEqual('yMMMMEd');
});
