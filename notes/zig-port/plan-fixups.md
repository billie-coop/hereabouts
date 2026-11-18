# Zig release fixups: proposed plan

Status: phase 1 only. No Zig, TypeScript, generated-data, or test changes. Prepared by
`t7t m3-hereabouts-fixups (M3)` for `t4t m3-hereabouts (M3)`. Implementation requires
supervisor approval AND completion of `t7j m3-hereabouts-review (M3)`'s review.

## Decisions requested

Approve these together, or amend them before implementation:

1. Use methods for Day, TimeOfDay, CalendarDate, matchers, converters, formatter and translator.
   Instant remains i64 with an `instant` namespace. Remove old aliases before the first release.
2. Return owning locale handles; cache limits count cache-owned entries, and live handles pin
   only the entries they use. Framework destruction drops its ownership; handles remain usable.
3. Eliminate mutable global timezone selection. Pass immutable databases explicitly and keep
   default-data convenience calls. CalendarDate remembers its database for later arithmetic.
4. Support concurrent use of framework/locale/formatter/translator objects with internal locks,
   assuming thread-safe allocators and callbacks. Destruction requires no active users.
5. Methods have `self` first and allocator first *after self*. Free/static allocating functions
   have the allocator literally first. This preserves Zig method syntax and is the one rule
   used throughout. If allocator literally first even before self is required, use namespace
   calls for allocating operations instead; do not silently mix the two conventions.

## API conventions and naming inventory

Functions use camelCase; types use UpperCamelCase; all option fields use snake_case (already
used in most modules). Acronyms follow existing UTC/ISO8601 spelling. Keep names that identify
an actual operand or result: `numbers.formatDecimal` versus `numbers.formatCurrency`,
`dates.formatDate` versus `dates.formatRelativeTime`, and the semantic `dayOfWeek` remain clear.
Do not broadly rename formatting methods merely because they contain the word date or number.

Methods express operations on the receiver; constructors are `Type.init`, fallible text parsers
`Type.parse` (optional where currently optional), and error-returning `Type.fromString` remains
distinct. No change to the existing optional-versus-error parsing semantics. Top-level
`decimal`/`rational` arithmetic stays namespace functions, which already read naturally.
LanguageTag's existing methods and locale-matcher's existing types remain.

The table lists the inconsistent public functions/types reached from `hereabouts.*`, including
exposed internal namespaces. Slash-separated entries map positionally. Other public declarations
retain their names. Each renamed implementation **and exported alias** gets a doc comment naming
its original TypeScript symbol and source path; a removed wrapper's destination documents that
original too. A method moved from another module gets the original TS name, not an invented
TypeScript method name. Internal call sites and suites migrate together, with no compatibility
aliases unless the supervisor requests them.

