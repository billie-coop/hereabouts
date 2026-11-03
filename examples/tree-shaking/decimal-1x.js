// 1.x: the same arithmetic with the Decimal class.
import { Decimal } from '@phensley/decimal';

const total = new Decimal('19.99').multiply(3).add('0.03');
console.log(total.toString());
