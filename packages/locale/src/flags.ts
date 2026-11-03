import { type LanguageTag, parseLanguageTag } from '@phensley/language-tag';
import { resolveLanguageTag } from './resolver';

// Regions with an emoji flag: the two-letter flag sequences recommended for general
// interchange (RGI) as of Emoji 16.0. Other pairs of regional indicators are valid text but
// most systems show them as two letters, so they get no flag here.
const RGI =
  ' AC AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO' +
  ' BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CP CQ CR CU CV CW CX CY CZ DE' +
  ' DG DJ DK DM DO DZ EA EC EE EG EH ER ES ET EU FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL' +
  ' GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU IC ID IE IL IM IN IO IQ IR IS IT JE JM JO' +
  ' JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH' +
  ' MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA' +
  ' PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL' +
  ' SM SN SO SR SS ST SV SX SY SZ TA TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM' +
  ' UN US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW ';

// The subdivisions with an RGI flag: England, Scotland and Wales.
const RGI_SUBDIVISIONS = ' gbeng gbsct gbwls ';

// UTF-16 for the characters flags are built from (no String.fromCodePoint in ES5).
// Regional indicator A is U+1F1E6, the black flag U+1F3F4, tag letter a U+E0061 and the
// cancel tag U+E007F.
const regionalIndicator = (c: number): string => `\uD83C${String.fromCharCode(0xdde6 + c - 65)}`;
const tagChar = (c: number): string => `\uDB40${String.fromCharCode(0xdc00 + c)}`;

/**
 * The emoji flag for a region code such as 'FR' or 'fr', or undefined when the region has
 * no flag: numeric areas like '419' (Latin America), unknown codes like 'ZZ', and anything
 * that isn't a region code.
 *
 * ```ts
 * regionFlag('SC') // '🇸🇨'
 * regionFlag('419') // undefined
 * ```
 *
 * @public
 */
export const regionFlag = (region: string): string | undefined => {
  const code = region.toUpperCase();
  return code.length === 2 && RGI.indexOf(` ${code} `) !== -1
    ? regionalIndicator(code.charCodeAt(0)) + regionalIndicator(code.charCodeAt(1))
    : undefined;
};

/**
 * The emoji flag for a CLDR subdivision code, as used in the `sd` locale extension: 'gbeng'
 * (England), 'gbsct' (Scotland) or 'gbwls' (Wales). Other subdivisions have no flag.
 *
 * @public
 */
export const subdivisionFlag = (subdivision: string): string | undefined => {
  const code = subdivision.toLowerCase();
  if (code.length < 3 || RGI_SUBDIVISIONS.indexOf(` ${code} `) === -1) {
    return undefined;
  }
  let s = '🏴';
  for (let i = 0; i < code.length; i++) {
    s += tagChar(code.charCodeAt(i));
  }
  return `${s}󠁿`;
};

/**
 * The emoji flag for a locale: its subdivision flag if it has one (`en-GB-u-sd-gbsct`),
 * otherwise the flag of its region. A locale without a region uses its likely region, so
 * 'ja' gives 🇯🇵 and 'en' gives 🇺🇸; old region codes are replaced first ('en-UK' gives 🇬🇧).
 * Undefined when the region has no flag ('es-419', 'eo').
 *
 * @public
 */
export const localeFlag = (locale: string | LanguageTag): string | undefined => {
  const tag = typeof locale === 'string' ? parseLanguageTag(locale) : locale;
  const u = tag.extensions.u || [];
  for (let i = 0; i < u.length; i++) {
    if (u[i].slice(0, 3) === 'sd-') {
      const flag = subdivisionFlag(u[i].slice(3));
      if (flag) {
        return flag;
      }
    }
  }
  const region = resolveLanguageTag(tag).region;
  return region ? regionFlag(region) : undefined;
};

/**
 * The region code of an emoji flag: 'FR' for 🇫🇷. Undefined for anything else, including
 * a flag followed by other text.
 *
 * @public
 */
export const flagRegion = (flag: string): string | undefined => {
  if (flag.length !== 4) {
    return undefined;
  }
  let code = '';
  for (let i = 0; i < 4; i += 2) {
    const lo = flag.charCodeAt(i + 1) - 0xdde6;
    if (flag.charCodeAt(i) !== 0xd83c || lo < 0 || lo > 25) {
      return undefined;
    }
    code += String.fromCharCode(65 + lo);
  }
  return regionFlag(code) ? code : undefined;
};