| Current public name | Proposed public name | Reason / contract |
| --- | --- | --- |
| `decimal.alignexp` | `decimal.alignExp` | Use camelCase consistently; keep the original spelling in the doc comment. |
| `decimal.shiftleft` | `decimal.shiftLeft` | Use camelCase consistently; keep the original spelling in the doc comment. |
| `decimal.shiftright` | `decimal.shiftRight` | Use camelCase consistently; keep the original spelling in the doc comment. |
| `decimal.divmod` | `decimal.divMod` | Use camelCase consistently; keep the original spelling in the doc comment. |
| `datetime.day` | `datetime.Day.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.isDay` | `datetime.Day.isValid` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayAdd` | `datetime.Day.add` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayCompare` | `datetime.Day.compare` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayDaysInMonth` | `datetime.Day.daysInMonth` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayEndOf` | `datetime.Day.endOf` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayEndOfWeek` | `datetime.Day.endOfWeek` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayEquals` | `datetime.Day.equals` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayFromEpochDay` | `datetime.Day.fromEpochDay` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayFromString` | `datetime.Day.fromString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayIsAfter` | `datetime.Day.isAfter` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayIsBefore` | `datetime.Day.isBefore` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayIsLeapYear` | `datetime.Day.isLeapYear` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayOfWeek` | `datetime.Day.dayOfWeek` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayOfYear` | `datetime.Day.dayOfYear` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayParse` | `datetime.Day.parse` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayRange` | `datetime.Day.range` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayStartOf` | `datetime.Day.startOf` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayStartOfWeek` | `datetime.Day.startOfWeek` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.daySubtract` | `datetime.Day.subtract` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayToEpochDay` | `datetime.Day.toEpochDay` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayToString` | `datetime.Day.toString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayUntil` | `datetime.Day.until` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.formatDay` | `datetime.Day.formatBuffer` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayFromInstant` | `datetime.Day.fromInstant` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayToday` | `datetime.Day.today` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayAtTime` | `datetime.Day.atTime` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.dayStartInstant` | `datetime.Day.startInstant` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.timeOfDay` | `datetime.TimeOfDay.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.isTimeOfDay` | `datetime.TimeOfDay.isValid` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.timeOfDayCompare` | `datetime.TimeOfDay.compare` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.timeOfDayFromMillis` | `datetime.TimeOfDay.fromMillis` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.timeOfDayFromString` | `datetime.TimeOfDay.fromString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.timeOfDayParse` | `datetime.TimeOfDay.parse` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.timeOfDayToMillis` | `datetime.TimeOfDay.toMillis` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.timeOfDayToString` | `datetime.TimeOfDay.toString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.formatTimeOfDay` | `datetime.TimeOfDay.formatBuffer` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.timeOfDayFromInstant` | `datetime.TimeOfDay.fromInstant` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.instantParse` | `datetime.instant.parse` | Instant stays an i64 alias; use a namespace because an integer alias cannot have methods. |
| `datetime.instantToString` | `datetime.instant.toString` | Instant stays an i64 alias; use a namespace because an integer alias cannot have methods. |
| `datetime.now` | `datetime.instant.now` | Instant stays an i64 alias; use a namespace because an integer alias cannot have methods. |
| `datetime.timeZoneId` | `datetime.zone.resolveId` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.timeZoneOffset` | `datetime.zone.offset` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `datetime.systemTimeZone` | `datetime.zone.systemId` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `timezone.setTimeZoneData` | `removed; pass Database explicitly` | Remove mutable global selection; database lookup methods use db.fromUTC/fromWall/resolveId/meta/ids. |
| `timezone.activeDatabase` | `removed; use database argument` | Remove mutable global selection; database lookup methods use db.fromUTC/fromWall/resolveId/meta/ids. |
| `timezone.zoneMeta` | `timezone.meta` | Remove mutable global selection; database lookup methods use db.fromUTC/fromWall/resolveId/meta/ids. |
| `timezone.zoneIds` | `timezone.ids` | Remove mutable global selection; database lookup methods use db.fromUTC/fromWall/resolveId/meta/ids. |
| `timezone.utcZone` | `timezone.utcInfo` | Remove mutable global selection; database lookup methods use db.fromUTC/fromWall/resolveId/meta/ids. |
| `plurals.PluralRules` | `plurals.Rules` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `plurals.getPluralRules` | `plurals.rulesFor` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `plurals.numberOperands` | `plurals.NumberOperands.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `plurals.numberOperandsToString` | `plurals.NumberOperands.toString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `locale.resolveLanguageTag` | `locale.resolveTag` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `locale.resolveLocaleId` | `locale.resolveId` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `locale.localeFlag` | `locale.flag` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `locale_matcher.create` | `locale_matcher.Matcher.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `locale_matcher.match` | `locale_matcher.Matcher.match` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `locale_matcher.getDistance` | `locale_matcher.distance` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.UnitConverter` | `unit_converter.Converter` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.UnitFactors` | `unit_converter.Factors` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.UnitConversion` | `unit_converter.Conversion` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.unitFactors` | `unit_converter.Factors.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.unitFactorsGet` | `unit_converter.Factors.get` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.create` | `unit_converter.Converter.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.has` | `unit_converter.Converter.has` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.add` | `unit_converter.Converter.add` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.factors` | `unit_converter.Converter.factors` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.categories` | `unit_converter.Converter.categories` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.get` | `unit_converter.Converter.get` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `unit_converter.convertUnits` | `unit_converter.Converter.convert` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.MessageCode` | `messageformat.Code` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.MessageOpType` | `messageformat.OpType` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.MessageState` | `messageformat.State` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.MessageMatcher` | `messageformat.Matcher` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.MessageArg` | `messageformat.Arg` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.MessageArgs` | `messageformat.Args` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.MessageArgConverter` | `messageformat.ArgConverter` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.MessageFormatterOptions` | `messageformat.FormatterOptions` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.MessageFormatter` | `messageformat.Formatter` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.Formatter` | `messageformat.CustomFormatter` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.cloneMessageCode` | `messageformat.Code.clone` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.buildMessageMatcher` | `messageformat.Matcher.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.parseMessagePattern` | `messageformat.parse` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.evaluateMessage` | `messageformat.evaluate` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.createMessageFormatter` | `messageformat.Formatter.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.formatMessage` | `messageformat.Formatter.format` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.messageFormatterToString` | `messageformat.Formatter.toString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.createTranslator` | `messageformat.Translator.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.resolveMessage` | `messageformat.Translator.resolve` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.translate` | `messageformat.Translator.translate` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.isMessageKey` | `messageformat.Translator.hasKey` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.messageArgNames` | `messageformat.argNames` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `messageformat.checkCatalogs` | `messageformat.Translator.checkCatalogs` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.cldrFramework (also core.cldr.cldrFramework)` | `core.CLDRFramework.init` | Remove the duplicate constructor alias; keep the two distinct framework types. |
| `core.cldrVersion` | `core.version` | Namespace already identifies the library. |
| `core.stringBundle` | `core.Bundle.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.loadPack` | `core.Pack.load` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.packGet` | `core.Pack.get` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.numbering.decimalNumberingSystem` | `core.private.NumberingSystem.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.parsing.number.parseNumberPattern` | `core.parsing.number.parse` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.parsing.number.parseNumberPatternAlloc` | `core.parsing.number.parseArena` | Make the arena-only contract explicit rather than the ambiguous Alloc suffix. |
| `core.parsing.number.NumberField / NumberNode / NumberPattern / ParsedNumberPattern` | `core.parsing.number.Field / Node / Pattern / ParsedPattern` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.parsing.wrapper.parseWrapperPattern` | `core.parsing.wrapper.parse` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.parsing.wrapper.parseWrapperPatternAlloc` | `core.parsing.wrapper.parseArena` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.parsing.wrapper.WrapperNode / WrapperPattern` | `core.parsing.wrapper.Node / Pattern` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_parsing.parseDatePattern` | `core.date_parsing.parse` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_parsing.freePattern` | `core.date_parsing.freeNodes` | Keep a slice result and use free<thing> for recursively owned slices. |
| `core.date_parsing.DateTimeNode / DateTimeField` | `core.date_parsing.Node / Field` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.SkeletonField / DateSkeleton / DateSkeletonParser / DatePatternMatcher` | `core.date_skeletons.Field / Skeleton / Parser / PatternMatcher` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.dateSkeleton` | `core.date_skeletons.Skeleton.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.dateSkeletonParser` | `core.date_skeletons.Parser.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.skeletonCompound` | `core.date_skeletons.Skeleton.isCompound` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.skeletonHas` | `core.date_skeletons.Skeleton.has` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.skeletonMonthWidth` | `core.date_skeletons.Skeleton.monthWidth` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.skeletonCanonical` | `core.date_skeletons.Skeleton.canonical` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.skeletonSplit` | `core.date_skeletons.Skeleton.split` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.skeletonParse` | `core.date_skeletons.Parser.parse` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.datePatternMatcher` | `core.date_skeletons.PatternMatcher.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.matcherAdd` | `core.date_skeletons.PatternMatcher.add` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.matcherSort` | `core.date_skeletons.PatternMatcher.sort` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.matcherMatch` | `core.date_skeletons.PatternMatcher.match` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.matcherAdjust` | `core.date_skeletons.PatternMatcher.adjust` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_skeletons.getDistance` | `core.date_skeletons.distance` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.CalendarPatterns` | `core.date_patterns.Patterns` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.calendarPatterns` | `core.date_patterns.Patterns.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.getCalendarPatterns (also core.date_manager.getCalendarPatterns)` | `core.date_patterns.get` | One public entry point for the locale cache; remove the manager alias. |
| `core.date_patterns.patternsDatePattern` | `core.date_patterns.Patterns.datePattern` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsTimePattern` | `core.date_patterns.Patterns.timePattern` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsWrapperPattern` | `core.date_patterns.Patterns.wrapperPattern` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsAvailablePattern` | `core.date_patterns.Patterns.availablePattern` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsAdjust` | `core.date_patterns.Patterns.adjust` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsMatchAvailable` | `core.date_patterns.Patterns.matchAvailable` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsMatchInterval` | `core.date_patterns.Patterns.matchInterval` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsParseSkeleton` | `core.date_patterns.Patterns.parseSkeleton` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsDayPeriods` | `core.date_patterns.Patterns.dayPeriods` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsEras` | `core.date_patterns.Patterns.eras` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsMonths` | `core.date_patterns.Patterns.months` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsWeekdays` | `core.date_patterns.Patterns.weekdays` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsQuarters` | `core.date_patterns.Patterns.quarters` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsIntervalPattern` | `core.date_patterns.Patterns.intervalPattern` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsIntervalFallback` | `core.date_patterns.Patterns.intervalFallback` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_patterns.patternsTimeData` | `core.date_patterns.Patterns.timeData` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_manager.managerAvailablePattern` | `core.date_manager.availablePattern` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_manager.getDateFormatRequest / getDateIntervalFormatRequest` | `core.date_manager.getFormatRequest / getIntervalFormatRequest` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_manager.DateFormatRequest / DateIntervalFormatRequest` | `core.date_manager.FormatRequest / IntervalFormatRequest` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_internal.CalendarFormatter / getCalendarFormatter` | `core.date_internal.Formatter / getFormatter` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_internal.parseDatePattern` | `core.date_parsing.parse` | Remove duplicate re-export; caller uses the parser namespace. |
| `core.date_formatter.calendarFormat` | `core.date_formatter.format` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.date_fields.getFieldType / skeletonFields` | `core.date_fields.getType / forSkeleton` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateFromFields` | `core.calendars.CalendarDate.fromFields` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateFromUnixEpoch` | `core.calendars.CalendarDate.fromUnixEpoch` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateType` | `core.calendars.CalendarDate.calendarType` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateUnixEpoch` | `core.calendars.CalendarDate.unixEpoch` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateFirstDayOfWeek` | `core.calendars.CalendarDate.firstDayOfWeek` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateMinDaysInFirstWeek` | `core.calendars.CalendarDate.minDaysInFirstWeek` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateJulianDay` | `core.calendars.CalendarDate.julianDay` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateModifiedJulianDay` | `core.calendars.CalendarDate.modifiedJulianDay` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateEra` | `core.calendars.CalendarDate.era` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateExtendedYear` | `core.calendars.CalendarDate.extendedYear` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateYear` | `core.calendars.CalendarDate.year` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateRelatedYear` | `core.calendars.CalendarDate.relatedYear` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateYearOfWeekOfYear` | `core.calendars.CalendarDate.yearOfWeekOfYear` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateWeekOfYear` | `core.calendars.CalendarDate.weekOfYear` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateYearOfWeekOfYearISO` | `core.calendars.CalendarDate.yearOfWeekOfYearISO` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateWeekOfYearISO` | `core.calendars.CalendarDate.weekOfYearISO` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateMonth` | `core.calendars.CalendarDate.month` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateWeekOfMonth` | `core.calendars.CalendarDate.weekOfMonth` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateDayOfYear` | `core.calendars.CalendarDate.dayOfYear` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateDayOfWeek` | `core.calendars.CalendarDate.dayOfWeek` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateOrdinalDayOfWeek` | `core.calendars.CalendarDate.ordinalDayOfWeek` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateDayOfWeekInMonth` | `core.calendars.CalendarDate.dayOfWeekInMonth` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateDayOfMonth` | `core.calendars.CalendarDate.dayOfMonth` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateIsAM` | `core.calendars.CalendarDate.isAM` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateHour` | `core.calendars.CalendarDate.hour` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateHourOfDay` | `core.calendars.CalendarDate.hourOfDay` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateMinute` | `core.calendars.CalendarDate.minute` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateSecond` | `core.calendars.CalendarDate.second` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateMilliseconds` | `core.calendars.CalendarDate.milliseconds` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateMillisecondsInDay` | `core.calendars.CalendarDate.millisecondsInDay` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateMetaZoneId` | `core.calendars.CalendarDate.metaZoneId` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateTimeZoneId` | `core.calendars.CalendarDate.timeZoneId` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateTimeZoneStableId` | `core.calendars.CalendarDate.timeZoneStableId` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateTimeZoneOffset` | `core.calendars.CalendarDate.timeZoneOffset` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateIsLeapYear` | `core.calendars.CalendarDate.isLeapYear` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateIsDaylightSavings` | `core.calendars.CalendarDate.isDaylightSavings` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateFieldOfVisualDifference` | `core.calendars.CalendarDate.fieldOfVisualDifference` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateCompare` | `core.calendars.CalendarDate.compare` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateFields` | `core.calendars.CalendarDate.toFields` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateToISOString` | `core.calendars.CalendarDate.toISOString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateToLocalISOString` | `core.calendars.CalendarDate.toLocalISOString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateToDateString` | `core.calendars.CalendarDate.toDateString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateToTimeString` | `core.calendars.CalendarDate.toTimeString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateToDateTimeString` | `core.calendars.CalendarDate.toDateTimeString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateToString` | `core.calendars.CalendarDate.toString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateSet` | `core.calendars.CalendarDate.set` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateWithZone` | `core.calendars.CalendarDate.withZone` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateStartOf` | `core.calendars.CalendarDate.startOf` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateEndOf` | `core.calendars.CalendarDate.endOf` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateAdd` | `core.calendars.CalendarDate.add` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateSubtract` | `core.calendars.CalendarDate.subtract` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateDifference` | `core.calendars.CalendarDate.difference` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateDifferenceSigned` | `core.calendars.CalendarDate.differenceSigned` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateRelativeTime` | `core.calendars.CalendarDate.relativeTime` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateSince` | `core.calendars.CalendarDate.since` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.dateUntil` | `core.calendars.CalendarDate.until` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.writeDateString` | `core.calendars.CalendarDate.writeDateString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.writeTimeString` | `core.calendars.CalendarDate.writeTimeString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.writeDateTimeString` | `core.calendars.CalendarDate.writeDateTimeString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.writeString` | `core.calendars.CalendarDate.writeString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.writeISOString` | `core.calendars.CalendarDate.writeISOString` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.timePeriod` | `core.calendars.TimePeriod.init` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.gregorianDateFromFields` | `core.calendars.CalendarDate.fromFields(gregorianCalendar, ...)` | Use the existing CalendarSystem value; the five date type aliases do not define distinct types. |
| `core.calendars.gregorianDateFromUnixEpoch` | `core.calendars.CalendarDate.fromUnixEpoch(gregorianCalendar, ...)` | Use the existing CalendarSystem value; the five date type aliases do not define distinct types. |
| `core.calendars.iso8601DateFromFields` | `core.calendars.CalendarDate.fromFields(iso8601Calendar, ...)` | Use the existing CalendarSystem value; the five date type aliases do not define distinct types. |
| `core.calendars.iso8601DateFromUnixEpoch` | `core.calendars.CalendarDate.fromUnixEpoch(iso8601Calendar, ...)` | Use the existing CalendarSystem value; the five date type aliases do not define distinct types. |
| `core.calendars.buddhistDateFromFields` | `core.calendars.CalendarDate.fromFields(buddhistCalendar, ...)` | Use the existing CalendarSystem value; the five date type aliases do not define distinct types. |
| `core.calendars.buddhistDateFromUnixEpoch` | `core.calendars.CalendarDate.fromUnixEpoch(buddhistCalendar, ...)` | Use the existing CalendarSystem value; the five date type aliases do not define distinct types. |
| `core.calendars.japaneseDateFromFields` | `core.calendars.CalendarDate.fromFields(japaneseCalendar, ...)` | Use the existing CalendarSystem value; the five date type aliases do not define distinct types. |
| `core.calendars.japaneseDateFromUnixEpoch` | `core.calendars.CalendarDate.fromUnixEpoch(japaneseCalendar, ...)` | Use the existing CalendarSystem value; the five date type aliases do not define distinct types. |
| `core.calendars.persianDateFromFields` | `core.calendars.CalendarDate.fromFields(persianCalendar, ...)` | Use the existing CalendarSystem value; the five date type aliases do not define distinct types. |
| `core.calendars.persianDateFromUnixEpoch` | `core.calendars.CalendarDate.fromUnixEpoch(persianCalendar, ...)` | Use the existing CalendarSystem value; the five date type aliases do not define distinct types. |
| `core.calendars.GregorianDate / ISO8601Date / BuddhistDate / JapaneseDate / PersianDate` | `core.calendars.CalendarDate` | Remove aliases that suggest distinct Zig types; the calendar type remains runtime data. |
| `core.calendars.isGregorianDate` | `core.calendars.CalendarDate.isGregorian` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.isISO8601Date` | `core.calendars.CalendarDate.isISO8601` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.isBuddhistDate` | `core.calendars.CalendarDate.isBuddhist` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.isJapaneseDate` | `core.calendars.CalendarDate.isJapanese` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.calendars.isPersianDate` | `core.calendars.CalendarDate.isPersian` | Namespace prefix or type operation; doc comment records the TypeScript original. |
| `core.arrows.fieldGet` | `core.arrows.FieldArrow.get` | Remove duplicate free-function wrappers; the methods already exist. |
| `core.arrows.digitsGet` | `core.arrows.DigitsArrow.get` | Remove duplicate free-function wrappers; the methods already exist. |
| `core.arrows.vectorExists` | `core.arrows.VectorArrow.exists` | Remove duplicate free-function wrappers; the methods already exist. |
| `core.arrows.vectorGet` | `core.arrows.VectorArrow.get` | Remove duplicate free-function wrappers; the methods already exist. |
| `core.arrows.vectorValid` | `core.arrows.VectorArrow.valid` | Remove duplicate free-function wrappers; the methods already exist. |
| `core.arrows.vectorMapping` | `core.arrows.VectorArrow.mapping` | Remove duplicate free-function wrappers; the methods already exist. |
| `core.KeyIndex` (already consistent) | `core.KeyIndex.get` | Keep its existing method; replace internal calls to the redundant instructions.keyIndexGet wrapper. No generated layout changes. |

