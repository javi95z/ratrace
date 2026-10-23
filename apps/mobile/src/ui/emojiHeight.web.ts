import { X_HEIGHT } from './fontCoverage';

/**
 * The web's twin of `emojiHeight.ts`. Chrome draws an emoji in a pixel text as large as it draws Jersey: measured on the Next web's page, the dice
 * under `font-size-adjust: 0.56` is 1.37455 times its size at 1000 px, Jersey's own 0.56 / (11/27), where iOS draws it 1.103 times. The app's web
 * is drawn by Chrome too, so its emoji take Jersey's small-letter height.
 */
export const EMOJI_X_HEIGHT = X_HEIGHT.Jersey15_400Regular;
