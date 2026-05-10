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
        <h1 className="text-xl font-bold">OpenClaw 원격 PC 연동</h1>
      </div>
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold mb-2">새로운 원격 PC 봇 만들기</h2>
          <p className="text-sm text-gray-500 mb-4">내 PC를 원격으로 제어할 수 있는 OpenClaw 봇을 생성합니다.</p>
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
          <h2 className="text-lg font-bold px-2">나의 OpenClaw 봇 목록</h2>
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
                <p className="text-sm font-semibold mb-2">💻 아래 명령어를 복사해서 PC 터미널(PowerShell)에 붙여넣으세요.</p>
                <div className="relative">
                  <pre className="text-xs text-blue-400 font-mono overflow-x-auto p-3 bg-gray-950 rounded-lg">
                    {`powershell -Command "cd 'c:\\home\\openAlo'; Invoke-WebRequest -Uri 'https://alopop.alonics.com/openclaw-bridge.js?v=$([DateTimeOffset]::Now.ToUnixTimeSeconds())' -OutFile openclaw-bridge.js -UseBasicParsing; node openclaw-bridge.js --server=https://alopop.alonics.com --token=${agent.agentToken}"`}
                  </pre>
                  <button 
                    onClick={() => navigator.clipboard.writeText(`powershell -Command "cd 'c:\\home\\openAlo'; Invoke-WebRequest -Uri 'https://alopop.alonics.com/openclaw-bridge.js?v=$([DateTimeOffset]::Now.ToUnixTimeSeconds())' -OutFile openclaw-bridge.js -UseBasicParsing; node openclaw-bridge.js --server=https://alopop.alonics.com --token=${agent.agentToken}"`)}
                    className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded-md text-white text-xs"
                  >
                    복사
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  * 실행 시 자동으로 필요한 패키지를 설치하고 서버에 연결됩니다.<br/>
                  * 연결이 완료되면 친구 목록에 이 봇이 표시되며 바로 대화(작업 지시)를 시작할 수 있습니다.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