### Fields, allocators, ownership and error sets

| Current convention / API | Proposed convention / API |
| --- | --- |
| `CLDR.Schema`, `.Calendars`, `.General`, `.Numbers`, `.Units` | `.schema`, `.calendars`, `.general`, `.numbers`, `.units`; types retain capitals |
| `TimeStringOptions.includeZoneId`, `includeZoneOffset`, `optionalMilliseconds` | `include_zone_id`, `include_zone_offset`, `optional_milliseconds` |
| `DateDiffOptions.includeWeeks`, `rollupFractional` | `include_weeks`, `rollup_fractional` |
| Calendar input/result fields `zoneId`, `firstDay`, `minDays`, `zoneInfo` | `zone_id`, `first_day`, `min_days`, `zone_info` |
| `CalendarSystem.monthCount`, `relatedYearOffset`, `weekRule`, `defaultFields`, `daysInMonth`, `daysInYear`, `monthStart`, `computeFields`, `resolveFields` | Corresponding snake_case data/callback fields; these are fields, not method declarations |
| `DateSkeleton.isDate`, `isTime`; parser `preferredFlex`, `allowedFlex`; patterns `skeletonParser`, `availableMatcher`, `intervalMatcher` | `is_date`, `is_time`, `preferred_flex`, `allowed_flex`, `skeleton_parser`, `available_matcher`, `interval_matcher` |
| Existing snake_case options in numbers, units, date formatting, messageformat, translator, framework | Keep; new cache options follow them |
| Existing generated schema fields (e.g. `schema.Numbers`, `dateFormats`) | Keep the TS schema names: generated schema is a mapping of the pack format, not an options API |
| LanguageTag.clone/compact/toString/expanded/render; StringFormatter.render; PartsFormatter.render; MessageArgConverter.asString/asDecimal; MessageMatcher.arguments/options; VectorArrow.mapping; NumberContext.adjust; Framework.info; CLDRFramework.info; every allocating bound API method | `self, gpa, ...` consistently; retain existing names except table renames. Some already match; verify rather than reorder blindly |
| Bound General.resolveLocale/resolveLocaleTag/parseLanguageTag and Numbers.parseDecimal | Keep method signatures `self, gpa, ...`; unused receiver follows the same rule |
| Allocating free/static APIs, including new constructors and new explicit-db variants | `gpa, ...` first; borrowed database/context after it; writer variants do not take an allocator |
| Managed owners (framework, locale handle, pack, formatter, translator, arena-backed parsed pattern) | `.deinit()` uses the stored allocator; owning handles are move-only by convention, `.clone()` explicitly retains |
| Unmanaged owned values (Decimal, Rational, LanguageTag, Locale, Match, Database, Conversion, Factors, Converter, Code) | `.deinit(gpa)`; retain standard Zig managed/unmanaged distinction and document it |
| Strings / recursively owned slices | `gpa.free(string)` / `freeParts`, `freeStrings`, `freeCatalogIssues`, `freeNodes`; no new cleanup/free/release naming dialect |
| `date_options.TimeData` (currently manually free `.allowed`) | Add `TimeData.deinit(gpa)`; borrowed static strings remain borrowed |
| `timePeriodToQuantity` (arena-only ownership, including temporary Decimals) | Public owned variant with matching `freeQuantities(gpa, ...)`; internal `...Arena` helper retains bulk lifetime. Bound method uses the same ownership rule |
| `timezone.DecodeError` | `timezone.Error` (decode domain plus `Allocator.Error`); Database.decode uses it |
| `decimal.ParseError` plus allocator unions at parse call sites | Keep domain `ParseError`; add/use exported `decimal.Error = ParseError || Allocator.Error` for parse/fromString |
| `rational.Error`, `unit_converter.Error`, `core.FrameworkError`, `core.days.Error`, calendar Error | Keep descriptive names at re-exports; compose from imported domain sets plus `Allocator.Error` with `||`; no `anyerror` or copied OutOfMemory literals |
| `messageformat.Error = error{OutOfMemory, FormatFailed}` | `Allocator.Error || error{FormatFailed}`; same error values |
| Ownership methods on borrowed values (`General.locale`, `bundle`, `messageFormatter`) | Document the owner and lifetime; callers must retain the locale handle; never call deinit on borrowed values |

