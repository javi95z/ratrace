import type { ViewProps } from 'react-native';

/*
 * The web export's twin of `headingLevel.ts` (Metro picks it for the web): react-native-web draws a header with an `aria-level` as that `<h…>`, so a
 * page has one `<h1>`, as the Next web's, and the rest under it at the Next web's levels.
 */

/** A heading of the second level: an `<h2>`. */
export const LEVEL_2 = { 'aria-level': 2 } as ViewProps;
/** A heading of the third level: an `<h3>`. */
export const LEVEL_3 = { 'aria-level': 3 } as ViewProps;
