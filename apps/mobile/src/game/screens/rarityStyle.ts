import type { BadgeRarity } from '@ratrace/content';
import { COLORS, EXTRA } from '../../ui/theme';

/**
 * The colour each rarity is named in, after its rim: bronze, gold and the gem's green. The web names the silver one `text-ink-100`, which is
 * no colour of its palette (`--color-*: initial` leaves only the 31), so that line keeps the colour of the one it is in: null here.
 */
export const RARITY_TONE: Record<BadgeRarity, string | null> = { common: EXTRA.bronze, uncommon: null, rare: COLORS['gold-500'], legendary: COLORS['teal-300'] };

/**
 * The glow round a badge card of each rarity, as the box-shadow the web draws it with: none for bronze, then a rim of light that grows. The web's
 * card is `frame frame-gold`, and its frame draws the glow under its strips (`--glow`, globals.css); the phone lays it under the card (`Glow`).
 */
export const RARITY_GLOW: Record<BadgeRarity, string> = {
  common: '',
  uncommon: EXTRA.glow.uncommon,
  rare: EXTRA.glow.rare,
  legendary: EXTRA.glow.legendary,
};
