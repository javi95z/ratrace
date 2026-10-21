import type { BadgeRarity } from '@ratrace/content';
import { COLORS, EXTRA } from '../../ui/theme';

/**
 * The colour each rarity is named in, after its rim: bronze, gold and the gem's green. The web names the silver one `text-ink-100`, which is
 * no colour of its palette (`--color-*: initial` leaves only the 31), so that line keeps the colour of the one it is in: null here.
 */
export const RARITY_TONE: Record<BadgeRarity, string | null> = { common: EXTRA.bronze, uncommon: null, rare: COLORS['gold-500'], legendary: COLORS['teal-300'] };

/**
 * The glow the web asks for round a badge card of each rarity, as its box-shadow: none for bronze, then a rim of light that grows. The card is
 * also `frame frame-gold`, and `frame` is a box-shadow of the same layer that comes later in the web's stylesheet, so the card is drawn with its
 * gold frame and no glow at all: the phone draws the frame, and this is kept as the web's word for when it draws the glow.
 */
export const RARITY_GLOW: Record<BadgeRarity, string> = {
  common: '',
  uncommon: EXTRA.glow.uncommon,
  rare: EXTRA.glow.rare,
  legendary: EXTRA.glow.legendary,
};
