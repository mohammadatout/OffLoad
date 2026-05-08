import { MatchConfig, MatchResult, MatchStats } from './matchingTypes';

const API_BASE = '/api/matcher';

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function runMatching(
  internalFile: File,
  externalFile: File,
  config: MatchConfig
): Promise<{ results: MatchResult[]; stats: MatchStats }> {
  const formData = new FormData();
  formData.append('internal_file', internalFile);
  formData.append('external_file', externalFile);
  formData.append('config', JSON.stringify(config));

  const res = await fetch(`${API_BASE}/match`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Matcher API returned ${res.status}`);
  }

  return res.json();
}
