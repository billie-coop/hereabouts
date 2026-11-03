import type { MessageCatalog } from '@billie-coop/hereabouts';
import type { MessageKey } from './en';

export const zh: MessageCatalog<MessageKey> = {
  'Loading locale data…': '正在加载语言区域数据…',
  "Couldn't load locale data: {error}": '无法加载语言区域数据:{error}',
  'v{version} · CLDR {cldr} · plain functions over plain data · every example runs live':
    'v{version} · CLDR {cldr} · 作用于简单数据的简单函数 · 每个示例都实时运行',
  Locale: '语言区域',
  'Time zone': '时区',
  'Search languages and regions': '搜索语言和地区',
  'Search time zones': '搜索时区',
  'No matches for “{query}”': '没有与“{query}”匹配的结果',
  'Locale data is a plain object (`loadLocaleAsync(framework, locale)`) passed to plain functions. Bundlers keep only the functions you import: number formatting alone is about 42 KB gzipped, day math alone about 1.3 KB.':
    '语言区域数据是一个简单对象(`loadLocaleAsync(framework, locale)`),传给简单函数使用。打包工具只保留你导入的函数:仅数字格式化约为 42 KB(gzip),仅日期计算约为 1.3 KB。',
  'Built on cldr-engine by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA tz database.':
    '基于 Patrick Hensley 的 cldr-engine 构建,使用 Unicode 联盟的 CLDR 数据和 IANA tz 数据库的时区。',
  Numbers: '数字',
  'Numbers are formatted from strings or numbers with exact decimal digits, so nothing is lost to floating point.':
    '数字由字符串或带有精确小数位的数字格式化而来,因此不会因浮点数而丢失任何精度。',
  Number: '数字',
  Currency: '货币',
  "Each currency rounds to its own digits (JPY has none, BHD has three) and `cash: true` applies cash rounding (CHF to 0.05). The default currency comes from the locale's region: `getCurrencyForRegion({region})` is {currency}.":
    '每种货币按自己的小数位数舍入(JPY 没有小数,BHD 有三位),`cash: true` 会应用现金舍入(CHF 舍入到 0.05)。默认货币来自语言区域的地区:`getCurrencyForRegion({region})` 是 {currency}。',
  Amount: '金额',
  'Decimal math': '十进制运算',
  'Arbitrary precision decimals as plain data (`{json}`), so amounts survive JSON and `structuredClone`. Add, subtract and multiply are exact; divide takes a precision or scale.':
    '任意精度的十进制数作为简单数据(`{json}`),因此金额经过 JSON 和 `structuredClone` 后依然准确。加、减、乘都是精确的;除法需要指定精度或小数位数。',
  'An invoice line': '一行发票明细',
  Quantity: '数量',
  'Unit price': '单价',
  'Tax rate': '税率',
  Dates: '日期',
  'Days, times and zones': '日期、时间和时区',
  'A `Day` is a calendar date with no time or zone, so it can’t shift by a day; a `TimeOfDay` is a wall clock time; instants are epoch milliseconds. Only a few functions take a zone: what day it is there (`dayToday`), and when a wall clock time happens there (`dayAtTime`).':
    '`Day` 是没有时间和时区的日历日期,所以不会偏移一天;`TimeOfDay` 是钟表时间;时刻是自纪元起的毫秒数。只有少数函数需要时区:那里今天是哪一天(`dayToday`),以及那里的某个钟表时间何时到来(`dayAtTime`)。',
  'Due date': '到期日',
  'Reminder time': '提醒时间',
  '{zone} has no clock change in the next year, so {time} every day is exactly 24 hours apart.':
    '{zone} 在未来一年内没有时间调整,因此每天的 {time} 恰好相隔 24 小时。',
  'The clocks change in {zone} on {date}: {time} that day comes {hours, plural, one {# hour} other {# hours}} after {time} the day before.':
    '{zone} 将在 {date} 调整时间:当天的 {time} 比前一天的 {time} 晚 {hours, plural, other {# 小时}}。',
  "The week starts on the locale's first day (`firstDayOfWeek(locale)` is {first}, 1 = Sunday). The grid is `dayRange` over `dayStartOfWeek` in steps of a week. Today in {zone}: {today}.":
    '一周从该语言区域的第一天开始(`firstDayOfWeek(locale)` 为 {first},1 = 星期日)。网格是从 `dayStartOfWeek` 开始、以一周为步长的 `dayRange`。{zone} 的今天:{today}。',
  Units: '单位',
  'Quantities in three lengths, and exact conversion with `@phensley/unit-converter`. This locale measures in the {system} system (`measurementSystem(locale)`).':
    '三种长度的数量,以及使用 `@phensley/unit-converter` 的精确换算。此语言区域使用 {system} 度量制(`measurementSystem(locale)`)。',
  Value: '值',
  Unit: '单位',
  'no conversion': '无换算',
  Messages: '消息',
  'Lists, plurals and messages': '列表、复数和消息',
  "ICU message format with the locale's plural rules, list formatting, and the plural category of any number.":
    '使用该语言区域复数规则的 ICU 消息格式、列表格式化,以及任意数字的复数类别。',
  'List items': '列表项',
  'Message (ICU)': '消息 (ICU)',
  'Arguments (JSON)': '参数 (JSON)',
  Matching: '匹配',
  'Locale matching': '语言区域匹配',
  "Pick the best of your app's supported locales for what a user asks for, using CLDR's language distances (es-MX matches es-419, zh-TW matches zh-Hant).":
    '根据 CLDR 的语言距离,从你的应用支持的语言区域中为用户的需求选出最佳的一个(es-MX 匹配 es-419,zh-TW 匹配 zh-Hant)。',
  Supported: '支持的',
  'Your languages': '你的语言',
  Translations: '翻译',
  'This page is translated with `createTranslator` and `translate`: an English source catalog keyed by its own text, and one catalog per language. Languages without a catalog fall back to English, using English plural rules.':
    '本页使用 `createTranslator` 和 `translate` 翻译:一个以自身英文文本为键的英文源目录,以及每种语言一个目录。没有目录的语言会回退到英文,并使用英文的复数规则。',
  'This text is in {language}.': '这段文字是{language}。',
  '{count, plural, one {# message} other {# messages}} in {languages, plural, one {# catalog} other {# catalogs}} besides English.':
    '除英文外的 {languages, plural, other {# 个目录}}中共有 {count, plural, other {# 条消息}}。',
  'Problems found by `checkCatalogs`: {count, plural, =0 {none} other {#}}.':
    '`checkCatalogs` 发现的问题:{count, plural, =0 {无} other {# 个}}。',
  'Translations on this site were written by an AI and have not been reviewed by native speakers.':
    '本网站的翻译由 AI 编写,未经母语人士审校。',
};
