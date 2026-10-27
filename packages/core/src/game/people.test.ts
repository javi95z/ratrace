import { describe, expect, it } from 'vitest';
import { endingOf, peopleEpilogue, peopleMet, peopleSeen } from './people';

describe('the people a life met', () => {
  it('are those whose cards it was dealt, in the order the collection shows them', () => {
    expect(peopleMet({})).toEqual([]);
    expect(peopleMet({ parents_met: 2, inlaw_met: 6, inlaw_out: 6 })).toEqual(['inlaw', 'parents']);
  });

  it('ends each story at the first ending whose flags hold, and at the last when none does', () => {
    expect(endingOf('inlaw', { inlaw_met: 1, inlaw_owes: 4, inlaw_repaid: 7 })).toEqual({ id: 'repaid', mood: 'pleased' });
    expect(endingOf('inlaw', { inlaw_met: 1, inlaw_owes: 4 })).toEqual({ id: 'unpaid', mood: 'upset' });
    expect(endingOf('inlaw', { inlaw_met: 1 })).toEqual({ id: 'coin', mood: 'pleased' });
    expect(endingOf('advisor', { advisor_met: 1, advisor_fund: 2, advisor_insurance: 5 }).id).toBe('both');
  });

  it('tells a line for each person met, and nothing of the rest', () => {
    expect(peopleEpilogue({ boss_met: 3, boss_cold: 5, parents_met: 1, parents_helped: 1 })).toEqual([
      { who: 'boss', ending: 'cold', mood: 'upset' },
      { who: 'parents', ending: 'helped', mood: 'pleased' },
    ]);
    expect(peopleEpilogue({ boss_cold: 5 })).toEqual([]);
  });

  it('keeps for the profile who was met as the life goes, and how their stories ended once it is over', () => {
    const flags = { inlaw_met: 1, inlaw_repaid: 9, founder_met: 3 };
    expect(peopleSeen(flags, false)).toEqual(['inlaw', 'founder']);
    expect(peopleSeen(flags, true)).toEqual(['inlaw', 'inlaw.repaid', 'founder', 'founder.passed']);
  });
});
