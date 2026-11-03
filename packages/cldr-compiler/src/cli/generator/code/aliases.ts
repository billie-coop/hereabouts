import {
  parseLanguageTag,
  tagExtlangs,
  tagHasRegion,
  tagHasScript,
  tagLanguage,
  tagRegion,
  tagScript,
  tagVariant,
} from '@phensley/cldr-core';
import { tzResolveId, tzZoneIds } from '@phensley/timezone';
import * as fs from 'fs';
import { join } from 'path';
import * as zlib from 'zlib';
import { getSupplemental } from '../../../cldr';
import { Code, HEADER, NOLINT_MAXLINE, objectToString } from './util';

/**
 * Split string into lines and split each line into a colon-delimited
 * key / value pair, and convert each group into an object.
 */
const parseSubtagBlock = (raw: string): { [x: string]: string } => {
  return raw
    .trim()
    .split('\n')
    .map((s) => {
      const i = s.indexOf(':');
      return [s.substring(0, i), s.substring(i + 1)];
    })
    .reduce((o: { [x: string]: string }, [k, v]) => {
      o[k.trim()] = v.trim();
      return o;
    }, {});
};

const expand = (aliases: any) => {
  const o: any = {};
  Object.keys(aliases).forEach((k) => {
    const tag = parseLanguageTag(k);
    const parts: string[] = [];
    let flag = false;

    // We ignore variants in language alias substitution for now
    if (tagVariant(tag)) {
      return;
    }
    if (flag || tagHasRegion(tag)) {
      parts.push(tagHasRegion(tag) ? tagRegion(tag) : '');
      flag = true;
    }
    if (flag || tagHasScript(tag)) {
      parts.push(tagHasScript(tag) ? tagScript(tag) : '');
    }
    let lang = tagLanguage(tag);
    const extlangs = tagExtlangs(tag);
    if (extlangs.length) {
      // Canonicalize step 3 https://tools.ietf.org/html/bcp47#section-4.5
      lang = extlangs[0];
    }
    parts.push(lang);
    const key = parts.reverse().join('-');
    o[key] = aliases[k];
  });
  return o;
};

const getIanaSubtags = () => {
  const path = join(__dirname, '..', '..', '..', '..', 'data', 'raw-iana-subtags.txt.gz');
  const raw = fs.readFileSync(path);
  const data = zlib.gunzipSync(raw).toString('utf-8');
  return data
    .split('%%')
    .map(parseSubtagBlock)
    .filter((r) => r.Type);
};

export const getAliases = (_data: any): Code[] => {
  const supplemental = getSupplemental();

  const { languageAlias, scriptAlias, territoryAlias, zoneAlias } = supplemental.Aliases;

  const ianaSubtags = getIanaSubtags();

  const grandfathered = ianaSubtags
    .filter((r) => r.Type === 'grandfathered')
    .reduce((o, r) => {
      const tag = r.Tag;
      o[tag] = r['Preferred-Value'];
      return o;
    }, {});

  Object.keys(grandfathered).forEach((key) => {
    if (languageAlias[key]) {
      delete languageAlias[key];
    }
  });

  const languages = objectToString(expand(languageAlias));
  const scripts = objectToString(scriptAlias);
  const territories = objectToString(territoryAlias);

  const result: Code[] = [];

  let code = NOLINT_MAXLINE + HEADER;
  code += `export const languageAliasRaw = '${languages}';\n\n`;
  code += `export const scriptAliasRaw = '${scripts}';\n`;

  result.push(Code.locale(['autogen.aliases.ts'], code));

  code = NOLINT_MAXLINE + HEADER;
  code += `export const territoryAliasRaw = '${territories}';\n`;

  result.push(Code.languagetag(['autogen.aliases.ts'], code));

  // Find time zone aliases that are not already handled in the @phensley/timezone package
  const zoneids = tzZoneIds();
  const zones = Object.keys(zoneAlias)
    .filter((alias) => {
      const zi = zoneids.indexOf(alias);
      if (zi !== -1) {
        // alias is in list of valid tzdb ids, ignore
        return false;
      }

      // if alias fails to resolve, include in this list
      return tzResolveId(alias) === undefined;
    })
    .sort()
    .map((k) => [k, zoneAlias[k]].join(':'))
    .join('|');

  code = NOLINT_MAXLINE + HEADER;
  code += `export const zoneAliasRaw = '${zones}';\n`;

  result.push(Code.core(['systems', 'calendars', 'autogen.aliases.ts'], code));

  return result;
};
