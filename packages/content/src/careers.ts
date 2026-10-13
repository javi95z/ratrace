import type { CareerDef } from '@ratrace/engine';

/**
 * Six career ladders. A level pays a share of the median salary of the player's city,
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
];
