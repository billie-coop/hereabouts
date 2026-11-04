/**
 * Builds the shared ICU message cases in `conformance/messageformat.json`: the matcher, the
 * parser (including malformed and garbage patterns), evaluation, the argument converter, the
 * caching formatter, and the translator.
 *
 * Argument values are JSON, with a few encodings for what JSON can't hold:
 * `{"$decimal": "1.50"}` is a Decimal, `{"$number": "NaN"}` a non-finite number, and
 * `{"$object": ...}` any other object. Custom formatters are named; their behavior is fixed
 * here (and mirrored in the Zig test): `upper` upper-cases its first argument as a string,
 * `list` describes its arguments and options, and any other name returns its own name.
 */
import { decimal, decimalToString, isDecimal } from '../../src/decimal';
import {
  type ApostropheMode,
  buildMessageMatcher,
  checkCatalogs,
  createMessageFormatter,
  createTranslator,
  defaultMessageArgConverter,
  evaluateMessage,
  formatMessage,
  isMessageKey,
  type MessageArg,
  type MessageCode,
  type MessageFormatFuncMap,
  type MessageState,
  messageArgNames,
  messageFormatterToString,
  parseMessagePattern,
  resolveMessage,
  translate,
} from '../../src/messageformat';
import { getPluralRules } from '../../src/plurals';
import { type ConformanceCase, collector, type Random, random } from './_shared';

// ---------------------------------------------------------------------------------------------
// Arguments and formatters

/** A JSON-encoded argument as a JavaScript value. */
const arg = (v: unknown): MessageArg => {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if ('$decimal' in o) {
      return decimal(o.$decimal as string);
    }
    if ('$number' in o) {
      return Number(o.$number);
    }
    if ('$object' in o) {
      return o.$object;
    }
  }
  return v;
};

const args = (xs: unknown[]): MessageArg[] => xs.map(arg);

const named = (o: Record<string, unknown>): Record<string, MessageArg> =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, arg(v)]));

const kind = (a: unknown): string =>
  a === undefined
    ? 'undefined'
    : a === null
      ? 'null'
      : isDecimal(a)
        ? `decimal:${decimalToString(a)}`
        : typeof a === 'function'
          ? 'function'
          : typeof a === 'object'
            ? 'object'
            : `${typeof a}:${String(a)}`;

/** Formatters by name, in the given order. */
const formattersFor = (names: string[]): MessageFormatFuncMap => {
  const f: MessageFormatFuncMap = {};
  for (const name of names) {
    f[name] =
      name === 'upper'
        ? (a) => defaultMessageArgConverter.asString(a[0]).replace(/[a-z]/g, (c) => c.toUpperCase())
        : name === 'list'
          ? (a, options) => `${a.length}[${a.map(kind).join(',')}](${options.join(',')})`
          : () => name;
  }
  return f;
};

const CUSTOM = ['upper', 'list', 'quux', 'quuxbar', 'quuxbaz', 'datetime-interval'];

const mode = (m: string | null): ApostropheMode | undefined =>
  m === null ? undefined : (m as ApostropheMode);

// ---------------------------------------------------------------------------------------------
// Fixed inputs, mostly from the unit tests

const MATCHER_NAMES = ['foo', 'bar'];