Existing enum helpers have `name`, `string`, and `toString` for borrowed tag strings. Standardize
on `toString` with no allocation: `plurals.Category.name`, `messageformat.Problem.name`, and
`core.general_options.AltType.string` become `toString`; `fromString` remains unchanged.
Numeric/text output allocating `toString` functions continue to take gpa.

The schema generator must be changed only if a generated Zig reference needs a renamed type;
never edit generated files directly. Data-field naming in generated tables remains unchanged.

## Bounded caches with safe lifetimes

### Framework and pack ownership

Add `pack_cache_size = 2` and `locale_cache_size = 64`, matching the TypeScript defaults.
Use zero to disable retaining entries (document this useful Zig interpretation; TypeScript's
`||` treats zero as default). No unlimited-by-accident sentinel.

`Framework.loadLocale` returns an owning `LocaleHandle`, not a raw pointer. A handle has
`data()` returning `*const LocaleData`, `clone()` to retain, and `deinit()` to release. It owns
one reference to a stable heap-allocated locale node, which holds LocaleData and one pack
reference. Cache residency owns one additional reference; eviction drops only that reference.
`CLDRFramework.get` returns an owning `CLDR` with the same lifetime (add `.clone()`/`.deinit()`);
its bound groups are borrowed views into that owner. `bindCLDR` returns a distinct borrowed
`CLDRView` type with no deinit method. The owning `CLDR` forwards the same bound groups and
retains a handle; this avoids accidentally deinitializing a borrowed binding.
Standalone LocaleData construction remains an unmanaged owner; `bind*` views borrow it.

