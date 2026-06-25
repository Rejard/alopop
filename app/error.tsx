'use client';

import { useEffect } from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';
import { reportCaughtError } from '@/lib/client-diagnostics';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to diagnostics API
    reportCaughtError({
      area: 'client_runtime',
      error: error,
      metadata: { digest: error.digest ?? '' },
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0d0913] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="bg-[#150f1d] border border-zinc-800 p-8 rounded-3xl max-w-md w-full shadow-2xl flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 animate-bounce">
          <ShieldAlert size={36} />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-white tracking-tight">앗! 시스템 오류가 발생했습니다</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            화면을 불러오는 중 예기치 못한 문제가 발생했습니다.<br />
            아래 버튼을 눌러 다시 시도해 주시기 바랍니다.
          </p>
        </div>

        {error.digest && (
          <div className="font-mono text-[10px] text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-lg border border-white/5">
            Error Digest: {error.digest}
          </div>
        )}

        <button
          onClick={() => reset()}
          className="w-full bg-emerald-400 hover:bg-emerald-500 text-zinc-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
        >
          <RotateCcw size={16} />
          다시 시도하기
        </button>
      </div>
    </div>
  );
}
