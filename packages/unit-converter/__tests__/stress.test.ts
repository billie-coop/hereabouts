import {
  ACCELERATION,
  ANGLE,
  AREA,
  CONSUMPTION,
  DIGITAL,
  DIGITAL_DECIMAL,
  DURATION,
  ELECTRIC,
  ENERGY,
  type FactorDef,
  FORCE,
  FREQUENCY,
  GRAPHICS_PER,
  GRAPHICS_PIXEL,
  ILLUMINANCE,
  LENGTH,
  MASS,
  POWER,
  PRESSURE,
  RADIATION,
  RADIOACTIVITY,
  RATIO,
  SPEED,
  SUBSTANCE,
  TEMPERATURE,
  TORQUE,
  unitFactors,
  unitFactorsGet,
  VOLUME,
  VOLUME_UK,
} from '../src';

const FACTORS: FactorDef[][] = [
  ACCELERATION,
  ANGLE,
  AREA,
  CONSUMPTION,
  DIGITAL,
  DIGITAL_DECIMAL,
  DURATION,
  ELECTRIC,
  ENERGY,
  FORCE,
  FREQUENCY,
  GRAPHICS_PER,
  GRAPHICS_PIXEL,
  ILLUMINANCE,
  LENGTH,
  MASS,
  POWER,
  PRESSURE,
  RADIATION,
  RADIOACTIVITY,
  RATIO,
  SPEED,
  SUBSTANCE,
  TEMPERATURE,
  TORQUE,
  VOLUME,
  VOLUME_UK,
];

test('cover all factors', () => {
  for (const factorset of FACTORS) {
    const map = unitFactors(factorset);
    for (const u of map.units) {
      for (const v of map.units) {
        unitFactorsGet(map, u, v);
      }
    }
  }
});
