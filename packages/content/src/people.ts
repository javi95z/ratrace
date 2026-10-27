/**
 * Content 1.50: the people who come back in a life (docs/superpowers/specs/2026-10-27-recurring-characters-design.md). Each has a few
 * cards that remember what the player did, through flags: `<who>_met` set by every option of each of their cards, `<who>_warm` and
 * `<who>_cold` by the choices that please or cross them, and the flags of their own story. Which card is whose, the face each wears on
 * it, and how each story may end are here; their names are the name pack's (`names.ts`, `{person:<who>}`), what they are to the player
 * and their endings the text's (`text.people`). The engine knows none of it.
 */

export type PersonId = 'inlaw' | 'boss' | 'landlord' | 'founder' | 'advisor' | 'parents';

/** In the order the collection shows them. */
export const PEOPLE: readonly PersonId[] = ['inlaw', 'boss', 'landlord', 'founder', 'advisor', 'parents'];

/** The two faces each is drawn with. */
export type Mood = 'pleased' | 'upset';

/** The flag every card of a person sets, whatever is chosen: the life has met them. */
export const metFlag = (who: PersonId): string => `${who}_met`;

/** A person's portrait in a mood (art/clean: `portraits/people-01`). */
export const personArt = (who: PersonId, mood: Mood): string => `person.${who}.${mood}`;

/** Whose each card is, and the face they wear on it: pleased when the news is good or they are, upset otherwise. */
export const cardPeople: Readonly<Record<string, { who: PersonId; mood: Mood }>> = {
  inlaw_coin: { who: 'inlaw', mood: 'pleased' },
  inlaw_moon: { who: 'inlaw', mood: 'pleased' },
  inlaw_dinner: { who: 'inlaw', mood: 'pleased' },
  inlaw_rug: { who: 'inlaw', mood: 'upset' },
  inlaw_loan: { who: 'inlaw', mood: 'upset' },
  inlaw_repay: { who: 'inlaw', mood: 'pleased' },
  boss_weekend: { who: 'boss', mood: 'upset' },
  boss_offer: { who: 'boss', mood: 'pleased' },
  boss_layoffs: { who: 'boss', mood: 'upset' },
  landlord_damp: { who: 'landlord', mood: 'pleased' },
  landlord_raise: { who: 'landlord', mood: 'upset' },
  landlord_sale: { who: 'landlord', mood: 'pleased' },
  founder_pitch: { who: 'founder', mood: 'pleased' },
  founder_more: { who: 'founder', mood: 'upset' },
  founder_exit: { who: 'founder', mood: 'pleased' },
  founder_second: { who: 'founder', mood: 'pleased' },
  advisor_fund: { who: 'advisor', mood: 'pleased' },
  advisor_insurance: { who: 'advisor', mood: 'pleased' },
  parents_help: { who: 'parents', mood: 'pleased' },
  parents_care: { who: 'parents', mood: 'upset' },
  parents_inheritance: { who: 'parents', mood: 'upset' },
};

/** How a person's story ended: the first whose flags hold, in order; the last of each holds always. */
export interface PersonEnding {
  id: string;
  mood: Mood;
  flags?: readonly string[];
  notFlags?: readonly string[];
}

export const personEndings: Readonly<Record<PersonId, readonly PersonEnding[]>> = {
  inlaw: [
    { id: 'jackpot', mood: 'pleased', flags: ['inlaw_jackpot'] },
    { id: 'repaid', mood: 'pleased', flags: ['inlaw_repaid'] },
    { id: 'forgiven', mood: 'pleased', flags: ['inlaw_forgiven'] },
    { id: 'unpaid', mood: 'upset', flags: ['inlaw_owes'] },
    { id: 'estranged', mood: 'upset', flags: ['inlaw_cold'] },
    { id: 'coin', mood: 'pleased' },
  ],
  boss: [
    { id: 'protected', mood: 'pleased', flags: ['boss_protected'] },
    { id: 'moved', mood: 'pleased', flags: ['boss_moved'] },
    { id: 'covered', mood: 'pleased', flags: ['boss_covered'] },
    { id: 'cold', mood: 'upset', flags: ['boss_cold'] },
    { id: 'gone', mood: 'upset' },
  ],
  landlord: [
    { id: 'sold', mood: 'pleased', flags: ['landlord_sold'] },
    { id: 'left', mood: 'upset', flags: ['landlord_left'] },
    { id: 'cold', mood: 'upset', flags: ['landlord_cold'] },
    { id: 'warm', mood: 'pleased', flags: ['landlord_warm'] },
    { id: 'rent', mood: 'upset' },
  ],
  founder: [
    { id: 'rich', mood: 'pleased', flags: ['founder_rich'] },
    { id: 'won', mood: 'pleased', flags: ['founder_won'] },
    { id: 'sold', mood: 'pleased', flags: ['founder_sold'] },
    { id: 'out', mood: 'upset', flags: ['founder_out'] },
    { id: 'closed', mood: 'upset', flags: ['founder_closed'] },
    { id: 'passed', mood: 'pleased' },
  ],
  advisor: [
    { id: 'both', mood: 'pleased', flags: ['advisor_fund', 'advisor_insurance'] },
    { id: 'fund', mood: 'pleased', flags: ['advisor_fund'] },
    { id: 'insurance', mood: 'pleased', flags: ['advisor_insurance'] },
    { id: 'cold', mood: 'upset', flags: ['advisor_cold'] },
    { id: 'none', mood: 'upset' },
  ],
  parents: [
    { id: 'debts', mood: 'upset', flags: ['parents_debts'] },
    { id: 'cared', mood: 'pleased', flags: ['parents_cared'] },
    { id: 'home', mood: 'pleased', flags: ['parents_home'] },
    { id: 'helped', mood: 'pleased', flags: ['parents_helped'] },
    { id: 'fine', mood: 'pleased' },
  ],
};
