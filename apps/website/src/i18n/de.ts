import type { MessageCatalog } from '@billie-coop/hereabouts';
import type { MessageKey } from './en';

export const de: MessageCatalog<MessageKey> = {
  'Loading locale data…': 'Gebietsschema-Daten werden geladen…',
  "Couldn't load locale data: {error}": 'Gebietsschema-Daten konnten nicht geladen werden: {error}',
  'v{version} · CLDR {cldr} · plain functions over plain data · every example runs live':
    'v{version} · CLDR {cldr} · einfache Funktionen über einfache Daten · jedes Beispiel läuft live',
  Locale: 'Gebietsschema',
  'Time zone': 'Zeitzone',
  'Search languages and regions': 'Sprachen und Regionen suchen',
  'Search time zones': 'Zeitzonen suchen',
  'No matches for “{query}”': 'Keine Treffer für „{query}“',
  'Locale data is a plain object (`loadLocaleAsync(framework, locale)`) passed to plain functions. Bundlers keep only the functions you import: number formatting alone is about 42 KB gzipped, day math alone about 1.3 KB.':
    'Gebietsschema-Daten sind ein einfaches Objekt (`loadLocaleAsync(framework, locale)`), das an einfache Funktionen übergeben wird. Bundler behalten nur die Funktionen, die du importierst: Zahlenformatierung allein sind etwa 42 KB gzip, Tagesrechnung allein etwa 1,3 KB.',
  'Built on cldr-engine by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA tz database.':
    'Basiert auf cldr-engine von Patrick Hensley, mit CLDR-Daten des Unicode-Konsortiums und Zeitzonen aus der IANA-tz-Datenbank.',
  Numbers: 'Zahlen',
  'Numbers are formatted from strings or numbers with exact decimal digits, so nothing is lost to floating point.':
    'Zahlen werden aus Zeichenketten oder Zahlen mit exakten Dezimalstellen formatiert, sodass durch Gleitkomma nichts verloren geht.',
  Number: 'Zahl',
  Currency: 'Währung',
  "Each currency rounds to its own digits (JPY has none, BHD has three) and `cash: true` applies cash rounding (CHF to 0.05). The default currency comes from the locale's region: `getCurrencyForRegion({region})` is {currency}.":
    'Jede Währung rundet auf ihre eigenen Stellen (JPY hat keine, BHD hat drei), und `cash: true` wendet Bargeldrundung an (CHF auf 0,05). Die Standardwährung ergibt sich aus der Region des Gebietsschemas: `getCurrencyForRegion({region})` ist {currency}.',
  Amount: 'Betrag',
  'Decimal math': 'Dezimalrechnung',
  'Arbitrary precision decimals as plain data (`{json}`), so amounts survive JSON and `structuredClone`. Add, subtract and multiply are exact; divide takes a precision or scale.':
    'Dezimalzahlen beliebiger Genauigkeit als einfache Daten (`{json}`), sodass Beträge JSON und `structuredClone` überstehen. Addieren, Subtrahieren und Multiplizieren sind exakt; Dividieren nimmt eine Genauigkeit oder Skala.',
  'An invoice line': 'Eine Rechnungsposition',
  Quantity: 'Menge',
  'Unit price': 'Stückpreis',
  'Tax rate': 'Steuersatz',
  Dates: 'Datum',
  'Days, times and zones': 'Tage, Uhrzeiten und Zeitzonen',
  'A `Day` is a calendar date with no time or zone, so it can’t shift by a day; a `TimeOfDay` is a wall clock time; instants are epoch milliseconds. Only a few functions take a zone: what day it is there (`dayToday`), and when a wall clock time happens there (`dayAtTime`).':
    'Ein `Day` ist ein Kalendertag ohne Uhrzeit und Zeitzone, er kann sich also nicht um einen Tag verschieben; eine `TimeOfDay` ist eine Uhrzeit; Zeitpunkte sind Epoch-Millisekunden. Nur wenige Funktionen nehmen eine Zeitzone: welcher Tag dort ist (`dayToday`) und wann dort eine Uhrzeit eintritt (`dayAtTime`).',
  'Due date': 'Fälligkeitsdatum',
  'Reminder time': 'Erinnerungszeit',
  '{zone} has no clock change in the next year, so {time} every day is exactly 24 hours apart.':
    '{zone} hat im nächsten Jahr keine Zeitumstellung, also liegt {time} jeden Tag genau 24 Stunden auseinander.',
  'The clocks change in {zone} on {date}: {time} that day comes {hours, plural, one {# hour} other {# hours}} after {time} the day before.':
    'Die Uhren werden in {zone} am {date} umgestellt: {time} an diesem Tag kommt {hours, plural, one {# Stunde} other {# Stunden}} nach {time} am Vortag.',
  "The week starts on the locale's first day (`firstDayOfWeek(locale)` is {first}, 1 = Sunday). The grid is `dayRange` over `dayStartOfWeek` in steps of a week. Today in {zone}: {today}.":
    'Die Woche beginnt am ersten Tag des Gebietsschemas (`firstDayOfWeek(locale)` ist {first}, 1 = Sonntag). Das Raster ist `dayRange` über `dayStartOfWeek` in Wochenschritten. Heute in {zone}: {today}.',
  Units: 'Einheiten',
  'Quantities in three lengths, and exact conversion with `@phensley/unit-converter`. This locale measures in the {system} system (`measurementSystem(locale)`).':
    'Mengen in drei Längen und exakte Umrechnung mit `@phensley/unit-converter`. Dieses Gebietsschema misst im System {system} (`measurementSystem(locale)`).',
  Value: 'Wert',
  Unit: 'Einheit',
  'no conversion': 'keine Umrechnung',
  Messages: 'Nachrichten',
  'Lists, plurals and messages': 'Listen, Pluralformen und Nachrichten',
  "ICU message format with the locale's plural rules, list formatting, and the plural category of any number.":
    'ICU-Nachrichtenformat mit den Pluralregeln des Gebietsschemas, Listenformatierung und die Pluralkategorie jeder Zahl.',
  'List items': 'Listeneinträge',
  'Message (ICU)': 'Nachricht (ICU)',
  'Arguments (JSON)': 'Argumente (JSON)',
  Matching: 'Abgleich',
  'Locale matching': 'Gebietsschema-Abgleich',
  "Pick the best of your app's supported locales for what a user asks for, using CLDR's language distances (es-MX matches es-419, zh-TW matches zh-Hant).":
    'Wähle aus den unterstützten Gebietsschemas deiner App das beste für das, was ein Nutzer verlangt, anhand der Sprachdistanzen von CLDR (es-MX passt zu es-419, zh-TW zu zh-Hant).',
  Supported: 'Unterstützt',
  'Your languages': 'Deine Sprachen',
  Translations: 'Übersetzungen',
  'This page is translated with `createTranslator` and `translate`: an English source catalog keyed by its own text, and one catalog per language. Languages without a catalog fall back to English, using English plural rules.':
    'Diese Seite wird mit `createTranslator` und `translate` übersetzt: ein englischer Quellkatalog, dessen Schlüssel sein eigener Text ist, und ein Katalog pro Sprache. Sprachen ohne Katalog fallen auf Englisch zurück, mit englischen Pluralregeln.',
  'This text is in {language}.': 'Dieser Text ist auf {language}.',
  '{count, plural, one {# message} other {# messages}} in {languages, plural, one {# catalog} other {# catalogs}} besides English.':
    '{count, plural, one {# Nachricht} other {# Nachrichten}} in {languages, plural, one {# Katalog} other {# Katalogen}} neben Englisch.',
  'Problems found by `checkCatalogs`: {count, plural, =0 {none} other {#}}.':
    'Von `checkCatalogs` gefundene Probleme: {count, plural, =0 {keine} other {#}}.',
  'Translations on this site were written by an AI and have not been reviewed by native speakers.':
    'Die Übersetzungen auf dieser Seite wurden von einer KI geschrieben und nicht von Muttersprachlern geprüft.',
};
