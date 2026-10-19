/**
 * Who lives each life: a first name that fits the city it starts in and the portrait it is drawn
 * with. Written once in Latin letters and once in Cyrillic, for Russian. A name is no rule of the
 * game, so it lives with the screens.
 */
const NAMES: Readonly<Record<string, { latin: string; cyrillic: string }>> = {
  nurse: { latin: 'Lucía', cyrillic: 'Люсия' },
  civil_servant: { latin: 'Carmen', cyrillic: 'Кармен' },
  engineer: { latin: 'Haruto', cyrillic: 'Харуто' },
  robotics_engineer: { latin: 'Kenji', cyrillic: 'Кэндзи' },
  rider: { latin: 'Somchai', cyrillic: 'Сомчай' },
  waiter: { latin: 'Arthit', cyrillic: 'Артит' },
  heir: { latin: 'Max', cyrillic: 'Макс' },
  influencer: { latin: 'Layla', cyrillic: 'Лейла' },
  newcomer: { latin: 'Amara', cyrillic: 'Амара' },
  banker: { latin: 'Oliver', cyrillic: 'Оливер' },
  lawyer: { latin: 'Maya', cyrillic: 'Майя' },
  founder: { latin: 'Zoe', cyrillic: 'Зои' },
  crypto_kid: { latin: 'Kai', cyrillic: 'Кай' },
  teacher: { latin: 'Wei', cyrillic: 'Вэй' },
  programmer: { latin: 'Anya', cyrillic: 'Аня' },
  comeback: { latin: 'Dmitri', cyrillic: 'Дмитрий' },
  chef: { latin: 'Diego', cyrillic: 'Диего' },
  salesperson: { latin: 'Valeria', cyrillic: 'Валерия' },
  private_banker: { latin: 'Lea', cyrillic: 'Леа' },
  doctor: { latin: 'Nina', cyrillic: 'Нина' },
};

/** The first name of whoever lives a life, in the letters of a language; null for a life with none. */
export function characterName(lifeId: string, locale: string): string | null {
  const name = NAMES[lifeId];
  return name ? (locale === 'ru' ? name.cyrillic : name.latin) : null;
}

export const CHARACTER_LIVES = Object.keys(NAMES);
