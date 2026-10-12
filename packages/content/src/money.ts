/** Dollars to the engine's cents. Every amount in the content is in start-of-game dollars. */
export const usd = (dollars: number): number => Math.round(dollars * 100);
