import {
  type LanguageTag,
  languageTag,
  parseLanguageTag,
  tagHasLanguage,
  tagHasRegion,
  tagHasScript,
} from '../language-tag';
import { resolveLanguageTag } from './resolver';

const UNDEFINED = /*#__PURE__*/ languageTag();

/**
 * Wrapper pairing an application's opaque locale identifier with a
 * parsed and resolved language tag object.
 *
 * @public
 */
export interface Locale {
  /**
   * Application's own identifier for the locale, e.g. 'en_US', 'fr-CA', etc.
   * We preserve this since applications may use it as a unique key to
   * resolve translated messages, and may be forced to use a legacy
   * identifier.
   */
  readonly id: string;

  /**
   * Language tag that has been parsed and resolved. Parsing canonicalizes
   * the subtags, while resolution includes substituting language and
   * territory aliases and adding likely subtags.
   */
  readonly tag: LanguageTag;
}

/**
 * Parses a language tag and resolves it, substituting aliases and
 * adding likely subtags.
 *
 * @public
 */
export const resolveLocaleId = (id: string): Locale => {
  let tag = parseLanguageTag(id);
  if (tagHasLanguage(tag) || tagHasScript(tag) || tagHasRegion(tag)) {
    tag = resolveLanguageTag(tag);
  } else {
    tag = UNDEFINED;
  }
  return { id, tag };
};