Pack nodes have their own reference count: cache ownership and one reference per dependent
locale node. A pack evicted from the LRU stays live while a locale uses it. A newly requested
locale may reload an evicted but pinned pack; no unbounded retired/weak lookup list is kept.
Pinned locale nodes do not point to the framework's stack address. Framework.deinit removes
both cache-owned reference sets; handles can outlive the framework. The allocator and explicit
custom timezone database must still outlive those handles. Reference counts are atomic, final
release destroys LocaleData before releasing the pack; no concurrent retain from an unowned
pointer is allowed. Ordinary struct copies do not retain and must not be independently freed.

Limits bound **cache ownership**, not user-retained live objects or a single pack's byte size.
Memory is O(cached pack payloads + cached locales + explicitly pinned payloads + active work).
Holding all handles intentionally can hold all data; no safe implementation can promise a
fixed total memory bound while also keeping arbitrary caller data alive. This is not the old
retire-forever design. The new docs show `var en = try fw.get(...); defer en.deinit();`.
`info` retains its current text semantics for resident packs; add numeric cache stats for
resident and pinned counts only if needed by tests, without a separate retention registry.

### Locale derived values

Actual callers use finite canonical key domains: generated decimal numbering-system names
(`getNumberParams` canonicalizes unknown inputs), one Latin system, four formatting calendars,
one context-transform map, one default formatter. Arbitrary format patterns/skeleton requests
already use per-call arenas. Keep immutable derived pointers stable for the locale's lifetime;
evicting them independently would make cached public NumberParams/CalendarPatterns pointers
unsafe.

