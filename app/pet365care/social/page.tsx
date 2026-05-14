import Image from "next/image";

export default function SocialPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F4F4F6] pb-24 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
            {/* Dummy profile icon */}
            <span className="text-xl">🐱</span>
          </div>
          <h1 className="text-[#FF7B6E] font-extrabold text-xl tracking-tight">Pet365Care</h1>
        </div>
        <button className="text-[#FF7B6E] p-2 bg-white rounded-full shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <main className="px-6 flex flex-col gap-8">
        
        {/* Popular Gatherings */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 px-1">
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">
              우리 동네 인기 모임
            </h2>
            <button className="text-sm font-semibold text-[#FF7B6E] flex items-center gap-1 self-start">
              지금 가장 핫한 펫 모임을 확인해보세요 더보기 <span className="text-lg">›</span>
            </button>
          </div>

          {/* Hero Card */}
          <div className="h-64 rounded-[32px] overflow-hidden relative shadow-md group pointer-events-none">
            <Image
              src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&q=80&w=800" 
              alt="Dogs running" 
              fill
              sizes="(max-width: 640px) 100vw, 448px"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            
            <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-2">
              <div className="flex gap-2 mb-1">
                <span className="bg-[#FF7B6E] text-white text-[11px] font-black px-2.5 py-1 rounded-full tracking-wider">HOT</span>
                <span className="bg-white/30 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">망원 한강공원</span>
              </div>
              <h3 className="text-white text-xl font-bold leading-tight">토요일 아침 대형견 산책 모임</h3>
              <p className="text-white/80 text-sm font-medium flex items-center gap-1.5 mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                멤버 12명 참여 중
              </p>
            </div>
          </div>
        </section>

        {/* Activity Categories */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-900 px-1">어떤 활동을 찾으시나요?</h2>
          
          {/* Full Width Pill */}
          <div className="bg-[#FDECE9] rounded-[32px] p-5 flex items-center justify-between cursor-pointer hover:bg-[#FAD8D2] transition-colors relative overflow-hidden h-28 shadow-sm">
            <div className="flex flex-col z-10 pl-2">
              <h3 className="text-lg font-bold text-gray-900 mb-0.5">일상 공유</h3>
              <p className="text-sm text-gray-600 font-medium">우리 아이의 귀여운 순간을<br/>자랑해보세요</p>
            </div>
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-[#FF7B6E] mr-2 z-10 transition-transform group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256">
                <path d="M208,56H180.28L166.65,35.56A16,16,0,0,0,153.31,28H102.69a16,16,0,0,0-13.34,7.56L75.72,56H48A24,24,0,0,0,24,80V192a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V80A24,24,0,0,0,208,56Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H80a8,8,0,0,0,6.66-3.78L100.28,47.56a0.07,0.07,0,0,1,0,0h55.35l13.67,20.66A8,8,0,0,0,176,72h32a8,8,0,0,1,8,8ZM128,88a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,88Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,168Z"></path>
              </svg>
            </div>
          </div>

          {/* Half Width Pills */}
          <div className="grid grid-cols-2 gap-4 h-36">
            <div className="bg-white rounded-[32px] p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm">
              <div className="w-12 h-12 bg-[#FFF3CD] rounded-full flex items-center justify-center text-[#B8860B] mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,206.51C111.45,210.15,56,161.4,56,104a72,72,0,0,1,144,0C200,161.4,144.55,210.15,128,222.51ZM128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Z"></path>
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900 leading-tight">지역 모임</h3>
              <p className="text-xs text-gray-500 font-medium mt-1">동네 친구 만들기</p>
            </div>

            <div className="bg-white rounded-[32px] p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm">
              <div className="w-12 h-12 bg-[#F2C99D]/40 rounded-full flex items-center justify-center text-[#A66C33] mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M80.49,94.94a28,28,0,1,0-36.93-36,28,28,0,1,0,36.93,36Z"></path>
                  <path d="M110,68a28,28,0,1,0-28-28A28,28,0,0,0,110,68Z"></path>
                  <path d="M168,76a28,28,0,1,0-28-28A28,28,0,0,0,168,76Z"></path>
                  <path d="M228.37,64a28,28,0,1,0-16.73,38.64A28.08,28.08,0,0,0,228.37,64Z"></path>
                  <path d="M198.81,142C188.75,127,163.63,112,128,112s-60.75,15-70.81,30c-12,17.91-17,47.41-1.07,76,8,14.37,24,26,45.88,26,26.78,0,34.82-14,35-14a8,8,0,0,1,14.06,0c0.16,0.3,8.2,14,35,14,21.85,0,37.89-11.64,45.88-26C215.82,189.43,210.82,159.93,198.81,142Zm-70.81,59.39A70.87,70.87,0,0,1,103,178a8,8,0,0,1,14-8c8.35,14.72,21.28,29,38,10a8,8,0,0,1,12.33,10.23,37.66,37.66,0,0,1-24.64,11.39C137.94,201.62,132.88,201.64,128,201.39Z"></path>
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900 leading-tight">산책 메이트</h3>
              <p className="text-xs text-gray-500 font-medium mt-1">함께 걷는 즐거움</p>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
