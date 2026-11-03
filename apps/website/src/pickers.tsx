import {
  addLikelySubtags,
  getCurrencyDisplayName,
  getCurrencyForRegion,
  getLanguageDisplayName,
  getRegionDisplayName,
  getScriptDisplayName,
  type LocaleData,
  localeFlag,
  parseLanguageTag,
  regionFlag,
  tagExpanded,
  timeZoneInfo,
  timeZoneOffset,
} from '@phensley/cldr';
import type { SearchItem } from './SearchSelect';

/** 'Serbian (Latin)': the language, and its script when the id names one. */
const languageName = (data: LocaleData, id: string): string => {
  const tag = parseLanguageTag(id);
  const name = getLanguageDisplayName(data, tag.language ?? 'und');
  return tag.script ? `${name} (${getScriptDisplayName(data, tag.script)})` : name;
};

/**
 * Locales for the picker, named in the page's locale: the language, the region (the likely
 * one when the id has none, so 'en' shows United States) and the flag. English names are
 * searchable too.
 */
export const localeItems = (data: LocaleData, en: LocaleData | undefined, ids: string[]) =>
  ids
    .map((id): SearchItem => {
      const tag = parseLanguageTag(id);
      const aliases = [
        // 'sr Latn', and the full tag: 'en-Latn-SC'.
        id.replace(/-/g, ' '),
        tagExpanded(addLikelySubtags(id)),
        // CLDR's own names for some locales: 'Swiss High German', 'British English'.
        getLanguageDisplayName(data, id),
      ];
      if (en) {
        aliases.push(
          `${languageName(en, id)} ${getRegionDisplayName(en, tag)}`,
          getLanguageDisplayName(en, id),
        );
      }
      return {
        value: id,
        flag: localeFlag(id),
        title: languageName(data, id),
        subtitle: getRegionDisplayName(data, tag),
        meta: id,
        aliases,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title) || a.subtitle.localeCompare(b.subtitle));

/** The likely full tag and the region's currency: 'en-Latn-SC · SCR, Seychellois Rupee'. */
export const localeDetail = (
  data: LocaleData,
  en: LocaleData | undefined,
  id: string,
): string[] => {
  const tag = addLikelySubtags(id);
  const currency = tag.region ? getCurrencyForRegion(tag.region) : undefined;
  const lines = [
    [tagExpanded(tag), currency && `${currency}, ${getCurrencyDisplayName(data, currency)}`]
      .filter(Boolean)
      .join(' · '),
  ];
  // The English name, when the page is in another language.
  if (en) {
    const name = (d: LocaleData) =>
      `${languageName(d, id)} · ${getRegionDisplayName(d, parseLanguageTag(id))}`;
    if (name(en) !== name(data)) lines.push(name(en));
  }
  return lines;
};

/** '+05:30', '−08:00'. */
const offsetText = (ms: number): string => {
  const m = Math.round(Math.abs(ms) / 60000);
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${ms < 0 ? '−' : '+'}${hh}:${mm}`;
};

/**
 * Time zones for the picker: the zone's city, its generic name ('Pacific Time') or country,
 * the offset now and the flag of its country. Zone ids, English names and every country the
 * zone covers are searchable.
 */
export const zoneItems = (
  data: LocaleData,
  en: LocaleData | undefined,
  zones: string[],
  now: number,
) => {
  const unknown = timeZoneInfo(data, 'Etc/Unknown').city.name;
  return zones
    .map((zone): SearchItem => {
      const info = timeZoneInfo(data, zone);
      const country = info.countries[0];
      const countries = info.countries.map((c) => getRegionDisplayName(data, c));
      const english = en ? timeZoneInfo(en, zone) : undefined;
      return {
        value: zone,
        flag: country ? regionFlag(country) : undefined,
        // Zones with no city (Etc/UTC, Etc/GMT+5) go by the rest of their id.
        title:
          info.city.name && info.city.name !== unknown
            ? info.city.name
            : zone.replace(/^Etc\//, ''),
        subtitle: info.names.long.generic || countries[0] || zone,
        meta: offsetText(timeZoneOffset(zone, now)),
        aliases: [
          zone.replace(/_/g, ' '),
          ...countries,
          ...(english
            ? [
                english.city.name,
                english.names.long.generic,
                ...info.countries.map((c) => getRegionDisplayName(en as LocaleData, c)),
              ]
            : []),
        ],
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
};

/** The zone id and every country it covers. */
export const zoneDetail = (data: LocaleData, zone: string): string => {
  const countries = timeZoneInfo(data, zone).countries.map((c) =>
    `${regionFlag(c) ?? ''} ${getRegionDisplayName(data, c)}`.trim(),
  );
  return [zone, ...countries].join(' · ');
};
