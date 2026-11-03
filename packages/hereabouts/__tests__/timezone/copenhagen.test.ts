import { tzFromUTC, type ZoneInfo } from '../../src/timezone';
import { Timestamp } from './_helpers';

// See tz 2022b NEWS. Several zones whose timestamps since 1970 are
// duplicates have been moved to the backzone file and replaced
// with links. Copenhagen now points to Berlin.
const ID = 'Europe/Berlin';

const OCT272019_010000 = new Timestamp(1572138000000);
const DEC311889_230940 = new Timestamp(-2524524620000);

test('copenhagen min / max', () => {
  let info = tzFromUTC(ID, Timestamp.MIN.n);

  expect(info).toEqual({ zoneid: ID, abbr: 'LMT', dst: 0, offset: 3208000 });

  const t = DEC311889_230940;
  info = tzFromUTC(ID, t.n);
  expect(info).toEqual({ zoneid: ID, abbr: 'LMT', dst: 0, offset: 3208000 });

  info = tzFromUTC(ID, t.mins(-1).n);
  expect(info).toEqual({ zoneid: ID, abbr: 'LMT', dst: 0, offset: 3208000 });

  info = tzFromUTC(ID, Timestamp.MAX.n);
  expect(info).toEqual({ zoneid: ID, abbr: 'CET', dst: 0, offset: 3600000 });
});

test('copenhagen zones', () => {
  const t = OCT272019_010000;
  let info: ZoneInfo | undefined;

  info = tzFromUTC(ID, t.secs(-30).n);
  expect(info).toEqual({ zoneid: ID, abbr: 'CEST', dst: 1, offset: 7200000 });

  info = tzFromUTC(ID, t.n);
  expect(info).toEqual({ zoneid: ID, abbr: 'CET', dst: 0, offset: 3600000 });

  info = tzFromUTC(ID, t.secs(30).n);
  expect(info).toEqual({ zoneid: ID, abbr: 'CET', dst: 0, offset: 3600000 });
});
