'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';

interface AiModelSelectorProps {
  selectedAiModel: string;
  setSelectedAiModel: (modelId: string) => void;
  aiModels: Record<string, { id: string; name: string }[]>;
  activeEvents?: any[];
  exhaustedFreeEvents?: Record<string, boolean>;
  disabled?: boolean;
  studioId?: string; // 특정 스튜디오별 개별 저장 시 사용
  className?: string; // 모바일/데스크톱 대응 또는 특화 스타일 레이아웃용
}

export function AiModelSelector({
  selectedAiModel,
  setSelectedAiModel,
  aiModels,
  activeEvents = [],
  exhaustedFreeEvents = {},
  disabled = false,
  studioId,
  className = ''
}: AiModelSelectorProps) {
  const {
    selectedProvider: globalProvider,
    setSelectedProvider: setGlobalProvider,
    apiKeys,
    setIsOpen: setSettingsOpen
  } = useSettingsStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 무료 이벤트 AI 판별용 유도 변수 계산
  const freeAiEvents = useMemo(
    () => activeEvents.filter((e: any) => e.eventType === 'FREE_AI' && !exhaustedFreeEvents[e.id]),
    [activeEvents, exhaustedFreeEvents]
  );
  
  const isFreeAiActiveForModel = useMemo(
    () => !!freeAiEvents.find((e: any) => e.aiModel === selectedAiModel),
    [freeAiEvents, selectedAiModel]
  );

  const hasProviderKey = globalProvider === 'gemini-free' || !!apiKeys[globalProvider];
  const allProviderModels = aiModels[globalProvider === 'gemini-free' ? 'gemini' : globalProvider] || [];
  
  // 유저가 설정한 모델 리스트 (키가 없으면 빈 리스트)
  const userModels = hasProviderKey ? allProviderModels : [];

  // 중복 제거된 유저 모델 리스트 (무료 이벤트 모델과 겹치는 경우 숨김)
  const filteredUserModels = userModels.filter(
    (model) => !freeAiEvents.some((event: any) => event.aiModel === model.id)
  );

  // 둘 다 없을 때만 AI 연결 필요 경고 노출
  const showAiWarning = filteredUserModels.length === 0 && freeAiEvents.length === 0;

  // 현재 선택된 모델 이름 계산
  let displayModelName = selectedAiModel || 'AI 선택';
  const selectedEvent = freeAiEvents.find((e: any) => e.aiModel === selectedAiModel);
  if (selectedEvent) {
    displayModelName = aiModels[selectedEvent.aiProvider === 'gemini-free' ? 'gemini' : selectedEvent.aiProvider]?.find((m) => m.id === selectedEvent.aiModel)?.name || selectedEvent.aiModel;
  } else if (hasProviderKey) {
    displayModelName = allProviderModels.find((m) => m.id === selectedAiModel)?.name || selectedAiModel || 'AI 선택';
  }

  return (
    <div className={`relative flex items-center gap-1.5 shrink-0 z-50 ${className}`}>
      <span className="text-[9px] text-purple-400 font-extrabold shrink-0">🤖 AI 모델:</span>
      
      {showAiWarning ? (
        <button
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setSettingsOpen(true, true); // forceGlobal을 true로 주어 전역 설정이 뜨도록 함
          }}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/50 shadow-sm transition-colors text-[9px] font-extrabold"
        >
          ⚠️ AI 연결 필요
        </button>
      ) : (
        <button
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setIsDropdownOpen(!isDropdownOpen);
          }}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold transition-colors border shrink-0 shadow-sm ${
            isFreeAiActiveForModel
              ? 'bg-purple-600/20 text-purple-400 shadow-[0_0_8px_rgba(147,51,234,0.3)] border-purple-500/30 hover:bg-purple-600/30'
              : 'bg-[#1b1227] hover:bg-purple-900/20 text-purple-300 border-purple-800/30'
          }`}
        >
          <span className="truncate max-w-[110px]">
            {displayModelName}
          </span>
          {isFreeAiActiveForModel && (
            <span className="bg-emerald-500 text-black px-1 rounded text-[7px] font-bold tracking-tighter">
              EVENT
            </span>
          )}
          <ChevronDown size={10} className="opacity-70 shrink-0" />
        </button>
      )}

      {isDropdownOpen && !showAiWarning && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-40 bg-[#1b1227] border border-purple-800/40 rounded-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100 z-50 max-h-60 overflow-y-auto no-scrollbar">
          
          {/* 유저 모델 리스트 */}
          {filteredUserModels.length > 0 && (
            <div className="flex flex-col border-b border-purple-800/40 pb-1 mb-1">
              {filteredUserModels.map((model) => (
                <button
                  key={model.id}
                  disabled={disabled}
                  onClick={() => {
                    setSelectedAiModel(model.id);
                    localStorage.setItem('alo_ai_model', model.id);
                    if (studioId) {
                      localStorage.setItem(`alo_ai_model_studio_${studioId}`, model.id);
                    }
                    
                    // 공용 제공사(provider)도 함께 변경
                    let nextProvider: 'openai' | 'gemini' | 'anthropic' = 'gemini';
                    if (model.id.startsWith('gpt-')) nextProvider = 'openai';
                    else if (model.id.startsWith('claude-')) nextProvider = 'anthropic';
                    localStorage.setItem('alo_ai_provider', nextProvider);
                    setGlobalProvider(nextProvider);
                    if (studioId) {
                      localStorage.setItem(`alo_ai_provider_studio_${studioId}`, nextProvider);
                    }

                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[11px] transition-colors ${
                    selectedAiModel === model.id && !freeAiEvents.some((e: any) => e.aiModel === selectedAiModel)
                      ? 'bg-purple-900/30 text-purple-300'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span className="truncate">{model.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* 무료 이벤트 모델 리스트 (마지막 리스트 보라색 박스 스타일) */}
          {freeAiEvents.length > 0 && (
            <div className="flex flex-col">
              {freeAiEvents.map((event: any) => {
                const modelName = aiModels[event.aiProvider === 'gemini-free' ? 'gemini' : event.aiProvider]?.find((m) => m.id === event.aiModel)?.name || event.aiModel;
                const isSelected = selectedAiModel === event.aiModel;
                
                return (
                  <button
                    key={`event-${event.id}`}
                    disabled={disabled}
                    onClick={() => {
                      setSelectedAiModel(event.aiModel);
                      localStorage.setItem('alo_ai_model', event.aiModel);
                      if (studioId) {
                        localStorage.setItem(`alo_ai_model_studio_${studioId}`, event.aiModel);
                      }

                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-[11px] font-extrabold transition-colors flex items-center justify-between gap-1 ${
                      isSelected ? 'bg-purple-800/80' : 'bg-[#3b1a53]'
                    } hover:bg-purple-700/80`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate text-purple-300">{modelName}</span>
                      <span className="bg-emerald-500 text-black px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter shrink-0 leading-none">
                        EVENT
                      </span>
                    </div>
                    {/* 사진에 있던 우측 작은 아이콘(v 형태)과 유사한 표시를 위해 ChevronDown 사용 */}
                    <ChevronDown size={10} className="text-purple-500/70 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
