import type { CardDef } from '@ratrace/engine';
import { healthCards, laterLifeCards, luckCards } from './chance';
import { familyCards, housingCards, lifestyleCards } from './home';
import { investingCards, taxCards, worldCards } from './markets';
import { businessCards, careerCards, educationCards } from './work';

/** The hundred cards of v1, in the order of spec section 3.11. */
export const cards: CardDef[] = [
  ...careerCards,
  ...educationCards,
  ...businessCards,
  ...investingCards,
  ...housingCards,
  ...lifestyleCards,
  ...familyCards,
  ...healthCards,
  ...luckCards,
  ...worldCards,
  ...taxCards,
  ...laterLifeCards,
];