/** [names, text, start, end, ops]; end -1 means the text length. */
const MATCHER: [string[], string, number, number, string[]][] = [
  [['foo'], 'abc foo', 0, -1, ['arguments', 'spaces', 'formatter', 'complete']],
  [MATCHER_NAMES, ' \t , , \n   , ﻿ \n ', 0, -1, ['spaces', 'complete']],
  [MATCHER_NAMES, ' abc', 0, -1, ['complete', 'char']],
  [MATCHER_NAMES, 'abc', 0, -1, ['char']],
  [MATCHER_NAMES, 'abc', 3, -1, ['char', 'complete']],
  [MATCHER_NAMES, '  a ::foo 123', 0, -1, ['spaces', 'arguments', 'spaces', 'arguments']],
  [MATCHER_NAMES, 'a;b;c  d;e;f', 0, -1, ['arguments', 'spaces', 'arguments']],
  [MATCHER_NAMES, '::quux', 0, -1, ['arguments']],
  [MATCHER_NAMES, 'abc;::quux', 0, -1, ['arguments', 'char']],
  [MATCHER_NAMES, '::', 0, -1, ['identifier']],
  [MATCHER_NAMES, ';;', 0, -1, ['identifier']],
  [MATCHER_NAMES, '{0 foo a b c}', 2, -1, ['formatter']],
  [MATCHER_NAMES, '{0 foo a b c}', 3, -1, ['formatter', 'options']],
  [MATCHER_NAMES, '{0 foo a b c}', 4, -1, ['formatter']],
  [MATCHER_NAMES, '{0 ::}', 3, -1, ['formatter', 'options']],
  [MATCHER_NAMES, '  a ::foo 123  , .bar } .quux', 0, -1, ['spaces', 'options', 'char']],
  [MATCHER_NAMES, 'offset:12', 0, -1, ['pluralOffset', 'complete']],
  [MATCHER_NAMES, 'offset:-12', 0, -1, ['pluralOffset']],
  [MATCHER_NAMES, 'offset:-infinity', 0, -1, ['pluralOffset', 'identifier']],
  [MATCHER_NAMES, 'offset:ab', 0, -1, ['pluralOffset']],
  [MATCHER_NAMES, 'xoffset:ab', 0, -1, ['pluralOffset']],
  [MATCHER_NAMES, 'offset:99999999999999999999999', 0, -1, ['pluralOffset']],
  [MATCHER_NAMES, 'offset:-0', 0, -1, ['pluralOffset']],
  [MATCHER_NAMES, '=2', 0, -1, ['pluralChoice']],
  [MATCHER_NAMES, '=2.50 x', 0, -1, ['pluralChoice', 'spaces', 'pluralChoice']],
  [MATCHER_NAMES, '=2. x', 0, -1, ['pluralChoice', 'char']],
  [MATCHER_NAMES, '=x', 0, -1, ['pluralChoice']],
  [MATCHER_NAMES, 'two', 0, -1, ['pluralChoice']],
  [MATCHER_NAMES, 'many', 0, -1, ['pluralChoice']],
  [MATCHER_NAMES, 'others', 0, -1, ['pluralChoice', 'char']],
  [MATCHER_NAMES, 'xyz', 0, -1, ['pluralChoice']],
  [MATCHER_NAMES, '01.9;012;0.5;007;0abc', 0, -1, ['arguments', 'char']],
  [MATCHER_NAMES, '0abc', 0, -1, ['arguments', 'identifier']],
  [MATCHER_NAMES, '12345678901234567890123;99', 0, -1, ['arguments']],
  [MATCHER_NAMES, `${'9'.repeat(400)};x`, 0, -1, ['arguments']],
  [MATCHER_NAMES, 'a; 12;　12x', 0, -1, ['arguments']],
  [MATCHER_NAMES, 'naïve;été x', 0, -1, ['arguments', 'spaces', 'identifier']],
  [MATCHER_NAMES, '«»–x', 0, -1, ['identifier', 'arguments']],
  [MATCHER_NAMES, 'a;', 0, -1, ['arguments', 'complete']],
  [MATCHER_NAMES, 'a;b c', 0, 2, ['arguments', 'complete']],
  [MATCHER_NAMES, 'abc foo', 0, 2, ['arguments', 'spaces', 'formatter']],
  [MATCHER_NAMES, 'abc foo', 4, 5, ['formatter', 'options']],
  [MATCHER_NAMES, 'foobar', 0, -1, ['formatter', 'formatter']],
  [
    ['plural2', 'x-y'],
    'plural2 selectordinal x-y',
    0,
    -1,
    ['formatter', 'spaces', 'formatter', 'spaces', 'formatter'],
  ],
  [MATCHER_NAMES, 'abc def', 5, 2, ['arguments', 'spaces', 'identifier']],
  [MATCHER_NAMES, 'abc', 9, 3, ['arguments', 'spaces', 'complete']],
];

/** Patterns from the parser, evaluation and garbage tests, plus malformed ones. */
const PATTERNS: string[] = [
  '{name} {height , select , tall {is tall} short {is short} mid {is of average height}}',
  '{0, plural, =0 {is zero} =53 {is fifty-three} one {is one} other {is other}}',
  '{0, decimal, percent}',
  '{0, number, percent}',
  '{0, foobar, percent}',
  'A {0, foobar, percent} B',
  'A {0, select, other {1 foobar baz}} B',
  'A {0 select foo {1 plural one{}}} B',
  'A {0 select foo {{1 plural offset:1 one{}}}} B',
  'hello {0 plural one',
  '{',
  '}',
  '{}',
  '{ }',
  '{{}}',
  '}{',
  "'{' 0 plural one {foo bar} '}'",
  "'{'0 plural one {1 select baz {hi there}} '}'",
  '# {0 plural one {# = # item} few {#} other {# items}} #',
  '{0 plural one { {A # B} }}',
  '# {0 plural one {-# = # item} few {-#} other {-# items}} #',
  "{0} '{1}' {2}",
  '{0}{-1}',
  '{0 plural one {-ONE #} other {OTHER #}}',
  '{0}{-0 missing formatter}{1}',
  '{0}{a}{-0}{-a}{}{-}{--}{---}',
  '{0 plural =1 {1} one {one} many {many} other {other}}',
  '{0 plural offset:1 =1 {1} other{other}}',
  '{2 select male {male} female {female} other {other}}',
  '{0 datetime long}',
  '{0;1 datetime-interval yMMMd}',
  '{0 currency format:long}',
  '{0 unit in:seconds sequence:day,hour,minute}',
  '{0 selectordinal one{st} other{th}}',
  '{0 number format:long}',
  '{0 plural other}',
  '{0 plural one {x} two}',
  '{0 plural others {x}}',
  '{0 plural =1.5 {x} =1. {y}}',
  '{0 plural one {x} {y}}',
  '{0 select}',
  '{0 select a {x} b}',
  '{0 select a x}',
  "{0 select a'{x}' {y}}",
  "{0 select a {x'}'y} other {z}}",
  '{0 plural offset:2 other {#}}',
  '{0 plural offset:x other {#}}',
  '{0 plural offset:99999999999999999999999 other {#}}',
  '{0 plural =0 {zero} =1 {one} =2 {two}}',
  '{0, plural,}',
  '{0 upper}',
  '{0;1;n list a b ::c "d" {x}}',
  '{0 quux}{0 quuxbar}{0 quuxbaz}{0 quuxba}',
  '{0, upper, }',
  '{x, select, a {{y, plural, one {# {z}} other {#}}} other {#}}',
  "{0 plural one {'#'} other {''#''}}",
  "it's {0}",
  "it''s {0}",
  "it's '{0}'",
  "Here's {name}",
  "Voici l''{name}",
  "Voici l'{name}",
  "dû le {date} (aujourd'hui)",
  "Use '{' and '}' around '{name}' ({name}), it''s fine",
  "'unterminated {0}",
  "{0 plural one {it's #} other {it''s #}}",
  "{0 plural one {'#' x} other {'# y}}",
  "a '#' b '{' c",
  "{0 select x {'{'} other {'}'}}",
  "'{0 plural one {x}",
  "{0 select a {'} other {b}}",
  '{012} {0abc} {01.9} {007}',
  '{12345678901234567890123}',
  `{${'9'.repeat(400)}}`,
  '{ a}',
  '{naïve} {été, select, a {x} other {y}}',
  '{😀} {x😀y}',
  '{a b}',
  '{a,}',
  '{a, }',
  '{a,, select,, x {y}}',
  '{0 select x {y} other {z} }',
  '{toString} {constructor} {__proto__} {valueOf, select, other {v}}',
  '',
  'plain text',
  '{-}',
  '{-',
  '{0 plural one {-} other {-x}}',
];

