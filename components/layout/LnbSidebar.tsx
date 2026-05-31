"use client";

import React from "react";
import { MessageSquare, Users, Wallet, Gamepad2, Building2, PawPrint, Crown, Bot, HelpCircle, Home as HomeIcon, ShieldPlus, Sprout, User as UserIcon } from "lucide-react";

export const PET365CARE_LNB_ITEMS = [
  { name: "홈", path: "/pet365care?view=home", icon: HomeIcon },
  { name: "소셜", path: "/pet365care/social", icon: Users },
  { name: "건강", path: "/pet365care/health", icon: ShieldPlus },
  { name: "케어", path: "/pet365care/care", icon: Sprout },
  { name: "프로필", path: "/pet365care/profile", icon: UserIcon },
];

interface LnbSidebarProps {
  currentTab: 'chats' | 'friends' | 'stats' | 'wallet' | 'games' | 'aistudio' | 'pet365care';
  setCurrentTab: (tab: 'chats' | 'friends' | 'stats' | 'wallet' | 'games' | 'aistudio' | 'pet365care') => void;
  unreadCounts: Record<string, number>;
  fetchGames: () => void;
  setActiveGameUrl: (url: string | null) => void;
  pet365Path: string;
  setPet365Path: (path: string) => void;
  myProfile: any;
  router: any;
  totalAiUsageCount: number;
  setIsDrawerOpen: (v: boolean) => void;
  setCurrentRoom: (v: any) => void;
  setIsGuideOpen: (v: boolean) => void;
  currentTime: Date | null;
  user: any;
  setIsProfileModalOpen: (v: boolean) => void;
}

