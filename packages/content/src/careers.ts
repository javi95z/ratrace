import type { CareerDef } from '@ratrace/engine';

/**
 * Eleven career ladders. A level pays a share of the median salary of the player's city,
 * so the same job pays more in New York than in Bangkok.
 *
 * A round of work adds one point of career skill, and a round of study one more. So the top of a
 * five-level ladder takes 28 years of work alone, or 14 with study every round.
 */
export const careers: CareerDef[] = [
  {
    // Steady and safe, with well-paid night shifts and a low ceiling.
    id: 'healthcare',
    overtimePct: 8,
    levels: [
      { salaryPct: 85, minSkill: 0, status: 2 },
      { salaryPct: 97, minSkill: 5, status: 5 },
      { salaryPct: 110, minSkill: 12, status: 9 },
      { salaryPct: 125, minSkill: 20, status: 14 },
    ],
  },
  {
    // Fast and steep.
    id: 'tech',
    overtimePct: 5,
    levels: [
      { salaryPct: 105, minSkill: 0, status: 3 },
      { salaryPct: 120, minSkill: 4, status: 6 },
      { salaryPct: 140, minSkill: 10, status: 11 },
      { salaryPct: 168, minSkill: 18, status: 18 },
      { salaryPct: 205, minSkill: 28, status: 28 },
    ],
  },
  {
    // A job for life with slow raises.
    id: 'public',
    overtimePct: 4,
    levels: [
      { salaryPct: 95, minSkill: 0, status: 3 },
      { salaryPct: 106, minSkill: 6, status: 6 },
      { salaryPct: 118, minSkill: 14, status: 10 },
      { salaryPct: 132, minSkill: 24, status: 16 },
    ],
  },
  {
    // Deliveries, hospitality and retail: low floor, plenty of overtime, a long climb.
    id: 'service',
    overtimePct: 10,
    levels: [
      { salaryPct: 65, minSkill: 0, status: 0 },
      { salaryPct: 80, minSkill: 4, status: 2 },
      { salaryPct: 98, minSkill: 10, status: 6 },
      { salaryPct: 122, minSkill: 18, status: 11 },
      { salaryPct: 155, minSkill: 28, status: 18 },
    ],
  },
  {
    // The highest ceiling. Reached by switching careers, or by the one life that starts here.
    id: 'finance',
    overtimePct: 6,
    levels: [
      { salaryPct: 130, minSkill: 0, status: 5 },
      { salaryPct: 160, minSkill: 4, status: 9 },
      { salaryPct: 200, minSkill: 10, status: 15 },
      { salaryPct: 260, minSkill: 18, status: 23 },
      { salaryPct: 350, minSkill: 28, status: 30 },
    ],
  },
  {
    // Long hours and a slow first step, then pay only finance beats. Nothing leads here: it is where the doctor starts.
    id: 'medicine',
    overtimePct: 8,
    levels: [
      { salaryPct: 110, minSkill: 0, status: 5 },
      { salaryPct: 150, minSkill: 6, status: 10 },
      { salaryPct: 200, minSkill: 14, status: 17 },
      { salaryPct: 260, minSkill: 24, status: 26 },
    ],
  },
  {
    // The longest apprenticeship and the highest ceiling of all: years of drafting for others, then a name on the door.
    id: 'law',
    overtimePct: 6,
    levels: [
      { salaryPct: 90, minSkill: 0, status: 4 },
      { salaryPct: 115, minSkill: 6, status: 8 },
      { salaryPct: 160, minSkill: 14, status: 15 },
      { salaryPct: 240, minSkill: 24, status: 24 },
      { salaryPct: 380, minSkill: 34, status: 32 },
    ],
  },
  {
    // Modest and flat, with the afternoons free: a point of focus more every round to spend elsewhere.
    id: 'education',
    overtimePct: 3,
    focus: 1,
    levels: [
      { salaryPct: 80, minSkill: 0, status: 3 },
      { salaryPct: 90, minSkill: 6, status: 6 },
      { salaryPct: 102, minSkill: 14, status: 10 },
      { salaryPct: 115, minSkill: 24, status: 15 },
    ],
  },
  {
    // Fast money and more status than anything pays, for the young: from thirty-four the audience moves on.
    id: 'influencer',
    overtimePct: 12,
    fade: { fromRound: 6, pctPerRound: 12, maxPct: 70 },
    levels: [
      { salaryPct: 70, minSkill: 0, status: 6 },
      { salaryPct: 130, minSkill: 3, status: 14 },
      { salaryPct: 220, minSkill: 8, status: 24 },
      { salaryPct: 300, minSkill: 14, status: 34 },
    ],
  },
  {
    // Easy to get into, long hours and good tips: the best overtime there is, and a long way to the top.
    id: 'hospitality',
    overtimePct: 14,
    levels: [
      { salaryPct: 60, minSkill: 0, status: 1 },
      { salaryPct: 78, minSkill: 4, status: 3 },
      { salaryPct: 100, minSkill: 10, status: 7 },
      { salaryPct: 130, minSkill: 18, status: 12 },
      { salaryPct: 170, minSkill: 28, status: 19 },
    ],
  },
  {
    // A low base and a commission on top, which is the economy's to give and to take.
    id: 'sales',
    overtimePct: 8,
    cyclePct: { boom: 25, expansion: 10, slowdown: -10, recession: -25 },
    levels: [
      { salaryPct: 75, minSkill: 0, status: 2 },
      { salaryPct: 100, minSkill: 4, status: 5 },
      { salaryPct: 135, minSkill: 10, status: 10 },
      { salaryPct: 180, minSkill: 18, status: 17 },
      { salaryPct: 240, minSkill: 28, status: 25 },
    ],
  },
];
