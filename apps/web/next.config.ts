import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  reactStrictMode: true,
  // The engine and the content are TypeScript sources in this workspace.
  transpilePackages: ['@ratrace/engine', '@ratrace/content'],
};

export default withNextIntl(config);
