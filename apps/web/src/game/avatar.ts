/**
 * The rat a player plays as, in the rooms and wherever others see them: one of a few colours, kept
 * in the profile's `portrait` as `rat_<colour>`. Someone who never chose has one all the same, the
 * same every time, from who they are.
 */
export const RAT_COLOURS = ['gold', 'teal', 'wine', 'sky', 'coral', 'emerald', 'cream', 'slate'] as const;
export type RatColour = (typeof RAT_COLOURS)[number];

/** How a colour is kept in the profile. */
export const avatarOf = (colour: RatColour): string => `rat_${colour}`;

/** The colour of a player: the one they chose, or one picked for them from their id. */
export function ratColourOf(portrait: string | null | undefined, userId: string): RatColour {
  const chosen = portrait?.startsWith('rat_') ? portrait.slice(4) : null;
  if (chosen && (RAT_COLOURS as readonly string[]).includes(chosen)) return chosen as RatColour;
  let mix = 0;
  for (const char of userId) mix = (mix * 31 + char.charCodeAt(0)) >>> 0;
  return RAT_COLOURS[mix % RAT_COLOURS.length];
}
