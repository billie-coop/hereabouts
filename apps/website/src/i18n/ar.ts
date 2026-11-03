import type { MessageCatalog } from '@phensley/cldr';
import type { MessageKey } from './en';

export const ar: MessageCatalog<MessageKey> = {
  'Loading locale data…': 'جارٍ تحميل بيانات اللغة…',
  "Couldn't load locale data: {error}": 'تعذّر تحميل بيانات اللغة: {error}',
  'v{version} · CLDR {cldr} · plain functions over plain data · every example runs live':
    'الإصدار {version} · CLDR {cldr} · دوال بسيطة على بيانات بسيطة · كل مثال يعمل مباشرةً',
  Locale: 'اللغة',
  'Time zone': 'المنطقة الزمنية',
  'Search languages and regions': 'ابحث عن لغة أو منطقة',
  'Search time zones': 'ابحث عن منطقة زمنية',
  'No matches for “{query}”': 'لا توجد نتائج لـ "{query}"',
  'Locale data is a plain object (`loadLocaleAsync(framework, locale)`) passed to plain functions. Bundlers keep only the functions you import: number formatting alone is about 42 KB gzipped, day math alone about 1.3 KB.':
    'بيانات اللغة كائن بسيط (`loadLocaleAsync(framework, locale)`) يُمرَّر إلى دوال بسيطة. تحتفظ أدوات التجميع بالدوال التي تستوردها فقط: تنسيق الأرقام وحده نحو 42 كيلوبايت مضغوطًا، وحساب الأيام وحده نحو 1.3 كيلوبايت.',
  'Built on cldr-engine by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA tz database.':
    'مبني على cldr-engine من تأليف Patrick Hensley، ببيانات CLDR من اتحاد يونيكود والمناطق الزمنية من قاعدة بيانات tz التابعة لـ IANA.',
  Numbers: 'الأرقام',
  'Numbers are formatted from strings or numbers with exact decimal digits, so nothing is lost to floating point.':
    'تُنسَّق الأرقام من سلاسل نصية أو أرقام بخانات عشرية دقيقة، فلا يضيع شيء بسبب الفاصلة العائمة.',
  Number: 'الرقم',
  Currency: 'العملة',
  "Each currency rounds to its own digits (JPY has none, BHD has three) and `cash: true` applies cash rounding (CHF to 0.05). The default currency comes from the locale's region: `getCurrencyForRegion({region})` is {currency}.":
    'تُقرَّب كل عملة إلى خاناتها الخاصة (ليس للين الياباني JPY خانات، وللدينار البحريني BHD ثلاث)، ويطبّق `cash: true` التقريب النقدي (الفرنك السويسري CHF إلى 0.05). تأتي العملة الافتراضية من منطقة اللغة: `getCurrencyForRegion({region})` هي {currency}.',
  Amount: 'المبلغ',
  'Decimal math': 'الحساب العشري',
  'Arbitrary precision decimals as plain data (`{json}`), so amounts survive JSON and `structuredClone`. Add, subtract and multiply are exact; divide takes a precision or scale.':
    'أعداد عشرية بدقة غير محدودة على شكل بيانات بسيطة (`{json}`)، فتبقى المبالغ سليمة عبر JSON و`structuredClone`. الجمع والطرح والضرب دقيقة، والقسمة تأخذ دقة أو مقياسًا.',
  'An invoice line': 'سطر في فاتورة',
  Quantity: 'الكمية',
  'Unit price': 'سعر الوحدة',
  'Tax rate': 'نسبة الضريبة',
  Dates: 'التواريخ',
  'Days, times and zones': 'الأيام والأوقات والمناطق الزمنية',
  'A `Day` is a calendar date with no time or zone, so it can’t shift by a day; a `TimeOfDay` is a wall clock time; instants are epoch milliseconds. Only a few functions take a zone: what day it is there (`dayToday`), and when a wall clock time happens there (`dayAtTime`).':
    '`Day` تاريخ تقويمي بلا وقت ولا منطقة زمنية، فلا يمكن أن ينزاح يومًا؛ و`TimeOfDay` وقت على الساعة؛ واللحظات أجزاء من الألف من الثانية منذ بداية الحقبة. قليل من الدوال يأخذ منطقة زمنية: أي يوم هو هناك (`dayToday`)، ومتى يحين وقت على الساعة هناك (`dayAtTime`).',
  'Due date': 'تاريخ الاستحقاق',
  'Reminder time': 'وقت التذكير',
  '{zone} has no clock change in the next year, so {time} every day is exactly 24 hours apart.':
    'لا يتغير التوقيت في {zone} خلال العام القادم، لذا يفصل {time} كل يوم 24 ساعة بالضبط.',
  'The clocks change in {zone} on {date}: {time} that day comes {hours, plural, one {# hour} other {# hours}} after {time} the day before.':
    'يتغير التوقيت في {zone} يوم {date}: يأتي {time} في ذلك اليوم بعد {hours, plural, zero {# ساعة} one {ساعة واحدة} two {ساعتين} few {# ساعات} many {# ساعة} other {# ساعة}} من {time} في اليوم السابق.',
  "The week starts on the locale's first day (`firstDayOfWeek(locale)` is {first}, 1 = Sunday). The grid is `dayRange` over `dayStartOfWeek` in steps of a week. Today in {zone}: {today}.":
    'يبدأ الأسبوع في أول يوم للغة (`firstDayOfWeek(locale)` هو {first}، و1 = الأحد). الشبكة هي `dayRange` بدءًا من `dayStartOfWeek` بخطوة أسبوع. اليوم في {zone}: {today}.',
  Units: 'الوحدات',
  'Quantities in three lengths, and exact conversion with `@phensley/unit-converter`. This locale measures in the {system} system (`measurementSystem(locale)`).':
    'كميات بثلاثة أطوال، وتحويل دقيق باستخدام `@phensley/unit-converter`. تقيس هذه اللغة بنظام {system} (`measurementSystem(locale)`).',
  Value: 'القيمة',
  Unit: 'الوحدة',
  'no conversion': 'لا تحويل',
  Messages: 'الرسائل',
  'Lists, plurals and messages': 'القوائم والجمع والرسائل',
  "ICU message format with the locale's plural rules, list formatting, and the plural category of any number.":
    'تنسيق رسائل ICU بقواعد الجمع الخاصة باللغة، وتنسيق القوائم، وفئة الجمع لأي رقم.',
  'List items': 'عناصر القائمة',
  'Message (ICU)': 'الرسالة (ICU)',
  'Arguments (JSON)': 'المعاملات (JSON)',
  Matching: 'المطابقة',
  'Locale matching': 'مطابقة اللغات',
  "Pick the best of your app's supported locales for what a user asks for, using CLDR's language distances (es-MX matches es-419, zh-TW matches zh-Hant).":
    'اختر من بين اللغات التي يدعمها تطبيقك الأنسب لما يطلبه المستخدم، باستخدام مسافات اللغات في CLDR (es-MX تطابق es-419، وzh-TW تطابق zh-Hant).',
  Supported: 'المدعومة',
  'Your languages': 'لغاتك',
  Translations: 'الترجمات',
  'This page is translated with `createTranslator` and `translate`: an English source catalog keyed by its own text, and one catalog per language. Languages without a catalog fall back to English, using English plural rules.':
    'تُترجم هذه الصفحة باستخدام `createTranslator` و`translate`: كتالوج مصدر بالإنجليزية مفاتيحه نصه نفسه، وكتالوج لكل لغة. تعود اللغات التي ليس لها كتالوج إلى الإنجليزية، بقواعد الجمع الإنجليزية.',
  'This text is in {language}.': 'هذا النص باللغة {language}.',
  '{count, plural, one {# message} other {# messages}} in {languages, plural, one {# catalog} other {# catalogs}} besides English.':
    '{count, plural, zero {# رسالة} one {رسالة واحدة} two {رسالتان} few {# رسائل} many {# رسالة} other {# رسالة}} في {languages, plural, zero {# كتالوج} one {كتالوج واحد} two {كتالوجين} few {# كتالوجات} many {# كتالوجًا} other {# كتالوج}} غير الإنجليزية.',
  'Problems found by `checkCatalogs`: {count, plural, =0 {none} other {#}}.':
    'المشكلات التي وجدها `checkCatalogs`: {count, plural, =0 {لا شيء} other {#}}.',
  'Translations on this site were written by an AI and have not been reviewed by native speakers.':
    'كُتبت الترجمات في هذا الموقع بواسطة ذكاء اصطناعي ولم يراجعها متحدثون أصليون.',
};