const OPTIONS: [boolean, string | null][] = [
  [false, null],
  [false, 'double-optional'],
  [false, 'double-required'],
  [true, null],
  [true, 'double-optional'],
];

// ---------------------------------------------------------------------------------------------
// Random inputs

const VALID: string[] = [
  '{0 plural =1 {1} one {one} many {many} other {other}}',
  '{0 plural offset:1 =1 {1} other{other}}',
  '{2 select male {male} female {female} other {other}}',
  '{0 datetime-interval long}',
  '{0;1 list yMMMd}',
  '{0 upper format:long}',
  '{0 quux in:seconds sequence:day,hour,minute}',
  '{0 selectordinal one{st} other{th}}',
  "{n plural one {it's #} other {'#' x}}",
];

const GARBAGE: string[] = [',', "'", "''", ' ', '{', '}', '*', ';', '!', '#', '-'];

const garbage = (r: Random): string => {
  const v = r.pick(VALID);
  const threshold = r.pick([0.05, 0.3, 0.7]);
  let out = '';
  for (let i = 0; i < v.length; i++) {
    out += r.next() < threshold ? GARBAGE[(i + r.int(0, 3)) % GARBAGE.length] : v[i];
  }
  return out;
};

const ARG_NAMES = ['0', '1', '2', 'n', 'name', 'x', 'missing', 'toString'];
const TEXTS = ['hello ', 'a#b', "it's ", "''", "'{x}'", ' ', '#', "'#'", 'x}', '{', '-', 'é '];

const genMessage = (r: Random, depth: number): string => {
  let out = '';
  const n = r.int(1, depth > 1 ? 2 : 4);
  for (let i = 0; i < n; i++) {
    const x = r.next();
    const name = r.pick(ARG_NAMES);
    const body = () => (depth < 3 && r.next() < 0.3 ? genMessage(r, depth + 1) : r.pick(TEXTS));
    if (x < 0.3) {
      out += r.pick(TEXTS);
    } else if (x < 0.45) {
      out += `{${name}}`;
    } else if (x < 0.65) {
      const offset = r.next() < 0.2 ? ` offset:${r.int(-1, 2)}` : '';
      const k = r.int(1, 3);
      let choices = '';
      for (let j = 0; j < k; j++) {
        choices += ` ${r.pick(['=0', '=1', '=2', '=1.5', 'zero', 'one', 'two', 'few', 'many', 'other'])} {${body()}}`;
      }
      out += `{${name}, ${r.pick(['plural', 'selectordinal'])},${offset}${choices}}`;
    } else if (x < 0.8) {
      const k = r.int(1, 3);
      let choices = '';
      for (let j = 0; j < k; j++) {
        choices += ` ${r.pick(['a', 'b', 'male', 'other', '1', 'true', 'NaN'])} {${body()}}`;
      }
      out += `{${name}, select,${choices}}`;
    } else if (x < 0.92) {
      const names = r.next() < 0.3 ? `${name};${r.pick(ARG_NAMES)}` : name;
      out += `{${names} ${r.pick(['upper', 'list', 'quux', 'nope'])}${r.pick(['', ' a', ' a b', ' ::x,y'])}}`;
    } else {
      out += `{-${body()}}`;
    }
  }
  return out;
};

