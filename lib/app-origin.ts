export const OFFICIAL_APP_URL = 'https://bwpnexo.it.com';
export const OFFICIAL_APP_DOMAIN = 'bwpnexo.it.com';

export function resolveAppOrigin(environment: string | undefined, configuredUrl?: string): string {
  // Deployment URLs, Host/Origin headers and a leftover local .env must never
  // change the destination of production verification and recovery links.
  if (environment === 'production') return OFFICIAL_APP_URL;
  const url = new URL(configuredUrl || 'http://localhost:3000');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol) || (!local && url.origin !== OFFICIAL_APP_URL)) {
    throw new Error('APP_URL debe ser una dirección local de desarrollo o https://bwpnexo.it.com.');
  }
  return url.origin;
}

export function getAppOrigin(): string {
  return resolveAppOrigin(process.env.NODE_ENV, process.env.APP_URL);
}
