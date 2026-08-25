import { API_BASE } from './apiBase';
import { UserRole } from './authTypes';

export interface ManagedUser {
  id: number;
  username: string;
  role: UserRole;
  is_active: number;
  created_at: string;
  created_by: string | null;
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

async function checkedFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { credentials: 'include', ...init });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response;
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  const response = await checkedFetch(`${API_BASE}/users`);
  return (await response.json()) as ManagedUser[];
}

export async function createUser(
  username: string,
  password: string,
  role: UserRole
): Promise<ManagedUser> {
  const response = await checkedFetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
  });
  return (await response.json()) as ManagedUser;
}

export async function updateUser(
  userId: number,
  update: { role?: UserRole; is_active?: boolean; password?: string }
): Promise<ManagedUser> {
  const response = await checkedFetch(`${API_BASE}/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  return (await response.json()) as ManagedUser;
}
