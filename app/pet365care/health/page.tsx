"use client";

import { CalendarCheck } from "lucide-react";

export default function HealthPage() {
  return (
    <div className="pet365-page flex flex-col min-h-full pb-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
            <span className="text-xl">🩺</span>
          </div>
          <h1 className="text-[#9c48ea] font-extrabold text-xl tracking-tight">Pet365Care</h1>
        </div>

      </header>

      {/* Main Content */}
      <main className="px-6 flex flex-col gap-8">
        
        {/* Premium Membership Card */}
        <div className="bg-gradient-to-br from-[#09070d] via-[#9c48ea] to-[#62fae3] rounded-[28px] p-8 text-white relative overflow-hidden shadow-xl shadow-[#9c48ea]/20 h-64 flex flex-col justify-end group cursor-pointer">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl translate-x-12 -translate-y-4"></div>
           <div className="absolute top-8 left-8">
             <span className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold tracking-wide">프리미엄 멤버십</span>
           </div>
           
           <div className="relative z-10">
             <h2 className="text-[28px] font-black leading-[1.1] mb-2 tracking-tight">우리아이 건강,<br/>이제 완벽하게 케어하세요</h2>
             <p className="text-sm font-medium text-white/90">월 4,900원으로 시작하는 가장 스마트한 펫 헬스케어</p>
           </div>
           {/* Paw background watermark */}
           <div className="absolute -bottom-10 -right-10 text-white/10 w-48 h-48 group-hover:scale-110 transition-transform duration-700">
             <svg fill="currentColor" viewBox="0 0 256 256"><path d="M80.49,94.94a28,28,0,1,0-36.93-36,28,28,0,1,0,36.93,36Z"></path><path d="M110,68a28,28,0,1,0-28-28A28,28,0,0,0,110,68Z"></path><path d="M168,76a28,28,0,1,0-28-28A28,28,0,0,0,168,76Z"></path><path d="M228.37,64a28,28,0,1,0-16.73,38.64A28.08,28.08,0,0,0,228.37,64Z"></path><path d="M198.81,142C188.75,127,163.63,112,128,112s-60.75,15-70.81,30c-12,17.91-17,47.41-1.07,76,8,14.37,24,26,45.88,26,26.78,0,34.82-14,35-14a8,8,0,0,1,14.06,0c0.16,0.3,8.2,14,35,14,21.85,0,37.89-11.64,45.88-26C215.82,189.43,210.82,159.93,198.81,142Zm-70.81,59.39A70.87,70.87,0,0,1,103,178a8,8,0,0,1,14-8c8.35,14.72,21.28,29,38,10a8,8,0,0,1,12.33,10.23,37.66,37.66,0,0,1-24.64,11.39C137.94,201.62,132.88,201.64,128,201.39Z"></path></svg>
           </div>
        </div>

        {/* Benefits Section */}
        <section className="flex flex-col gap-4">
          <h3 className="text-xl font-bold text-gray-900 px-1">특별한 혜택</h3>

          {/* AI Vet */}
          <div className="pet365-card p-6 flex items-start gap-4 cursor-pointer">
            <div className="w-14 h-14 bg-[#efe7ff] rounded-full flex items-center justify-center text-[#9c48ea] shrink-0">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M216,40V216a24,24,0,0,1-24,24H64a24,24,0,0,1-24-24V40A24,24,0,0,1,64,16H192A24,24,0,0,1,216,40ZM192,32H64a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H192a8,8,0,0,0,8-8V40A8,8,0,0,0,192,32ZM136,88v24h24a8,8,0,0,1,0,16H136v24a8,8,0,0,1-16,0V128H96a8,8,0,0,1,0-16h24V88a8,8,0,0,1,16,0Z"></path></svg>
            </div>
            <div>
              <h4 className="text-lg font-bold text-gray-900 mb-1">AI 정밀 진단 무제한</h4>
              <p className="text-sm font-medium text-gray-500 leading-relaxed">증상 검색부터 예상 질병까지, 횟수 제한 없이 AI 수의사가 실시간으로 진단해 드립니다.</p>
            </div>
          </div>

          {/* Hospital Priority */}
          <div className="pet365-card p-6 flex items-start gap-4 cursor-pointer">
            <div className="w-14 h-14 bg-[#e8fbf8] rounded-full flex items-center justify-center text-[#0f766e] shrink-0">
               <CalendarCheck size={28} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-gray-900 mb-1">동물병원 예약 우선권</h4>
              <p className="text-sm font-medium text-gray-500 leading-relaxed">제휴 병원 예약 시 프리미엄 회원 전용 우선 예약 슬롯을 배정받아 대기 없이 진료받으세요.</p>
            </div>
          </div>

        </section>

      </main>
    </div>
  );
}
