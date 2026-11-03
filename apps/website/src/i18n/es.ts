import type { MessageCatalog } from '@billie-coop/hereabouts';
import type { MessageKey } from './en';

export const es: MessageCatalog<MessageKey> = {
  'Loading locale data…': 'Cargando datos de idioma…',
  "Couldn't load locale data: {error}": 'No se pudieron cargar los datos de idioma: {error}',
  'v{version} · CLDR {cldr} · plain functions over plain data · every example runs live':
    'v{version} · CLDR {cldr} · funciones simples sobre datos simples · cada ejemplo se ejecuta en vivo',
  Locale: 'Idioma',
  'Time zone': 'Zona horaria',
  'Search languages and regions': 'Buscar idiomas y regiones',
  'Search time zones': 'Buscar zonas horarias',
  'No matches for “{query}”': 'No hay resultados para «{query}»',
  'Locale data is a plain object (`loadLocaleAsync(framework, locale)`) passed to plain functions. Bundlers keep only the functions you import: number formatting alone is about 42 KB gzipped, day math alone about 1.3 KB.':
    'Los datos de idioma son un objeto simple (`loadLocaleAsync(framework, locale)`) que se pasa a funciones simples. Los empaquetadores solo conservan las funciones que importas: el formato de números por sí solo ocupa unos 42 KB comprimidos, el cálculo de días unos 1,3 KB.',
  'Built on cldr-engine by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA tz database.':
    'Basado en cldr-engine de Patrick Hensley, con datos CLDR del Consorcio Unicode y zonas horarias de la base de datos tz de IANA.',
  Numbers: 'Números',
  'Numbers are formatted from strings or numbers with exact decimal digits, so nothing is lost to floating point.':
    'Los números se formatean a partir de cadenas o números con decimales exactos, así que no se pierde nada por la coma flotante.',
  Number: 'Número',
  Currency: 'Moneda',
  "Each currency rounds to its own digits (JPY has none, BHD has three) and `cash: true` applies cash rounding (CHF to 0.05). The default currency comes from the locale's region: `getCurrencyForRegion({region})` is {currency}.":
    'Cada moneda redondea a sus propios decimales (JPY no tiene, BHD tiene tres) y `cash: true` aplica el redondeo en efectivo (CHF a 0,05). La moneda predeterminada sale de la región del idioma: `getCurrencyForRegion({region})` es {currency}.',
  Amount: 'Importe',
  'Decimal math': 'Cálculo decimal',
  'Arbitrary precision decimals as plain data (`{json}`), so amounts survive JSON and `structuredClone`. Add, subtract and multiply are exact; divide takes a precision or scale.':
    'Decimales de precisión arbitraria como datos simples (`{json}`), así que los importes sobreviven a JSON y a `structuredClone`. Sumar, restar y multiplicar es exacto; dividir admite una precisión o una escala.',
  'An invoice line': 'Una línea de factura',
  Quantity: 'Cantidad',
  'Unit price': 'Precio unitario',
  'Tax rate': 'Tipo de impuesto',
  Dates: 'Fechas',
  'Days, times and zones': 'Días, horas y zonas',
  'A `Day` is a calendar date with no time or zone, so it can’t shift by a day; a `TimeOfDay` is a wall clock time; instants are epoch milliseconds. Only a few functions take a zone: what day it is there (`dayToday`), and when a wall clock time happens there (`dayAtTime`).':
    'Un `Day` es una fecha de calendario sin hora ni zona, así que no puede desplazarse un día; un `TimeOfDay` es una hora de reloj; los instantes son milisegundos desde la época. Solo unas pocas funciones reciben una zona: qué día es allí (`dayToday`) y cuándo ocurre allí una hora de reloj (`dayAtTime`).',
  'Due date': 'Fecha de vencimiento',
  'Reminder time': 'Hora del recordatorio',
  '{zone} has no clock change in the next year, so {time} every day is exactly 24 hours apart.':
    '{zone} no cambia la hora en el próximo año, así que {time} cada día está exactamente a 24 horas del anterior.',
  'The clocks change in {zone} on {date}: {time} that day comes {hours, plural, one {# hour} other {# hours}} after {time} the day before.':
    'La hora cambia en {zone} el {date}: ese día, {time} llega {hours, plural, one {# hora} other {# horas}} después de {time} del día anterior.',
  "The week starts on the locale's first day (`firstDayOfWeek(locale)` is {first}, 1 = Sunday). The grid is `dayRange` over `dayStartOfWeek` in steps of a week. Today in {zone}: {today}.":
    'La semana empieza el primer día del idioma (`firstDayOfWeek(locale)` es {first}, 1 = domingo). La cuadrícula es `dayRange` sobre `dayStartOfWeek` en pasos de una semana. Hoy en {zone}: {today}.',
  Units: 'Unidades',
  'Quantities in three lengths, and exact conversion with `@phensley/unit-converter`. This locale measures in the {system} system (`measurementSystem(locale)`).':
    'Cantidades en tres longitudes y conversión exacta con `@phensley/unit-converter`. Este idioma mide en el sistema {system} (`measurementSystem(locale)`).',
  Value: 'Valor',
  Unit: 'Unidad',
  'no conversion': 'sin conversión',
  Messages: 'Mensajes',
  'Lists, plurals and messages': 'Listas, plurales y mensajes',
  "ICU message format with the locale's plural rules, list formatting, and the plural category of any number.":
    'Formato de mensajes ICU con las reglas de plural del idioma, formato de listas y la categoría de plural de cualquier número.',
  'List items': 'Elementos de la lista',
  'Message (ICU)': 'Mensaje (ICU)',
  'Arguments (JSON)': 'Argumentos (JSON)',
  Matching: 'Coincidencia',
  'Locale matching': 'Coincidencia de idiomas',
  "Pick the best of your app's supported locales for what a user asks for, using CLDR's language distances (es-MX matches es-419, zh-TW matches zh-Hant).":
    'Elige, entre los idiomas que admite tu app, el mejor para lo que pide el usuario, usando las distancias entre idiomas de CLDR (es-MX coincide con es-419, zh-TW con zh-Hant).',
  Supported: 'Admitidos',
  'Your languages': 'Tus idiomas',
  Translations: 'Traducciones',
  'This page is translated with `createTranslator` and `translate`: an English source catalog keyed by its own text, and one catalog per language. Languages without a catalog fall back to English, using English plural rules.':
    'Esta página se traduce con `createTranslator` y `translate`: un catálogo de origen en inglés cuyas claves son su propio texto, y un catálogo por idioma. Los idiomas sin catálogo vuelven al inglés, con las reglas de plural del inglés.',
  'This text is in {language}.': 'Este texto está en {language}.',
  '{count, plural, one {# message} other {# messages}} in {languages, plural, one {# catalog} other {# catalogs}} besides English.':
    '{count, plural, one {# mensaje} other {# mensajes}} en {languages, plural, one {# catálogo} other {# catálogos}} además del inglés.',
  'Problems found by `checkCatalogs`: {count, plural, =0 {none} other {#}}.':
    'Problemas encontrados por `checkCatalogs`: {count, plural, =0 {ninguno} other {#}}.',
  'Translations on this site were written by an AI and have not been reviewed by native speakers.':
    'Las traducciones de este sitio las escribió una IA y no las han revisado hablantes nativos.',
};
