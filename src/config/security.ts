export const analytics = {
  script: 'https://cloud.umami.is/script.js',
  collector: 'https://gateway.umami.is',
  websiteId: '72126cdf-b4c4-49ba-8661-a3eca4d7d688',
} as const;

export const ana = { endpoint: 'https://secretary.danilostoletovic.com/chat' } as const;
const cloudflareBeacon = 'https://static.cloudflareinsights.com/beacon.min.js';

export function securityHeaders(themeHash: string) {
  const directives = {
    'default-src': ["'none'"],
    'base-uri': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'", 'mailto:'],
    'script-src': ["'self'", `'sha256-${themeHash}'`, analytics.script, cloudflareBeacon, cloudflareBeacon + '/'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:'],
    'font-src': ["'self'"],
    'manifest-src': ["'self'"],
    'connect-src': ["'self'", analytics.collector, new URL(ana.endpoint).origin],
  } satisfies Record<string, readonly string[]>;

  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Strict-Transport-Security': 'max-age=31536000',
    'Content-Security-Policy': Object.entries(directives).map(([key, sources]) => `${key} ${sources.join(' ')}`).join('; '),
  } as const;
}
