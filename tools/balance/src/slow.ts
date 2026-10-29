/**
 * The time a balance test is given to play its lives: what it takes on a developer's machine, and three times as much on a CI runner (`CI`, which
 * GitHub Actions sets), whose few slower cores play the same lives in about twice the time. A test that runs out of time says nothing of the balance.
 */
export function slow(ms: number): number {
  return process.env.CI ? ms * 3 : ms;
}