Replace the public arbitrary-string cache extension with a private typed key (finite tagged
union of number-system index, calendar, context transforms). Do not allow an arbitrary caller
string to create permanent entries. This makes per-locale retained memory bounded by the
shipped data, not by request count. Keep arbitrary inputs/canonicalization buffers in temporary
arenas. If extensible public caching is required, it needs a separate owning result/entry API;
that is outside the finite internal cache.

Each immutable cache candidate gets an independently reclaimable arena. Build outside the
cache mutex, then recheck and publish under the mutex; destroy duplicate or failed candidate
arenas immediately. Builders may recursively request *different* cache entries (number params
request the Latin system); never hold the map lock through a build. Detect/avoid same-key
recursive cycles. Published entries are immutable; dependency pointers remain valid until
locale destruction. This also prevents accumulating partial builds after repeated OOM.

The default message formatter must be stored separately with a reclaiming general allocator,
not `Caches.arena.allocator()`. Its deinit runs explicitly before freeing locale cache storage.
Today its LRU evicts logically, but arena free cannot reclaim the parsed-code blocks, so a
single long-lived locale can grow with every new message. Add a churn regression measuring
live allocated bytes, not merely LRU entry count.

### Message format and translator caches

Keep formatter parse LRU default 100; represent default as `cache_size: ?usize = null`, so
zero unambiguously disables caching. Cache-owned Code is never exposed as a borrow across an
unlock/eviction. Public parse returns owned Code; a formatting call clones a cached Code into
its temporary arena while protected, unlocks, evaluates, and frees that arena. Clone-on-use is
the simplest safe first release; profile before introducing a second reference-count protocol.
With cache disabled, parse into the call's arena. `cacheGet` becomes internal.

