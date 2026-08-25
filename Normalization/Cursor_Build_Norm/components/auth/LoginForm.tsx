'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/authApi';

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(username, password);
      router.replace('/workspace');
      router.refresh();
    } catch {
      setError('Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="username" className="block text-[12px] font-medium mb-1.5" style={{ color: '#080D44' }}>
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="w-full h-11 px-3 rounded-md border text-[13px] focus:outline-none focus:ring-2"
          style={{ borderColor: '#D5D3CC', color: '#080D44', background: '#FFFFFF' }}
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-[12px] font-medium mb-1.5" style={{ color: '#080D44' }}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full h-11 px-3 rounded-md border text-[13px] focus:outline-none focus:ring-2"
          style={{ borderColor: '#D5D3CC', color: '#080D44', background: '#FFFFFF' }}
          required
        />
      </div>

      {error && (
        <p className="text-[11px]" style={{ color: '#A12622' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-11 rounded-full text-[13px] font-medium transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: '#080D44', color: '#F4F3EE' }}
      >
        {isSubmitting ? 'Signing In...' : 'Sign In'}
      </button>
    </form>
  );
}
