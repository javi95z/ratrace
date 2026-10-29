/*
 * The web's stand-in for Reanimated's layout animations on a page (react-native-reanimated/lib/module/layoutReanimation/web/index.js and its
 * domUtils.js, read in their place by metro.config.js): the game gives no component `entering`, `exiting` or `layout`, so their keyframes, the
 * stylesheet made of them and the code that plays them are never needed. Its animated components read only these. Were one given such an animation
 * after all, it would be taken as one the player asked to reduce: the component is shown at once, with no animation.
 */
export function configureWebLayoutAnimations() {}

export function addHTMLMutationObserver() {}

export function getReducedMotionFromConfig() {
  return true;
}

export function saveSnapshot() {}

export function startWebLayoutAnimation() {}

export function tryActivateLayoutTransition() {}
