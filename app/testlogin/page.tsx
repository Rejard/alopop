'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, LogIn } from 'lucide-react';

const TEST_USERS = [
  'test01',
  'test02',
  'test03',
  'test04',
  'test05',
  'test06',
  'test07',
  'test08',
  'test09',
  'test10',
];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function TestLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('test01');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) throw new Error('테스트 로그인 정보가 맞지 않습니다.');

      const user = await response.json();
      localStorage.setItem('alo_user', JSON.stringify(user));
      window.dispatchEvent(new Event('alo-user-change'));
      router.push('/');
    } catch (error) {
      alert(getErrorMessage(error, '테스트 로그인 처리 중 오류가 발생했습니다.'));
      setIsLoading(false);
    }
  };

  return (
    <main className="alo-mobile-shell overflow-y-auto">
      <div className="alo-mobile-frame flex min-h-[100dvh] items-center">
        <section className="alo-card-strong w-full p-6">
          <div className="mb-7 flex items-center gap-3">
            <div className="alo-logo-tile h-12 w-12 text-[18px]">alo</div>
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-[var(--alo-accent-mint)]">Temporary Access</p>
              <h1 className="text-2xl font-black tracking-[-0.05em] text-white">테스트 로그인</h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="test-user" className="mb-2 block text-xs font-black text-[var(--alo-text-muted)]">
                테스트 계정
              </label>
              <select
                id="test-user"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-base font-black text-white outline-none focus:border-[var(--alo-accent-mint)]"
              >
                {TEST_USERS.map((user) => (
                  <option key={user} value={user} className="bg-[#111827] text-white">
                    {user}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="test-password" className="mb-2 block text-xs font-black text-[var(--alo-text-muted)]">
                비밀번호
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 focus-within:border-[var(--alo-accent-mint)]">
                <KeyRound size={19} className="text-[var(--alo-text-soft)]" />
                <input
                  id="test-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="1234"
                  className="min-h-[46px] flex-1 bg-transparent text-base font-black text-white outline-none placeholder:text-white/25"
                />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="alo-primary-action min-h-[58px] w-full gap-2 text-[16px] disabled:opacity-50">
              <LogIn size={19} />
              {isLoading ? '로그인 중...' : '임시 로그인'}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-[var(--alo-text-soft)]">
            Google 로그인이 어려운 환경에서만 사용하는 임시 접근 경로입니다.
          </p>
        </section>
      </div>
    </main>
  );
}
