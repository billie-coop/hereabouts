import {
  decimal,
  decimalAdd,
  decimalDivide,
  decimalMultiply,
  decimalSetScale,
  decimalSubtract,
  decimalToString,
  formatCurrency,
  type LocaleData,
} from '@billie-coop/hereabouts';
import { useState } from 'react';
import { rich, type T } from '../i18n';
import { attempt, Example, Field, q, Section } from '../ui';

export const DecimalMath = ({ cldr, t }: { cldr: LocaleData; t: T }) => {
  const [a, setA] = useState('0.1');
  const [b, setB] = useState('0.2');
  const [qty, setQty] = useState('3');
  const [price, setPrice] = useState('19.99');
  const [rate, setRate] = useState('0.08875');
  const s = decimalToString;
  const rows: [string, () => string, string?][] = [
    [`${a} + ${b} (JavaScript numbers)`, () => String(Number(a) + Number(b))],
    [`decimalToString(decimalAdd(${q(a)}, ${q(b)}))`, () => s(decimalAdd(a, b))],
    [`decimalToString(decimalSubtract(${q(a)}, ${q(b)}))`, () => s(decimalSubtract(a, b))],
    [`decimalToString(decimalMultiply(${q(a)}, ${q(b)}))`, () => s(decimalMultiply(a, b))],
    [
      `decimalToString(decimalDivide(${q(a)}, ${q(b)}, { precision: 30 }))`,
      () => s(decimalDivide(a, b, { precision: 30 })),
    ],
  ];
  const subtotal = () => decimalMultiply(qty, price);
  const tax = () => decimalSetScale(decimalMultiply(subtotal(), rate), 2, 'half-even');
  const invoice: [string, () => string][] = [
    [`subtotal = decimalMultiply(${q(qty)}, ${q(price)})`, () => s(subtotal())],
    [
      `tax = decimalSetScale(decimalMultiply(subtotal, ${q(rate)}), 2, 'half-even')`,
      () => s(tax()),
    ],
    [
      `formatCurrency(locale, decimalAdd(subtotal, tax), 'USD')`,
      () => formatCurrency(cldr, decimalAdd(subtotal(), tax()), 'USD'),
    ],
  ];
  return (
    <Section
      moreLabel={t('More examples')}
      id="math"
      title={t('Decimal math')}
      intro={rich(
        t(
          'Arbitrary precision decimals as plain data (`{json}`), so amounts survive JSON and `structuredClone`. Add, subtract and multiply are exact; divide takes a precision or scale.',
          { json: JSON.stringify(decimal('19.99')) },
        ),
      )}
      controls={
        <>
          <Field label="a" value={a} onChange={setA} className="w-36" />
          <Field label="b" value={b} onChange={setB} className="w-36" />
        </>
      }
    >
      {rows.map(([code, f]) => (
        <Example key={code} code={code} result={attempt(f)} />
      ))}
      <div className="flex flex-wrap items-end gap-3 pt-4 pb-1">
        <span className="w-full text-sm font-medium">{t('An invoice line')}</span>
        <Field label={t('Quantity')} value={qty} onChange={setQty} className="w-20" />
        <Field label={t('Unit price')} value={price} onChange={setPrice} className="w-28" />
        <Field label={t('Tax rate')} value={rate} onChange={setRate} className="w-28" />
      </div>
      {invoice.map(([code, f]) => (
        <Example key={code} code={code} result={attempt(f)} />
      ))}
    </Section>
  );
};
