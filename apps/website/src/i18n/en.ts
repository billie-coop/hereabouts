/**
 * The site's text in English: the source catalog. Keys are the English text, so code reads as
 * the page does; placeholders in braces are filled by `translate` (and type-checked), and text
 * in backticks is shown as code. Add a message here first, then to each catalog in this folder;
 * `i18n.test.ts` fails until every catalog has it with the same placeholders.
 */
export const en = {
  // Page
  'Loading locale data…': 'Loading locale data…',
  "Couldn't load locale data: {error}": "Couldn't load locale data: {error}",
  'v{version} · CLDR {cldr} · plain functions over plain data · every example runs live':
    'v{version} · CLDR {cldr} · plain functions over plain data · every example runs live',
  Locale: 'Locale',
  'Time zone': 'Time zone',
  'Search languages and regions': 'Search languages and regions',
  'Search time zones': 'Search time zones',
  'No matches for “{query}”': 'No matches for “{query}”',
  'Locale data is a plain object (`loadLocaleAsync(framework, locale)`) passed to plain functions. Bundlers keep only the functions you import: number formatting alone is about 42 KB gzipped, day math alone about 1.3 KB.':
    'Locale data is a plain object (`loadLocaleAsync(framework, locale)`) passed to plain functions. Bundlers keep only the functions you import: number formatting alone is about 42 KB gzipped, day math alone about 1.3 KB.',
  'Built on cldr-engine by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA tz database.':
    'Built on cldr-engine by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA tz database.',

  // Sections
  Numbers: 'Numbers',
  'Numbers are formatted from strings or numbers with exact decimal digits, so nothing is lost to floating point.':
    'Numbers are formatted from strings or numbers with exact decimal digits, so nothing is lost to floating point.',
  Number: 'Number',

  Currency: 'Currency',
  "Each currency rounds to its own digits (JPY has none, BHD has three) and `cash: true` applies cash rounding (CHF to 0.05). The default currency comes from the locale's region: `getCurrencyForRegion({region})` is {currency}.":
    "Each currency rounds to its own digits (JPY has none, BHD has three) and `cash: true` applies cash rounding (CHF to 0.05). The default currency comes from the locale's region: `getCurrencyForRegion({region})` is {currency}.",
  Amount: 'Amount',

  'Decimal math': 'Decimal math',
  'Arbitrary precision decimals as plain data (`{json}`), so amounts survive JSON and `structuredClone`. Add, subtract and multiply are exact; divide takes a precision or scale.':
    'Arbitrary precision decimals as plain data (`{json}`), so amounts survive JSON and `structuredClone`. Add, subtract and multiply are exact; divide takes a precision or scale.',
  'An invoice line': 'An invoice line',
  Quantity: 'Quantity',
  'Unit price': 'Unit price',
  'Tax rate': 'Tax rate',

  Dates: 'Dates',
  'Days, times and zones': 'Days, times and zones',
  'A `Day` is a calendar date with no time or zone, so it can’t shift by a day; a `TimeOfDay` is a wall clock time; instants are epoch milliseconds. Only a few functions take a zone: what day it is there (`dayToday`), and when a wall clock time happens there (`dayAtTime`).':
    'A `Day` is a calendar date with no time or zone, so it can’t shift by a day; a `TimeOfDay` is a wall clock time; instants are epoch milliseconds. Only a few functions take a zone: what day it is there (`dayToday`), and when a wall clock time happens there (`dayAtTime`).',
  'Due date': 'Due date',
  'Reminder time': 'Reminder time',
  '{zone} has no clock change in the next year, so {time} every day is exactly 24 hours apart.':
    '{zone} has no clock change in the next year, so {time} every day is exactly 24 hours apart.',
  'The clocks change in {zone} on {date}: {time} that day comes {hours, plural, one {# hour} other {# hours}} after {time} the day before.':
    'The clocks change in {zone} on {date}: {time} that day comes {hours, plural, one {# hour} other {# hours}} after {time} the day before.',
  "The week starts on the locale's first day (`firstDayOfWeek(locale)` is {first}, 1 = Sunday). The grid is `dayRange` over `dayStartOfWeek` in steps of a week. Today in {zone}: {today}.":
    "The week starts on the locale's first day (`firstDayOfWeek(locale)` is {first}, 1 = Sunday). The grid is `dayRange` over `dayStartOfWeek` in steps of a week. Today in {zone}: {today}.",

  Units: 'Units',
  'Quantities in three lengths, and exact conversion with `@phensley/unit-converter`. This locale measures in the {system} system (`measurementSystem(locale)`).':
    'Quantities in three lengths, and exact conversion with `@phensley/unit-converter`. This locale measures in the {system} system (`measurementSystem(locale)`).',
  Value: 'Value',
  Unit: 'Unit',
  'no conversion': 'no conversion',

  Messages: 'Messages',
  'Lists, plurals and messages': 'Lists, plurals and messages',
  "ICU message format with the locale's plural rules, list formatting, and the plural category of any number.":
    "ICU message format with the locale's plural rules, list formatting, and the plural category of any number.",
  'List items': 'List items',
  'Message (ICU)': 'Message (ICU)',
  'Arguments (JSON)': 'Arguments (JSON)',

  Matching: 'Matching',
  'Locale matching': 'Locale matching',
  "Pick the best of your app's supported locales for what a user asks for, using CLDR's language distances (es-MX matches es-419, zh-TW matches zh-Hant).":
    "Pick the best of your app's supported locales for what a user asks for, using CLDR's language distances (es-MX matches es-419, zh-TW matches zh-Hant).",
  Supported: 'Supported',
  'Your languages': 'Your languages',

  Translations: 'Translations',
  'This page is translated with `createTranslator` and `translate`: an English source catalog keyed by its own text, and one catalog per language. Languages without a catalog fall back to English, using English plural rules.':
    'This page is translated with `createTranslator` and `translate`: an English source catalog keyed by its own text, and one catalog per language. Languages without a catalog fall back to English, using English plural rules.',
  'This text is in {language}.': 'This text is in {language}.',
  '{count, plural, one {# message} other {# messages}} in {languages, plural, one {# catalog} other {# catalogs}} besides English.':
    '{count, plural, one {# message} other {# messages}} in {languages, plural, one {# catalog} other {# catalogs}} besides English.',
  'Problems found by `checkCatalogs`: {count, plural, =0 {none} other {#}}.':
    'Problems found by `checkCatalogs`: {count, plural, =0 {none} other {#}}.',
  'Translations on this site were written by an AI and have not been reviewed by native speakers.':
    'Translations on this site were written by an AI and have not been reviewed by native speakers.',
};

export type MessageKey = keyof typeof en;
