import type { MessageCatalog } from '@billie-coop/hereabouts';
import type { MessageKey } from './en';

export const pt: MessageCatalog<MessageKey> = {
  'Loading locale data…': 'Carregando dados de idioma…',
  "Couldn't load locale data: {error}": 'Não foi possível carregar os dados de idioma: {error}',
  'v{version} · CLDR {cldr} · plain functions over plain data · every example runs live':
    'v{version} · CLDR {cldr} · funções simples sobre dados simples · cada exemplo roda ao vivo',
  Locale: 'Idioma',
  'Time zone': 'Fuso horário',
  'Search languages and regions': 'Pesquisar idiomas e regiões',
  'Search time zones': 'Pesquisar fusos horários',
  'No matches for “{query}”': 'Nenhum resultado para “{query}”',
  'Locale data is a plain object (`loadLocaleAsync(framework, locale)`) passed to plain functions. Bundlers keep only the functions you import: number formatting alone is about 42 KB gzipped, day math alone about 1.3 KB.':
    'Os dados de idioma são um objeto simples (`loadLocaleAsync(framework, locale)`) passado a funções simples. Os bundlers mantêm só as funções que você importa: só a formatação de números tem uns 42 KB compactados, só o cálculo de dias uns 1,3 KB.',
  'Built on cldr-engine by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA tz database.':
    'Feito com cldr-engine de Patrick Hensley, com dados CLDR do Consórcio Unicode e fusos horários do banco de dados tz da IANA.',
  Numbers: 'Números',
  'Numbers are formatted from strings or numbers with exact decimal digits, so nothing is lost to floating point.':
    'Os números são formatados a partir de strings ou números com casas decimais exatas, então nada se perde com ponto flutuante.',
  Number: 'Número',
  Currency: 'Moeda',
  "Each currency rounds to its own digits (JPY has none, BHD has three) and `cash: true` applies cash rounding (CHF to 0.05). The default currency comes from the locale's region: `getCurrencyForRegion({region})` is {currency}.":
    'Cada moeda arredonda para as próprias casas decimais (JPY não tem nenhuma, BHD tem três) e `cash: true` aplica o arredondamento em dinheiro (CHF para 0,05). A moeda padrão vem da região do idioma: `getCurrencyForRegion({region})` é {currency}.',
  Amount: 'Valor',
  'Decimal math': 'Cálculo decimal',
  'Arbitrary precision decimals as plain data (`{json}`), so amounts survive JSON and `structuredClone`. Add, subtract and multiply are exact; divide takes a precision or scale.':
    'Decimais de precisão arbitrária como dados simples (`{json}`), então os valores sobrevivem a JSON e a `structuredClone`. Somar, subtrair e multiplicar é exato; dividir recebe uma precisão ou escala.',
  'An invoice line': 'Uma linha de fatura',
  Quantity: 'Quantidade',
  'Unit price': 'Preço unitário',
  'Tax rate': 'Alíquota de imposto',
  Dates: 'Datas',
  'Days, times and zones': 'Dias, horas e fusos',
  'A `Day` is a calendar date with no time or zone, so it can’t shift by a day; a `TimeOfDay` is a wall clock time; instants are epoch milliseconds. Only a few functions take a zone: what day it is there (`dayToday`), and when a wall clock time happens there (`dayAtTime`).':
    'Um `Day` é uma data de calendário sem hora nem fuso, então não pode mudar de dia; um `TimeOfDay` é uma hora de relógio; instantes são milissegundos desde a época. Só algumas funções recebem um fuso: que dia é lá (`dayToday`) e quando uma hora de relógio acontece lá (`dayAtTime`).',
  'Due date': 'Data de vencimento',
  'Reminder time': 'Hora do lembrete',
  '{zone} has no clock change in the next year, so {time} every day is exactly 24 hours apart.':
    '{zone} não muda de horário no próximo ano, então {time} todo dia fica exatamente a 24 horas do anterior.',
  'The clocks change in {zone} on {date}: {time} that day comes {hours, plural, one {# hour} other {# hours}} after {time} the day before.':
    'O horário muda em {zone} em {date}: nesse dia, {time} chega {hours, plural, one {# hora} other {# horas}} depois das {time} do dia anterior.',
  "The week starts on the locale's first day (`firstDayOfWeek(locale)` is {first}, 1 = Sunday). The grid is `dayRange` over `dayStartOfWeek` in steps of a week. Today in {zone}: {today}.":
    'A semana começa no primeiro dia do idioma (`firstDayOfWeek(locale)` é {first}, 1 = domingo). A grade é `dayRange` sobre `dayStartOfWeek` em passos de uma semana. Hoje em {zone}: {today}.',
  Units: 'Unidades',
  'Quantities in three lengths, and exact conversion with `@phensley/unit-converter`. This locale measures in the {system} system (`measurementSystem(locale)`).':
    'Quantidades em três tamanhos e conversão exata com `@phensley/unit-converter`. Este idioma mede no sistema {system} (`measurementSystem(locale)`).',
  Value: 'Valor',
  Unit: 'Unidade',
  'no conversion': 'sem conversão',
  Messages: 'Mensagens',
  'Lists, plurals and messages': 'Listas, plurais e mensagens',
  "ICU message format with the locale's plural rules, list formatting, and the plural category of any number.":
    'Formato de mensagens ICU com as regras de plural do idioma, formatação de listas e a categoria de plural de qualquer número.',
  'List items': 'Itens da lista',
  'Message (ICU)': 'Mensagem (ICU)',
  'Arguments (JSON)': 'Argumentos (JSON)',
  Matching: 'Correspondência',
  'Locale matching': 'Correspondência de idiomas',
  "Pick the best of your app's supported locales for what a user asks for, using CLDR's language distances (es-MX matches es-419, zh-TW matches zh-Hant).":
    'Escolha, entre os idiomas que o seu app suporta, o melhor para o que o usuário pede, usando as distâncias entre idiomas do CLDR (es-MX corresponde a es-419, zh-TW a zh-Hant).',
  Supported: 'Suportados',
  'Your languages': 'Seus idiomas',
  Translations: 'Traduções',
  'This page is translated with `createTranslator` and `translate`: an English source catalog keyed by its own text, and one catalog per language. Languages without a catalog fall back to English, using English plural rules.':
    'Esta página é traduzida com `createTranslator` e `translate`: um catálogo de origem em inglês cujas chaves são o próprio texto, e um catálogo por idioma. Idiomas sem catálogo voltam ao inglês, com as regras de plural do inglês.',
  'This text is in {language}.': 'Este texto está em {language}.',
  '{count, plural, one {# message} other {# messages}} in {languages, plural, one {# catalog} other {# catalogs}} besides English.':
    '{count, plural, one {# mensagem} other {# mensagens}} em {languages, plural, one {# catálogo} other {# catálogos}} além do inglês.',
  'Problems found by `checkCatalogs`: {count, plural, =0 {none} other {#}}.':
    'Problemas encontrados por `checkCatalogs`: {count, plural, =0 {nenhum} other {#}}.',
  'Translations on this site were written by an AI and have not been reviewed by native speakers.':
    'As traduções deste site foram escritas por uma IA e não foram revisadas por falantes nativos.',
};