const randomArg = (r: Random): unknown => {
  const x = r.next();
  if (x < 0.35) {
    return r.pick([0, 1, 2, 3, 5, 11, 21, 100, 1.5, -1, 0.1, 1e21, 2.5e-7, 123456789012]);
  }
  if (x < 0.55) {
    return r.pick(['a', 'male', '1', '1.50', 'abc', '', 'true', 'NaN', '-0']);
  }
  if (x < 0.62) {
    return r.next() < 0.5;
  }
  if (x < 0.7) {
    return null;
  }
  if (x < 0.85) {
    return { $decimal: r.pick(['1', '1.50', '-2', '0', '3e2', 'NaN', 'Infinity']) };
  }
  if (x < 0.9) {
    return { $number: r.pick(['NaN', 'Infinity', '-Infinity']) };
  }
  return { $object: { msg: 'hello' } };
};

const randomArgs = (r: Random): [unknown[], Record<string, unknown>] => {
  const positional: unknown[] = [];
  for (let i = r.int(0, 3); i > 0; i--) {
    positional.push(randomArg(r));
  }
  const n: Record<string, unknown> = {};
  for (const name of ARG_NAMES) {
    if (r.next() < 0.35) {
      n[name] = randomArg(r);
    }
  }
  return [positional, n];
};

const randomNumber = (r: Random): number => {
  const x = r.next();
  if (x < 0.3) {
    return r.int(-1000000, 1000000);
  }
  if (x < 0.6) {
    return (r.next() - 0.5) * 10 ** r.int(-12, 25);
  }
  if (x < 0.8) {
    return r.next() * 10 ** r.int(-330, 310);
  }
  return Number((r.next() * 1000).toFixed(r.int(0, 6)));
};

// ---------------------------------------------------------------------------------------------
// Translator scenarios, from the translator tests

type Pairs = [string, string][];

const EN: Pairs = [
  ['Save changes?', 'Save changes?'],
  ['{count} invoices', '{count, plural, one {# invoice} other {# invoices}}'],
  ['due {date}', 'due {date}'],
  ["Here's {name}", "Here's {name}"],
  [
    '{count} overdue for {customer}',
    '{count, plural, =0 {Nothing overdue for {customer}} one {# invoice overdue for {customer}} other {# invoices overdue for {customer}}}',
  ],
];
const DE: Pairs = [
  ['Save changes?', 'Änderungen speichern?'],
  ['{count} invoices', '{count, plural, one {# Rechnung} other {# Rechnungen}}'],
  ["Here's {name}", 'Hier ist {name}'],
];
const FR: Pairs = [
  ["Here's {name}", "Voici l''{name}"],
  ['due {date}', "dû le {date} (aujourd'hui)"],
];
const PT: Pairs = [['{count} invoices', '{count, plural, one {# fatura} other {# faturas}}']];
const PT_PT: Pairs = [['Save changes?', 'Guardar alterações?']];

interface TranslatorSpec {
  source: Pairs;
  sourceLanguage?: string;
  catalogs?: [string, Pairs | null][];
  formatters?: string[];
  apostropheMode?: string;
}

