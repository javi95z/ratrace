import { SKILLS } from '../types';
import type { Content, FinanceSkill, FocusAction, GameEvent, PlayerState, RoundTally, SkillId, SkillLevel, StudyAction } from '../types';

/** The skill each study action teaches. */
export const STUDY_OF: Record<StudyAction, SkillId> = {
  studyNegotiation: 'negotiation',
  studyLanguages: 'languages',
  networking: 'network',
  exercise: 'health',
};

/** True for a use of focus that studies a skill rather than serving the job. It needs no job. */
export function isStudy(action: FocusAction): action is StudyAction {
  return action in STUDY_OF;
}

/** The level some points of a skill come to. */
export function levelOfPoints(points: number, content: Content): SkillLevel {
  const [one, two, three] = content.life.skills.levelPoints;
  return points >= three ? 3 : points >= two ? 2 : points >= one ? 1 : 0;
}

/** The points at which a level begins: nothing for the first, a threshold of the rules for the others. */
export function pointsOfLevel(level: number, content: Content): number {
  return level <= 0 ? 0 : content.life.skills.levelPoints[Math.min(level, 3) - 1];
}

/**
 * Raises money sense by points, as any skill: a round with money invested is one. A level a card
 * gave stays even if the points are short of it, so the level is never taken back.
 */
export function addFinancePoints(p: PlayerState, content: Content, points: number, events: GameEvent[]): void {
  const life = p.life;
  life.financePoints += points;
  const level = Math.max(life.financeSkill, levelOfPoints(life.financePoints, content)) as FinanceSkill;
  if (level > life.financeSkill) {
    life.financeSkill = level;
    events.push({ kind: 'financeSkill', level });
  }
}

/** The level the player has reached in a skill. */
export function skillLevel(p: PlayerState, skill: SkillId, content: Content): SkillLevel {
  return levelOfPoints(p.life.skills[skill], content);
}

/** Every skill at its level. */
export function skillLevels(p: PlayerState, content: Content): Record<SkillId, SkillLevel> {
  return Object.fromEntries(SKILLS.map((skill) => [skill, skillLevel(p, skill, content)])) as Record<SkillId, SkillLevel>;
}

/**
 * Where the player practised each skill in a round, by living it rather than studying it: a trade
 * that uses it, a job hunt for negotiation, a city not their own for its language, a club for
 * the people met there, a gym for the body. Running a business is the
 * only way management is learnt, and a business run by its owner teaches as much as study.
 */
export function practised(p: PlayerState, content: Content, tally: RoundTally): Record<SkillId, number> {
  const rules = content.life.skills;
  const career = p.life.career?.id;
  const trade = (skill: SkillId) => career !== undefined && (rules.practiceCareers[skill] ?? []).includes(career);
  const member = p.life.items.some((owned) => content.items.some((item) => item.id === owned.itemId && item.kind === 'membership'));
  const gym = p.life.items.some((owned) => content.items.some((item) => item.id === owned.itemId && item.kind === 'membership' && (rules.practiceItems.health ?? []).includes(item.id)));
  const tended = p.businesses.some((business) => business.tended);
  const managed = p.businesses.some((business) => business.manager);
  const practice = (yes: boolean) => (yes ? rules.practicePoints : 0);
  return {
    negotiation: practice(trade('negotiation') || tally.focusActions.includes('jobHunt')),
    languages: practice(trade('languages') || p.cityId !== p.life.homeCityId),
    network: practice(trade('network') || member),
    management: tended ? rules.studyPoints : practice(managed),
    health: practice(trade('health') || gym),
  };
}

/** Adds points to skills, and tells of every level reached. */
export function addSkillPoints(p: PlayerState, content: Content, points: Partial<Record<SkillId, number>>, events: GameEvent[]): void {
  for (const skill of SKILLS) {
    const add = points[skill] ?? 0;
    if (add === 0) continue;
    const before = skillLevel(p, skill, content);
    p.life.skills[skill] = Math.max(0, p.life.skills[skill] + add);
    const after = skillLevel(p, skill, content);
    if (after > before) events.push({ kind: 'skill', skill, level: after });
  }
}

/** What a round of study and of living adds to every skill. */
export function learnSkills(p: PlayerState, content: Content, tally: RoundTally, events: GameEvent[]): void {
  const points = practised(p, content, tally);
  for (const action of tally.focusActions) {
    if (isStudy(action)) points[STUDY_OF[action]] += content.life.skills.studyPoints;
  }
  addSkillPoints(p, content, points, events);
}

/** A business may be owned past the usual limit by someone who knows how to manage. */
export function maxBusinessesOf(p: PlayerState, content: Content): number {
  return content.business.maxBusinesses + (skillLevel(p, 'management', content) >= content.life.skills.managementExtraFrom ? 1 : 0);
}
