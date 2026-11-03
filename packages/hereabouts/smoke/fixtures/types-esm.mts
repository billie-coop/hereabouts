import {
  createFramework,
  type Decimal,
  formatDecimal,
  type LocaleData,
  loadLocale,
} from '@billie-coop/hereabouts';
import { type Day, dayAdd, dayFromString } from '@billie-coop/hereabouts/datetime';
import { decimal, decimalAdd } from '@billie-coop/hereabouts/decimal';
import { parseLanguageTag } from '@billie-coop/hereabouts/language-tag';
import { localeFlag } from '@billie-coop/hereabouts/locale';
import { createLocaleMatcher } from '@billie-coop/hereabouts/locale-matcher';
import { createTranslator, translate } from '@billie-coop/hereabouts/messageformat';
import { getPluralRules } from '@billie-coop/hereabouts/plurals';
import { setTimeZoneData, tzZoneIds } from '@billie-coop/hereabouts/timezone';
import { convertUnits } from '@billie-coop/hereabouts/unit-converter';

const sum: Decimal = decimalAdd(decimal('0.1'), '0.2');
const due: Day | undefined = dayFromString('2026-01-31');
const en = { '{n} items': '{n, plural, one {# item} other {# items}}', Save: 'Save' };
const t = createTranslator({ source: en, catalogs: {} });
const s: string = translate(t, 'en', '{n} items', { n: 2 });
// @ts-expect-error: placeholders are type-checked
translate(t, 'en', '{n} items');
const fw = createFramework({ loader: () => '' });
const fmt = (l: LocaleData) => formatDecimal(l, sum);
export const all = [
  due && dayAdd(due, { days: 1 }),
  s,
  fw,
  fmt,
  loadLocale,
  setTimeZoneData,
  tzZoneIds,
  convertUnits,
  getPluralRules,
  parseLanguageTag,
  localeFlag,
  createLocaleMatcher,
];
