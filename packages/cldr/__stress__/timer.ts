import { decimal, decimalAdd, decimalMovePoint, decimalSubtract, decimalToString } from '../src';

const time = (n: [number, number]) =>
  decimalAdd(decimal(n[0]), decimalMovePoint(decimal(n[1]), -9));

export class Timer {
  protected _start: [number, number] = process.hrtime();

  start(): void {
    this._start = process.hrtime();
  }

  micros(): string {
    const _end = process.hrtime();
    return decimalToString(decimalMovePoint(decimalSubtract(time(_end), time(this._start)), 6));
  }

  // private asDecimal(hrtime: [number, number]): Decimal {
  //   return new Decimal(hrtime[0]).add(new Decimal(hrtime[1]).movePoint(-9));
  // }
}
