import type { ViewProps } from 'react-native';

/*
 * The level of a heading under the page's own (`accessibilityRole="header"`), as the Next web writes it: `<h2>` for a panel's tab, the news, a sheet's
 * title, a section of a page; `<h3>` under one of those. A page has one `<h1>`, its title. The phone's screen readers know no levels: nothing here
 * (the web: `headingLevel.web.ts`).
 */

/** A heading of the second level (the web's `<h2>`). */
export const LEVEL_2: ViewProps = {};
/** A heading of the third level (the web's `<h3>`). */
export const LEVEL_3: ViewProps = {};
