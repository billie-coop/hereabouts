/**
 * Writes the data tables of the core foundation and number formatting as Zig source:
 *
 * - `core/locale/autogen.locales.zig`: `availableLocales()`.
 * - `core/systems/numbering/autogen.names.zig`: the decimal digits of each numbering system,
 *   expanded to ten digits the way `getNumberParams` expands them.
 * - `core/internals/numbers/autogen.currencies.zig`: currency fractions and region currencies.
 * - `core/internals/numbers/autogen.spacing.zig`: the UTF-16 code units the currency spacing
 *   matchers (`RE_DIGIT`, `RE_SYMBOL`) accept, as ranges.
 * - `core/utils/autogen.upper.zig`: what `toUpperCase()` makes of each BMP code unit, for the
 *   context transforms that capitalize the first character.
 */

import {
  currencyFractionsRaw,
  currencyRegionsRaw,
} from '../../src/core/internals/numbers/autogen.currencies';
import { RE_DIGIT, RE_SYMBOL } from '../../src/core/internals/numbers/render';
import { availableLocales } from '../../src/core/locale';
import { decimalNumberingDigits } from '../../src/core/systems/numbering/autogen.names';
import { numarray, stringToObject } from '../../src/core/utils/string';
import {
  tagHasRegion,
  tagHasScript,
  tagLanguage,
  tagRegion,
  tagScript,
  tagVariant,
} from '../../src/language-tag';
import { header, type ZigFile, zigString } from './_emit';

const opt = (s: string | undefined): string => (s ? zigString(s) : 'null');

const localesFile = (): string => {
  const rows = availableLocales().map((l) => {
    const t = l.tag;
    return (
      `    .{ .id = ${zigString(l.id)}, .tag = .{ .language = ${zigString(tagLanguage(t))}, ` +
      `.script = ${tagHasScript(t) ? zigString(tagScript(t)) : 'null'}, ` +
      `.region = ${tagHasRegion(t) ? zigString(tagRegion(t)) : 'null'}, ` +
      `.variant = ${opt(tagVariant(t))} } },`
    );
  });
  return (
    header('core-data', 'src/core/locale/autogen.locales.ts') +
    'const Locale = @import("../../locale/locale.zig").Locale;\n\n' +
    '/// Every locale with data, in the order `availableLocales()` lists them. Static: do not\n' +
    '/// free them.\n' +
    `pub const available_locales = [_]Locale{\n${rows.join('\n')}\n};\n`
  );
};

/** The ten digits of a numbering system, as `makeDigits` in `api/private/numbers.ts` builds them. */
const tenDigits = (base: readonly string[]): string[] => {
  const digits = base.slice(0);
  if (digits.length !== 10) {
    const c = digits[0].charCodeAt(0);
    if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = digits[0].charCodeAt(1);
      for (let i = 1; i < 10; i++) {
        digits.push(String.fromCharCode(c) + String.fromCharCode(c2 + i));
      }
    } else {
      for (let i = 1; i < 10; i++) {
        digits.push(String.fromCharCode(c + i));
      }
    }
  }
  return digits;
};

const namesFile = (): string => {
  const rows = Object.keys(decimalNumberingDigits).map(
    (k) =>
      `    .{ ${zigString(k)}, [10][]const u8{ ${tenDigits(decimalNumberingDigits[k]).map(zigString).join(', ')} } },`,
  );
  return (
    header('core-data', 'src/core/systems/numbering/autogen.names.ts') +
    'const std = @import("std");\n\n' +
    '/// The ten decimal digits of each numbering system, by name.\n' +
    'pub const decimal_numbering_digits = std.StaticStringMap([10][]const u8).initComptime(.{\n' +
    `${rows.join('\n')}\n});\n`
  );
};

const currenciesFile = (): string => {
  const fractions = currencyFractionsRaw.split('|').map((r) => {
    const parts = r.split(':');
    const v = numarray(parts[1]);
    return (
      `    .{ ${zigString(parts[0])}, CurrencyFractions{ .digits = ${v[0]}, .rounding = ${v[1]}, ` +
      `.cash_digits = ${v[2]}, .cash_rounding = ${v[3]} } },`
    );
  });
  const regions = stringToObject(currencyRegionsRaw, '|', ':');
  const rows = Object.keys(regions).map(
    (k) => `    .{ ${zigString(k)}, ${zigString(regions[k])} },`,
  );
  return (
    header('core-data', 'src/core/internals/numbers/autogen.currencies.ts') +
    'const std = @import("std");\n' +
    'const CurrencyFractions = @import("../../common/numbers.zig").CurrencyFractions;\n\n' +
    '/// Currencies whose fractions differ from the default, by code.\n' +
    'pub const currency_fractions = std.StaticStringMap(CurrencyFractions).initComptime(.{\n' +
    `${fractions.join('\n')}\n});\n\n` +
    '/// Currency of each region.\n' +
    'pub const currency_regions = std.StaticStringMap([]const u8).initComptime(.{\n' +
    `${rows.join('\n')}\n});\n`
  );
};

/** Ranges of BMP code units the regex accepts as a single character. */
const ranges = (re: RegExp): [number, number][] => {
  const out: [number, number][] = [];
  for (let c = 0; c <= 0xffff; c++) {
    if (re.test(String.fromCharCode(c))) {
      const last = out[out.length - 1];
      if (last && last[1] === c - 1) {
        last[1] = c;
      } else {
        out.push([c, c]);
      }
    }
  }
  return out;
};

const rangeList = (rs: [number, number][]): string =>
  rs.map((r) => `    .{ 0x${r[0].toString(16)}, 0x${r[1].toString(16)} },`).join('\n');

const spacingFile = (): string =>
  header('core-data', 'RE_DIGIT and RE_SYMBOL in src/core/internals/numbers/render.ts') +
  '/// Code units matching `RE_DIGIT` (decimal digits), as inclusive ranges.\n' +
  `pub const digit_ranges = [_][2]u16{\n${rangeList(ranges(RE_DIGIT))}\n};\n\n` +
  '/// Code units matching `RE_SYMBOL` (symbols and separators), as inclusive ranges.\n' +
  `pub const symbol_ranges = [_][2]u16{\n${rangeList(ranges(RE_SYMBOL))}\n};\n`;

const upperFile = (): string => {
  const rows: string[] = [];
  for (let c = 0; c <= 0xffff; c++) {
    if (c >= 0xd800 && c <= 0xdfff) {
      continue;
    }
    const s = String.fromCharCode(c);
    const u = s.toUpperCase();
    if (u !== s) {
      rows.push(`    .{ .cp = 0x${c.toString(16)}, .upper = ${zigString(u)} },`);
    }
  }
  return (
    header('core-data', "JavaScript's String.prototype.toUpperCase") +
    'pub const Upper = struct { cp: u16, upper: []const u8 };\n\n' +
    '/// BMP code points that `toUpperCase()` changes, sorted, with the result.\n' +
    `pub const upper = [_]Upper{\n${rows.join('\n')}\n};\n`
  );
};

export const files = (): ZigFile[] => [
  { path: 'core/locale/autogen.locales.zig', content: localesFile() },
  { path: 'core/systems/numbering/autogen.names.zig', content: namesFile() },
  { path: 'core/internals/numbers/autogen.currencies.zig', content: currenciesFile() },
  { path: 'core/internals/numbers/autogen.spacing.zig', content: spacingFile() },
  { path: 'core/utils/autogen.upper.zig', content: upperFile() },
];
