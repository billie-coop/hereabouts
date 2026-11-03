import {
  type LanguageTag,
  parseLanguageTag,
  resolveLanguageTag,
  tagHasLanguage,
  tagHasRegion,
  tagHasScript,
  tagLanguage,
  tagRegion,
  tagScript,
  tagVariant,
} from '../../../../../hereabouts/src/core';
import { availableLocales } from '../../../cldr';
import { Code, HEADER, NOLINT_MAXLINE } from './util';

const enum Flags {
  LANG = 1,
  SCRIPT = 2,
  REGION = 4,
  VARIANT = 8,
}

const computeFlags = (_id: string, tag: LanguageTag) => {
  let f = 0;
  const t = parseLanguageTag(_id);
  if (tagHasLanguage(t) && tagLanguage(t) === tagLanguage(tag)) {
    f |= Flags.LANG;
  }
  if (tagHasScript(t) && tagScript(t) === tagScript(tag)) {
    f |= Flags.SCRIPT;
  }
  if (tagHasRegion(t) && tagRegion(t) === tagRegion(tag)) {
    f |= Flags.REGION;
  }
  if (tagVariant(t) && tagVariant(t) === tagVariant(tag)) {
    f |= Flags.VARIANT;
  }
  return f;
};

const computeLocales = (): string => {
  const root: any = {};
  const raw = availableLocales().sort();
  for (let i = 0; i < raw.length; i++) {
    const id = raw[i];
    const tag = resolveLanguageTag(id);
    let region = tagRegion(tag);
    if (tagVariant(tag)) {
      region += '-' + tagVariant(tag);
    }
    const flags = computeFlags(id, tag);
    const keys = [tagLanguage(tag), tagScript(tag), region + ':' + flags];

    let o: any = root;
    let m: any;
    for (const k of keys) {
      if (!k) {
        break;
      }
      m = o[k] || {};
      o[k] = m;
      o = m;
    }
  }

  let s: string = '{';

  const languages = Object.keys(root);
  for (let i = 0; i < languages.length; i++) {
    if (i) {
      s += ',';
    }
    const language = languages[i];
    s += language + ':{';
    const scriptobj = root[language];
    const scripts = Object.keys(scriptobj);
    for (let j = 0; j < scripts.length; j++) {
      if (j) {
        s += ',';
      }
      const script = scripts[j];
      s += script + ':[';
      const regionobj = scriptobj[script];

      const flags: number[] = [];
      const regions: string[] = [];
      Object.keys(regionobj).forEach((region) => {
        const [r, f] = region.split(':');
        regions.push(r);
        flags.push(parseInt(f, 10));
      });

      for (let k = 0; k < flags.length; k++) {
        if (k) {
          s += ',';
        }
        s += flags[k];
      }
      s += ",'";

      for (let k = 0; k < regions.length; k++) {
        if (k) {
          s += ' ';
        }
        s += regions[k];
      }
      s += "']";
    }
    s += '}';
  }
  s += '}';

  return s;
};

export const getLocale = (_data: any): Code[] => {
  const locales = computeLocales();

  let code = HEADER + NOLINT_MAXLINE;
  code += `export const rawLocales: any = ${locales};\n`;

  return [Code.core(['locale', 'autogen.locales.ts'], code)];
};
