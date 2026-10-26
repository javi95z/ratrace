import { EMPTY_BOOK, readBook } from '@ratrace/core/game/lifeMilestones';
import type { MilestoneBook, MilestoneKeep } from '@ratrace/core/game/lifeMilestones';
import { kvMilestones } from '../kvStore';
import type { BasketText } from './phoneBasket';

/**
 * The milestones of lives, kept on a place for them as the basket is: which of a life's milestones its story does not tell it has reached (so a life
 * opened again does not celebrate one twice), and the youngest age each was ever reached at. Read once, then held: the round store reads it with
 * every step. A place that keeps nothing keeps the book for as long as the app runs.
 */
export function milestonesOver(place: BasketText): MilestoneKeep {
  let held: MilestoneBook | null = null;
  return {
    load() {
      if (held === null) {
        try {
          held = readBook(JSON.parse(place.read() ?? 'null'));
        } catch {
          held = EMPTY_BOOK;
        }
      }
      return held;
    },
    save(book) {
      held = book;
      try {
        place.write(JSON.stringify(book));
      } catch {
        // Not kept beyond this start of the app.
      }
    },
  };
}

/** The milestones in the phone's own store (the browser's, on the web). */
export const phoneMilestones: MilestoneKeep = milestonesOver(kvMilestones);
