import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#F4F3EE', color: '#080D44' }}
    >
      <section
        className="w-full max-w-md border rounded-xl p-7"
        style={{ borderColor: '#E5E3DC', background: '#FFFFFF' }}
      >
        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: '#6B6B66' }}>
            OffLoad
          </p>
          <h1 className="text-[24px] font-medium mt-1">Sign In</h1>
          <p className="text-[12px] mt-1.5" style={{ color: '#6B6B66' }}>
            Continue to your workspace.
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
