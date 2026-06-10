import type { MetadataRoute } from 'next';

/**
 * Robots.txt dinâmico.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/checkout/sucesso', '/api/'],
      },
    ],
    sitemap: 'https://gtsofthub.com.br/sitemap.xml',
  };
}
