import { describe, expect, it } from 'vitest';
import { lives } from '@ratrace/content';
import en from '@ratrace/i18n/messages/en.json';
import es from '@ratrace/i18n/messages/es.json';
import ru from '@ratrace/i18n/messages/ru.json';
import { unlockProgress } from './unlockProgress';

describe('progress towards a life', () => {
  it('counts the lives finished for the goal of finishing one', () => {
    expect(unlockProgress('finish_one_life', 0)).toEqual({ have: 0, need: 1 });
    expect(unlockProgress('finish_one_life', 4)).toEqual({ have: 1, need: 1 });
  });

  it('shows nothing where the device does not know, or does not record, what the goal counts', () => {
    expect(unlockProgress('finish_one_life', null)).toBeNull();
    expect(unlockProgress('net_worth_1m', 3)).toBeNull();
    expect(unlockProgress('mba', 3)).toBeNull();
  });
});

describe('the hint of a locked life', () => {
  it.each([
    ['en', en],
    ['es', es],
    ['ru', ru],
  ])('has one in %s for every life that must be unlocked', (_, messages) => {
    for (const life of lives.filter((candidate) => candidate.unlock !== 'default')) {
      expect((messages.newLife.hints as Record<string, string>)[life.id], life.id).toBeTruthy();
    }
  });
});