const TRANSLATORS: [TranslatorSpec, unknown[][]][] = [
  [
    {
      source: EN,
      catalogs: [
        ['de', DE],
        ['fr', FR],
        ['pt', PT],
        ['pt-PT', PT_PT],
      ],
    },
    [
      ['translate', 'de', 'Save changes?', {}],
      ['translate', 'de-AT', 'Save changes?', {}],
      ['translate', 'de_CH', '{count} invoices', { count: 3 }],
      ['translate', 'de', 'due {date}', { date: '31.1.' }],
      ['translate', 'pt-PT', 'Save changes?', {}],
      ['translate', 'pt-PT', '{count} invoices', { count: 5 }],
      ['translate', 'pt-BR', 'Save changes?', {}],
      ['translate', 'ja', 'Save changes?', {}],
      ['resolveMessage', 'pt-PT', '{count} invoices'],
      ['resolveMessage', 'ja-JP', 'Save changes?'],
      ['resolveMessage', 'pt_PT_x', 'Save changes?'],
      ['resolveMessage', 'pt_PT', 'Save changes?'],
      ['translate', 'de_AT', 'Save changes?', {}],
      ['resolveMessage', '-pt', 'Save changes?'],
      ['resolveMessage', '', 'Save changes?'],
      ['translate', 'pt', '{count} invoices', { count: 0 }],
      ['translate', 'ja', '{count} invoices', { count: 1 }],
      ['translate', 'pl', '{count} invoices', { count: 2 }],
      ['translate', 'en', "Here's {name}", { name: 'Ada' }],
      ['translate', 'fr', "Here's {name}", { name: 'atelier' }],
      ['translate', 'fr', 'due {date}', { date: '31/01' }],
      ['translate', 'en', '{count} overdue for {customer}', { count: 0, customer: 'Billie' }],
      ['translate', 'en', '{count} overdue for {customer}', { count: 2, customer: 'Billie' }],
      ['translate', 'en', '{count} overdue for {customer}', { count: 1 }],
      ['translate', 'de', 'Not a key {x}', { x: 1 }],
      ['translate', 'de', 'Not a key', {}],
      ['isMessageKey', 'Save changes?'],
      ['isMessageKey', 'Required'],
      ['isMessageKey', 'toString'],
      ['sizes'],
      ['checkCatalogs', false],
      ['checkCatalogs', true],
      ['sizes'],
    ],
  ],
  [
    { source: EN, catalogs: [['pt-PT', PT]] },
    [
      ['translate', 'pt-PT', '{count} invoices', { count: 0 }],
      ['translate', 'pt-pt', '{count} invoices', { count: 0 }],
      ['sizes'],
    ],
  ],
  [
    { source: [['k', "Use '{' and '}' around '{name}' ({name}), it''s fine"]] },
    [
      ['translate', 'en', 'k', { name: 'x' }],
      ['checkCatalogs', true],
    ],
  ],
  [
    { source: EN, catalogs: [['de', DE]] },
    [
      ['translate', 'de', '{count} invoices', { count: 1 }],
      ['translate', 'en', '{count} invoices', { count: 1 }],
      ['translate', 'de', 'Save changes?', {}],
      ['translate', 'de', '{count} invoices', { count: 2 }],
      ['sizes'],
      ['checkCatalogs', false],
    ],
  ],
  [
    { source: EN, catalogs: [['fr', [["Here's {name}", "Voici l'{name}"]]]] },
    [
      ['translate', 'fr', "Here's {name}", { name: 'atelier' }],
      ['checkCatalogs', false],
    ],
  ],
  [
    {
      source: EN,
      catalogs: [
        [
          'xx',
          [
            ['Save changes?', 'ok'],
            ['{count} invoices', '{count, plural, one {# x}}'],
            ['due {date}', 'due {datum}'],
            ["Here's {name}", 'unbalanced {name'],
            ['Nope', 'extra'],
          ],
        ],
      ],
    },
    [['checkCatalogs', true]],
  ],
  [
    {
      source: [
        ['b', '{b} {a}'],
        ['10', 'ten {x, select, a {A} other {{y}}}'],
        ['2', "two {n, plural, one {#} other {'{'#'}'}}"],
        ['a', '{a, upper} {b, list, x}'],
        ['bad', '{x} }{'],
        ['name', 'named'],
        ['g', '{g, select, a {x}}'],
      ],
      sourceLanguage: 'fr',
      catalogs: [
        ['zz', [['b', '{a} {b}']]],
        ['😀', [['b', '{b}']]],
        ['～', [['2', 'deux']]],
        [
          'yy',
          [
            ['10', 'dix {x, select, a {A} other {{z}}}'],
            ['b', '{b} {a} {c}'],
            ['20', 'x'],
            ['3', 'y'],
            ['a', '{a, upper} {b, list}'],
            ['g', '{g, select, a {{h, plural, one {x}}} other {y}}'],
          ],
        ],
        ['ww', null],
        ['de', [['bad', '{x}']]],
      ],
      formatters: ['upper', 'list'],
    },
    [
      ['translate', 'fr', 'a', { a: 'up', b: 1 }],
      ['translate', 'yy', 'a', { a: 'up', b: 1 }],
      ['translate', 'ww-x', 'b', { a: 1, b: 2 }],
      ['translate', 'fr', '2', { n: 1 }],
      ['translate', 'fr', '2', { n: 2 }],
      ['translate', 'constructor', 'name', {}],
      ['resolveMessage', 'toString', 'name'],
      ['resolveMessage', '__proto__', 'name'],
      ['resolveMessage', 'constructor', 'b'],
      ['translate', 'fr', 'bad', { x: 1 }],
      ['checkCatalogs', true],
      ['checkCatalogs', false],
      ['sizes'],
    ],
  ],
  [
    {
      source: [['k', "{n, plural, one {it's #} other {'#' x}}"]],
      apostropheMode: 'double-required',
      sourceLanguage: 'pt_BR',
      catalogs: [
        ['zh-Hant-TW', [['k', "{n, plural, other {l'{n}'}}"]]],
        ['es-419', [['k', '{n, plural, one {uno} many {muchos} other {#}}']]],
      ],
    },
    [
      ['translate', 'en', 'k', { n: 1 }],
      ['translate', 'zh-Hant-TW', 'k', { n: 1 }],
      ['translate', 'es-419', 'k', { n: 1000000 }],
      ['translate', 'es-419', 'k', { n: 1 }],
      ['checkCatalogs', true],
      ['sizes'],
    ],
  ],
];

const buildTranslator = (spec: TranslatorSpec) =>
  createTranslator({
    source: Object.fromEntries(spec.source),
    sourceLanguage: spec.sourceLanguage,
    catalogs: Object.fromEntries(
      (spec.catalogs || []).map(([id, pairs]) => [
        id,
        pairs ? Object.fromEntries(pairs) : undefined,
      ]),
    ),
    formatters: spec.formatters ? formattersFor(spec.formatters) : undefined,
    apostropheMode: spec.apostropheMode as ApostropheMode | undefined,
  });

const runTranslator = (spec: TranslatorSpec, ops: unknown[][]): unknown[] => {
  const t = buildTranslator(spec);
  return ops.map((op) => {
    switch (op[0]) {
      case 'translate':
        return (translate as any)(t, op[1], op[2], named(op[3] as Record<string, unknown>));
      case 'resolveMessage':
        return resolveMessage(t, op[1] as string, op[2] as string);
      case 'isMessageKey':
        return isMessageKey(t, op[1] as string);
      case 'checkCatalogs':
        return checkCatalogs(t, { complete: op[1] as boolean }).map((i) => ({ ...i }));
      default:
        return [t.state.parsed.size, t.state.plurals.size];
    }
  });
};

