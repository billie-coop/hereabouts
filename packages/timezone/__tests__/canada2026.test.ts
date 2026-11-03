import { tzFromUTC } from '../src';

const HOUR = 3600000;

// tzdb 2026b (BC) and 2026c (Alberta) move both provinces to permanent time.
// tzdb models both switches as happening at 2026-11-01 02:00 local time. Before
// that, both zones keep observing DST as usual.
//
//   America/Vancouver: PDT (-07, dst) -> MST (-07, no dst) at 2026-11-01 09:00 UTC
//   America/Edmonton:  MDT (-06, dst) -> CST (-06, no dst) at 2026-11-01 08:00 UTC

const VANCOUVER = 'America/Vancouver';
const EDMONTON = 'America/Edmonton';

const VANCOUVER_SWITCH = Date.UTC(2026, 10, 1, 9, 0, 0);
const EDMONTON_SWITCH = Date.UTC(2026, 10, 1, 8, 0, 0);

const at = (zoneid: string, utc: number) => tzFromUTC(zoneid, utc);
const info = (zoneid: string, abbr: string, dst: number, hours: number) => ({
  zoneid,
  abbr,
  dst,
  offset: hours * HOUR,
});

test('vancouver observed dst before 2026-11-01', () => {
  expect(at(VANCOUVER, Date.UTC(2025, 6, 15, 20))).toEqual(info(VANCOUVER, 'PDT', 1, -7));
  expect(at(VANCOUVER, Date.UTC(2025, 11, 15, 20))).toEqual(info(VANCOUVER, 'PST', 0, -8));
  expect(at(VANCOUVER, Date.UTC(2026, 6, 15, 20))).toEqual(info(VANCOUVER, 'PDT', 1, -7));
  expect(at(VANCOUVER, VANCOUVER_SWITCH - 1000)).toEqual(info(VANCOUVER, 'PDT', 1, -7));
});

test('vancouver is permanent -07 from 2026-11-01', () => {
  const mst = info(VANCOUVER, 'MST', 0, -7);
  expect(at(VANCOUVER, VANCOUVER_SWITCH)).toEqual(mst);
  expect(at(VANCOUVER, Date.UTC(2026, 11, 15, 20))).toEqual(mst);
  expect(at(VANCOUVER, Date.UTC(2027, 2, 15, 20))).toEqual(mst);
  expect(at(VANCOUVER, Date.UTC(2027, 6, 15, 20))).toEqual(mst);
  expect(at(VANCOUVER, Date.UTC(2030, 0, 15, 20))).toEqual(mst);
});

test('edmonton observed dst before 2026-11-01', () => {
  expect(at(EDMONTON, Date.UTC(2025, 6, 15, 20))).toEqual(info(EDMONTON, 'MDT', 1, -6));
  expect(at(EDMONTON, Date.UTC(2025, 11, 15, 20))).toEqual(info(EDMONTON, 'MST', 0, -7));
  expect(at(EDMONTON, Date.UTC(2026, 6, 15, 20))).toEqual(info(EDMONTON, 'MDT', 1, -6));
  expect(at(EDMONTON, EDMONTON_SWITCH - 1000)).toEqual(info(EDMONTON, 'MDT', 1, -6));
});

test('edmonton is permanent -06 from 2026-11-01', () => {
  const cst = info(EDMONTON, 'CST', 0, -6);
  expect(at(EDMONTON, EDMONTON_SWITCH)).toEqual(cst);
  expect(at(EDMONTON, Date.UTC(2026, 11, 15, 20))).toEqual(cst);
  expect(at(EDMONTON, Date.UTC(2027, 2, 15, 20))).toEqual(cst);
  expect(at(EDMONTON, Date.UTC(2027, 6, 15, 20))).toEqual(cst);
  expect(at(EDMONTON, Date.UTC(2030, 0, 15, 20))).toEqual(cst);
});
