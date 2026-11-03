import { tzFromUTC, tzFromWall, tzResolveId } from '../src/timezone';

{
  const id = tzResolveId('Pacific/Samoa');
  console.log(id);

  const ZONES = [
    'UTC',
    'Pacific/Samoa',
    'America/New_York',
    'Pacific/Pago_Pago',
    'Asia/Tokyo',
    'Europe/Paris',
  ];

  const now = new Date(2020, 2, 18, 12, 30, 0).getTime();
  for (const zoneid of ZONES) {
    const info = tzFromUTC(zoneid, now);
    console.log(`${zoneid.padEnd(18)} -> ${JSON.stringify(info)}`);
  }
}

{
  // Sun Mar  8 2020 02:10:00 AM NY time
  const local = 1583633400000;
  const zoneid = 'America/New_York';
  const [utc, info] = tzFromWall(zoneid, local)!;
  console.log(utc);
  console.log(JSON.stringify(info));
}
