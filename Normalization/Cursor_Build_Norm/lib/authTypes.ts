export type UserRole = 'admin' | 'reviewer';

export interface AuthUser {
  username: string;
  role: UserRole;
}

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}
