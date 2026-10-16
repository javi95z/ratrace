import { lives } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { CHARACTER_LIVES, characterName } from './characters';

describe('the people who live the lives', () => {
  it('have a name for every life, and for no other', () => {
    expect([...CHARACTER_LIVES].sort()).toEqual(lives.map((life) => life.id).sort());
  });

  it('are named in Latin letters, and in Cyrillic for Russian', () => {
    expect(characterName('nurse', 'es')).toBe('Lucía');
    expect(characterName('nurse', 'en')).toBe('Lucía');
    expect(characterName('nurse', 'ru')).toBe('Люсия');
    for (const life of lives) expect(characterName(life.id, 'ru'), life.id).toMatch(/^[А-яЁё]+$/);
    expect(characterName('atlantis', 'es')).toBeNull();
  });

  it('are all different', () => {
    const names = lives.map((life) => characterName(life.id, 'en'));
    expect(new Set(names).size).toBe(names.length);
  });
});
