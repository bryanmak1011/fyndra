// Thin wrapper around Apify's REST API for running a third-party actor
// synchronously and reading back its dataset — used to source JobsDB HK
// and 104.com.tw (see BLOCKERS.md 2026-09-10: neither site has a workable
// direct-fetch path, so a verified third-party actor stands in for a
// provider we'd otherwise write ourselves). Docs:
// https://docs.apify.com/api/v2/act-run-sync-get-dataset-items-post
export interface ApifyConfig {
  apiToken: string;
}

export class ApifyRunError extends Error {}

const RUN_TIMEOUT_MS = 120_000;

export interface ApifyClient {
  runActorSync<T>(actorId: string, input: Record<string, unknown>): Promise<T[]>;
}

export function createApifyClient(config: ApifyConfig): ApifyClient {
  return {
    async runActorSync<T>(actorId: string, input: Record<string, unknown>): Promise<T[]> {
      const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
      });

      if (!response.ok) {
        const rawText = await response.text();
        throw new ApifyRunError(`Apify actor ${actorId} run failed (HTTP ${response.status}): ${rawText.slice(0, 500)}`);
      }

      return response.json() as Promise<T[]>;
    },
  };
}
