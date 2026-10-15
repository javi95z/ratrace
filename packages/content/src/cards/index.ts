import type { CardDef } from '@ratrace/engine';
import { healthCards, laterLifeCards, luckCards } from './chance';
import { cityCards } from './cities';
import { crimeCards } from './crime';
import { familyCards, housingCards, lifestyleCards, lodgerCards } from './home';
import { investingCards, taxCards, worldCards } from './markets';
import { moreBusinessCards, moreCareerCards, moreEducationCards, moreFamilyCards, moreHousingCards, moreInvestingCards, moreLaterLifeCards, moreLifestyleCards, moreTaxCards } from './extra';
import { businessCards, careerCards, educationCards } from './work';

/** The hundred cards of v1, in the order of spec section 3.11. */
export const cards: CardDef[] = [
  ...careerCards,
  ...moreCareerCards,
  ...educationCards,
  ...moreEducationCards,
  ...businessCards,
  ...moreBusinessCards,
  ...investingCards,
  ...moreInvestingCards,
  ...housingCards,
  ...moreHousingCards,
  ...lifestyleCards,
  ...lodgerCards,
  ...moreLifestyleCards,
  ...familyCards,
  ...moreFamilyCards,
  ...healthCards,
  ...luckCards,
  ...worldCards,
  ...taxCards,
  ...moreTaxCards,
  ...laterLifeCards,
  ...moreLaterLifeCards,
  // Two for each city, dealt only there.
  ...cityCards,
  // The wrong side of the law, and prison.
  ...crimeCards,
];