Translator's parsed map is **not** bounded by catalog size: `resolveMessage` falls back to an
unknown caller key, which can be a new pattern on every call. Replace it with the same bounded
LRU and add `cache_size: ?usize = null` (default 100). Bound its plural-rule map too (default
64 with a separate `plural_cache_size` option, zero disables), or remove the map and resolve
static rules per call; prefer removal because lookup is cheap and results are static. Preserve
unknown-key fallback behavior exactly. Tests exercise thousands of distinct unknown patterns.

Entry-count bounds do not bound arbitrary message length. For cache memory independent of
message length, add `max_cached_message_bytes` (default 64 KiB) to formatter and translator;
oversized patterns format normally through temporary storage without entering the cache.
Retained decoded trees have O(input bytes) storage; guard arithmetic when computing limits.
Expose no changing per-request global cache configuration.

## Thread safety and explicit timezone data

| State | Sharing contract and synchronization |
| --- | --- |
| Generated schema, locale tables, plural rules, default timezone database | Immutable; freely shared |
| Custom decoded Database | Immutable after decode; freely shared while its owner keeps it alive; no concurrent deinit |
| Decimal/Rational/tag/matcher/converter values, Day/TimeOfDay | Concurrent reads safe while backing storage is alive; mutable builders and destruction require exclusive ownership |
| CalendarDate | Immutable; stores `*const Database` used at construction, so set/add/withZone/difference use that database consistently |
| Framework LRU maps, recency and publication | One internal mutex on stable state; callbacks and expensive pack parsing outside it; recheck under lock and discard races |
| PackScript exception-index cache and pack arena | Separate pack lock; decode candidate privately, publish under lock, reclaim duplicate candidates; no unsynchronized shared arena allocation |
| Locale derived caches | Map/publication lock and per-candidate arenas as above; returned immutable entries require no read lock |
| Formatter and translator LRUs | Internal mutex; clone/snapshot while locked, evaluate outside the lock |
| Loader/custom formatter/converter callbacks and allocator contexts | Caller supplies thread-safe implementations for concurrent calls; no library lock is held while invoking them |
| Framework / handle / pack / locale / formatter / translator deinit | No concurrent operations on the object being destroyed; a cloned handle in another thread is a different owner |

