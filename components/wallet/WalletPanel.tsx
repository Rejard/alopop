"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Loader2, LogOut, Send } from "lucide-react";

export function WalletTransactionList() {
  const [activeTxTab, setActiveTxTab] = useState<'USAGE' | 'TRANSFER'>('USAGE');
  const allTransactions = useLiveQuery(() => db.walletTx?.orderBy('createdAt').reverse().toArray());

  if (!allTransactions) return <div className="text-zinc-500 text-xs text-center py-4 flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" />로컬 장부 불러오는 중...</div>;

  const transactions = allTransactions.filter((tx: any) =>
    activeTxTab === 'TRANSFER' ? tx.category === 'P2P_TRANSFER' : tx.category !== 'P2P_TRANSFER'
  );

  return (
    <div className="space-y-4 mb-20 flex flex-col h-full">
      {/* 탭 버튼들 */}
      <div className="flex bg-surface-container rounded-lg p-1">
        <button
          onClick={() => setActiveTxTab('USAGE')}
          className={`flex-1 py-1.5 text-[11px] font-bold tracking-wider rounded-md transition-all ${activeTxTab === 'USAGE' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-white'}`}
        >
          AI 사용 내역
        </button>
        <button
          onClick={() => setActiveTxTab('TRANSFER')}
          className={`flex-1 py-1.5 text-[11px] font-bold tracking-wider rounded-md transition-all ${activeTxTab === 'TRANSFER' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-white'}`}
        >
          P2P 송금 내역
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="text-zinc-500 text-xs text-center py-8 bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30">
          해당 카테고리에 기록된 거래 내역이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx: any) => (
            <div key={tx.id} className="bg-surface-container-low p-3.5 rounded-xl flex items-center justify-between border border-outline-variant/20 shadow-sm transition-all hover:bg-surface-variant">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-inner ${tx.type === 'SPEND' ? 'bg-error/10 text-error border border-error/20' : 'bg-tertiary/10 text-tertiary border border-tertiary/20'}`}>
                  {tx.type === 'SPEND' ? <LogOut size={14} className="" /> : <Send size={14} className="rotate-180" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-on-surface tracking-tight">{tx.description}</span>
                  <span className="text-[10px] text-on-surface-variant">{new Date(tx.createdAt).toLocaleString('ko-KR')}</span>
                </div>
              </div>
              <div className={`font-mono font-bold text-sm tracking-tighter ${tx.type === 'SPEND' ? 'text-error' : 'text-tertiary'}`}>
                {tx.type === 'SPEND' ? '-' : '+'} {tx.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
