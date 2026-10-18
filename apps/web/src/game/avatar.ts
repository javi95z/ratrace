/**
 * The rat a player plays as, in the rooms and wherever others see them, kept in the profile's
 * `portrait`. It is built in layers, back to front: the colour of the ground, a backdrop, the rat
 * itself, and what it wears on its body, its eyes and its head.
 *
 * Kept as `rat_x` and one letter a layer (`rat_x305200`): the database takes nothing but lower-case
 * letters, digits and underscores. An older `rat_<colour>` is still read, as that colour and a rat
 * picked for the player. Someone who never chose has one all the same, the same every time, from who
 * they are.
 */
export const RAT_COLOURS = ['gold', 'teal', 'wine', 'sky', 'coral', 'emerald', 'cream', 'slate'] as const;
export type RatColour = (typeof RAT_COLOURS)[number];

export const RAT_BODIES = ['grey', 'brown', 'white', 'black', 'ginger', 'golden', 'slate', 'spotted'] as const;
export const RAT_OUTFITS = ['suit', 'tracksuit', 'tuxedo', 'hoodie', 'scrubs', 'hivis', 'chef', 'leather', 'lab', 'sweater', 'hawaiian', 'varsity', 'robe', 'kimono', 'fur', 'gold'] as const;
export const RAT_HATS = ['cap', 'beanie', 'beret', 'hardhat', 'cowboy', 'headphones', 'bandana', 'chef', 'tophat', 'crown', 'graduate', 'party', 'viking', 'flowers', 'wizard', 'halo'] as const;
export const RAT_EYES = ['sunglasses', 'round', 'aviators', 'monocle', 'patch', 'visor', 'moustache', 'heart'] as const;
export const RAT_BACKDROPS = ['stars', 'city', 'coins', 'chart', 'cheese', 'confetti', 'wheel', 'beach'] as const;

/** The layers a player chooses from, and what each may be. A layer other than the body may be left bare. */
export const RAT_LAYERS = { body: RAT_BODIES, outfit: RAT_OUTFITS, hat: RAT_HATS, eyes: RAT_EYES, backdrop: RAT_BACKDROPS } as const;
export type RatLayer = keyof typeof RAT_LAYERS;

export interface RatLook {
  colour: RatColour;
  body: (typeof RAT_BODIES)[number];
  outfit: (typeof RAT_OUTFITS)[number] | null;
  hat: (typeof RAT_HATS)[number] | null;
  eyes: (typeof RAT_EYES)[number] | null;
  backdrop: (typeof RAT_BACKDROPS)[number] | null;
}

/** The sprite of a piece of the rat. */
export const ratSprite = (layer: RatLayer, piece: string): string => `rat.${layer}.${piece}`;

/**
 * Pieces kept for what a player has done in their lives, by the badge that opens each. The rest are
 * for everyone.
 */
export const RAT_PRIZES: Partial<Record<`${RatLayer}.${string}`, string>> = {
  'hat.crown': 'escaped',
  'outfit.gold': 'escaped',
  'hat.tophat': 'millionaire',
  'hat.graduate': 'mba',
  'hat.halo': 'truly_innocent',
};

/** The badge a piece asks for, or null when it is free. */
export const prizeOf = (layer: RatLayer, piece: string): string | null => RAT_PRIZES[`${layer}.${piece}`] ?? null;

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

/** How a look is kept in the profile. */
export function avatarOf(look: RatLook): string {
  const optional = (list: readonly string[], piece: string | null) => DIGITS[piece === null ? 0 : list.indexOf(piece) + 1];
  return [
    'rat_x',
    DIGITS[RAT_BODIES.indexOf(look.body)],
    optional(RAT_OUTFITS, look.outfit),
    optional(RAT_HATS, look.hat),
    optional(RAT_EYES, look.eyes),
    optional(RAT_BACKDROPS, look.backdrop),
    DIGITS[RAT_COLOURS.indexOf(look.colour)],
  ].join('');
}

/** A number from the player's id, the same every time; `salt` gives another. */
function mixOf(userId: string, salt: number): number {
  let mix = salt;
  for (const char of userId) mix = (mix * 31 + char.charCodeAt(0)) >>> 0;
  return mix;
}

/** The rat given to a player who has not chosen one. */
function givenLook(userId: string): RatLook {
  return {
    colour: RAT_COLOURS[mixOf(userId, 0) % RAT_COLOURS.length],
    body: RAT_BODIES[mixOf(userId, 7) % RAT_BODIES.length],
    outfit: null,
    hat: null,
    eyes: null,
    backdrop: null,
  };
}

/** The look of a player: the one they chose, or one picked for them from their id. Anything not understood is left to the pick. */
export function ratLookOf(portrait: string | null | undefined, userId: string): RatLook {
  const given = givenLook(userId);
  if (!portrait?.startsWith('rat_')) return given;
  const rest = portrait.slice(4);
  if ((RAT_COLOURS as readonly string[]).includes(rest)) return { ...given, colour: rest as RatColour };
  if (!/^x[0-9a-z]{6}$/.test(rest)) return given;
  const at = (i: number) => DIGITS.indexOf(rest[i + 1]);
  const required = <T>(list: readonly T[], i: number, fallback: T): T => list[at(i)] ?? fallback;
  const optional = <T>(list: readonly T[], i: number): T | null => (at(i) === 0 ? null : (list[at(i) - 1] ?? null));
  return {
    body: required(RAT_BODIES, 0, given.body),
    outfit: optional(RAT_OUTFITS, 1),
    hat: optional(RAT_HATS, 2),
    eyes: optional(RAT_EYES, 3),
    backdrop: optional(RAT_BACKDROPS, 4),
    colour: required(RAT_COLOURS, 5, given.colour),
  };
}

/** The colour of a player's ground. */
export const ratColourOf = (portrait: string | null | undefined, userId: string): RatColour => ratLookOf(portrait, userId).colour;
