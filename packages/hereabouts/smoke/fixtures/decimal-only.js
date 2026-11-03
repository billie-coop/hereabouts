import { decimal, decimalAdd, decimalToString } from '@billie-coop/hereabouts/decimal';

console.log(JSON.stringify([decimalToString(decimalAdd(decimal('0.1'), '0.2'))]));