export function LnbSidebar({
  currentTab, setCurrentTab, unreadCounts, fetchGames, setActiveGameUrl,
  pet365Path, setPet365Path, myProfile, router, totalAiUsageCount,
  setIsDrawerOpen, setCurrentRoom, setIsGuideOpen, currentTime, user, setIsProfileModalOpen
}: LnbSidebarProps) {
  return (
    <div className="alo-side-rail w-[4.5rem] bg-surface-container-lowest flex flex-col items-center py-6 shrink-0 z-0 relative overflow-y-auto no-scrollbar">
      <div className={`flex flex-col gap-6 w-full items-center transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]`}>
        {/* 탭 전환 상태 인디케이터 배지 (동적 위치) */}
        <div
          className="absolute left-0 w-1 bg-gradient-to-b from-primary to-primary-dim shadow-[0_0_10px_rgba(204,151,255,0.8)] rounded-r-lg transition-all duration-300 ease-in-out"
          style={{
            height: '24px',
            top: currentTab === 'chats' ? '36px' : currentTab === 'friends' ? '108px' : currentTab === 'wallet' ? '180px' : currentTab === 'games' ? '252px' : currentTab === 'aistudio' ? '324px' : '396px'
          }}
        />

        {/* 채팅 목록 탭 */}
        <button
          onClick={() => setCurrentTab('chats')}
          className={`relative p-3 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${currentTab === 'chats' ? 'text-primary bg-surface-variant shadow-inner' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'}`}
          title="채팅 목록"
        >
          <MessageSquare size={24} strokeWidth={currentTab === 'chats' ? 2.5 : 2} />
          {Object.values(unreadCounts).some(count => count > 0) && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-zinc-900"></span>}
        </button>

        {/* 친구 목록 탭 */}
        <button
          onClick={() => setCurrentTab('friends')}
          className={`p-3 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${currentTab === 'friends' ? 'text-primary bg-surface-variant shadow-inner' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'}`}
          title="친구 목록"
        >
          <Users size={24} strokeWidth={currentTab === 'friends' ? 2.5 : 2} />
        </button>

        {/* 지갑 탭 */}
        <button
          onClick={() => setCurrentTab('wallet')}
          className={`relative p-3 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${currentTab === 'wallet' ? 'text-primary bg-surface-variant shadow-inner' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'}`}
          title="내 지갑 / 로컬 장부"
        >
          <Wallet size={24} strokeWidth={currentTab === 'wallet' ? 2.5 : 2} />
        </button>

        {/* 게임 탭 */}
        <button
          onClick={() => {
            setCurrentTab('games');
            fetchGames();
          }}
          className={`relative p-3 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${currentTab === 'games' ? 'text-primary bg-surface-variant shadow-inner' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'}`}
          title="게임 구역"
        >
          <Gamepad2 size={24} strokeWidth={currentTab === 'games' ? 2.5 : 2} />
        </button>

        {/* AI 스튜디오 탭 */}
        <button
          onClick={() => setCurrentTab('aistudio')}
          className={`relative p-3 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${currentTab === 'aistudio' ? 'text-primary bg-surface-variant shadow-inner' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'}`}
          title="Alopop AI Studio"
        >
          <Building2 size={24} strokeWidth={currentTab === 'aistudio' ? 2.5 : 2} />
        </button>

        {/* Pet365Care 탭 서비스 */}
        <button
          onClick={() => {
            setCurrentTab('pet365care');
            setPet365Path('/pet365care?view=home');
          }}
          className={`relative p-3 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${currentTab === 'pet365care' ? 'text-primary bg-surface-variant shadow-inner' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'}`}
          title="Pet365Care"
        >
          <PawPrint size={24} strokeWidth={currentTab === 'pet365care' ? 2.5 : 2} />
        </button>

        {currentTab === 'pet365care' && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-primary/20 bg-surface-container/70 px-1.5 py-2 shadow-inner">
            {PET365CARE_LNB_ITEMS.map((item) => {
              const isPet365Active = pet365Path === item.path;
              const Icon = item.icon;

              return (
                <button
                  key={item.path}
                  onClick={() => {
                    setCurrentTab('pet365care');
                    setPet365Path(item.path);
                  }}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                    isPet365Active
                      ? 'bg-gradient-to-br from-primary to-secondary text-[#09070d] shadow-[0_8px_20px_rgba(98,250,227,0.18)]'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-white'
                  }`}
                  title={`Pet365Care ${item.name}`}
                >
                  <Icon size={19} strokeWidth={isPet365Active ? 2.6 : 2} />
                </button>
              );
            })}
          </div>
        )}

        {/* 👑 관리자 대시보드 버튼 (isAdmin이 true일 때만 렌더링) */}
        {myProfile?.isAdmin && (
          <button
            onClick={() => router.push('/admin')}
            className="relative p-3 rounded-xl transition-all text-yellow-500 hover:text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20"
            title="👑 관리자 전용 대시보드"
          >
            <Crown size={24} strokeWidth={2} className="drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
          </button>
        )}
      </div>

      {/* LNB 하단: 알림, 아바타, 타이머 등 */}
      <div className="flex flex-col items-center gap-4 mt-auto w-full pb-6">
        {/* AI 사용 통계 표시 */}
        <button
          onClick={() => { setCurrentTab('stats'); setIsDrawerOpen(false); setCurrentRoom(null); }}
          className="flex flex-col items-center justify-center gap-1 w-10 h-10 mb-2 rounded-xl bg-purple-900/20 border border-purple-500/30 hover:border-purple-400/50 hover:bg-purple-900/40 text-purple-300 shadow-inner group transition-all"
          title="오늘 AI 총 사용 횟수"
        >
          <Bot size={16} className="opacity-80 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-mono font-bold leading-none">{totalAiUsageCount}</span>
        </button>

        {/* 헬프/가이드 버튼 */}
        <button
          className="mb-1 text-zinc-500 hover:text-white transition-colors p-1 rounded-full hover:bg-zinc-800"
          onClick={() => setIsGuideOpen(true)}
          title="알로팝 사용 안내"
        >
          <HelpCircle size={22} />
        </button>

        {/* 라이브 타임 타이머 */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-[10px] font-mono font-bold text-secondary tracking-widest tabular-nums animate-pulse">
            {currentTime ? currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '00:00'}
          </div>
          <div className="text-[8px] font-mono text-outline-variant font-bold">UTC+9</div>
        </div>

        <div
          className="w-10 h-10 rounded-lg bg-surface-container-high shadow-ambient border border-outline-variant/30 flex items-center justify-center text-primary font-bold cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden"
          title={user?.username || ''}
          onClick={() => { setCurrentTab('friends'); setIsProfileModalOpen(true); }}
        >
          {myProfile?.avatar_url ? (
            <img src={myProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            (myProfile?.username?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase()) || '?'
          )}
        </div>
      </div>
    </div>
  );
}
