import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/i18n/metadata';

/** Everything may be read but what is not a page; the sitemap says where the pages are. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    sitemap: new URL('/sitemap.xml', SITE_URL).href,
  };
}
