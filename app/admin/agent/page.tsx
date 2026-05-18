'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Terminal } from 'lucide-react';

type Agent = {
  id: string;
  username: string;
  createdAt: string;
  agentToken: string;
};

export default function AgentSetupPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/agent')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.agents)) setAgents(data.agents as Agent[]);
      })
      .catch(() => setAgents([]));
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (data.agent) {
        setAgents([...agents, data.agent as Agent]);
        setName('');
      }
    } finally {
      setLoading(false);
    }
  };

  const commandFor = (token: string) =>
    `cd 'c:\\home'; Invoke-WebRequest -Uri 'https://alopop.alonics.com/openclaw-bridge.js?v=$([DateTimeOffset]::Now.ToUnixTimeSeconds())' -OutFile openclaw-bridge.js -UseBasicParsing; node openclaw-bridge.js --server=https://alopop.alonics.com --token=${token}`;

  return (
    <main className="alo-mobile-shell overflow-y-auto">
      <div className="alo-mobile-frame pb-12">
        <header className="mb-6 flex items-center gap-3">
          <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/75">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-[var(--alo-accent-mint)]">Private Night Tool</p>
            <h1 className="text-xl font-black tracking-[-0.04em]">OpenClaw AI 에이전트 연동</h1>
          </div>
        </header>

        <section className="alo-card mb-7 p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[var(--alo-accent-mint)]">
            <Terminal size={22} />
          </div>
          <h2 className="mb-2 text-lg font-black tracking-[-0.04em]">새로운 AI 에이전트 봇 만들기</h2>
          <p className="mb-5 text-sm leading-relaxed text-[var(--alo-text-muted)]">
            내 PC에서 실행되는 OpenClaw 에이전트를 알로팝 채팅방에 연결합니다.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="예: 회사 업무용 PC"
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/35 focus:border-[var(--alo-accent-mint)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="alo-primary-action min-w-[82px] px-4 text-sm disabled:opacity-45"
            >
              {loading ? '생성 중' : '생성'}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="px-1 text-lg font-black tracking-[-0.04em]">나의 AI 에이전트 목록</h2>
          {agents.length === 0 && (
            <div className="alo-card p-6 text-center text-sm font-bold text-[var(--alo-text-muted)]">
              등록된 봇이 없습니다.
            </div>
          )}
          {agents.map((agent) => {
            const command = commandFor(agent.agentToken);
            return (
              <article key={agent.id} className="alo-card p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black tracking-[-0.04em]">{agent.username}</h3>
                    <p className="mt-1 text-xs text-[var(--alo-text-soft)]">
                      생성일: {new Date(agent.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full border border-[rgba(98,250,227,0.25)] bg-[rgba(98,250,227,0.1)] px-3 py-1 text-[11px] font-black text-[var(--alo-accent-mint)]">
                    연결 대기
                  </span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="mb-3 text-sm font-black">PC PowerShell에 아래 명령어를 붙여넣으세요.</p>
                  <div className="relative">
                    <pre className="max-h-44 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-black/55 p-3 pr-12 font-mono text-[11px] leading-relaxed text-[var(--alo-accent-mint)]">
                      {command}
                    </pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(command)}
                      className="absolute right-2 top-2 rounded-xl bg-white/10 p-2 text-white"
                      aria-label="명령어 복사"
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-[var(--alo-text-muted)]">
                    에이전트가 멈추면 채팅에서 <strong className="text-[var(--alo-accent-mint)]">!중지</strong>를 입력하세요. 5분 무응답 시 자동 복구됩니다.
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