Do not solve the timezone problem with just an atomic `active` pointer: it does not protect a
reader from the replaced database being freed and can mix databases within one operation.
Remove active/set selection. Put fromUTC/fromWall/resolveId/meta/ids on Database; namespace
convenience functions use `defaultDatabase` immutably. Custom data callers use db methods.
Expose a small immutable `datetime.ZoneContext{ database }` that delegates all zone-aware
Day/TimeOfDay/instant operations to that same pointer. Its methods use the existing operand
words (dayFromInstant, timeOfDayFromInstant, dayAtTime, etc.) to distinguish operand types.
The corresponding Day/TimeOfDay methods use the default database as convenience wrappers. `FrameworkOptions`
adds `timezone_database = timezone.defaultDatabase`; LocaleData carries it, calendar
constructors snapshot it in CalendarDate. Direct CalendarDate constructors accept it explicitly
(or a default-data wrapper); transformations retain it. No operation consults global selection.
Database-agnostic calendar rules/tables remain static. Difference of dates with distinct
custom databases needs an explicit rule: interpret each date at its stored instant, and use
the receiver's database for result calendar/wall arithmetic; test this rule.

Pack exception caches must not return pointers into a temporary candidate arena that loses
publication. No loader runs under the framework mutex (reentrancy and arbitrary latency).
A load may run twice on concurrent misses; loader/free pairs still balance. Do not promise
single-flight loading unless needed. Lock order avoids nested framework/pack/locale/formatter
locks: take/retain a node under the framework lock, unlock, perform the next operation.
Reference-count destruction occurs after dropping cache locks. Use the synchronization APIs
actually available in Zig 0.16's installed standard library, with stable heap storage for locks;
do not add a dependency or invent a spinlock around callbacks.

Callbacks can reenter format/translate because evaluation happens after snapshot/unlock.
Their own side effects are caller-controlled. Returned output is caller-owned or explicitly
borrowed from a pinned handle/database; document all such borrows. Sharing a handle for reads
is safe; deinit of that very handle requires coordination. Clone for independent ownership.

## Other release work and review integration

Reports read: all report/handoff files currently under notes/zig-port, the README, the porting
briefs, the root exports and the implementations involved above. Historical outstanding
Calendars binding notes are superseded by the integration section and current code.
The existing public entry points cover the full shipped schema. Custom schema configs,
spellout/RBNF unused by TS, integer-only instants and documented JS-prototype deviations stay
explicit supported-scope limitations, not stealth fixes to the TypeScript reference.

Remaining verification debt: rerun the twelve serial datetime deliberate-break checks named in
handoff-timezone-datetime.md. Foundation's older handoff also records an interrupted mutation
run; verify the supervisor's later validation record before claiming that debt is closed.
Use isolated temporary source copies, one mutation at a time, to keep the shared clone stable.
Core-number invalid-enum cases skipped by the Zig type system must remain reported as such;
do not claim every JSON entry is executable when invalid enum strings cannot be expressed.

After review completion, make a numbered disposition of every finding (fixed with regression,
or disagreed with and evidence). Review may add real correctness/OOM/validation fixes beyond
this plan. Do not change TS behavior or shared JSON to hide a Zig failure. New regression cases
belong in the targeted generator and only its JSON is regenerated if needed. Zig-only ownership,
concurrency, allocation-failure and invalid typed input tests go directly into suites.

Implementation sequence after approval:

1. Record reviewer findings and baseline; add focused safety regressions.
2. Ownership nodes/handles, cache bounds and independent allocator cleanup; migrate all callers.
3. Explicit timezone database propagation and locking/snapshotting; concurrency/reentrancy tests.
4. Apply the approved naming inventory, public docs, examples and all suite call-site migrations.
5. Run `zig fmt --check`, `zig build test` and `zig build test -Doptimize=ReleaseSafe` (including
   test-unit), then targeted leak/OOM/churn/concurrency tests and deliberate-break checks.
6. If TS generators change: scoped Biome, yarn ts-check and all Vitest conformance/generated-data
   freshness checks. Never run unnamed data generators. Check git diff --check in all cases.
7. Ask `t7j m3-hereabouts-review (M3)` to recheck the final diff, address valid follow-up findings,
   write report-fixups.md with evidence and remaining limitations, report to the supervisor.

New tests must cover: capacities 0/1/N; hits reorder eviction; pinned handles survive both LRUs
and framework destruction; clone/release order; pack pins outlive eviction; failed cache builds
release all storage; formatter and unknown-key translator churn plateaus; large messages bypass
cache; callbacks reenter; concurrent locale loads and first derived builds; concurrent formatting
with eviction; simultaneous independent custom databases; arithmetic retains database choice;
allocation failure through handle construction and parsed-Code cloning. Use barriers/bounded
loops rather than timing sleeps. Run commands in visible hc panes and remove only our panes.

Shared-file scope required by this task: zig/src/hereabouts.zig as needed for new namespaces,
zig/src/core/core.zig exports, zig/README.md examples/ownership/thread contracts, zig/build.zig
only if test registration needs it, and existing tests/generators affected by renames. No
package.json, TS library source, schema config or unrelated notes changes. Supervisor commits;
this worker never uses state-changing Git commands.
