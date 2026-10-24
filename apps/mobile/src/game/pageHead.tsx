import type { Page } from './pageList';

/**
 * What a page tells a search and a shared link, in the document's head: only the web has one (`pageHead.web.tsx`); on the phone a page says nothing
 * of the kind.
 */
export const PageHead: (props: { page: Page }) => null = () => null;
