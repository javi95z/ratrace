import { describe, expect, it } from 'vitest';
import { catalog, localeOf } from './catalog';
import { WORDS } from './catalogWords';
import type { Words } from './catalogWords';

/** Every plain label of a language's catalogue: its headings, table heads and row names. */
const labels = (words: Words): string[] => {
  const found: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') found.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(words);
  return found.filter((label) => label.length > 3);
};

/** The text a reader sees: no pictures, no anchors, no markdown marks. */
const prose = (markdown: string): string => markdown.replace(/<img [^>]*>/g, '').replace(/\]\(#[^)]*\)/g, ']');

describe('catalog', () => {
  const es = catalog('es');
  const ru = catalog('ru');

  it('is Spanish unless asked for Russian', () => {
    expect(localeOf([])).toBe('es');
    expect(localeOf(['--locale=ru'])).toBe('ru');
    expect(() => localeOf(['--locale=fr'])).toThrow();
    expect(es.startsWith('# Catálogo del juego\n')).toBe(true);
  });

  it('writes the Russian catalogue with Russian headings', () => {
    expect(ru.startsWith('# Каталог игры\n')).toBe(true);
    const headings = ru.split('\n').filter((line) => /^#{1,2} /.test(line));
    expect(headings.length).toBeGreaterThan(10);
    for (const heading of headings) expect(heading, heading).toMatch(/^#+ [А-ЯЁ]/);
    for (const section of Object.values(WORDS.ru.sections)) expect(ru).toContain(`## ${section}\n`);
  });

  it('lets no Spanish label into the Russian catalogue', () => {
    const text = prose(ru);
    const leaks = labels(WORDS.es).filter((label) => !labels(WORDS.ru).includes(label) && text.includes(label));
    expect(leaks).toEqual([]);
    expect(text).not.toMatch(/[áéíóúñ¿¡]/i);
    expect(text).not.toMatch(/\b(?:ronda|años|sueldo|estatus|del)\b/);
  });

  it('writes Russian numbers and keeps the Spanish ones', () => {
    expect(ru).toMatch(/\d \d{3} \$/);
    expect(ru).not.toMatch(/\d %/);
    expect(es).toMatch(/\d\.\d{3} \$/);
    expect(es).toMatch(/\d %/);
  });

  it('links each section of the contents to its heading', () => {
    for (const [, target] of ru.matchAll(/\]\(#([^)]+)\)/g)) {
      const heading = ru.split('\n').find((line) => line.startsWith('## ') && line.slice(3).toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /g, '-') === target);
      expect(heading, target).toBeDefined();
    }
  });
});