// ---------------------------------------------------------------------------------------------

/** Run matcher operations from a start and end, recording each result and the final start. */
const runMatcher = (
  names: string[],
  sticky: boolean,
  text: string,
  s: number,
  e: number,
  ops: string[],
): unknown => {
  const m = buildMessageMatcher(names, sticky);
  const r: MessageState = { t: text, s, e: e === -1 ? text.length : e };
  const results = ops.map((op) => {
    const v = (m as any)[op](r);
    return v === undefined ? null : v;
  });
  return { results, s: r.s };
};

interface FormatterSpec {
  language?: string;
  region?: string;
  formatters?: string[];
  cacheSize?: number;
  disableEscapes?: boolean;
  apostropheMode?: string;
}

const runFormatter = (
  spec: FormatterSpec,
  calls: [string, unknown[], Record<string, unknown>][],
) => {
  const f = createMessageFormatter({
    language: spec.language,
    region: spec.region,
    formatters: spec.formatters ? formattersFor(spec.formatters) : undefined,
    cacheSize: spec.cacheSize,
    disableEscapes: spec.disableEscapes,
    apostropheMode: spec.apostropheMode as ApostropheMode | undefined,
  });
  const results = calls.map(([msg, pos, nm]) => formatMessage(f, msg, args(pos), named(nm)));
  return { results, toString: messageFormatterToString(f) };
};

