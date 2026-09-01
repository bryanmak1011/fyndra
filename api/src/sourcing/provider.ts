import { logger } from '../lib/logger.js';

// Identifies us honestly to every source we crawl — the opposite of the
// browser-spoofing shortcut this session explicitly declined to take for
// JobsDB HK. See SDD.md §6.3 and compliance/risk-acceptance-log.md.
const USER_AGENT = 'FyndraBot/0.1 (+https://github.com/bryanmak1011/fyndra)';

export class SsrfError extends Error {}

/** SSRF guard: only fetch a host this provider explicitly named as its own. */
export function assertAllowedHost(rawUrl: string, allowedHosts: ReadonlySet<string>): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) {
    throw new SsrfError(`Host not allowlisted for this provider: ${url.hostname}`);
  }
  return url;
}

/**
 * A single polite HTTP GET: honest User-Agent, honours `Retry-After` on
 * 429 with one retry, then gives up rather than hammering the source
 * (FR-016a — never work around a source that's telling us to back off).
 */
export async function politeFetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });

  if (response.status === 429) {
    const retryAfterSeconds = Number(response.headers.get('retry-after') ?? '5');
    logger.warn('provider_rate_limited', { host: url.hostname, retryAfterSeconds });
    await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
    const retry = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (!retry.ok) throw new Error(`${url.hostname} returned ${retry.status} after retry`);
    return retry.json() as Promise<T>;
  }

  if (!response.ok) {
    throw new Error(`${url.hostname} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}
