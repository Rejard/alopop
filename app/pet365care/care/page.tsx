"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Gift, FileText, ChevronDown, Loader2, X, Clock } from "lucide-react";
import { usePet365Auth } from "@/lib/pet365care/use-pet365-auth";
import { getErrorMessage } from "@/lib/pet365care/errors";
import { analyzeImage } from "@/lib/pet365care/gemini-client";
import { getSettings, addHealthRecord, getHealthRecords, type HealthRecord } from "@/lib/pet365care/local-store";

export default function CarePage() {
  const [activeTab, setActiveTab] = useState("일상");
  const { user } = usePet365Auth();
  
  // Camera & AI State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<HealthRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "기록" && user?.id) {
      setHistoryLoading(true);
      setHistory(getHealthRecords());
      setHistoryLoading(false);
    }
  }, [activeTab, user?.id]);

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setDiagnosis(null);

    const reader = new FileReader();
    reader.onloadend = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        let width = img.width;
        let height = img.height;
        const maxDim = 600; // 600px is enough for Gemini Vision, massively reduces JSON payload size
        
        if (width > height && width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        } else if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64String = canvas.toDataURL("image/jpeg", 0.5); // Quality 50%

        try {
          const apiKey = "alopop-internal";
          if (!apiKey) {
            throw new Error("프로필 설정에서 Gemini API 키를 먼저 등록해주세요.");
          }

          const result = await analyzeImage(base64String);
          setDiagnosis(result.diagnosis);

          // 로컬 기록 저장
          addHealthRecord({
            aiDiagnosis: result.diagnosis,
            confidence: result.confidence,
            mood: result.mood,
          });
        } catch (err: unknown) {
          console.error(err);
          setDiagnosis(`분석 실패: ${getErrorMessage(err)}`);
        } finally {
          setAnalyzing(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F6] pb-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Hidden File Input */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Alopop avatar URLs may be authenticated by the host app.
              <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl">🐶</span>
            )}
          </div>
          <h1 className="text-[#FF7B6E] font-extrabold text-xl tracking-tight">Pet365Care</h1>
        </div>
        <button className="text-[#FF7B6E] p-2 bg-white rounded-full shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
      </header>

      {/* Analysis Modal Overlay */}
      {(analyzing || diagnosis) && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 sm:absolute pointer-events-auto">
          <div className="bg-white rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            {analyzing ? (
              <div className="p-10 flex flex-col items-center justify-center text-center gap-6">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center animate-pulse">
                  <Loader2 className="animate-spin text-[#FF7B6E]" size={40} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Gemini AI가 판독 중입니다...</h3>
                  <p className="text-sm font-medium text-gray-500 max-w-[200px] mx-auto">사진의 픽셀 하나하나 분석하여 건강 상태를 확인하고 있어요.</p>
                </div>
              </div>
            ) : (
              <div className="p-8 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">분석 완료</h3>
                  </div>
                  <button onClick={() => setDiagnosis(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                    <X size={20} className="text-gray-600" />
                  </button>
                </div>
                
                <div className="bg-gray-50 rounded-2xl p-5 mb-6 max-h-[300px] overflow-y-auto hide-scrollbar">
                  <p className="text-[15px] font-medium text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {diagnosis}
                  </p>
                </div>
                
                <button onClick={() => setDiagnosis(null)} className="w-full py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white font-bold rounded-2xl shadow-lg transition-transform active:scale-[0.98]">
                  결과 저장 및 닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="px-6 flex flex-col gap-6">
        
        {/* Main AI Camera Button */}
        <button 
          onClick={handleCameraClick}
          className="relative w-full bg-gradient-to-r from-[#D74F3B] to-[#FF8A7A] rounded-[32px] p-6 flex items-center gap-4 text-left shadow-lg shadow-red-900/20 active:scale-[0.98] transition-transform overflow-hidden group"
        >
          {/* Decorative Circles */}
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute top-0 right-12 w-16 h-16 bg-white/20 rounded-full blur-xl"></div>
          
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-inner shrink-0 group-hover:bg-white/30 transition-colors">
            <Camera className="text-white" fill="white" size={24} />
          </div>
          <div className="flex-1 z-10">
            <h2 className="text-xl font-bold text-white mb-0.5">AI 카메라 건강 분석</h2>
            <p className="text-white/80 text-sm font-medium">AI 카메라로 우리 아이 건강 체크하기</p>
          </div>
          <div className="w-8 h-8 flex items-center justify-center text-white/50 z-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* AI Daily Diagnosis */}
        <div className="bg-[#FFF8E7] rounded-[32px] p-6 flex items-start gap-4 shadow-sm border border-orange-50 cursor-pointer hover:bg-[#FFF3D4] transition-colors">
          <div className="w-12 h-12 bg-[#F3C130] rounded-full flex items-center justify-center text-[#946900] shadow-inner shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256">
              <path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,206.51C111.45,210.15,56,161.4,56,104a72,72,0,0,1,144,0C200,161.4,144.55,210.15,128,222.51ZM128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Z"></path>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">AI 일일 진단</h3>
            <p className="text-sm font-medium text-gray-600 leading-snug">{user?.username ? `${user.username}의 반려동물은` : "강쥐는"} 오늘 컨디션이 아주 좋아요! 활동량이 평균보다 15% 높습니다.</p>
          </div>
        </div>

        {/* Promotion Box */}
        <div className="bg-[#FDECE9] rounded-[32px] p-6 flex flex-col gap-4 shadow-sm relative overflow-hidden">
          {/* Cutout illusion dots */}
          <div className="absolute top-1/2 -left-4 -translate-y-1/2 w-8 h-8 rounded-full bg-[#F4F4F6]"></div>
          <div className="absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-8 rounded-full bg-[#F4F4F6]"></div>

          <div className="flex items-center gap-3">
             <div className="w-10 h-10 flex items-center justify-center text-[#9B3C2B]">
               <Gift size={28} strokeWidth={2.5} />
             </div>
             <div>
                <h4 className="font-bold text-gray-900 text-base">강쥐가 행복해 보여요!</h4>
                <p className="text-xs font-medium text-gray-600">프리미엄 관절 영양제는 어떠세요?</p>
             </div>
          </div>
          <button className="w-full py-4 bg-[#8E3B29] hover:bg-[#783020] text-white font-bold rounded-2xl shadow-md transition-colors text-sm tracking-wide">
            20% 할인 쿠폰 받기
          </button>
        </div>

        {/* Toggle Switch */}
        <div className="bg-[#EBEBEF] p-1.5 rounded-[24px] flex mt-2 shadow-inner">
          {["일상", "의료", "기록"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-bold rounded-[20px] transition-all duration-300 ${
                activeTab === tab
                  ? "bg-[#A73A2A] text-white shadow-md"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Inner Tab Content (Mood) */}
        {activeTab === "일상" && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 mt-2">
            <h3 className="font-bold text-gray-900 ml-1 text-[15px]">기분</h3>
            <button className="w-full bg-white px-5 py-4 rounded-2xl flex items-center justify-between shadow-sm border border-gray-100 cursor-pointer active:scale-[0.99] transition-all">
              <span className="font-semibold text-gray-800 text-sm">행복하고 활기참</span>
              <ChevronDown size={20} className="text-gray-400" />
            </button>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "기록" && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 mt-2">
            <h3 className="font-bold text-gray-900 ml-1 text-[15px] flex items-center gap-2">
              <Clock size={16} className="text-[#FF7B6E]" /> AI 분석 기록
            </h3>

            {/* History Summary Card */}
            {!historyLoading && history.length > 0 && (
              <div className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-[24px] p-5 border border-rose-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-600">📊 분석 요약</span>
                  <span className="text-xs font-semibold text-gray-400">총 {history.length}회</span>
                </div>
                <p className="text-sm font-medium text-gray-700 leading-relaxed">
                  {history.length >= 3
                    ? `최근 ${Math.min(history.length, 5)}건의 분석 결과를 기반으로, 반려동물의 건강 상태가 꾸준히 관리되고 있습니다.`
                    : "분석 기록이 쌓이면 건강 트렌드를 확인할 수 있어요!"
                  }
                </p>
                {history.length >= 1 && (
                  <div className="mt-3 pt-3 border-t border-rose-100">
                    <p className="text-[11px] font-bold text-gray-400 mb-1">마지막 분석</p>
                    <p className="text-xs text-gray-600 line-clamp-2">{history[0].aiDiagnosis}</p>
                  </div>
                )}
              </div>
            )}
            
            {historyLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-[#FF7B6E]" size={24} />
              </div>
            ) : history.length === 0 ? (
              <div className="bg-white rounded-[24px] p-8 text-center shadow-sm">
                <FileText size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">아직 분석 기록이 없습니다.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((record) => {
                  const date = new Date(record.createdAt);
                  const dateString = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
                  
                  return (
                    <div 
                      key={record.id} 
                      onClick={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}
                      className="bg-white rounded-[24px] p-5 flex flex-col gap-3 shadow-sm border border-transparent hover:border-red-100 transition-all cursor-pointer"
                    >
                       <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-[#FF7B6E] bg-red-50 px-2.5 py-1 rounded-full">사진 분석 완료</span>
                          <span className="text-xs font-semibold text-gray-400">{dateString}</span>
                       </div>
                       <p className={`text-sm font-medium text-gray-700 leading-relaxed transition-all whitespace-pre-wrap ${expandedRecordId === record.id ? '' : 'line-clamp-3'}`}>
                         {record.aiDiagnosis}
                       </p>
                       {expandedRecordId !== record.id && (
                         <div className="text-center pt-1">
                           <ChevronDown size={18} className="mx-auto text-gray-300" />
                         </div>
                       )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
