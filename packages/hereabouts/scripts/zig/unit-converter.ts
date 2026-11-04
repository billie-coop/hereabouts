/**
 * Writes `zig/src/unit_converter/autogen.factors.zig`: the public factor tables of
 * `src/unit-converter/factors.ts` (ACCELERATION, ..., VOLUME_UK), as the TypeScript builds them
 * from the CLDR-generated star tables plus the hand-maintained entries.
 */
import * as F from '../../src/unit-converter';
import { header, type ZigFile, zigString } from './_emit';

/** The exported tables, in the order factors.ts declares them. */
export const TABLES: [string, readonly F.FactorDef[]][] = [
  ['ACCELERATION', F.ACCELERATION],
  ['ANGLE', F.ANGLE],
  ['AREA', F.AREA],
  ['CONSUMPTION', F.CONSUMPTION],
  ['DIGITAL', F.DIGITAL],
  ['DIGITAL_DECIMAL', F.DIGITAL_DECIMAL],
  ['DURATION', F.DURATION],
  ['ELECTRIC', F.ELECTRIC],
  ['ENERGY', F.ENERGY],
  ['FORCE', F.FORCE],
  ['FREQUENCY', F.FREQUENCY],
  ['GRAPHICS_PER', F.GRAPHICS_PER],
  ['GRAPHICS_PIXEL', F.GRAPHICS_PIXEL],
  ['ILLUMINANCE', F.ILLUMINANCE],
  ['LENGTH', F.LENGTH],
  ['MASS', F.MASS],
  ['POWER', F.POWER],
  ['PRESSURE', F.PRESSURE],
  ['RADIATION', F.RADIATION],
  ['RADIOACTIVITY', F.RADIOACTIVITY],
  ['RATIO', F.RATIO],
  ['SPEED', F.SPEED],
  ['SUBSTANCE', F.SUBSTANCE],
  ['TEMPERATURE', F.TEMPERATURE],
  ['TORQUE', F.TORQUE],
  ['VOLUME', F.VOLUME],
  ['VOLUME_UK', F.VOLUME_UK],
];

const str = (x: unknown, where: string): string => {
  if (typeof x !== 'string') {
    throw new Error(`${where}: expected a string factor`);
  }
  return zigString(x);
};

const table = (name: string, defs: readonly F.FactorDef[]): string => {
  const rows = defs.map(([src, f, dst, off], i) => {
    const where = `${name}[${i}]`;
    const args = [zigString(src), str(f, where), zigString(dst)];
    return off === undefined
      ? `    d(${args.join(', ')}),`
      : `    o(${args.join(', ')}, ${str(off, where)}),`;
  });
  return `pub const ${name} = [_]FactorDef{\n${rows.join('\n')}\n};\n`;
};

export const files = (): ZigFile[] => [
  {
    path: 'unit_converter/autogen.factors.zig',
    content:
      header('unit-converter', 'src/unit-converter/factors.ts') +
      'const FactorDef = @import("types.zig").FactorDef;\n\n' +
      'fn d(src: []const u8, factor: []const u8, dst: []const u8) FactorDef {\n' +
      '    return .{ .src = src, .factor = .{ .string = factor }, .dst = dst };\n' +
      '}\n\n' +
      'fn o(src: []const u8, factor: []const u8, dst: []const u8, offset: []const u8) FactorDef {\n' +
      '    return .{ .src = src, .factor = .{ .string = factor }, .dst = dst, .offset = .{ .string = offset } };\n' +
      '}\n\n' +
      TABLES.map(([n, defs]) => table(n, defs)).join('\n'),
  },
];
