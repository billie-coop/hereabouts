import { tzFromUTC, type ZoneInfo } from '../../src/timezone';
import { Timestamp } from './_helpers';

const ID = 'America/New_York';
const MAR102019_065930 = new Timestamp(1552201170000);
const NOV181883_170000 = new Timestamp(-2717650800000);

test('new york min / max', () => {
  const t = NOV181883_170000;

  let info = tzFromUTC(ID, Timestamp.MIN.n);
  expect(info).toEqual({ zoneid: ID, abbr: 'LMT', dst: 0, offset: -17762000 });

  info = tzFromUTC(ID, t.n);
  expect(info).toEqual({ zoneid: ID, abbr: 'EST', dst: 0, offset: -18000000 });

  info = tzFromUTC(ID, t.mins(-1).n);
  expect(info).toEqual({ zoneid: ID, abbr: 'LMT', dst: 0, offset: -17762000 });

  info = tzFromUTC(ID, Timestamp.MAX.n);
  expect(info).toEqual({ zoneid: ID, abbr: 'EST', dst: 0, offset: -18000000 });
});

test('new york utc', () => {
  const t = MAR102019_065930;
  let info: ZoneInfo | undefined;

  info = tzFromUTC(ID, t.n);
  expect(info).toEqual({ zoneid: ID, abbr: 'EST', dst: 0, offset: -18000000 });

  info = tzFromUTC(ID, t.secs(29).n);
  expect(info).toEqual({ zoneid: ID, abbr: 'EST', dst: 0, offset: -18000000 });

  info = tzFromUTC(ID, t.secs(30).n);
  expect(info).toEqual({ zoneid: ID, abbr: 'EDT', dst: 1, offset: -14400000 });

  info = tzFromUTC(ID, t.mins(1).n);
  expect(info).toEqual({ zoneid: ID, abbr: 'EDT', dst: 1, offset: -14400000 });
});
