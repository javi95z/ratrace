/**
 * How hard each life is to play, from one to three: a judgement for choosing at a glance, not a
 * rule of the game, so it lives with the screens. One: a safe job or money to begin with. Two: a
 * good career with a loan or a catch. Three: little money, an unsteady pay, or a debt to climb out of.
 */
export const DIFFICULTY: Readonly<Record<string, 1 | 2 | 3>> = {
  nurse: 1,
  civil_servant: 1,
  heir: 1,
  teacher: 1,
  robotics_engineer: 1,
  engineer: 2,
  banker: 2,
  doctor: 2,
  founder: 2,
  lawyer: 2,
  programmer: 2,
  salesperson: 2,
  private_banker: 2,
  chef: 2,
  pilot: 2,
  architect: 2,
  recruit: 1,
  newcomer: 3,
  rider: 3,
  comeback: 3,
  crypto_kid: 3,
  influencer: 3,
  waiter: 3,
  estate_agent: 3,
};

/** A life's difficulty; one the list has not judged counts as middling. */
export const difficultyOf = (lifeId: string): 1 | 2 | 3 => DIFFICULTY[lifeId] ?? 2;