export const cases = (): ConformanceCase[] => {
  const { cases: out, add } = collector();

  // Matcher
  for (const sticky of [true, false]) {
    for (const [names, text, s, e, ops] of MATCHER) {
      add('matcher', [names, sticky, text, s, e, ops], () =>
        runMatcher(names, sticky, text, s, e, ops),
      );
    }
  }

  // Parser
  for (const p of PATTERNS) {
    for (const [disable, m] of OPTIONS) {
      add('parseMessagePattern', [p, CUSTOM, true, disable, m], () =>
        parseMessagePattern(p, buildMessageMatcher(CUSTOM, true), disable, mode(m)),
      );
    }
  }
  // Formatter names are regexp source in the TypeScript ('a.c' also matches 'abc'); the port
  // matches them literally, so the cases only use names without regexp syntax.
  add(
    'parseMessagePattern',
    ['{0 foo} {0 foobar} {0 foo-bar x}', ['foo', 'foo-bar'], false, false, null],
    () =>
      parseMessagePattern(
        '{0 foo} {0 foobar} {0 foo-bar x}',
        buildMessageMatcher(['foo', 'foo-bar'], false),
      ),
  );

  // Converter
  const convertArgs: unknown[] = [
    false,
    true,
    1.2,
    0,
    -0,
    1e21,
    1.5e-7,
    0.1,
    123456789012345680000,
    'abc',
    '1.4',
    'infinity',
    '',
    ' 1',
    '1e5',
    '-0',
    null,
    { $decimal: '3.14159' },
    { $decimal: '-infinity' },
    { $decimal: '1.50' },
    { $number: 'NaN' },
    { $number: 'Infinity' },
    { $number: '-Infinity' },
    { $object: { foo: 'foo', bar: 'bar' } },
    { $object: { data: [1], flag: 2 } },
    { $object: [1, 2] },
  ];
  const r0 = random(0x5eed);
  for (let i = 0; i < 300; i++) {
    convertArgs.push(randomNumber(r0));
  }
  for (const a of convertArgs) {
    add('asString', [a], () => defaultMessageArgConverter.asString(arg(a)));
    add('asDecimal', [a], () => ({ ...defaultMessageArgConverter.asDecimal(arg(a)) }));
  }

  // Evaluation of hand-built code
  const codes: [string, MessageCode, unknown[], Record<string, unknown>][] = [
    ['en', [7], [], {}],
    ['en', [4, [[0, 'a'], [7], [1, 0]]], [5], {}],
    [
      'en',
      [
        2,
        [0],
        0,
        0,
        [
          [0, '1.50', [7]],
          [1, 'other', [0, 'o']],
        ],
      ],
      [{ $decimal: '1.5' }],
      {},
    ],
    ['en', [2, [0], 0, 0, [[0, 'abc', [0, 'nan']]]], [{ $decimal: 'NaN' }], {}],
    [
      'en',
      [
        2,
        [0],
        2,
        1,
        [
          [1, 'few', [7]],
          [1, 'other', [4, [[7], [0, '!']]]],
        ],
      ],
      [5],
      {},
    ],
    [
      'en',
      [
        2,
        ['n'],
        -1,
        0,
        [
          [1, 'one', [7]],
          [1, 'other', [0, 'x']],
        ],
      ],
      [],
      { n: 0 },
    ],
    ['en', [2, [0], 1e23, 0, [[1, 'other', [7]]]], [1], {}],
    [
      'en',
      [
        3,
        [0],
        [
          ['1', [7]],
          ['other', [0, 'o']],
        ],
      ],
      [1],
      {},
    ],
    ['en', [3, [0], [['x', [0, 'X']]]], ['y'], {}],
    ['en', [6, 'nope', [0], []], [1], {}],
    ['en', [6, 'list', [0, 'n', 5, 'toString'], ['a', 'b']], [1, null], { n: { $decimal: '2' } }],
    ['en', [5], [], {}],
    ['en', [1, 1e23], [], {}],
    ['en', [1, 1e23], [], { '1e+23': 'big' }],
    ['en', [1, 0], ['p'], { 0: 'n' }],
    ['en', [1, 0], ['p'], { 0: null }],
    [
      'fr',
      [
        2,
        [0],
        0,
        0,
        [
          [1, 'one', [0, 'un']],
          [1, 'other', [0, 'autre']],
        ],
      ],
      [1.5],
      {},
    ],
  ];
  for (const [lang, code, pos, nm] of codes) {
    add('evaluateMessage', [lang, code, pos, nm], () =>
      evaluateMessage(
        getPluralRules(lang),
        defaultMessageArgConverter,
        formattersFor(CUSTOM),
        code,
        args(pos),
        named(nm),
      ),
    );
  }

  // Formatting, from the unit tests
  const NOT_DECIMALS = [
    { data: [1], flag: 2 },
    { data: [1], flag: 0 },
    { data: [1], sign: 1, exp: 0, flag: 5 },
    { data: [1.5], sign: 1, exp: 0, flag: 0 },
    { data: ['1'], sign: 1, exp: 0, flag: 0 },
  ];
  const fixedCalls: [FormatterSpec, [string, unknown[], Record<string, unknown>][]][] = [
    [{}, [['{0}', ['Foo'], {}]]],
    [
      { language: 'en', formatters: ['foo', 'upper', 'quux', 'quuxbar', 'quuxbaz'] },
      [
        ['{0}', ['Hello'], {}],
        ['{0 upper}', ['Hello'], {}],
        ['{0 upper}', ['Hello'], {}],
        ['{0}', ['Hello'], {}],
        ['{0 plural one {# item} other {# items}}', [0], {}],
        ['{0 plural one {# item} other {# items}}', [1], {}],
        ['{0 plural one {# item} other {# items}}', [2], {}],
        ['{0 quux}', [0], {}],
        ['{0 quuxbar}', [0], {}],
        ['{0 quuxbaz}', [0], {}],
        ['{0 foo}', [0], {}],
      ],
    ],
    [
      { language: 'en' },
      [
        ['{0}', [], {}],
        ['hi {0}!', [], {}],
        ['{name}', [], {}],
        ['{0, plural, other {#}}', [], {}],
        ['{count, plural, one {# item} other {# items}}', [], {}],
        ['{0, selectordinal, one {#st} other {#th}}', [], {}],
        ['{name, select, female {her} other {their}}', [], {}],
        ['{0} and {1}', ['a'], {}],
        ['{0}', [null], {}],
        ['{5}', [], {}],
        [
          '{toString}|{constructor, select, other {c}}|{valueOf, plural, other {#}}|{__proto__}',
          [],
          {},
        ],
        ['{toString}', [], { toString: 'own' }],
        ...NOT_DECIMALS.flatMap((o): [string, unknown[], Record<string, unknown>][] => [
          ['<{0}>', [{ $object: o }], {}],
          ['{0 plural one {one} other {other:#}}', [{ $object: o }], {}],
          ['{0 select 1 {x} other {y}}', [{ $object: o }], {}],
        ]),
        ['<{0}>', [{ $decimal: '1.50' }], {}],
        ['<{0}>', [{ $decimal: '-infinity' }], {}],
        ['{0 plural one {one} other {other:#}}', [{ $decimal: '1' }], {}],
        ['{0 select 1 {x} other {y}}', [{ $decimal: '1' }], {}],
      ],
    ],
    [
      { language: 'en', formatters: CUSTOM },
      [
        ['{0 plural one {is ONE} other {is OTHER}}', [0], {}],
        ['{0 plural one {is ONE} other {is OTHER}}', [1], {}],
        [
          '{gender, select, female {her bar} male {his foo} they {their baz} other {unknown quux}}',
          [],
          { gender: 'male' },
        ],
        [
          '{gender, select, female {her bar} male {his foo} they {their baz} other {unknown quux}}',
          [],
          { gender: 'zzz' },
        ],
        ['{0}{-1}', [1, 1], {}],
        ['{0 plural one {-ONE #} other {OTHER #}}', [1], {}],
        ['{0 plural one {-ONE #} other {OTHER #}}', [15], {}],
        ['{0}{-0 missing formatter}{1}', [1, 2], {}],
        ['{0}{a}{-0}{-a}{}{-}{--}{---}', [], { a: 'A' }],
        [
          '==> {0, plural, offset:1      =0 {Be the first to like this}     =1 {You liked this}    one {You and someone else liked this}  other {You and # others liked this}}!',
          [3],
          {},
        ],
        ['{0 plural =53{fifty-three} other{dunno}}', [53], {}],
        ['leader {0 plural =0 {zero items} one {# item} other {# items}} trailer', [3], {}],
        [
          '{name} was {0 selectordinal one{#st} two{#nd} few{#rd} other{#th}}!',
          [2],
          { name: 'Bob' },
        ],
        [
          '{name} was {0 selectordinal one{#st} two{#nd} few{#rd} other{#th}}!',
          [23],
          { name: 'Bob' },
        ],
        ['{0 list}', [0], {}],
        ['{0 list}', [{ $object: { msg: 'hello' } }], {}],
        ['{missing;msg list}', [], { msg: 'hello' }],
        ['{0;1 list a b ::c "d"}', [0], {}],
        ['{0 upper}', [{ $decimal: '1e3' }], {}],
        [
          '{x, select, a {{y, plural, one {# {z}} other {#}}} other {#}}',
          [],
          { x: 'a', y: 1, z: 'zed' },
        ],
        ['{x, select, a {{y, plural, one {# {z}} other {#}}} other {#}}', [], { x: 'b', y: 1 }],
        ['{x, select, true {T} other {#}}', [], { x: true }],
        ['{0 plural =1.5 {exact} other {#}}', ['1.50'], {}],
        ['{0 plural =1 {exact #} other {#}}', [{ $decimal: '1.00' }], {}],
        ['{0, plural, offset:1 =2 {exact #} one {one #} other {#}}', [2], {}],
        ['{0, plural, offset:1 =2 {exact #} one {one #} other {#}}', [3], {}],
      ],
    ],
    [
      { language: 'en', cacheSize: 2 },
      [
        ['a {0}', [1], {}],
        ['b {0}', [1], {}],
        ['a {0}', [1], {}],
        ['c {0}', [1], {}],
        ['c {0}', [1], {}],
      ],
    ],
    [{ language: 'en', cacheSize: 0 }, [['a {0}', [1], {}]]],
    [{ language: 'pt', region: 'PT' }, [['{0 plural one {um} other {#}}', [0], {}]]],
    [{ language: 'pt' }, [['{0 plural one {um} other {#}}', [0], {}]]],
    [{ language: '' }, [['{0 plural one {um} other {#}}', [1], {}]]],
    [
      { formatters: ['b', '10', 'a', '2', '01', '4294967295', '4294967294'] },
      [['{0 10}{0 2}', [1], {}]],
    ],
    [{ formatters: ['q"uo\\te\n'] }, []],
    [{ disableEscapes: true }, [["it's {0} '{1}'", [1, 2], {}]]],
    [
      { apostropheMode: 'double-optional' },
      [["it's {0} '{1}' {2, plural, other {'#' #}}", [1, 2, 3], {}]],
    ],
  ];
  for (const [spec, calls] of fixedCalls) {
    add('formatMessage', [spec, calls], () => runFormatter(spec, calls));
  }

  // Translator
  for (const [spec, ops] of TRANSLATORS) {
    add('translator', [spec, ops], () => runTranslator(spec, ops));
  }
  const argNames: [string, { formatters?: string[]; apostropheMode?: string }][] = [
    ['{count} invoices', {}],
    [EN[4][1], {}],
    ["it's '{literal}' {x}", {}],
    ['{g, select, a {{x}} other {{y}}}', {}],
    ['{n, number} {d, date}', { formatters: ['number', 'date'] }],
    ['{n, number} {d, date}', {}],
    ['plain', {}],
    ["it's '{literal}' {x}", { apostropheMode: 'double-required' }],
    ['{0} {10} {2} {b} {B} {～} {😀} {a;b list} {012}', { formatters: ['list'] }],
    ['{0, plural, one {{1}} other {{12345678901234567890123}}}', {}],
  ];
  for (const [p, o] of argNames) {
    add('messageArgNames', [p, o], () =>
      messageArgNames(p, {
        formatters: o.formatters,
        apostropheMode: mode(o.apostropheMode ?? null),
      }),
    );
  }

  // Random garbage patterns: parsed, then formatted.
  const r = random(0x1c0);
  for (let i = 0; i < 600; i++) {
    const p = garbage(r);
    const [disable, m] = r.pick(OPTIONS);
    add('parseMessagePattern', [p, CUSTOM, true, disable, m], () =>
      parseMessagePattern(p, buildMessageMatcher(CUSTOM, true), disable, mode(m)),
    );
  }

  // Random messages: parsed and formatted with random arguments.
  for (let i = 0; i < 700; i++) {
    const p = r.next() < 0.2 ? garbage(r) : genMessage(r, 0);
    const [disable, m] = r.pick(OPTIONS);
    if (i % 4 === 0) {
      add('parseMessagePattern', [p, CUSTOM, true, disable, m], () =>
        parseMessagePattern(p, buildMessageMatcher(CUSTOM, true), disable, mode(m)),
      );
    }
    const spec: FormatterSpec = {
      language: r.pick(['en', 'fr', 'ar', 'pl', 'ja', 'cy', 'ru']),
      formatters: ['upper', 'list', 'quux'],
      disableEscapes: disable,
      apostropheMode: m ?? undefined,
    };
    const calls: [string, unknown[], Record<string, unknown>][] = [];
    for (let j = r.int(1, 3); j > 0; j--) {
      const [pos, nm] = randomArgs(r);
      calls.push([p, pos, nm]);
    }
    add('formatMessage', [spec, calls], () => runFormatter(spec, calls));
  }

  return out;
};
