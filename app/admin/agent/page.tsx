'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AgentSetupPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/agent').then(res => res.json()).then(data => {
      if (data.agents) setAgents(data.agents);
    });
  }, []);

  const handleCreate = async () => {
    if (!name) return;
    setLoading(true);
    const res = await fetch('/api/admin/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.agent) {
      setAgents([...agents, data.agent]);
      setName('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sticky top-0 z-10 flex items-center">
        <Link href="/" className="mr-4 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        </Link>
        <h1 className="text-xl font-bold">OpenClaw AI 에이전트 연동</h1>
      </div>
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold mb-2">새로운 AI 에이전트 봇 만들기</h2>
          <p className="text-sm text-gray-500 mb-4">내 PC에서 OpenClaw AI 에이전트를 실행하여 알로팝 채팅으로 작업을 지시할 수 있습니다.</p>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="예: 회사 업무용 PC" 
              className="flex-1 px-4 py-2 border rounded-xl dark:bg-gray-900 dark:border-gray-700"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <button 
              onClick={handleCreate}
              disabled={loading || !name}
              className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-50"
            >
              생성
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold px-2">나의 AI 에이전트 목록</h2>
          {agents.length === 0 && <p className="text-gray-500 px-2">등록된 봇이 없습니다.</p>}
          {agents.map(agent => (
            <div key={agent.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{agent.username}</h3>
                  <p className="text-xs text-gray-400">생성일: {new Date(agent.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                  연결 대기중
                </div>
              </div>
              
              <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-xl">
                <p className="text-sm font-semibold mb-2">💻 아래 명령어를 한 번에 복사해서 PC의 PowerShell에 붙여넣으세요.</p>
                <div className="relative">
                  <pre className="text-xs text-blue-400 font-mono overflow-x-auto p-3 bg-gray-950 rounded-lg whitespace-pre-wrap">
                    {`cd 'c:\\home'; Invoke-WebRequest -Uri 'https://alopop.alonics.com/openclaw-bridge.js?v=$([DateTimeOffset]::Now.ToUnixTimeSeconds())' -OutFile openclaw-bridge.js -UseBasicParsing; node openclaw-bridge.js --server=https://alopop.alonics.com --token=${agent.agentToken}`}
                  </pre>
                  <button 
                    onClick={() => navigator.clipboard.writeText(`cd 'c:\\home'; Invoke-WebRequest -Uri 'https://alopop.alonics.com/openclaw-bridge.js?v=$([DateTimeOffset]::Now.ToUnixTimeSeconds())' -OutFile openclaw-bridge.js -UseBasicParsing; node openclaw-bridge.js --server=https://alopop.alonics.com --token=${agent.agentToken}`)}
                    className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded-md text-white text-xs"
                  >
                    복사
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  * 한 줄짜리 명령어입니다. 전체를 복사해서 한 번에 붙여넣으세요.<br/>
                  * 에이전트가 멈추면 채팅에서 <strong className="text-yellow-400">!중지</strong> 를 입력하세요. (5분 무응답 시 자동 복구됩니다)<br/>
                  * PowerShell 창을 닫으면 봇이 멈춥니다. 다시 시작하려면 명령어를 다시 실행하세요.
                </p>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 mt-3">
                  <p className="text-[11px] text-amber-600 dark:text-amber-300">⚠️ <strong>필수:</strong> PC에서 <strong>OpenClaw Gateway</strong>가 실행 중이어야 합니다. 미설치 시 <code className="bg-black/20 dark:bg-black/30 px-1 rounded">openclaw gateway install</code> → <code className="bg-black/20 dark:bg-black/30 px-1 rounded">openclaw gateway start</code></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
