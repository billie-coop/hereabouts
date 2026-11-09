import {
  type CurrencyType,
  formatCurrency,
  formatDecimal,
  getCurrencyDisplayName,
  getCurrencyForRegion,
  getCurrencySymbol,
  getPluralCardinal,
  getPluralOrdinal,
  type LocaleData,
} from '@billie-coop/hereabouts';
import { useEffect, useState } from 'react';
import { loadLocale } from '../locale';
import { rich, type T } from '../i18n';
import { attempt, Example, Field, q, Section, Select } from '../ui';

export const Numbers = ({ cldr, t }: { cldr: LocaleData; t: T }) => {
  const [n, setN] = useState('1234567.891');
  const [comparisons, setComparisons] = useState<LocaleData[]>([]);
  useEffect(() => {
    let live = true;
    Promise.all(['en-US', 'de-DE', 'ja-JP'].map(loadLocale)).then(
      (data) => {
        if (live) setComparisons(data);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  const locales = [
    cldr,
    ...comparisons.filter((data) => data.language !== cldr.language || data.region !== cldr.region),
  ].slice(0, 3);
  const rows: [string, () => string][] = [
    [`formatDecimal(locale, ${q(n)})`, () => formatDecimal(cldr, n)],
    [
      `formatDecimal(locale, ${q(n)}, { maximumFractionDigits: 1 })`,
      () => formatDecimal(cldr, n, { maximumFractionDigits: 1 }),
    ],
    [
      `formatDecimal(locale, ${q(n)}, { style: 'short' })`,
      () => formatDecimal(cldr, n, { style: 'short' }),
    ],
    [
      `formatDecimal(locale, ${q(n)}, { style: 'long' })`,
      () => formatDecimal(cldr, n, { style: 'long' }),
    ],
    [
      `formatDecimal(locale, ${q(n)}, { style: 'scientific' })`,
      () => formatDecimal(cldr, n, { style: 'scientific' }),
    ],
    [
      `formatDecimal(locale, '0.256', { style: 'percent' })`,
      () => formatDecimal(cldr, '0.256', { style: 'percent' }),
    ],
    [
      `formatDecimal(locale, ${q(n)}, { nu: 'native' })`,
      () => formatDecimal(cldr, n, { nu: 'native' }),
    ],
    [`getPluralCardinal(locale, ${q(n)})`, () => getPluralCardinal(cldr, n)],
    [`getPluralOrdinal(locale, 3)`, () => getPluralOrdinal(cldr, 3)],
  ];
  return (
    <Section
      moreLabel={t('More examples')}
      id="numbers"
      size="wide"
      preview={
        <div className="number-comparison">
          {locales.map((data) => (
            <div key={`${data.language}-${data.region}`}>
              <span className="visual-label">
                {data.language}-{data.region}
              </span>
              <strong dir="auto">
                {attempt(() => formatDecimal(data, n, { maximumFractionDigits: 2 }))}
              </strong>
              <small dir="auto">{attempt(() => formatDecimal(data, n, { style: 'short' }))}</small>
            </div>
          ))}
        </div>
      }
      title={t('Numbers')}
      intro={t(
        'Numbers are formatted from strings or numbers with exact decimal digits, so nothing is lost to floating point.',
      )}
      controls={<Field label={t('Number')} value={n} onChange={setN} />}
    >
      {rows.map(([code, f]) => (
        <Example key={code} code={code} result={attempt(f)} />
      ))}
    </Section>
  );
};

const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'CHF',
  'INR',
  'BRL',
  'KRW',
  'MXN',
  'BHD',
  'SEK',
];

export const Currency = ({ cldr, t }: { cldr: LocaleData; t: T }) => {
  const home = getCurrencyForRegion(cldr.region);
  const [amount, setAmount] = useState('-1234.565');
  const [code, setCode] = useState<string>('');
  const c = (code || home) as CurrencyType;
  const codes = Array.from(new Set([home, ...CURRENCIES]));
  const rows: [string, () => string][] = [
    [`formatCurrency(locale, ${q(amount)}, ${q(c)})`, () => formatCurrency(cldr, amount, c)],
    [
      `formatCurrency(locale, ${q(amount)}, ${q(c)}, { style: 'accounting' })`,
      () => formatCurrency(cldr, amount, c, { style: 'accounting' }),
    ],
    [
      `formatCurrency(locale, ${q(amount)}, ${q(c)}, { style: 'code' })`,
      () => formatCurrency(cldr, amount, c, { style: 'code' }),
    ],
    [
      `formatCurrency(locale, ${q(amount)}, ${q(c)}, { style: 'name' })`,
      () => formatCurrency(cldr, amount, c, { style: 'name' }),
    ],
    [
      `formatCurrency(locale, '1234567', ${q(c)}, { style: 'short' })`,
      () => formatCurrency(cldr, '1234567', c, { style: 'short' }),
    ],
    [
      `formatCurrency(locale, ${q(amount)}, ${q(c)}, { cash: true })`,
      () => formatCurrency(cldr, amount, c, { cash: true }),
    ],
    [`getCurrencySymbol(locale, ${q(c)}, 'narrow')`, () => getCurrencySymbol(cldr, c, 'narrow')],
    [`getCurrencyDisplayName(locale, ${q(c)})`, () => getCurrencyDisplayName(cldr, c)],
  ];
  return (
    <Section
      moreLabel={t('More examples')}
      id="currency"
      preview={
        <div className="currency-receipt">
          {[...new Set([c, 'USD', 'EUR', 'JPY'])].slice(0, 3).map((currency) => (
            <div key={currency}>
              <span>{currency}</span>
              <strong dir="auto">
                {attempt(() => formatCurrency(cldr, amount, currency as CurrencyType))}
              </strong>
            </div>
          ))}
        </div>
      }
      title={t('Currency')}
      intro={rich(
        t(
          "Each currency rounds to its own digits (JPY has none, BHD has three) and `cash: true` applies cash rounding (CHF to 0.05). The default currency comes from the locale's region: `getCurrencyForRegion({region})` is {currency}.",
          { region: q(cldr.region), currency: home },
        ),
      )}
      controls={
        <>
          <Field label={t('Amount')} value={amount} onChange={setAmount} className="w-36" />
          <Select
            label={t('Currency')}
            value={c}
            onChange={setCode}
            options={codes.map((v) => ({ value: v, label: v }))}
          />
        </>
      }
    >
      {rows.map(([code, f]) => (
        <Example key={code} code={code} result={attempt(f)} />
      ))}
    </Section>
  );
};
