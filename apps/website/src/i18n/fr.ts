import type { MessageCatalog } from '@billie-coop/hereabouts';
import type { MessageKey } from './en';

export const fr: MessageCatalog<MessageKey> = {
  'More examples': 'Plus d’exemples',
  'Loading locale data…': 'Chargement des données de langue…',
  "Couldn't load locale data: {error}": 'Impossible de charger les données de langue : {error}',
  'v{version} · CLDR {cldr} · plain functions over plain data · every example runs live':
    'v{version} · CLDR {cldr} · des fonctions simples sur des données simples · chaque exemple s’exécute en direct',
  Locale: 'Langue',
  'Time zone': 'Fuseau horaire',
  'Search languages and regions': 'Rechercher une langue ou une région',
  'Search time zones': 'Rechercher un fuseau horaire',
  'No matches for “{query}”': 'Aucun résultat pour « {query} »',
  'Locale data is a plain object (`loadLocaleAsync(framework, locale)`) passed to plain functions. Bundlers keep only the functions you import: number formatting alone is about 42 KB gzipped, day math alone about 1.3 KB.':
    'Les données de langue sont un objet simple (`loadLocaleAsync(framework, locale)`) passé à des fonctions simples. Les bundlers ne gardent que les fonctions importées : le formatage des nombres seul pèse environ 42 Ko gzip, le calcul de jours seul environ 1,3 Ko.',
  'Built on cldr-engine by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA tz database.':
    'Construit sur cldr-engine de Patrick Hensley, avec les données CLDR du Consortium Unicode et les fuseaux horaires de la base tz de l’IANA.',
  Numbers: 'Nombres',
  'Numbers are formatted from strings or numbers with exact decimal digits, so nothing is lost to floating point.':
    'Les nombres sont formatés à partir de chaînes ou de nombres avec des décimales exactes : rien n’est perdu à cause de la virgule flottante.',
  Number: 'Nombre',
  Currency: 'Devise',
  "Each currency rounds to its own digits (JPY has none, BHD has three) and `cash: true` applies cash rounding (CHF to 0.05). The default currency comes from the locale's region: `getCurrencyForRegion({region})` is {currency}.":
    'Chaque devise arrondit à son propre nombre de décimales (JPY n’en a aucune, BHD en a trois) et `cash: true` applique l’arrondi en espèces (CHF à 0,05). La devise par défaut vient de la région de la langue : `getCurrencyForRegion({region})` donne {currency}.',
  Amount: 'Montant',
  'Decimal math': 'Calcul décimal',
  'Arbitrary precision decimals as plain data (`{json}`), so amounts survive JSON and `structuredClone`. Add, subtract and multiply are exact; divide takes a precision or scale.':
    'Des décimaux à précision arbitraire sous forme de données simples (`{json}`), donc les montants survivent à JSON et à `structuredClone`. L’addition, la soustraction et la multiplication sont exactes ; la division prend une précision ou une échelle.',
  'An invoice line': 'Une ligne de facture',
  Quantity: 'Quantité',
  'Unit price': 'Prix unitaire',
  'Tax rate': 'Taux de taxe',
  Dates: 'Dates',
  'Days, times and zones': 'Jours, heures et fuseaux',
  'A `Day` is a calendar date with no time or zone, so it can’t shift by a day; a `TimeOfDay` is a wall clock time; instants are epoch milliseconds. Only a few functions take a zone: what day it is there (`dayToday`), and when a wall clock time happens there (`dayAtTime`).':
    'Un `Day` est une date de calendrier sans heure ni fuseau, il ne peut donc pas se décaler d’un jour ; un `TimeOfDay` est une heure d’horloge ; les instants sont des millisecondes depuis l’époque. Seules quelques fonctions prennent un fuseau : quel jour il est là-bas (`dayToday`) et quand une heure d’horloge s’y produit (`dayAtTime`).',
  'Due date': 'Date d’échéance',
  'Reminder time': 'Heure du rappel',
  '{zone} has no clock change in the next year, so {time} every day is exactly 24 hours apart.':
    '{zone} n’a pas de changement d’heure dans l’année qui vient, donc {time} chaque jour revient exactement toutes les 24 heures.',
  'The clocks change in {zone} on {date}: {time} that day comes {hours, plural, one {# hour} other {# hours}} after {time} the day before.':
    'L’heure change à {zone} le {date} : ce jour-là, {time} arrive {hours, plural, one {# heure} other {# heures}} après {time} la veille.',
  "The week starts on the locale's first day (`firstDayOfWeek(locale)` is {first}, 1 = Sunday). The grid is `dayRange` over `dayStartOfWeek` in steps of a week. Today in {zone}: {today}.":
    'La semaine commence le premier jour de la langue (`firstDayOfWeek(locale)` vaut {first}, 1 = dimanche). La grille est `dayRange` sur `dayStartOfWeek` par pas d’une semaine. Aujourd’hui à {zone} : {today}.',
  Units: 'Unités',
  'Quantities in three lengths, and exact conversion with `@billie-coop/hereabouts/unit-converter`. This locale measures in the {system} system (`measurementSystem(locale)`).':
    'Des quantités en trois longueurs, et une conversion exacte avec `@billie-coop/hereabouts/unit-converter`. Cette langue utilise le système {system} (`measurementSystem(locale)`).',
  Value: 'Valeur',
  Unit: 'Unité',
  'no conversion': 'pas de conversion',
  Messages: 'Messages',
  'Lists, plurals and messages': 'Listes, pluriels et messages',
  "ICU message format with the locale's plural rules, list formatting, and the plural category of any number.":
    'Le format de message ICU avec les règles de pluriel de la langue, le formatage de listes et la catégorie de pluriel de n’importe quel nombre.',
  'List items': 'Éléments de la liste',
  'Message (ICU)': 'Message (ICU)',
  'Arguments (JSON)': 'Arguments (JSON)',
  Matching: 'Correspondance',
  'Locale matching': 'Correspondance de langues',
  "Pick the best of your app's supported locales for what a user asks for, using CLDR's language distances (es-MX matches es-419, zh-TW matches zh-Hant).":
    'Choisissez, parmi les langues prises en charge par votre app, la meilleure pour ce que demande l’utilisateur, grâce aux distances linguistiques de CLDR (es-MX correspond à es-419, zh-TW à zh-Hant).',
  Supported: 'Prises en charge',
  'Your languages': 'Vos langues',
  Translations: 'Traductions',
  'This page is translated with `createTranslator` and `translate`: an English source catalog keyed by its own text, and one catalog per language. Languages without a catalog fall back to English, using English plural rules.':
    'Cette page est traduite avec `createTranslator` et `translate` : un catalogue source en anglais dont les clés sont son propre texte, et un catalogue par langue. Les langues sans catalogue reviennent à l’anglais, avec les règles de pluriel anglaises.',
  'This text is in {language}.': 'Ce texte est en {language}.',
  '{count, plural, one {# message} other {# messages}} in {languages, plural, one {# catalog} other {# catalogs}} besides English.':
    '{count, plural, one {# message} other {# messages}} dans {languages, plural, one {# catalogue} other {# catalogues}} en plus de l’anglais.',
  'Problems found by `checkCatalogs`: {count, plural, =0 {none} other {#}}.':
    'Problèmes trouvés par `checkCatalogs` : {count, plural, =0 {aucun} other {#}}.',
  'Translations on this site were written by an AI and have not been reviewed by native speakers.':
    'Les traductions de ce site ont été écrites par une IA et n’ont pas été relues par des locuteurs natifs.',
};
