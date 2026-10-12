import type { CareerDef } from '@ratrace/engine';

/**
 * Five career ladders. A level pays a share of the median salary of the player's city,
 * so the same job pays more in New York than in Bangkok.
 * A round of work adds one point of career skill, and a round of study one more.
 */
export const careers: CareerDef[] = [
  {
    // Steady and safe, with paid night shifts and a low ceiling.
    id: 'healthcare',
    overtimePct: 20,
    levels: [
      { salaryPct: 85, minSkill: 0, status: 2 },
      { salaryPct: 105, minSkill: 4, status: 5 },
      { salaryPct: 125, minSkill: 9, status: 9 },
      { salaryPct: 150, minSkill: 15, status: 14 },
    ],
  },
  {
    // Fast and steep.
    id: 'tech',
    overtimePct: 10,
    levels: [
      { salaryPct: 110, minSkill: 0, status: 3 },
      { salaryPct: 150, minSkill: 3, status: 6 },
      { salaryPct: 210, minSkill: 7, status: 11 },
      { salaryPct: 290, minSkill: 12, status: 18 },
      { salaryPct: 420, minSkill: 18, status: 28 },
    ],
  },
  {
    // A job for life with slow raises.
    id: 'public',
    overtimePct: 5,
    levels: [
      { salaryPct: 95, minSkill: 0, status: 3 },
      { salaryPct: 110, minSkill: 5, status: 6 },
      { salaryPct: 130, minSkill: 11, status: 10 },
      { salaryPct: 155, minSkill: 18, status: 16 },
    ],
  },
  {
    // Deliveries, hospitality and retail: low floor, plenty of overtime, a long climb.
    id: 'service',
    overtimePct: 25,
    levels: [
      { salaryPct: 65, minSkill: 0, status: 0 },
      { salaryPct: 85, minSkill: 3, status: 2 },
      { salaryPct: 115, minSkill: 7, status: 6 },
      { salaryPct: 150, minSkill: 12, status: 11 },
      { salaryPct: 210, minSkill: 18, status: 18 },
    ],
  },
  {
    // The highest ceiling. No life starts here; it is reached by switching careers.
    id: 'finance',
    overtimePct: 15,
    levels: [
      { salaryPct: 130, minSkill: 0, status: 5 },
      { salaryPct: 190, minSkill: 3, status: 9 },
      { salaryPct: 280, minSkill: 7, status: 15 },
      { salaryPct: 420, minSkill: 12, status: 23 },
      { salaryPct: 650, minSkill: 18, status: 30 },
    ],
  },
];
