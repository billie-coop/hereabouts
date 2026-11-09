import type { MessageCatalog } from '@billie-coop/hereabouts';
import type { MessageKey } from './en';

export const zhHant: MessageCatalog<MessageKey> = {
  'More examples': '更多範例',
  'Loading locale data…': '正在載入語言區域資料…',
  "Couldn't load locale data: {error}": '無法載入語言區域資料:{error}',
  'v{version} · CLDR {cldr} · plain functions over plain data · every example runs live':
    'v{version} · CLDR {cldr} · 作用於簡單資料的簡單函式 · 每個範例都即時執行',
  Locale: '語言區域',
  'Time zone': '時區',
  'Search languages and regions': '搜尋語言和地區',
  'Search time zones': '搜尋時區',
  'No matches for “{query}”': '沒有符合「{query}」的結果',
  'Locale data is a plain object (`loadLocaleAsync(framework, locale)`) passed to plain functions. Bundlers keep only the functions you import: number formatting alone is about 42 KB gzipped, day math alone about 1.3 KB.':
    '語言區域資料是一個簡單物件(`loadLocaleAsync(framework, locale)`),傳給簡單函式使用。打包工具只保留你匯入的函式:僅數字格式化約為 42 KB(gzip),僅日期計算約為 1.3 KB。',
  'Built on cldr-engine by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA tz database.':
    '以 Patrick Hensley 的 cldr-engine 為基礎,使用 Unicode 聯盟的 CLDR 資料與 IANA tz 資料庫的時區。',
  Numbers: '數字',
  'Numbers are formatted from strings or numbers with exact decimal digits, so nothing is lost to floating point.':
    '數字由字串或帶有精確小數位的數字格式化而來,因此不會因浮點數而遺失任何精度。',
  Number: '數字',
  Currency: '貨幣',
  "Each currency rounds to its own digits (JPY has none, BHD has three) and `cash: true` applies cash rounding (CHF to 0.05). The default currency comes from the locale's region: `getCurrencyForRegion({region})` is {currency}.":
    '每種貨幣依自己的小數位數四捨五入(JPY 沒有小數,BHD 有三位),`cash: true` 會套用現金進位(CHF 進位到 0.05)。預設貨幣來自語言區域的地區:`getCurrencyForRegion({region})` 是 {currency}。',
  Amount: '金額',
  'Decimal math': '十進位運算',
  'Arbitrary precision decimals as plain data (`{json}`), so amounts survive JSON and `structuredClone`. Add, subtract and multiply are exact; divide takes a precision or scale.':
    '任意精度的十進位數作為簡單資料(`{json}`),因此金額經過 JSON 與 `structuredClone` 後依然準確。加、減、乘都是精確的;除法需要指定精度或小數位數。',
  'An invoice line': '一行發票明細',
  Quantity: '數量',
  'Unit price': '單價',
  'Tax rate': '稅率',
  Dates: '日期',
  'Days, times and zones': '日期、時間與時區',
  'A `Day` is a calendar date with no time or zone, so it can’t shift by a day; a `TimeOfDay` is a wall clock time; instants are epoch milliseconds. Only a few functions take a zone: what day it is there (`dayToday`), and when a wall clock time happens there (`dayAtTime`).':
    '`Day` 是沒有時間與時區的日曆日期,所以不會偏移一天;`TimeOfDay` 是時鐘時間;時刻是自紀元起的毫秒數。只有少數函式需要時區:那裡今天是哪一天(`dayToday`),以及那裡的某個時鐘時間何時到來(`dayAtTime`)。',
  'Due date': '到期日',
  'Reminder time': '提醒時間',
  '{zone} has no clock change in the next year, so {time} every day is exactly 24 hours apart.':
    '{zone} 在未來一年內沒有時間調整,因此每天的 {time} 恰好相隔 24 小時。',
  'The clocks change in {zone} on {date}: {time} that day comes {hours, plural, one {# hour} other {# hours}} after {time} the day before.':
    '{zone} 將於 {date} 調整時間:當天的 {time} 比前一天的 {time} 晚 {hours, plural, other {# 小時}}。',
  "The week starts on the locale's first day (`firstDayOfWeek(locale)` is {first}, 1 = Sunday). The grid is `dayRange` over `dayStartOfWeek` in steps of a week. Today in {zone}: {today}.":
    '一週從該語言區域的第一天開始(`firstDayOfWeek(locale)` 為 {first},1 = 星期日)。格線是從 `dayStartOfWeek` 開始、以一週為間隔的 `dayRange`。{zone} 的今天:{today}。',
  Units: '單位',
  'Quantities in three lengths, and exact conversion with `@billie-coop/hereabouts/unit-converter`. This locale measures in the {system} system (`measurementSystem(locale)`).':
    '三種長度的數量,以及使用 `@billie-coop/hereabouts/unit-converter` 的精確換算。此語言區域使用 {system} 度量衡制(`measurementSystem(locale)`)。',
  Value: '值',
  Unit: '單位',
  'no conversion': '無換算',
  Messages: '訊息',
  'Lists, plurals and messages': '清單、複數與訊息',
  "ICU message format with the locale's plural rules, list formatting, and the plural category of any number.":
    '使用該語言區域複數規則的 ICU 訊息格式、清單格式化,以及任意數字的複數類別。',
  'List items': '清單項目',
  'Message (ICU)': '訊息 (ICU)',
  'Arguments (JSON)': '參數 (JSON)',
  Matching: '比對',
  'Locale matching': '語言區域比對',
  "Pick the best of your app's supported locales for what a user asks for, using CLDR's language distances (es-MX matches es-419, zh-TW matches zh-Hant).":
    '依據 CLDR 的語言距離,從你的應用程式支援的語言區域中為使用者的需求選出最佳的一個(es-MX 對應 es-419,zh-TW 對應 zh-Hant)。',
  Supported: '支援的',
  'Your languages': '你的語言',
  Translations: '翻譯',
  'This page is translated with `createTranslator` and `translate`: an English source catalog keyed by its own text, and one catalog per language. Languages without a catalog fall back to English, using English plural rules.':
    '本頁使用 `createTranslator` 與 `translate` 翻譯:一個以自身英文文字為鍵的英文來源目錄,以及每種語言一個目錄。沒有目錄的語言會退回英文,並使用英文的複數規則。',
  'This text is in {language}.': '這段文字是{language}。',
  '{count, plural, one {# message} other {# messages}} in {languages, plural, one {# catalog} other {# catalogs}} besides English.':
    '除英文外的 {languages, plural, other {# 個目錄}}中共有 {count, plural, other {# 則訊息}}。',
  'Problems found by `checkCatalogs`: {count, plural, =0 {none} other {#}}.':
    '`checkCatalogs` 發現的問題:{count, plural, =0 {無} other {# 個}}。',
  'Translations on this site were written by an AI and have not been reviewed by native speakers.':
    '本網站的翻譯由 AI 撰寫,未經母語人士審閱。',
};
