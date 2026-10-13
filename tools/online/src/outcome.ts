export interface Outcome {
  passed: number;
  failed: string[];
}

/**
 * Reads the outcome out of whatever the CLI printed. Null if the block never reached its end.
 * The CLI wraps the database's message in JSON inside JSON, so its quotes arrive escaped once, twice or three times.
 */
export function outcomeOf(text: string): Outcome | null {
  const found = /SECURITY_TESTS (\{.*?"failed"\s*:\s*\[.*?\]\s*\})/s.exec(text.replace(/\\+"/g, '"'));
  if (!found) return null;
  try {
    return JSON.parse(found[1]) as Outcome;
  } catch {
    return null;
  }
}
