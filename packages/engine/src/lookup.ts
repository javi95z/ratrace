import type { CardDef, CareerDef, CareerLevel, CityDef, Content, ItemDef, PropertyTypeDef } from './types';

export function cityOf(content: Content, cityId: string): CityDef {
  const city = content.cities.find((c) => c.id === cityId);
  if (!city) throw new Error(`unknown city: ${cityId}`);
  return city;
}

export function careerOf(content: Content, careerId: string): CareerDef {
  const career = content.careers.find((c) => c.id === careerId);
  if (!career) throw new Error(`unknown career: ${careerId}`);
  return career;
}

export function levelOf(content: Content, job: { id: string; level: number }): CareerLevel {
  const level = careerOf(content, job.id).levels[job.level];
  if (!level) throw new Error(`career ${job.id} has no level ${job.level}`);
  return level;
}

export function itemOf(content: Content, itemId: string): ItemDef {
  const item = content.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`unknown item: ${itemId}`);
  return item;
}

export function propertyTypeOf(content: Content, typeId: string): PropertyTypeDef {
  const type = content.propertyTypes.find((t) => t.id === typeId);
  if (!type) throw new Error(`unknown property type: ${typeId}`);
  return type;
}

export function cardOf(content: Content, cardId: string): CardDef {
  const card = content.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`unknown card: ${cardId}`);
  return card;
}
