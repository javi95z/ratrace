import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Links and navigation that keep the visitor in their language. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
