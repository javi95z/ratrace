import type { BadgeRarity } from '@ratrace/content';

/** The colour each rarity is named in, after its rim. */
export const RARITY_TONE: Record<BadgeRarity, string> = { common: 'text-[#c98a4b]', uncommon: 'text-ink-100', rare: 'text-gold-500', legendary: 'text-teal-300' };

/**
 * The glow round a badge card of each rarity: none for bronze, then a rim of light that grows. The card is a `frame`, whose
 * box-shadow draws it under its strips (`--glow`, globals.css): a `shadow-*` class there would lose to the frame's own.
 */
export const RARITY_GLOW: Record<BadgeRarity, string> = {
  common: '',
  uncommon: '[--glow:0_0_6px_rgba(240,230,210,0.35)]',
  rare: '[--glow:0_0_12px_rgba(233,177,60,0.6)]',
  legendary: '[--glow:0_0_20px_rgba(94,224,200,0.7)]',
};
