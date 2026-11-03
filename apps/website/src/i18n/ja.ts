import type { MessageCatalog } from '@billie-coop/hereabouts';
import type { MessageKey } from './en';

export const ja: MessageCatalog<MessageKey> = {
  'Loading locale data…': 'ロケールデータを読み込んでいます…',
  "Couldn't load locale data: {error}": 'ロケールデータを読み込めませんでした: {error}',
  'v{version} · CLDR {cldr} · plain functions over plain data · every example runs live':
    'v{version} · CLDR {cldr} · シンプルなデータに対するシンプルな関数 · すべての例がライブで動作',
  Locale: 'ロケール',
  'Time zone': 'タイムゾーン',
  'Search languages and regions': '言語と地域を検索',
  'Search time zones': 'タイムゾーンを検索',
  'No matches for “{query}”': '「{query}」に一致する項目はありません',
  'Locale data is a plain object (`loadLocaleAsync(framework, locale)`) passed to plain functions. Bundlers keep only the functions you import: number formatting alone is about 42 KB gzipped, day math alone about 1.3 KB.':
    'ロケールデータはシンプルなオブジェクト(`loadLocaleAsync(framework, locale)`)で、シンプルな関数に渡します。バンドラーはインポートした関数だけを残します。数値の書式設定だけなら gzip で約 42 KB、日付計算だけなら約 1.3 KB です。',
  'Built on cldr-engine by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA tz database.':
    'Patrick Hensley による cldr-engine をベースに、Unicode コンソーシアムの CLDR データと IANA tz データベースのタイムゾーンを使用しています。',
  Numbers: '数値',
  'Numbers are formatted from strings or numbers with exact decimal digits, so nothing is lost to floating point.':
    '数値は文字列または正確な小数桁を持つ数値から書式設定されるため、浮動小数点で失われるものはありません。',
  Number: '数値',
  Currency: '通貨',
  "Each currency rounds to its own digits (JPY has none, BHD has three) and `cash: true` applies cash rounding (CHF to 0.05). The default currency comes from the locale's region: `getCurrencyForRegion({region})` is {currency}.":
    '各通貨はそれぞれの桁数に丸められ(JPY は 0 桁、BHD は 3 桁)、`cash: true` で現金の端数処理(CHF は 0.05 単位)が適用されます。既定の通貨はロケールの地域から決まります: `getCurrencyForRegion({region})` は {currency} です。',
  Amount: '金額',
  'Decimal math': '10 進数の計算',
  'Arbitrary precision decimals as plain data (`{json}`), so amounts survive JSON and `structuredClone`. Add, subtract and multiply are exact; divide takes a precision or scale.':
    '任意精度の 10 進数をシンプルなデータ(`{json}`)として扱うので、金額は JSON や `structuredClone` を経ても失われません。加算・減算・乗算は正確で、除算には精度またはスケールを指定します。',
  'An invoice line': '請求書の明細行',
  Quantity: '数量',
  'Unit price': '単価',
  'Tax rate': '税率',
  Dates: '日付',
  'Days, times and zones': '日・時刻・タイムゾーン',
  'A `Day` is a calendar date with no time or zone, so it can’t shift by a day; a `TimeOfDay` is a wall clock time; instants are epoch milliseconds. Only a few functions take a zone: what day it is there (`dayToday`), and when a wall clock time happens there (`dayAtTime`).':
    '`Day` は時刻もタイムゾーンも持たない暦日なので、1 日ずれることがありません。`TimeOfDay` は時計の時刻、瞬間はエポックからのミリ秒です。タイムゾーンを受け取る関数はわずかです: その地域で今日が何日か(`dayToday`)と、その地域で時計の時刻がいつ来るか(`dayAtTime`)。',
  'Due date': '支払期日',
  'Reminder time': 'リマインダーの時刻',
  '{zone} has no clock change in the next year, so {time} every day is exactly 24 hours apart.':
    '{zone} では今後 1 年間時刻の切り替えがないため、毎日の {time} はちょうど 24 時間間隔です。',
  'The clocks change in {zone} on {date}: {time} that day comes {hours, plural, one {# hour} other {# hours}} after {time} the day before.':
    '{zone} では {date} に時刻が切り替わります: その日の {time} は前日の {time} の {hours, plural, other {# 時間}}後に来ます。',
  "The week starts on the locale's first day (`firstDayOfWeek(locale)` is {first}, 1 = Sunday). The grid is `dayRange` over `dayStartOfWeek` in steps of a week. Today in {zone}: {today}.":
    '週はロケールの最初の曜日から始まります(`firstDayOfWeek(locale)` は {first}、1 = 日曜日)。グリッドは `dayStartOfWeek` から 1 週間ずつ進める `dayRange` です。{zone} の今日: {today}。',
  Units: '単位',
  'Quantities in three lengths, and exact conversion with `@phensley/unit-converter`. This locale measures in the {system} system (`measurementSystem(locale)`).':
    '3 種類の長さで表す数量と、`@phensley/unit-converter` による正確な換算。このロケールは {system} 系で計測します(`measurementSystem(locale)`)。',
  Value: '値',
  Unit: '単位',
  'no conversion': '換算なし',
  Messages: 'メッセージ',
  'Lists, plurals and messages': 'リスト、複数形、メッセージ',
  "ICU message format with the locale's plural rules, list formatting, and the plural category of any number.":
    'ロケールの複数形規則を使う ICU メッセージ形式、リストの書式設定、任意の数値の複数形カテゴリ。',
  'List items': 'リストの項目',
  'Message (ICU)': 'メッセージ (ICU)',
  'Arguments (JSON)': '引数 (JSON)',
  Matching: 'マッチング',
  'Locale matching': 'ロケールのマッチング',
  "Pick the best of your app's supported locales for what a user asks for, using CLDR's language distances (es-MX matches es-419, zh-TW matches zh-Hant).":
    'アプリが対応するロケールの中から、ユーザーの希望に最も合うものを CLDR の言語距離で選びます(es-MX は es-419 に、zh-TW は zh-Hant に一致)。',
  Supported: '対応ロケール',
  'Your languages': 'あなたの言語',
  Translations: '翻訳',
  'This page is translated with `createTranslator` and `translate`: an English source catalog keyed by its own text, and one catalog per language. Languages without a catalog fall back to English, using English plural rules.':
    'このページは `createTranslator` と `translate` で翻訳されています: 自身の英語テキストをキーにした英語のソースカタログと、言語ごとのカタログです。カタログのない言語は英語にフォールバックし、英語の複数形規則を使います。',
  'This text is in {language}.': 'このテキストは{language}です。',
  '{count, plural, one {# message} other {# messages}} in {languages, plural, one {# catalog} other {# catalogs}} besides English.':
    '英語以外の {languages, plural, other {# 個のカタログ}}に {count, plural, other {# 件のメッセージ}}。',
  'Problems found by `checkCatalogs`: {count, plural, =0 {none} other {#}}.':
    '`checkCatalogs` が見つけた問題: {count, plural, =0 {なし} other {# 件}}。',
  'Translations on this site were written by an AI and have not been reviewed by native speakers.':
    'このサイトの翻訳は AI が作成したもので、ネイティブスピーカーによる確認は受けていません。',
};
