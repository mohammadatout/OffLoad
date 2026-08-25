import { API_BASE, HEAVY_API_BASE } from './apiBase';
import { MatchConfig, MatchRunResponse } from './matchingTypes';

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runMatching(
  internalFile: File,
  externalFile: File,
  config: MatchConfig
): Promise<MatchRunResponse> {
  const formData = new FormData();
  formData.append('internal_file', internalFile);
  formData.append('external_file', externalFile);
  formData.append('config', JSON.stringify(config));

  // Direct to the API: match runs on large files outlast the dev proxy.
  const res = await fetch(`${HEAVY_API_BASE}/match/run`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Matcher API returned ${res.status}`);
  }

  const payload = (await res.json()) as MatchRunResponse;
  return {
    results: payload.results ?? [],
    stats: payload.stats,
    library_hits: payload.library_hits ?? 0,
    newly_staged: payload.newly_staged ?? 0,
    suppressed: payload.suppressed ?? 0,
  };
}
