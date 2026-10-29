/*
 * The rewards the player has accepted (Rewards.tsx), by life: `<gameId>:<kind>:<id>`. Kept for as long as the app runs, so a summary drawn again (a
 * page left and come back to, a tablet turned) does not show a reward twice. A badge or a life is first earned once ever, so nothing longer is needed:
 * the step that earned it is gone once the round moves on.
 */
const accepted = new Set<string>();

export const rewardAccepted = (key: string): boolean => accepted.has(key);
export const acceptReward = (key: string): void => void accepted.add(key);
/** Forgets every reward accepted: for a test's teardown. */
export const forgetAcceptedRewards = (): void => accepted.clear();
