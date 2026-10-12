import type { CityDef, Content } from './types';

export function cityOf(content: Content, cityId: string): CityDef {
  const city = content.cities.find((c) => c.id === cityId);
  if (!city) throw new Error(`unknown city: ${cityId}`);
  return city;
}
