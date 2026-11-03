import {
  createLocaleMatcher,
  getLanguageDisplayName,
  type LocaleData,
  matchLocale,
} from '@billie-coop/hereabouts';
import { useState } from 'react';
import type { T } from '../i18n';
import { attempt, Example, Field, q, Section } from '../ui';

export const Matching = ({ cldr, t }: { cldr: LocaleData; t: T }) => {
  const [supported, setSupported] = useState('en, en-GB, es, es-419, fr, de, ja, pt-BR, zh-Hant');
  const [desired, setDesired] = useState(
    typeof navigator !== 'undefined' ? navigator.languages.join(', ') : 'en-US',
  );
  const desiredList = desired
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const examples = desiredList.length ? [desiredList] : [];
  for (const one of ['en-AU', 'es-MX', 'pt-PT', 'zh-TW', 'nb', 'sr-Latn']) {
    examples.push([one]);
  }
  return (
    <Section
      id="matching"
      title={t('Locale matching')}
      intro={t(
        "Pick the best of your app's supported locales for what a user asks for, using CLDR's language distances (es-MX matches es-419, zh-TW matches zh-Hant).",
      )}
      controls={
        <>
          <Field
            label={t('Supported')}
            value={supported}
            onChange={setSupported}
            className="w-80"
          />
          <Field
            label={t('Your languages')}
            value={desired}
            onChange={setDesired}
            className="w-56"
          />
        </>
      }
    >
      {examples.map((want) => (
        <Example
          key={want.join(',')}
          code={`matchLocale(createLocaleMatcher(supported), [${want.map(q).join(', ')}])`}
          result={attempt(() => {
            const m = matchLocale(createLocaleMatcher(supported), want);
            return `${m.locale.id} · ${getLanguageDisplayName(cldr, m.locale.tag)} (distance ${m.distance})`;
          })}
        />
      ))}
    </Section>
  );
};
