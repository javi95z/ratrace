import type { CardDef } from '@ratrace/engine';
import { healthCards, laterLifeCards, luckCards } from './chance';
import { cityCards } from './cities';
import { crimeCards } from './crime';
import { familyCards, housingCards, lifestyleCards, lodgerCards, redTapeCards } from './home';
import { investingCards, taxCards, worldCards } from './markets';
import { moreBusinessCards, moreCareerCards, moreEducationCards, moreFamilyCards, moreHousingCards, moreInvestingCards, moreLaterLifeCards, moreLifestyleCards, moreTaxCards } from './extra';
import { businessCards, careerCards, educationCards } from './work';
import { celebCards } from './celebs';
import { v20Cards } from './v20';
import { richCards } from './rich';
import { peopleCards } from './people';
import { jobCards } from './jobs';
import { tradeCards } from './trades';
import { networkCards } from './network';

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
  ...redTapeCards,
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
  // The famous, as parodies: rare, and once a life.
  ...celebCards,
  // Content 1.48: more of the everyday.
  ...v20Cards,
  // Content 1.50: the troubles of a fortune, dealt only to the rich.
  ...richCards,
  // Content 1.50: the people who come back, and the player's own.
  ...peopleCards,
  // Content 1.52: the four careers added last, each with four cards of its own.
  ...jobCards,
  // And three for each of the eleven careers before them.
  ...tradeCards,
  // Content 1.53: what knowing the right people brings.
  ...networkCards,
];
