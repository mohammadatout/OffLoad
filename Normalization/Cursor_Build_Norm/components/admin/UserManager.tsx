'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserRole } from '@/lib/authTypes';
import { ManagedUser, createUser, fetchUsers, updateUser } from '@/lib/usersApi';

const inputStyle = {
  borderColor: '#E5E3DC',
  color: '#080D44',
  background: '#FFFFFF',
} as const;

export default function UserManager() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('reviewer');
  const [resetDrafts, setResetDrafts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setUsers(await fetchUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    setError('');
    setMessage('');
    try {
      const created = await createUser(newUsername.trim(), newPassword, newRole);
      setMessage(`Created ${created.username} as ${created.role}.`);
      setNewUsername('');
      setNewPassword('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the user.');
    }
  }

  async function handleUpdate(
    user: ManagedUser,
    update: { role?: UserRole; is_active?: boolean; password?: string },
    successMessage: string
  ) {
    setBusyId(user.id);
    setError('');
    setMessage('');
    try {
      await updateUser(user.id, update);
      setMessage(successMessage);
      setResetDrafts((prev) => ({ ...prev, [user.id]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update the user.');
    } finally {
      setBusyId(null);
    }
  }

  const canCreate = newUsername.trim().length > 0 && newPassword.length >= 8;

  return (
    <section
      className="rounded-md border p-4"
      style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
    >
      <h2 className="text-[13px] font-medium" style={{ color: '#080D44' }}>
        Users
      </h2>
      <p className="text-[11px] mt-1" style={{ color: '#6B6B66' }}>
        Reviewers can approve matches below 95%. Only admins clear the high-confidence queue,
        delete matches, and import reference data.
      </p>

      {error && (
        <p className="text-[11px] mt-2" style={{ color: '#A12622' }}>
          {error}
        </p>
      )}
      {message && (
        <p className="text-[11px] mt-2" style={{ color: '#2C6E3F' }}>
          {message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: '#6B6B66' }}>
            Username
          </span>
          <input
            value={newUsername}
            onChange={(event) => setNewUsername(event.target.value)}
            className="h-9 px-3 rounded border text-[12px] w-[180px]"
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: '#6B6B66' }}>
            Password (8+ characters)
          </span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="h-9 px-3 rounded border text-[12px] w-[200px]"
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: '#6B6B66' }}>
            Role
          </span>
          <select
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as UserRole)}
            className="h-9 px-2 rounded border text-[12px]"
            style={inputStyle}
          >
            <option value="reviewer">reviewer</option>
            <option value="admin">admin</option>
          </select>
        </label>

        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="h-9 px-4 rounded-full text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#080D44', color: '#F4F3EE' }}
        >
          Add user
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead style={{ background: '#F8F7F4', color: '#6B6B66' }}>
            <tr>
              <th className="text-left px-3 py-2 font-medium">Username</th>
              <th className="text-left px-3 py-2 font-medium">Role</th>
              <th className="text-left px-3 py-2 font-medium">Active</th>
              <th className="text-left px-3 py-2 font-medium">Created</th>
              <th className="text-left px-3 py-2 font-medium">Reset password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t" style={{ borderColor: '#F0EEE9' }}>
                <td className="px-3 py-2" style={{ color: '#080D44' }}>
                  {user.username}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={user.role}
                    disabled={busyId === user.id}
                    onChange={(event) =>
                      handleUpdate(
                        user,
                        { role: event.target.value as UserRole },
                        `${user.username} is now ${event.target.value}.`
                      )
                    }
                    className="h-7 px-1.5 rounded border text-[11px]"
                    style={inputStyle}
                  >
                    <option value="reviewer">reviewer</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() =>
                      handleUpdate(
                        user,
                        { is_active: !user.is_active },
                        user.is_active
                          ? `${user.username} deactivated and signed out.`
                          : `${user.username} reactivated.`
                      )
                    }
                    disabled={busyId === user.id}
                    className="h-6 px-2 rounded text-[10px] disabled:opacity-50"
                    style={{
                      border: '1px solid #E5E3DC',
                      color: user.is_active ? '#2C6E3F' : '#A12622',
                    }}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-3 py-2" style={{ color: '#6B6B66' }}>
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="password"
                      value={resetDrafts[user.id] ?? ''}
                      onChange={(event) =>
                        setResetDrafts((prev) => ({ ...prev, [user.id]: event.target.value }))
                      }
                      placeholder="New password"
                      className="h-7 px-2 rounded border text-[11px] w-[150px]"
                      style={inputStyle}
                    />
                    <button
                      onClick={() =>
                        handleUpdate(
                          user,
                          { password: resetDrafts[user.id] },
                          `Password reset for ${user.username}. Their sessions were ended.`
                        )
                      }
                      disabled={busyId === user.id || (resetDrafts[user.id] ?? '').length < 8}
                      className="h-7 px-2 rounded text-[10px] disabled:opacity-40"
                      style={{ border: '1px solid #E5E3DC', color: '#080D44' }}
                    >
                      Reset
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center" style={{ color: '#6B6B66' }}>
                  {isLoading ? 'Loading users…' : 'No users yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
