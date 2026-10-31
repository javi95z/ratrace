/**
 * The time a balance test is given to play its lives: three times what it takes on a developer's machine at rest. A CI runner's few slower cores play the
 * same lives in about twice the time, and a machine busy with other work does no better. A test that runs out of time says nothing of the balance.
 */
export function slow(ms: number): number {
  return ms * 3;
}
