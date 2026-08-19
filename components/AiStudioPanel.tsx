'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { useChatStore } from '@/store/useChatStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { AiModelSelector } from './AiModelSelector';
import { 
  Bot, Gamepad2, Scale, Music, Trash2, Plus, 
  Send, Paperclip, X, Copy, Download, RefreshCw, 
  ExternalLink, Play, Server, ShieldCheck, HelpCircle, 
  ChevronRight, Building2, User, Sparkles, AlertCircle,
  ChevronLeft, FolderOpen, ArrowLeft, ChevronDown, Check
} from 'lucide-react';
import { OFFICE_STYLE, CHATTER, SIM_CHATTER, SVG_ASSETS } from './studio/studioData';
// ==========================================
// 🧑‍💻 가상 오피스 에이전트 렌더링 컴포넌트 (Shared Layout Animation 보장)
// ==========================================
interface AgentProps {
  name: string;
  svgContent: string;
  showDesk?: boolean;
  isAbsent?: boolean;
  status: string;
  log: string;
  selectedStudioType: string;
  customRole?: string;
  customExpertise?: string;
}

function Agent({ name, svgContent, showDesk = false, isAbsent = false, status, log, selectedStudioType, customRole, customExpertise }: AgentProps) {
  const colors: Record<string, string> = {
    Alice: '#ff4d4d', Carol: '#ffb3ff', Bob: '#4da6ff', Dave: '#33cc33',
    Eve: '#ec4899', Frank: '#10b981', Grace: '#8b5cf6', Hank: '#f59e0b',
    Justice: '#fbbf24', Solomon: '#a855f7', Scribe: '#0891b2',
    Beat: '#e11d48', Budget: '#10b981', Trend: '#ec4899',
    '임변호': '#fbbf24', '지분석': '#a855f7', '서기록': '#0891b2', '오기획': '#e11d48', '한재무': '#10b981', '윤홍보': '#ec4899', '김장부': '#38bdf8', '이절세': '#22c55e', '박감사': '#eab308', '정신고': '#f97316', '최재무': '#a855f7',
    // 🏢 일반 사무직 HSL tailoring color palette
    '최인사': '#f87171', '정기획': '#fb923c', '홍홍보': '#f472b6', '윤재무': '#a78bfa', '김영업': '#60a5fa', '이회계': '#34d399', '박비서': '#2dd4bf', '강지원': '#a8a29e'
  };
  const roles: Record<string, string> = {
    Alice: '기획', Carol: '디자인', Bob: '개발', Dave: 'QA',
    Eve: '마케팅', Frank: '보안', Grace: 'CS', Hank: '테스터',
    Justice: '변호사', Solomon: '분석관', Scribe: '기록관',
    Beat: '총괄', Budget: '재무', Trend: '마케팅',
    '임변호': '변호사', '지분석': '분석관', '서기록': '기록관', '오기획': '총괄', '한재무': '재무', '윤홍보': '마케팅', '김장부': '기장', '이절세': '세무', '박감사': '감사', '정신고': '신고', '최재무': 'CFO',
    // 🏢 일반 사무직 디폴트 부서
    '최인사': '인사', '정기획': '기획', '홍홍보': '홍보', '윤재무': '재무', '김영업': '영업', '이회계': '회계', '박비서': '비서', '강지원': '총무'
  };
  const color = colors[name] || '#a855f7';
  const role = customRole || roles[name] || '요원';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '55px', height: showDesk ? '80px' : '65px', flexShrink: 0 }}>
      {/* (항상 고정되는) 배경: 💻 개인 책상 및 부재중 이름표 */}
      {showDesk && (
        <div style={{ position: 'absolute', bottom: '0px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '52px', height: '16px', backgroundColor: '#1e1e2d', borderTop: '2px solid #3b3b54', borderRadius: '4px', zIndex: 10, boxShadow: '0 3px 5px rgba(0,0,0,0.4)' }}>
            <div style={{ position: 'absolute', top: '2px', left: '19px', width: '14px', height: '9px', backgroundColor: isAbsent ? '#0f0f16' : '#1a1a24', border: '1px solid ' + (isAbsent ? '#4b5563' : color), borderRadius: '2px', boxShadow: isAbsent ? 'none' : '0 0 6px ' + color + ', inset 0 0 4px ' + color, transition: 'all 0.3s' }} />
          </div>
        </div>
      )}

      {/* 캐릭터 본체, 말풍선, 상태, 이름표 */}
      {name && (
        <motion.div
          layout
          layoutId={`glide-${name}`}
          transition={{ type: 'tween', ease: 'easeInOut', duration: 1.5 }}
          style={{ 
            position: 'absolute', 
            bottom: showDesk ? '16px' : '8px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            zIndex: isAbsent ? 10 : 100,
            opacity: isAbsent ? 0 : 1,
            scale: isAbsent ? 0.8 : 1,
            pointerEvents: isAbsent ? 'none' : 'auto',
            transition: 'opacity 0.5s ease-out, scale 0.5s ease-out'
          }}
        >
          {/* 💬 말풍선 */}
          {log && (
            <div style={{
              position: 'absolute',
              bottom: '53px',
              backgroundColor: 'rgba(20, 20, 30, 0.95)',
              color: '#f8fafc',
              padding: '3px 6px',
              borderRadius: '5px',
              fontSize: '0.6rem',
              whiteSpace: 'nowrap',
              border: '1px solid ' + color + '66',
              boxShadow: '0 4px 6px rgba(0,0,0,0.6)',
              zIndex: 110,
              pointerEvents: 'none'
            }}>
              {log}
              <div style={{
                position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)',
                width: '0', height: '0', borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                borderTop: '4px solid rgba(20, 20, 30, 0.95)'
              }} />
            </div>
          )}

          {/* 🧑‍💻 캐릭터 일러스트 & 상태 배지 */}
          <div style={{ position: 'relative', height: '40px', width: '35px', zIndex: 105 }}>
            {status !== 'idle' && (
              <div style={{
                position: 'absolute', top: '-5px', right: '-8px',
                backgroundColor: color,
                borderRadius: '50%', width: '16px', height: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.45rem', fontWeight: 'bold', color: '#fff',
                boxShadow: '0 0 3px rgba(0,0,0,0.5)', zIndex: 120
              }}>
                {status === 'thinking' ? '생각' : (status === 'meeting' ? '회의' : '작업')}
              </div>
            )}
            <div 
              style={{
                width: '35px', height: '40px',
                filter: status !== 'idle' ? 'drop-shadow(0 0 4px ' + color + '88)' : 'none',
                transition: 'filter 0.3s'
              }} 
              dangerouslySetInnerHTML={{ __html: SVG_ASSETS[selectedStudioType === 'game' ? `svg${name}` : (selectedStudioType === 'law' ? `svg${name}` : `svg${name}`)] || svgContent }} 
            />
          </div>

          {/* 🏷️ 이름표 */}
          <span 
            title={customExpertise || `${name} 요원`}
            style={{ fontSize: '0.55rem', color: '#cbd5e1', marginTop: '-2px', fontWeight: 'bold', whiteSpace: 'nowrap', textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000', zIndex: 125, cursor: 'help' }}
          >
            {name} ({role})
          </span>
        </motion.div>
      )}
    </div>
  );
}



interface AiStudioPanelProps {
  user: any;
  markRoomAsRead: (roomId: string) => Promise<void>;
  selectedAiModel: string;
  setSelectedAiModel: React.Dispatch<React.SetStateAction<string>>;
  aiModels: Record<string, { id: string, name: string }[]>;
  activeEvents?: any[];
  exhaustedFreeEvents?: Record<string, boolean>;
}

export function AiStudioPanel({ 
  user, 
  markRoomAsRead,
  selectedAiModel,
  setSelectedAiModel,
  aiModels,
  activeEvents = [],
  exhaustedFreeEvents = {}
}: AiStudioPanelProps) {
  const { socket } = useChatStore();

  const [studios, setStudios] = useState<any[]>([]);
  const [selectedStudio, setSelectedStudio] = useState<any | null>(null);
  
  // 현재 가상 에이전트 사무실 상태 및 말풍선 로그
  const [agentState, setAgentState] = useState<Record<string, { status: string; room: string; log: string }>>({});
  const [isWorking, setIsWorking] = useState(false);

  // 💻 [공용 연결] useSettingsStore 상태와 props를 통해 채팅창과 100% 동일하게 Reactive 연동
  const { 
    selectedProvider: globalProvider, 
    setSelectedProvider: setGlobalProvider, 
    apiKeys, 
    setIsOpen: setSettingsOpen 
  } = useSettingsStore();

  const [isAiModelDropdownOpen, setIsAiModelDropdownOpen] = useState(false);
  const [isCreateModalAiDropdownOpen, setIsCreateModalAiDropdownOpen] = useState(false);

  // 100% 채팅창과 호환되는 globalModel 변수 매핑 및 동적 변수 유도
  const globalModel = selectedAiModel;
  const freeAiEvents = useMemo(() => activeEvents.filter((e: any) => e.eventType === 'FREE_AI' && !exhaustedFreeEvents[e.id]), [activeEvents, exhaustedFreeEvents]);
  const isFreeAiActiveForModel = useMemo(() => !!freeAiEvents.find((e: any) => e.aiProvider === globalProvider && e.aiModel === selectedAiModel), [freeAiEvents, globalProvider, selectedAiModel]);
  const showAiWarning = globalProvider !== 'gemini-free' && !apiKeys[globalProvider];

  // 💻 각기 다른 스튜디오마다 각기 다른 AI 모델 선택/적용을 보관하고 복원하는 로직
  useEffect(() => {
    if (!selectedStudio?.id) return;

    // 1. 해당 스튜디오 전용으로 저장된 모델 설정 로드
    const studioModel = localStorage.getItem(`alo_ai_model_studio_${selectedStudio.id}`);
    const studioProvider = localStorage.getItem(`alo_ai_provider_studio_${selectedStudio.id}`);

    if (studioModel && studioProvider) {
      // 스튜디오 전용 모델 설정이 있는 경우 즉시 반영
      setSelectedAiModel(studioModel);
      setGlobalProvider(studioProvider as any);
      localStorage.setItem('alo_ai_model', studioModel);
      localStorage.setItem('alo_ai_provider', studioProvider);
    } else {
      // 없는 경우, 전역 공용 기본값 반영하고 해당 스튜디오 전용 키로도 세이브
      const currentGlobalModel = localStorage.getItem('alo_ai_model') || 'gemini-3.5-flash';
      const currentGlobalProvider = localStorage.getItem('alo_ai_provider') || 'gemini';
      
      setSelectedAiModel(currentGlobalModel);
      setGlobalProvider(currentGlobalProvider as any);
      localStorage.setItem(`alo_ai_model_studio_${selectedStudio.id}`, currentGlobalModel);
      localStorage.setItem(`alo_ai_provider_studio_${selectedStudio.id}`, currentGlobalProvider);
    }
  }, [selectedStudio?.id, setSelectedAiModel, setGlobalProvider]);

  // 💻 5인 이상 스튜디오를 위한 동기식 실시간 책상 배정 및 위치 고정(재정렬 금지) 헬퍼 세션 엔진 (1 틱 딜레이 해결로 점프 이동 완벽 차단)
  const deskAssignments = useMemo(() => {
    const assignments: Record<string, number> = {};
    const targetAgents = Object.keys(agentState);
    const totalAgentCount = targetAgents.length;

    // 역할별 정렬 가중치 계산
    const getAgentWeight = (agentName: string) => {
      const info = agentState[agentName] as any;
      const role = info?.role || '';
      
      const ROLE_ORDER: Record<string, number> = {
        '기획': 1, '디자인': 2, '개발': 3, 'QA': 4,
        '변호사': 1, '분석관': 2, '기록관': 3,
        '총괄': 1, '재무': 2, '마케팅': 3,
        '기장': 1, '세무': 2, '감사': 3, '신고': 4, 'CFO': 5,
        '마케터': 5, '보안': 6, 'CS': 7, '테스터': 8
      };
      
      if (ROLE_ORDER[role] !== undefined) return ROLE_ORDER[role];

      const AGENT_NAME_ORDER: Record<string, number> = {
        Alice: 1, Carol: 2, Bob: 3, Dave: 4,
        Eve: 5, Frank: 6, Grace: 7, Hank: 8,
        Justice: 1, Solomon: 2, Scribe: 3,
        Beat: 1, Budget: 2, Trend: 3,
        '김장부': 1, '이절세': 2, '박감사': 3, '정신고': 4, '최재무': 5
      };

      return AGENT_NAME_ORDER[agentName] || 999;
    };

    if (totalAgentCount <= 4) {
      // 4인 이하: 가중치 순으로 고유 지정석 영구 고정
      const sorted = [...targetAgents].sort((a, b) => getAgentWeight(a) - getAgentWeight(b));
      sorted.forEach((name, idx) => {
        assignments[name] = idx;
      });
    } else {
      // 5인 이상: 현재 DevRoom에 있는 요원만 가중치 순 정렬 후 순서대로 책상(0~3) 배정
      const devRoomAgents = targetAgents
        .filter(name => agentState[name]?.room === 'DevRoom')
        .sort((a, b) => getAgentWeight(a) - getAgentWeight(b));

      devRoomAgents.forEach((name, idx) => {
        if (idx < 4) {
          assignments[name] = idx;
        }
      });
    }

    return assignments;
  }, [agentState]);
  
  // 터미널 및 인풋
  const [logs, setLogs] = useState<any[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  
  // 에디터 & 뷰어 모달
  const [viewDoc, setViewDoc] = useState<any | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorCode, setEditorCode] = useState('');
  const [isDeploying, setIsDeploying] = useState<string | null>(null);

  // 새 스튜디오 개설 폼
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStudioName, setNewStudioName] = useState('');
  const [newStudioType, setNewStudioType] = useState('office');
  const [newStudioDesc, setNewStudioDesc] = useState('');
  const [newStudioAgentCount, setNewStudioAgentCount] = useState(4);
  const [newStudioAgentsConfig, setNewStudioAgentsConfig] = useState<any[]>([
    { name: '최인사', role: '인사', expertise: '인사 고과 및 핵심 인재 영입 담당 시니어 인사관' },
    { name: '정기획', role: '기획', expertise: '차년도 사업 전략 및 경영 혁신 기획 파트장' },
    { name: '홍홍보', role: '홍보', expertise: '바이럴 마케팅 및 브랜드 커뮤니케이션 스페셜리스트' },
    { name: '윤재무', role: '재무', expertise: '자금 포트폴리오 자본 배분 및 예산 통제 CFO' },
    { name: '김영업', role: '영업', expertise: '신규 매출 판로 개척 및 파트너십 구축 영업 팀장' },
    { name: '이회계', role: '회계', expertise: '매출/매입 세부 장부 기장 및 결산 전표 검산 기장사' },
    { name: '박비서', role: '비서', expertise: '스케줄 동선 조율 및 CEO 전담 행정 업무 비서실장' },
    { name: '강지원', role: '총무', expertise: '사무 자산 관리 및 복리후생 인프라 총무 담당관' }
  ]);
  const [isRecommending, setIsRecommending] = useState(false);
  const [hasUsedAiRecommend, setHasUsedAiRecommend] = useState(false); // AI 추천을 실제로 사용했는지 명확히 추적

  // 모바일/태블릿 반응형 대응 상태 추가
  const [isMobile, setIsMobile] = useState(false);
  const [activeMobileView, setActiveMobileView] = useState<'list' | 'detail' | 'archive'>('list');
  const [showDesktopArchive, setShowDesktopArchive] = useState(false); // 데스크탑에서 아카이브 패널 토글 상태

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 요원들의 생동감 넘치는 랜덤 장소 이동 및 말풍선 로컬 시뮬레이션 (작업 중에도 idle 요원들은 자유 행동 보장)
  useEffect(() => {
    if (!selectedStudio?.type) return;

    const updateAgents = () => {
      setAgentState(prev => {
        let changed = false;
        const next = { ...prev };
        const totalAgentCount = Object.keys(prev).length;

        // 각 방의 현재 실시간 요원 헤드카운트 계산 (next 기준)
        const getRoomCount = (roomName: string, state: any) => {
          return Object.values(state).filter((info: any) => info.room === roomName).length;
        };

        const currentAgents = Object.keys(prev);

        for (const name of currentAgents) {
          const info = next[name] || { status: 'idle', room: 'DevRoom', log: '' };

          // 헌법 5번 수호: 자기 작업 순서(thinking / coding)인데 메인 작업실(DevRoom) 밖에 있다면 바로 강제 복귀!
          if (info.status === 'thinking' || info.status === 'coding') {
            if (info.room !== 'DevRoom') {
              const devRoomCount = getRoomCount('DevRoom', next);
              if (devRoomCount >= 4) {
                // 작업실에 4명이 꽉 차 있다면, 노는(idle) 요원 중 한 명을 방출!
                const idleAgentsInDevRoom = Object.keys(next).filter(
                  k => next[k]?.room === 'DevRoom' && next[k]?.status === 'idle'
                );
                
                if (idleAgentsInDevRoom.length > 0) {
                  // 유휴 요원 중 무작위 한 명 선정
                  const ejectedName = idleAgentsInDevRoom[Math.floor(Math.random() * idleAgentsInDevRoom.length)];
                  
                  // 방출될 방 결정 (정원이 4명 미만인 회의실 또는 휴게실)
                  let targetEjectRoom = '';
                  const confCount = getRoomCount('Conference', next);
                  const pantryCount = getRoomCount('Pantry', next);
                  
                  if (pantryCount < 4) targetEjectRoom = 'Pantry';
                  else if (confCount < 4) targetEjectRoom = 'Conference';
                  
                  if (targetEjectRoom) {
                    next[ejectedName] = { ...next[ejectedName], room: targetEjectRoom, log: '작업실 자리를 양보하고 이동합니다☕' };
                    next[name] = { ...info, room: 'DevRoom', log: '순서가 되어 메인 작업실로 즉시 복귀합니다💻' };
                    changed = true;
                    continue; // 처리 완료했으므로 다음 에이전트로 이동
                  }
                }
              } else {
                // 작업실에 빈자리가 있다면 즉시 작업실로 복귀
                next[name] = { ...info, room: 'DevRoom', log: '순서가 되어 작업실로 복귀합니다💻' };
                changed = true;
                continue;
              }
            }

            // 작업 중 말풍선 갱신
            const phrases = CHATTER[name] || CHATTER['Alice'];
            const msg = phrases[Math.floor(Math.random() * phrases.length)];
            next[name] = { ...next[name], log: msg };
            changed = true;
          } 
          
          // 헌법 추가 조항 수호: 작업 중이지 않은(idle) 에이전트는 자유롭게 공간을 이동한다!
          else if (info.status === 'idle') {
            // 50% 확률로 장소 및 말풍선 변경 결정
            if (Math.random() < 0.5) {
              const r = Math.random();
              let targetLocation = 'desk';
              if (r > 0.8) targetLocation = 'pantry';
              else if (r > 0.6) targetLocation = 'conference';

              let newRoom = 'DevRoom';
              if (targetLocation === 'pantry') newRoom = 'Pantry';
              if (targetLocation === 'conference') newRoom = 'Conference';

              const currentTargetCount = getRoomCount(newRoom, next);
              
              if (newRoom === info.room) {
                // 1. 같은 방에 계속 머무르는 경우: 방 이동 없이 말풍선 멘트만 신선하게 업데이트! (침묵 해제)
                const phrases = SIM_CHATTER[targetLocation];
                const msg = phrases[Math.floor(Math.random() * phrases.length)];
                next[name] = { ...info, log: msg };
                changed = true;
              } else if (currentTargetCount < 4) {
                // 2. 다른 방으로 이동하는 경우: 정원 한도 체크 후 이동 및 새로운 멘트 적용
                const phrases = SIM_CHATTER[targetLocation];
                const msg = phrases[Math.floor(Math.random() * phrases.length)];
                next[name] = { ...info, log: msg, room: newRoom };
                changed = true;
              }
            } else {
              if (info.log !== '') {
                next[name] = { ...info, log: '' };
                changed = true;
              }
            }
          }
        }
        return changed ? next : prev;
      });
    };

    updateAgents();
    const interval = setInterval(updateAgents, 3500);
    return () => clearInterval(interval);
  }, [selectedStudio?.type]);

  // 1. 스튜디오 목록 로드 (서버 우선, localStorage 폴백 캐시)
  const fetchStudios = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/aistudio/studios?userId=${user.id}`);
      let allStudios: any[] = [];
      if (res.ok) {
        allStudios = await res.json();
        try {
          const personalStudios = allStudios.filter((s: any) => !s.isSystem);
          if (personalStudios.length > 0) {
            localStorage.setItem('alopop_local_studios', JSON.stringify(personalStudios));
          }
        } catch (e) { /* cache write fail is non-critical */ }
      } else {
        let localStudios: any[] = [];
        try {
          const stored = localStorage.getItem('alopop_local_studios');
          if (stored) {
            const parsed = JSON.parse(stored);
            localStudios = Array.isArray(parsed) ? parsed.filter((s: any) => s.ownerId === user.id) : [];
          }
        } catch (e) { /* ignore */ }
        allStudios = localStudios;
      }

      setStudios(allStudios);
      if (allStudios.length > 0 && !selectedStudio && window.innerWidth >= 1024) {
        handleSelectStudio(allStudios[0]);
      }
    } catch (e) {
      console.error(e);
      let localStudios: any[] = [];
      try {
        const stored = localStorage.getItem('alopop_local_studios');
        if (stored) {
          const parsed = JSON.parse(stored);
          localStudios = Array.isArray(parsed) ? parsed.filter((s: any) => s.ownerId === user.id) : [];
        }
      } catch (e2) { /* ignore */ }
      if (localStudios.length > 0) {
        setStudios(localStudios);
      }
    }
  };

  useEffect(() => {
    fetchStudios();
  }, [user?.id]);

  // 2. 특정 스튜디오 진입 및 활성화 (서버 우선, localStorage 폴백)
  const handleSelectStudio = async (studio: any) => {
    if (selectedStudio?.id === studio.id) return;
    
    if (selectedStudio?.id && selectedStudio?.isSystem && socket) {
      socket.emit('leave_studio_room', selectedStudio.id);
    }
    
    setSelectedStudio(studio);
    setLogs([]);
    setAgentState({});
    setIsWorking(false);
    
    if (studio.isSystem) {
      if (socket) {
        socket.emit('join_studio_room', studio.id);
      }
      fetchArtifacts(studio.id);
    } else {
      try {
        const [stateRes, artifactsRes] = await Promise.all([
          fetch(`/api/aistudio/studios/${studio.id}/state`),
          fetch(`/api/aistudio/history/${studio.id}`)
        ]);

        if (stateRes.ok) {
          const stateData = await stateRes.json();
          setAgentState(stateData.agentState || {});
          setLogs(stateData.logs || []);
          try { localStorage.setItem(`alopop_studio_state_${studio.id}`, JSON.stringify(stateData)); } catch (e) { /* ignore */ }
        } else {
          throw new Error('Server state fetch failed');
        }

        if (artifactsRes.ok) {
          const artifactsData = await artifactsRes.json();
          setArtifacts(artifactsData);
          try { localStorage.setItem(`alopop_local_artifacts_${studio.id}`, JSON.stringify(artifactsData)); } catch (e) { /* ignore */ }
        } else {
          setArtifacts([]);
        }
      } catch (e) {
        try {
          const storedState = localStorage.getItem(`alopop_studio_state_${studio.id}`);
          if (storedState) {
            const parsed = JSON.parse(storedState);
            setAgentState(parsed.agentState || {});
            setLogs(parsed.logs || []);
          } else if (studio.agentState) {
            setAgentState(studio.agentState);
            setLogs(studio.logs || []);
          }
          const storedArtifacts = localStorage.getItem(`alopop_local_artifacts_${studio.id}`);
          setArtifacts(storedArtifacts ? JSON.parse(storedArtifacts) : []);
        } catch (e2) {
          console.error('[Studio Load Fallback] Error:', e2);
        }
      }
    }
    setActiveMobileView('detail');
  };

  // 3. 스튜디오별 산출물 목록 로드
  const fetchArtifacts = async (studioId: string) => {
    try {
      const res = await fetch(`/api/aistudio/history/${studioId}`);
      if (res.ok) {
        const data = await res.json();
        setArtifacts(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 4. 소켓 리스너 통합 연동
  useEffect(() => {
    if (!socket || !selectedStudio) return;

    socket.on('syncStudioState', (data: any) => {
      if (data.studioId !== selectedStudio.id) return;
      setIsWorking(data.isWorking);
      setAgentState(data.agentState || {});
      setLogs(data.logs || []);
    });

    socket.on('logStudio', (logObj: any) => {
      setLogs(prev => [...prev, logObj]);
      if (logObj.agent && logObj.msg) {
        setAgentState(prev => ({
          ...prev,
          [logObj.agent]: {
            ...(prev[logObj.agent] || { status: 'idle', room: 'DevRoom' }),
            log: logObj.msg.substring(0, 30) + (logObj.msg.length > 30 ? '...' : '')
          }
        }));
      }
    });

    socket.on('agentStudioStatus', (data: any) => {
      const { agent, status } = data;
      setAgentState(prev => {
        const info = prev[agent] || { status: 'idle', room: 'DevRoom', log: '' };
        let newRoom = 'DevRoom';
        if (status === 'meeting') newRoom = 'Conference';
        else if (status === 'pantry') newRoom = 'Pantry';
        return {
          ...prev,
          [agent]: { ...info, status, room: newRoom }
        };
      });
    });

    socket.on('syncStudioAgentState', (state: any) => {
      setAgentState(state || {});
    });

    socket.on('studioWorkingStatus', (data: any) => {
      if (data.studioId === selectedStudio.id) {
        setIsWorking(data.isWorking);
      }
    });

    socket.on('studioTaskFinished', (data: any) => {
      if (data.studioId === selectedStudio.id) {
        setIsWorking(false);
        fetchArtifacts(selectedStudio.id);
      }
    });

    return () => {
      socket.off('syncStudioState');
      socket.off('logStudio');
      socket.off('agentStudioStatus');
      socket.off('syncStudioAgentState');
      socket.off('studioWorkingStatus');
      socket.off('studioTaskFinished');
    };
  }, [socket, selectedStudio?.id]);

  // 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  // 4.5. AI 스튜디오 조직 추천 설정 함수 (선택한 동적 AI 모델로 호출)
  const handleRecommendConfig = async () => {
    if (!newStudioDesc.trim()) {
      alert('설립 목적 및 업무 지시 개요를 먼저 입력해주세요.');
      return;
    }
    
    // 1. 추천용 AI 제공사 및 모델 확보
    const provider = globalProvider === 'gemini-free' ? 'gemini' : globalProvider;
    
    // 2. 해당 제공사의 로컬 API Key 추출
    let providerApiKey = '';
    try {
      const keysStr = localStorage.getItem('alo_api_keys');
      if (keysStr) {
        const keys = JSON.parse(keysStr);
        providerApiKey = keys[provider] || '';
      }
    } catch (e) { /* ignore */ }

    if (!providerApiKey) {
      alert(`AI 추천 설정을 사용하려면 [설정]에서 개인 ${provider.toUpperCase()} API Key를 먼저 등록해주세요.`);
      setSettingsOpen(true, true); // 설정 모달창을 오픈
      return;
    }
    
    setIsRecommending(true);
    try {
      const prompt = `당신은 한국 기업의 조직 설계 전문 컨설턴트입니다. 아래의 사업 목적에 가장 적합한 사무직 스튜디오 조직을 설계해주세요.

[설립 목적 및 업무 개요]
"${newStudioDesc}"

다음 조건을 반드시 충족하세요:
1. 적정 인원수: 2명~8명 사이에서 최적 인원을 결정
2. 각 인원에 대해:
   - name: 한국식 3글자 성함 (성 1글자 + 이름 2글자, 부서와 관련된 재치있는 작명)
   - role: 해당 인원이 맡을 부서명 (자유롭게 창작 가능. 예: 개발, 마케팅, 인사, 전략기획, 데이터분석 등)
   - expertise: 20자 이내의 구체적인 전문성/페르소나 설명

반드시 아래 JSON 포맷으로만 응답하세요 (마크다운 코드블록 제외, 순수 JSON만):
{"agentCount": 숫자, "agentsConfig": [{"name": "성함", "role": "부서", "expertise": "전문성 설명"}, ...]}`;

      let res;
      if (provider === 'gemini') {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${globalModel}:generateContent?key=${providerApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.9 }
            })
          }
        );
      } else if (provider === 'openai') {
        res = await fetch(
          `https://api.openai.com/v1/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${providerApiKey}`
            },
            body: JSON.stringify({
              model: globalModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.9
            })
          }
        );
      } else {
        // Anthropic: CORS 회피용 로컬 백엔드 프록시 호출
        res = await fetch(
          `/api/aistudio/proxy-anthropic`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: providerApiKey,
              model: globalModel,
              prompt: prompt
            })
          }
        );
      }
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${provider.toUpperCase()} API 호출 실패 (HTTP ${res.status}): ${errText.substring(0, 200)}`);
      }

      const result = await res.json();
      let rawText = '';
      
      if (provider === 'gemini') {
        rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (provider === 'openai') {
        rawText = result?.choices?.[0]?.message?.content || '';
      } else if (provider === 'anthropic') {
        rawText = result?.content?.[0]?.text || '';
      }
      
      // JSON 파싱 (마크다운 코드블록 제거)
      let cleanJson = rawText.replace(/```(?:json)?\s*\n?/gi, '').replace(/\n?```/g, '').trim();
      const data = JSON.parse(cleanJson);
      
      console.log('AI Recommendation result (local):', data);
      
      const recommendedCount = Math.min(8, Math.max(2, data.agentCount || 4));
      setNewStudioAgentCount(recommendedCount);
      
      const recommendedAgents = data.agentsConfig || [];
      
      const defaultNames = ['최인사', '정기획', '홍홍보', '윤재무', '김영업', '이회계', '박비서', '강지원'];
      const defaultRoles = ['인사', '기획', '홍보', '재무', '영업', '회계', '비서', '총무'];
      const defaultExpertises = [
        '인사 고과 및 핵심 인재 영입 담당 시니어 인사관',
        '차년도 사업 전략 및 경영 혁신 기획 파트장',
        '바이럴 마케팅 및 브랜드 커뮤니케이션 스페셜리스트',
        '자금 포트폴리오 자본 배분 및 예산 통제 CFO',
        '신규 매출 판로 개척 및 파트너십 구축 영업 팀장',
        '매출/매입 세부 장부 기장 및 결산 전표 검산 기장사',
        '스케줄 동선 조율 및 CEO 전담 행정 업무 비서실장',
        '사무 자산 관리 및 복리후생 인프라 총무 담당관'
      ];
      
      const mergedConfig = Array.from({ length: 8 }, (_, idx) => {
        if (idx < recommendedAgents.length) {
          return {
            name: recommendedAgents[idx].name || defaultNames[idx],
            role: recommendedAgents[idx].role || defaultRoles[idx],
            expertise: recommendedAgents[idx].expertise || defaultExpertises[idx]
          };
        } else {
          return {
            name: defaultNames[idx],
            role: defaultRoles[idx],
            expertise: defaultExpertises[idx]
          };
        }
      });
      
      setNewStudioAgentsConfig(mergedConfig);
      setHasUsedAiRecommend(true);
    } catch (e: any) {
      console.error('handleRecommendConfig Error:', e);
      alert(`AI 추천 설정 오류: ${e.message || e}`);
    } finally {
      setIsRecommending(false);
    }
  };

  // 5. 새 스튜디오 생성 (서버 DB 저장, localStorage 캐시 백업)
  const handleCreateStudio = async () => {
    console.log('handleCreateStudio called. newStudioName:', newStudioName, 'user.id:', user?.id, 'newStudioType:', newStudioType);
    if (!newStudioName.trim()) {
      alert('스튜디오 이름을 입력해주세요.');
      return;
    }
    if (!user?.id) {
      alert('로그인 세션이 만료되었거나 사용자 정보가 없습니다. 다시 로그인해 주세요.');
      return;
    }
    try {
      const activeConfig = newStudioAgentsConfig.slice(0, newStudioAgentCount);

      const initialAgentState: Record<string, any> = {};
      activeConfig.forEach((agent: any, idx: number) => {
        initialAgentState[agent.name] = {
          status: 'idle',
          room: idx < 4 ? 'DevRoom' : 'Conference',
          log: '',
          role: agent.role,
          expertise: agent.expertise,
          characterIdx: idx % 8
        };
      });

      const usedAiRecommend = hasUsedAiRecommend;

      let welcomeLogs: any[] = [];

      if (usedAiRecommend) {
        let geminiApiKey = '';
        try {
          const keysStr = localStorage.getItem('alo_api_keys');
          if (keysStr) {
            const keys = JSON.parse(keysStr);
            geminiApiKey = keys['gemini'] || '';
          }
        } catch (e) { /* ignore */ }

        if (geminiApiKey) {
          try {
            const agentsList = activeConfig.map((a: any) => `${a.name}(${a.role}, ${a.expertise})`).join(', ');
            const welcomePrompt = `당신은 새로 설립된 한국 회사 "${newStudioName}"의 직원들입니다.
설립 목적: "${newStudioDesc}"
직원 목록: ${agentsList}

각 직원이 대표님께 드리는 첫인사(웰컴 멘트)를 한국어로 1~2문장씩 작성해주세요. 각자의 성격, 전문 분야, 부서에 어울리는 개성 넘치고 활기찬 인사말이어야 합니다.
반드시 아래 JSON 배열 포맷으로만 응답하세요 (마크다운 코드블록 제외):
[{"name": "이름", "message": "인사말"}, ...]`;

            const welcomeRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: welcomePrompt }] }],
                  generationConfig: { temperature: 1.0 }
                })
              }
            );

            if (welcomeRes.ok) {
              const welcomeResult = await welcomeRes.json();
              const rawText = welcomeResult?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              const cleanJson = rawText.replace(/```(?:json)?\s*\n?/gi, '').replace(/\n?```/g, '').trim();
              const welcomeMessages = JSON.parse(cleanJson);
              
              welcomeLogs = [
                { agent: '대표님', msg: `🎉 "${newStudioName}" 스튜디오가 개설되었습니다! 각 요원들이 인사드립니다.`, createdAt: new Date().toISOString() }
              ];
              
              for (const wm of welcomeMessages) {
                welcomeLogs.push({
                  agent: wm.name,
                  msg: wm.message,
                  createdAt: new Date().toISOString()
                });
                if (initialAgentState[wm.name]) {
                  initialAgentState[wm.name].log = wm.message.substring(0, 30) + (wm.message.length > 30 ? '...' : '');
                }
              }
            }
          } catch (e) {
            console.error('[Welcome Message Gen] Error:', e);
          }
        }
      }

      if (welcomeLogs.length === 0) {
        let defaultWelcomeMessages: Record<string, string> = {};
        try {
          const resTemplates = await fetch('/api/aistudio/templates-resources');
          if (resTemplates.ok) {
            const tmplData = await resTemplates.json();
            defaultWelcomeMessages = tmplData.defaultWelcomeMessages || {};
          }
        } catch (e) {
          console.error('[Templates Resources] Fetch error:', e);
        }

        welcomeLogs = [
          { agent: '대표님', msg: `🔥 "${newStudioName}" 스튜디오가 개설되었습니다! 일할 준비가 되어 있습니다.`, createdAt: new Date().toISOString() }
        ];
        
        for (const agent of activeConfig) {
          const msg = defaultWelcomeMessages[agent.name] || `안녕하세요 대표님! ${agent.role} 담당 ${agent.name}입니다. 최선을 다하겠습니다!`;
          welcomeLogs.push({
            agent: agent.name,
            msg,
            createdAt: new Date().toISOString()
          });
          if (initialAgentState[agent.name]) {
            initialAgentState[agent.name].log = msg.substring(0, 30) + (msg.length > 30 ? '...' : '');
          }
        }
      }

      const createRes = await fetch('/api/aistudio/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: newStudioName,
          type: 'office'
        })
      });

      let newStudio: any;
      if (createRes.ok) {
        newStudio = await createRes.json();
        fetch(`/api/aistudio/studios/${newStudio.id}/state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentState: initialAgentState, logs: welcomeLogs })
        }).catch(e => console.error('[State Save] Error:', e));
      } else {
        const studioId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        newStudio = {
          id: studioId,
          name: newStudioName,
          type: 'office',
          isSystem: false,
          ownerId: user.id,
          isWorking: false,
          createdAt: new Date().toISOString()
        };
      }

      newStudio.agentState = initialAgentState;
      newStudio.logs = welcomeLogs;
      newStudio.description = newStudioDesc;

      try {
        localStorage.setItem(`alopop_studio_state_${newStudio.id}`, JSON.stringify({
          agentState: initialAgentState,
          logs: welcomeLogs
        }));
      } catch (e) { /* ignore */ }

      console.log('[Studio] Created successfully:', newStudio.id);
      setNewStudioName('');
      setNewStudioDesc('');
      setNewStudioAgentCount(4);
      setHasUsedAiRecommend(false);
      setShowCreateModal(false);
      fetchStudios();
      handleSelectStudio(newStudio);
    } catch (e: any) {
      console.error('handleCreateStudio Catch Block:', e);
      alert(`스튜디오 개설 오류: ${e.message || e}`);
    }
  };

  // 6. 스튜디오 삭제 (서버 우선, localStorage 캐시 정리)
  const handleDeleteStudio = async (studioId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('정말로 이 AI 스튜디오 방을 삭제하시겠습니까? 관련 로그와 산출물이 모두 삭제됩니다.')) return;
    
    try {
      const res = await fetch(`/api/aistudio/delete/${studioId}?userId=${user.id}`, {
        method: 'DELETE'
      });
      if (res.ok || res.status === 404) {
        try {
          const stored = localStorage.getItem('alopop_local_studios');
          if (stored) {
            const localStudios = JSON.parse(stored).filter((s: any) => s.id !== studioId);
            localStorage.setItem('alopop_local_studios', JSON.stringify(localStudios));
          }
          localStorage.removeItem(`alopop_studio_state_${studioId}`);
          localStorage.removeItem(`alopop_local_artifacts_${studioId}`);
        } catch (cacheErr) { /* ignore */ }

        setStudios(prev => prev.filter(s => s.id !== studioId));
        if (selectedStudio?.id === studioId) {
          setSelectedStudio(null);
          setAgentState({});
          setLogs([]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 7. 업무 지시 발송 (시스템: 소켓 / 로컬: 브라우저 자가 구동 오케스트레이션)
  const handleSendTask = () => {
    if (isWorking || !selectedStudio?.id) return;
    if (!taskInput.trim() && attachments.length === 0) return;

    if (selectedStudio.isSystem) {
      // 시스템 공용 스튜디오: 기존 소켓 기반
      if (!socket) return;
      socket.emit('start_studio_task', {
        studioId: selectedStudio.id,
        task: taskInput,
        isRevision: artifacts.length > 0,
        files: attachments
      });
    } else {
      // 로컬 개인 스튜디오: 브라우저 자가 오케스트레이션 가동
      runLocalStudioOrchestration(selectedStudio, taskInput);
    }

    setTaskInput('');
    setAttachments([]);
  };

  // =============================================
  // 로컬 스튜디오 자가 구동 AI 오케스트레이션 엔진
  // =============================================
  const runLocalStudioOrchestration = async (studio: any, task: string) => {
    // 1. 현재 연산용 AI 프로바이더 및 모델명 확보
    // globalProvider가 'gemini-free'이면 gemini 프로바이더로 처리
    const provider = globalProvider === 'gemini-free' ? 'gemini' : globalProvider;
    
    // 2. 해당 프로바이더의 로컬 API Key 추출
    let providerApiKey = '';
    try {
      const keysStr = localStorage.getItem('alo_api_keys');
      if (keysStr) {
        const keys = JSON.parse(keysStr);
        providerApiKey = keys[provider] || '';
      }
    } catch (e) { /* ignore */ }

    if (!providerApiKey) {
      alert(`업무를 수행하려면 [설정]에서 개인 ${provider.toUpperCase()} API Key를 먼저 등록해주세요.`);
      setSettingsOpen(true, true); // 바로 설정창을 열어줌
      return;
    }

    setIsWorking(true);
    const addLog = (agent: string, msg: string) => {
      const logEntry = { agent, msg, createdAt: new Date().toISOString() };
      setLogs(prev => [...prev, logEntry]);
      return logEntry;
    };

    addLog('대표님', `[신규 업무 발주] AI 모델: ${globalModel} | "${task}"`);

    try {
      // 현재 로컬 에이전트 상태에서 파이프라인 구성
      const currentState = { ...agentState };
      const agentNames = Object.keys(currentState);
      let accumulatedDoc = `[대표님의 지시사항]\n"${task}"\n\n`;

      // 에이전트 순차 실행
      for (let i = 0; i < agentNames.length; i++) {
        const agentName = agentNames[i];
        const agentInfo = (currentState[agentName] || {}) as any;
        const role = agentInfo.role || '업무';
        const expertise = agentInfo.expertise || '종합 업무 담당';

        // 에이전트 상태 업데이트: thinking
        currentState[agentName] = { ...currentState[agentName], status: 'thinking', room: 'DevRoom', log: '업무 문서 작성 중...' };
        setAgentState({ ...currentState });
        addLog(agentName, `${role} 업무 처리를 시작합니다... (AI: ${globalModel})`);

        // 프롬프트 생성
        const prompt = `당신은 "${studio.name}" 소속의 ${role} '${agentName}'입니다.
전문성 및 페르소나: ${expertise}
대표님의 핵심 지시: "${task}"
이전 단계의 에이전트들이 작성하고 분석한 문서 내역은 다음과 같습니다:
=== 누적 작성 문서 ===
${accumulatedDoc}
======================

위 자료를 바탕으로, 당신의 전문 역할(${role})에 맞는 새로운 분석 결과, 제안, 혹은 구체적인 기획서 단락을 마크다운(Markdown) 포맷으로 추가 및 확장해 최종 문서를 빌드해 주세요.
오직 한국어(Korean)로 실무 마크다운 결과물만 완벽하게 출력하세요 (사담 금지, 불필요한 마크다운 코드 블록 백틱은 씌우지 마세요).`;

        try {
          let res;
          if (provider === 'gemini') {
            res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${globalModel}:generateContent?key=${providerApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.7 }
                })
              }
            );
          } else if (provider === 'openai') {
            res = await fetch(
              `https://api.openai.com/v1/chat/completions`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${providerApiKey}`
                },
                body: JSON.stringify({
                  model: globalModel,
                  messages: [{ role: 'user', content: prompt }],
                  temperature: 0.7
                })
              }
            );
          } else {
            // Anthropic: CORS 회피용 로컬 백엔드 프록시 호출
            res = await fetch(
              `/api/aistudio/proxy-anthropic`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  apiKey: providerApiKey,
                  model: globalModel,
                  prompt: prompt
                })
              }
            );
          }

          if (res.ok) {
            const result = await res.json();
            let resultText = '';
            
            if (provider === 'gemini') {
              resultText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            } else if (provider === 'openai') {
              resultText = result?.choices?.[0]?.message?.content || '';
            } else if (provider === 'anthropic') {
              resultText = result?.content?.[0]?.text || '';
            }

            accumulatedDoc += `\n### [${agentName} - ${role}의 자문/기획]\n${resultText}\n`;
          } else {
            const errBody = await res.text();
            console.error('API Call Failed:', errBody);
            addLog(agentName, `⚠️ API 호출 실패 (HTTP ${res.status}). 다음 에이전트로 넘어갑니다.`);
          }
        } catch (apiErr: any) {
          addLog(agentName, `⚠️ 네트워크 오류: ${apiErr.message}`);
        }

        // 에이전트 상태 업데이트: idle
        currentState[agentName] = { ...currentState[agentName], status: 'idle', room: i < 4 ? 'DevRoom' : 'Conference', log: '완료!' };
        setAgentState({ ...currentState });
        addLog(agentName, `작업이 끝났습니다. ${i < agentNames.length - 1 ? '다음 에이전트에게 인계합니다.' : '최종 결과를 제출합니다.'}`);
      }

      const versionNum = artifacts.length + 1;
      const docTitle = `${studio.name} 보고서 V${versionNum}`;
      let newArtifact: any = {
        id: `local_artifact_${Date.now()}`,
        name: docTitle,
        content: accumulatedDoc,
        isDeployed: false,
        createdAt: new Date().toISOString()
      };

      try {
        const artifactRes = await fetch(`/api/aistudio/studios/${studio.id}/artifacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: docTitle, content: accumulatedDoc })
        });
        if (artifactRes.ok) {
          newArtifact = await artifactRes.json();
        }
      } catch (e) { /* server save failed, use local artifact */ }

      const updatedArtifacts = [newArtifact, ...artifacts];
      setArtifacts(updatedArtifacts);
      try { localStorage.setItem(`alopop_local_artifacts_${studio.id}`, JSON.stringify(updatedArtifacts)); } catch (e) { /* ignore */ }

      addLog('대표님', `🎉 스튜디오 자문 및 기획 문서 작성이 완료되었습니다! 최종 결과물 [${docTitle}]이 아카이브에 안전하게 등록되었습니다.`);

      const finalLogs = [...logs, { agent: '대표님', msg: `🎉 [${docTitle}] 아카이브 등록 완료!`, createdAt: new Date().toISOString() }];
      fetch(`/api/aistudio/studios/${studio.id}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentState: currentState, logs: finalLogs })
      }).catch(e => console.error('[State Save] Error:', e));
      try { localStorage.setItem(`alopop_studio_state_${studio.id}`, JSON.stringify({ agentState: currentState, logs: finalLogs })); } catch (e) { /* ignore */ }

    } catch (error: any) {
      addLog('대표님', `❌ 에러가 발생하여 연산이 중단되었습니다: ${error.message}`);
    } finally {
      setIsWorking(false);
    }
  };

  // 8. 파일 첨부 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachments(prev => [...prev, {
          name: file.name,
          mimeType: file.type,
          base64: (reader.result as string).split(',')[1],
          url: reader.result
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // 9. 문서 다운로드
  const handleDownloadDoc = (artifact: any) => {
    const element = document.createElement("a");
    const file = new Blob([artifact.content || ''], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${artifact.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // 10. 소스 코드 에디터 오픈
  const handleOpenEditor = async (artifact: any) => {
    try {
      const res = await fetch(`/api/aistudio/history/content/${artifact.id}`);
      if (res.ok) {
        const code = await res.text();
        setEditorCode(code);
        setViewDoc(artifact);
        setShowEditor(true);
      }
    } catch (e) {
      alert('소스를 가져오는 데 실패했습니다.');
    }
  };

  // 11. 소스 세이브
  const handleSaveEditor = async () => {
    if (!viewDoc?.id) return;
    try {
      const res = await fetch(`/api/aistudio/history/content/${viewDoc.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: editorCode
      });
      if (res.ok) {
        alert('성공적으로 저장되었습니다!');
        setShowEditor(false);
        fetchArtifacts(selectedStudio.id);
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 12. 게임 런칭 (PM2 배포)
  const handleDeployGame = async (artifact: any) => {
    setIsDeploying(artifact.id);
    try {
      const res = await fetch(`/api/aistudio/deploy/${artifact.id}`, { method: 'POST' });
      if (res.ok) {
        alert('PM2 서버에 성공적으로 자동 런칭 및 배포되었습니다!');
        fetchArtifacts(selectedStudio.id);
      } else {
        const err = await res.json();
        alert(`배포 실패: ${err.error || '알 수 없는 서버 오류'}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeploying(null);
    }
  };

  // 13. 게임 배포 해제
  const handleUndeployGame = async (artifact: any) => {
    if (!confirm('정말로 이 게임의 포트 배포를 중지하고 PM2에서 제거하시겠습니까?')) return;
    setIsDeploying(artifact.id);
    try {
      const res = await fetch(`/api/aistudio/undeploy/${artifact.id}`, { method: 'POST' });
      if (res.ok) {
        alert('배포가 중지 및 회수되었습니다.');
        fetchArtifacts(selectedStudio.id);
      } else {
        alert('배포 회수에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeploying(null);
    }
  };

  // 14. 수동 QA 호출
  const handleRunManualQA = (artifact: any) => {
    if (isWorking || !socket) return;
    socket.emit('run_studio_manual_qa', {
      studioId: selectedStudio.id,
      url: artifact.fileUrl,
      label: artifact.name
    });
  };

  // 15. 산출물 삭제
  const handleDeleteArtifact = async (artifactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('정말로 이 산출물 기록을 아카이브에서 영구 삭제하시겠습니까? 물리 파일도 함께 지워집니다.')) return;
    try {
      const res = await fetch(`/api/aistudio/history/delete/${artifactId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchArtifacts(selectedStudio.id);
        if (viewDoc?.id === artifactId) setViewDoc(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 가상 요원 개별 렌더링 함수 (인라인 스타일 및 transition)
  const renderAgent = (name: string, svgContent: string, showDesk = false, isAbsent = false) => {
    const info = (agentState[name] || { status: 'idle', room: 'DevRoom', log: '' }) as any;
    const colors: Record<string, string> = {
      Alice: '#ff4d4d', Carol: '#ffb3ff', Bob: '#4da6ff', Dave: '#33cc33',
      Justice: '#fbbf24', Solomon: '#a855f7', Scribe: '#0891b2',
      Beat: '#e11d48', Budget: '#10b981', Trend: '#ec4899',
      '임변호': '#fbbf24', '지분석': '#a855f7', '서기록': '#0891b2', '오기획': '#e11d48', '한재무': '#10b981', '윤홍보': '#ec4899', '김장부': '#38bdf8', '이절세': '#22c55e', '박감사': '#eab308', '정신고': '#f97316', '최재무': '#a855f7'
    };
    const roles: Record<string, string> = {
      Alice: '기획', Carol: '디자인', Bob: '개발', Dave: 'QA',
      Justice: '변호사', Solomon: '분석관', Scribe: '기록관',
      Beat: '총괄', Budget: '재무', Trend: '마케팅',
      '임변호': '변호사', '지분석': '분석관', '서기록': '기록관', '오기획': '총괄', '한재무': '재무', '윤홍보': '마케팅', '김장부': '기장', '이절세': '세무', '박감사': '감사', '정신고': '신고', '최재무': 'CFO'
    };
    const color = colors[name] || '#a855f7';
    const role = roles[name] || '요원';

    return (
      <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '55px', height: showDesk ? '80px' : '65px', flexShrink: 0 }}>
        {/* (항상 고정되는) 배경: 💻 개인 책상 및 부재중 이름표 */}
        {showDesk && (
          <div style={{ position: 'absolute', bottom: '0px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '52px', height: '16px', backgroundColor: '#1e1e2d', borderTop: '2px solid #3b3b54', borderRadius: '4px', zIndex: 10, boxShadow: '0 3px 5px rgba(0,0,0,0.4)' }}>
              <div style={{ position: 'absolute', top: '2px', left: '19px', width: '14px', height: '9px', backgroundColor: isAbsent ? '#0f0f16' : '#1a1a24', border: '1px solid ' + (isAbsent ? '#4b5563' : color), borderRadius: '2px', boxShadow: isAbsent ? 'none' : '0 0 6px ' + color + ', inset 0 0 4px ' + color, transition: 'all 0.3s' }} />
            </div>
          </div>
        )}

        {/* 캐릭터 본체, 말풍선, 상태, 이름표 */}
        {name && (
          <motion.div
            layout
            layoutId={`glide-${name}`}
            transition={{ type: 'tween', ease: 'easeInOut', duration: 1.5 }}
            style={{ 
              position: 'absolute', 
              bottom: showDesk ? '16px' : '8px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              zIndex: isAbsent ? 10 : 100,
              opacity: isAbsent ? 0 : 1,
              scale: isAbsent ? 0.8 : 1,
              pointerEvents: isAbsent ? 'none' : 'auto',
              transition: 'opacity 0.5s ease-out, scale 0.5s ease-out'
            }}
          >
            {/* 💬 말풍선 */}
            {info.log && (
              <div style={{
                position: 'absolute',
                bottom: '53px',
                backgroundColor: 'rgba(20, 20, 30, 0.95)',
                color: '#f8fafc',
                padding: '3px 6px',
                borderRadius: '5px',
                fontSize: '0.6rem',
                whiteSpace: 'nowrap',
                border: '1px solid ' + color + '66',
                boxShadow: '0 4px 6px rgba(0,0,0,0.6)',
                zIndex: 110,
                pointerEvents: 'none'
              }}>
                {info.log}
                <div style={{
                  position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)',
                  width: '0', height: '0', borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                  borderTop: '4px solid rgba(20, 20, 30, 0.95)'
                }} />
              </div>
            )}

            {/* 🧑‍💻 캐릭터 일러스트 & 상태 배지 */}
            <div style={{ position: 'relative', height: '40px', width: '35px', zIndex: 105 }}>
              {info.status !== 'idle' && (
                <div style={{
                  position: 'absolute', top: '-5px', right: '-8px',
                  backgroundColor: color,
                  borderRadius: '50%', width: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.45rem', fontWeight: 'bold', color: '#fff',
                  boxShadow: '0 0 3px rgba(0,0,0,0.5)', zIndex: 120
                }}>
                  {info.status === 'thinking' ? '생각' : (info.status === 'meeting' ? '회의' : '작업')}
                </div>
              )}
              <div 
                style={{
                  width: '35px', height: '40px',
                  filter: info.status !== 'idle' ? 'drop-shadow(0 0 4px ' + color + '88)' : 'none',
                  transition: 'filter 0.3s'
                }} 
                dangerouslySetInnerHTML={{ __html: SVG_ASSETS[selectedStudio.type === 'game' ? `svg${name}` : (selectedStudio.type === 'law' ? `svg${name}` : `svg${name}`)] || svgContent }} 
              />
            </div>

            {/* 🏷️ 이름표 */}
            <span style={{ fontSize: '0.55rem', color: '#cbd5e1', marginTop: '-2px', fontWeight: 'bold', whiteSpace: 'nowrap', textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000', zIndex: 125 }}>
              {name} ({role})
            </span>
          </motion.div>
        )}
      </div>
    );
  };


  return (
    <div className="w-full h-full flex bg-[#130d1a] text-[#e2e8f0] font-sans overflow-hidden">
      
      {(!isMobile || activeMobileView === 'list') && (
        <div className={`${isMobile ? 'w-full' : 'w-64 border-r'} border-[#2d223c] bg-[#171021] flex flex-col flex-shrink-0 h-full`}>
        {/* 헤더 */}
        <div className="p-4 border-b border-[#2d223c] flex items-center">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-purple-400 animate-pulse" />
            <span className="font-bold text-sm text-purple-200 tracking-wider">AI 스튜디오 리스트</span>
          </div>
        </div>

        {/* 리스트 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-purple-900/20">
          {studios.map(studio => {
            const isSelected = selectedStudio?.id === studio.id;
            const IconComponent = studio.type === 'game' ? Gamepad2 : (studio.type === 'law' ? Scale : (studio.type === 'tax' ? Server : (studio.type === 'office' ? Building2 : Music)));
            const typeLabel = studio.type === 'game' ? '게임' : (studio.type === 'law' ? '법률' : (studio.type === 'tax' ? '세무' : (studio.type === 'office' ? '사무직' : '공연')));
            
            return (
              <div 
                key={studio.id}
                onClick={() => handleSelectStudio(studio)}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border duration-300 ${isSelected ? 'bg-purple-950/40 border-purple-800/60 shadow-lg text-purple-100' : 'bg-transparent border-transparent text-[#cbd5e1] hover:bg-purple-950/15 hover:text-white'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-purple-800 text-white' : 'bg-[#21182c] text-purple-400 group-hover:text-purple-300'} transition-all`}>
                    <IconComponent size={16} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate leading-snug">{studio.name}</span>
                    <span className="text-[9px] text-purple-400/80 font-medium tracking-tight mt-0.5">{typeLabel} 스튜디오</span>
                  </div>
                </div>
                
                {/* 본인 스튜디오일 때만 삭제 버튼 활성화 */}
                {!studio.isSystem && (
                  <button 
                    onClick={(e) => handleDeleteStudio(studio.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 rounded transition-all hover:bg-red-950/20"
                    title="스튜디오 삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}

          {/* 리스트바와 완벽히 일관성 있는 디자인의 '새 스튜디오 개설' 버튼 */}
          <div 
            onClick={() => setShowCreateModal(true)}
            className="group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border border-dashed border-purple-900/30 hover:border-purple-600/40 hover:bg-purple-950/15 text-purple-400 hover:text-purple-300 duration-300 mt-2.5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-purple-950/30 text-purple-400 transition-all border border-purple-900/20 group-hover:bg-purple-900/30">
                <Plus size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-extrabold truncate leading-snug">새 스튜디오 개설</span>
                <span className="text-[9px] text-purple-500/80 font-medium tracking-tight mt-0.5">커스텀 협업 공간 추가</span>
              </div>
            </div>
          </div>

          {studios.length === 0 && (
            <div className="text-center py-12 px-4">
              <Bot size={28} className="mx-auto text-purple-800 mb-3" />
              <p className="text-[11px] text-zinc-500">생성된 AI 스튜디오가 없습니다.</p>
            </div>
          )}
        </div>
        
        {/* 하단 내 프로필 */}
        <div className="p-3 border-t border-[#2d223c] bg-[#110b19] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-300 border border-purple-800/50">
            {user?.username?.[0] || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-purple-200 truncate">{user?.username || '사용자'}</span>
            <span className="text-[9px] text-zinc-500 font-mono tracking-tighter truncate">{user?.id?.substring(0, 13)}...</span>
          </div>
        </div>
      </div>
      )}

      {/* ==========================================
          [우측 컬럼] 메인 스튜디오 영역
         ========================================== */}
      {selectedStudio ? (
        (!isMobile || activeMobileView !== 'list') && (
          <div className="flex-1 flex overflow-hidden">
            
            {/* 가상 사무실 + 터미널 로그 + 전송 패널 */}
            {(!isMobile || activeMobileView === 'detail') && (
              <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-[#0f0a15] border-r border-[#2d223c]">
            
            {/* 가상 사무실 시뮬레이션 (상단) - 원래 2단 오피스 맵 디자인 완벽 복원 */}
            <div className="h-[405px] border-b border-[#2d223c] bg-[#110b17] relative p-3.5 flex flex-col gap-3 flex-shrink-0 select-none overflow-hidden">
              
              {/* 타이틀HUD */}
              <div className="flex justify-between items-center z-20 w-full flex-shrink-0">
                <div className="flex items-center gap-2 min-w-[50px]">
                  {isMobile && (
                    <button
                      onClick={() => setActiveMobileView('list')}
                      className="p-1.5 rounded-lg bg-purple-900/30 text-purple-300 border border-purple-800/40 hover:bg-purple-800/60 hover:text-white transition-all shadow-sm flex items-center gap-1 text-[10px] font-bold"
                    >
                      <ChevronLeft size={12} />
                      목록
                    </button>
                  )}
                </div>

                {/* 🤖 분석용 AI 모델 셀렉터 (최상축 중간 배치 - 항시 노출 및 채팅창 100% 공용 연결) */}
                <AiModelSelector
                  selectedAiModel={selectedAiModel}
                  setSelectedAiModel={setSelectedAiModel}
                  aiModels={aiModels}
                  activeEvents={activeEvents}
                  exhaustedFreeEvents={exhaustedFreeEvents}
                  disabled={isWorking}
                  studioId={selectedStudio?.id}
                />
                
                <div className="flex items-center gap-1.5 min-w-[50px] justify-end">
                  <button
                    onClick={() => isMobile ? setActiveMobileView('archive') : setShowDesktopArchive(prev => !prev)}
                    className={`relative p-1.5 rounded-lg border transition-all shadow-sm flex items-center gap-1 text-[10px] font-bold ${(!isMobile && showDesktopArchive) ? 'bg-purple-800/80 text-white border-purple-600' : 'bg-purple-900/30 text-purple-300 border-purple-800/40 hover:bg-purple-800/60 hover:text-white'}`}
                  >
                    <FolderOpen size={12} />
                    산출물 {(!isMobile && showDesktopArchive) && <span className="font-mono ml-0.5 opacity-80">(닫기)</span>}
                    {artifacts.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[#1b1227]">
                        {artifacts.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* 🏢 원래 디자인 2단 가상 룸 배치 (깃허브 디자인 100% 완벽 복원) */}
              {(() => {
                const agentsInConference = Object.values(agentState).some((info: any) => info.room === 'Conference');
                const agentsInPantry = Object.values(agentState).some((info: any) => info.room === 'Pantry');
                
                const config: Record<string, string> = {};
                
                // 가상 사무직 8인의 SVG 아셋 목록 (순차 매핑용 풀)
                const officeSvgs = [
                  SVG_ASSETS['svg최인사'],
                  SVG_ASSETS['svg정기획'],
                  SVG_ASSETS['svg홍홍보'],
                  SVG_ASSETS['svg윤재무'],
                  SVG_ASSETS['svg김영업'],
                  SVG_ASSETS['svg이회계'],
                  SVG_ASSETS['svg박비서'],
                  SVG_ASSETS['svg강지원']
                ];
                
                // 1. 현재 존재하는 에이전트들의 SVG 에셋을 SVG_ASSETS에서 동적으로 찾아 매핑
                Object.keys(agentState).forEach((name, idx) => {
                  if (SVG_ASSETS['svg' + name]) {
                    config[name] = SVG_ASSETS['svg' + name];
                  } else {
                    // AI 추천 등으로 인해 SVG_ASSETS에 이름이 없는 임의의 요원인 경우, 8인 사무직 캐릭터를 골고루 순차 할당!
                    config[name] = officeSvgs[idx % officeSvgs.length];
                  }
                });

                // 2. 동적 매핑 후에도 비어있거나 부족할 때를 대비한 타입별 기본 백업 요원 설정
                if (selectedStudio.type === 'game') {
                  if (!config['Alice']) config['Alice'] = SVG_ASSETS['svgAlice'];
                  if (!config['Carol']) config['Carol'] = SVG_ASSETS['svgCarol'];
                  if (!config['Bob']) config['Bob'] = SVG_ASSETS['svgBob'];
                  if (!config['Dave']) config['Dave'] = SVG_ASSETS['svgDave'];
                } else if (selectedStudio.type === 'tax') {
                  if (!config['김장부']) config['김장부'] = SVG_ASSETS['svg김장부'];
                  if (!config['이절세']) config['이절세'] = SVG_ASSETS['svg이절세'];
                  if (!config['박감사']) config['박감사'] = SVG_ASSETS['svg박감사'];
                  if (!config['정신고']) config['정신고'] = SVG_ASSETS['svg정신고'];
                  if (!config['최재무']) config['최재무'] = SVG_ASSETS['svg최재무'];
                  if (!config['김기장']) config['김기장'] = SVG_ASSETS['svg김장부'];
                } else if (selectedStudio.type === 'law') {
                  if (!config['임변호']) config['임변호'] = SVG_ASSETS['svg임변호'];
                  if (!config['지분석']) config['지분석'] = SVG_ASSETS['svg지분석'];
                  if (!config['서기록']) config['서기록'] = SVG_ASSETS['svg서기록'];
                  // 하위 호환용 영문 백업
                  if (!config['Justice']) config['Justice'] = SVG_ASSETS['svg임변호'];
                  if (!config['Solomon']) config['Solomon'] = SVG_ASSETS['svg지분석'];
                  if (!config['Scribe']) config['Scribe'] = SVG_ASSETS['svg서기록'];
                } else {
                  if (!config['오기획']) config['오기획'] = SVG_ASSETS['svg오기획'];
                  if (!config['한재무']) config['한재무'] = SVG_ASSETS['svg한재무'];
                  if (!config['윤홍보']) config['윤홍보'] = SVG_ASSETS['svg윤홍보'];
                  // 하위 호환용 영문 백업
                  if (!config['Beat']) config['Beat'] = SVG_ASSETS['svg오기획'];
                  if (!config['Budget']) config['Budget'] = SVG_ASSETS['svg한재무'];
                  if (!config['Trend']) config['Trend'] = SVG_ASSETS['svg윤홍보'];
                }

                return (
                  <LayoutGroup id="office-layout">
                    <div className="flex-1 flex flex-col gap-[15px] relative mt-1 overflow-hidden z-10">
                    {/* 동적 CSS 키프레임 애니메이션 삽입 */}
                    <style dangerouslySetInnerHTML={{ __html: OFFICE_STYLE }} />

                    {/* 상단 1단: 회의실과 탕비실 나란히 50:50 배치 */}
                    <div style={{ display: 'flex', gap: '15px', height: '170px', flexShrink: 0 }}>
                      
                      {/* 1. 회의실 (Conference Room) */}
                      <div style={{ flex: 1, backgroundColor: 'rgba(168,85,247,0.05)', border: '1px dashed #581c87', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'visible' }}>
                        <span style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 'bold', marginBottom: 'auto', position: 'relative', zIndex: 20, textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>📢 회의실</span>

                        {/* 배경 소품: 화이트보드 */}
                        <div style={{ position: 'absolute', top: '15px', right: '15px', width: '50px', height: '30px', backgroundColor: '#e2e8f0', borderRadius: '4px', border: '2px solid #64748b', zIndex: 1, boxShadow: 'inset 0 0 5px rgba(0,0,0,0.1)' }}>
                          {agentsInConference ? (
                            <svg width="50" height="30" style={{ position: 'absolute', top: 0, left: 0 }}>
                              <polyline points="5,25 15,15 25,20 40,5" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="50" strokeDashoffset="0">
                                <animate attributeName="stroke-dashoffset" from="50" to="0" dur="1s" fill="freeze" />
                              </polyline>
                            </svg>
                          ) : (
                            <div style={{ position: 'absolute', bottom: '4px', left: '6px', width: '25px', height: '2px', backgroundColor: '#ef4444' }} />
                          )}
                        </div>

                        {/* 배경 소품: 회의용 중앙 테이블 */}
                        <div style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', width: '80px', height: '50px', backgroundColor: '#2d2d3a', border: `3px solid ${agentsInConference ? '#a855f7' : '#581c87'}`, borderRadius: '40px', zIndex: 5, boxShadow: agentsInConference ? '0 0 15px rgba(168,85,247,0.8)' : '0 8px 15px rgba(0,0,0,0.6)', transition: 'all 0.5s' }}>
                          {agentsInConference && (
                            <motion.div animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', top: '50%', left: '50%', x: '-50%', y: '-50%', width: '30px', height: '15px', borderRadius: '50%', backgroundColor: 'rgba(168,85,247,0.5)', filter: 'blur(3px)' }} />
                          )}
                        </div>

                        {/* 회의실 내 에이전트 캐릭터 렌더링 (원래의 50:50 Grid를 유지하며 스크롤바 영구 제거 + overflow: visible 및 zIndex 상향) */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(2, 1fr)', // 2행 2열(최대 4인) 구조 영구 고정 (헌법 수호) 
                          gap: '5px 2px', 
                          justifyItems: 'center', 
                          alignItems: 'end', 
                          marginTop: '0px', 
                          position: 'relative', 
                          zIndex: 50,
                          overflow: 'visible'
                        }}>
                          {Object.entries(config)
                            .filter(([name]) => {
                              const info = (agentState[name] || { room: 'DevRoom' }) as any;
                              return info.room === 'Conference';
                            })
                            .map(([name, svgContent]) => {
                              const info = (agentState[name] || { status: 'idle', room: 'DevRoom', log: '' }) as any;
                              return (
                                <Agent 
                                  key={name}
                                  name={name}
                                  svgContent={svgContent}
                                  showDesk={false}
                                  isAbsent={false}
                                  customRole={(info as any).role}
                                  customExpertise={(info as any).expertise}
                                  status={info.status}
                                  log={info.log}
                                  selectedStudioType={selectedStudio.type}
                                />
                              );
                            })}
                        </div>
                      </div>

                      {/* 2. Pantry 탕비실 (Pantry Room) */}
                      <div style={{ flex: 1, backgroundColor: 'rgba(56,189,248,0.05)', border: '1px dashed #0c4a6e', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'visible' }}>
                        <span style={{ fontSize: '0.7rem', color: '#7dd3fc', fontWeight: 'bold', marginBottom: 'auto', position: 'relative', zIndex: 20, textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>☕ 휴게실</span>

                        {/* 배경 소품: 커피 카운터 및 머신 */}
                        <div style={{ position: 'absolute', top: '40px', right: '15px', width: '55px', height: '20px', backgroundColor: '#1e293b', borderRadius: '4px', borderBottom: '3px solid #0f172a', zIndex: 1 }}>
                          <div style={{ position: 'absolute', bottom: '100%', right: '8px', width: '18px', height: '24px', backgroundColor: '#334155', borderRadius: '4px 4px 0 0', border: `1px solid ${agentsInPantry ? '#38bdf8' : '#475569'}`, transition: 'all 0.5s' }}>
                            <div style={{ position: 'absolute', top: '5px', left: '3px', width: '10px', height: '5px', backgroundColor: '#0f172a', borderRadius: '2px' }} />
                            <div style={{ position: 'absolute', top: '3px', right: '3px', width: '4px', height: '4px', backgroundColor: agentsInPantry ? '#4ade80' : '#38bdf8', borderRadius: '50%', boxShadow: agentsInPantry ? '0 0 8px 1px #4ade80, 0 0 15px 3px #22c55e, 0 0 25px 4px #16a34a, 0 0 40px 6px #15803d' : '0 0 5px #38bdf8', transition: 'all 0.3s' }} />
                            {agentsInPantry && (
                              <motion.div animate={{ y: [0, 8, 8], opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', top: '10px', left: '7px', width: '2px', height: '4px', backgroundColor: '#451a03' }} />
                            )}
                          </div>
                          <div style={{ position: 'absolute', bottom: '100%', right: '32px', width: '8px', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '1px 1px 4px 4px' }}>
                            {agentsInPantry && (
                              <motion.div animate={{ y: [0, -10], opacity: [0, 0.8, 0], scale: [1, 1.5] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} style={{ position: 'absolute', top: '-8px', left: '2px', width: '3px', height: '8px', borderLeft: '2px solid rgba(255,255,255,0.6)', filter: 'blur(1px)', borderRadius: '50%', transform: 'rotate(10deg)' }} />
                            )}
                          </div>
                        </div>

                        {/* 배경 소품: 화분 */}
                        <div style={{ position: 'absolute', bottom: '15px', left: '20px', zIndex: 5 }}>
                          <div style={{ position: 'absolute', bottom: '14px', left: '-6px', width: '18px', height: '18px', backgroundColor: '#22c55e', borderRadius: '50% 0 50% 50%', transform: 'rotate(15deg)' }} />
                          <div style={{ position: 'absolute', bottom: '12px', left: '4px', width: '20px', height: '20px', backgroundColor: '#16a34a', borderRadius: '50% 50% 50% 0', transform: 'rotate(-10deg)' }} />
                          <div style={{ position: 'absolute', bottom: '0', left: '0', width: '16px', height: '14px', backgroundColor: '#854d0e', borderRadius: '2px', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px' }} />
                        </div>

                        {/* 탕비실 내 에이전트 캐릭터 렌더링 (원래의 50:50 Grid를 유지하며 스크롤바 영구 제거 + overflow: visible 및 zIndex 상향) */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(2, 1fr)', // 2행 2열(최대 4인) 구조 영구 고정 (헌법 수호) 
                          gap: '5px 2px', 
                          justifyItems: 'center', 
                          alignItems: 'end', 
                          marginTop: '0px', 
                          position: 'relative', 
                          zIndex: 50,
                          overflow: 'visible'
                        }}>
                          {Object.entries(config)
                            .filter(([name]) => {
                              const info = (agentState[name] || { room: 'DevRoom' }) as any;
                              return info.room === 'Pantry';
                            })
                            .map(([name, svgContent]) => {
                              const info = (agentState[name] || { status: 'idle', room: 'DevRoom', log: '' }) as any;
                              return (
                                <Agent 
                                  key={name}
                                  name={name}
                                  svgContent={svgContent}
                                  showDesk={false}
                                  isAbsent={false}
                                  status={info.status}
                                  log={info.log}
                                  selectedStudioType={selectedStudio.type}
                                  customRole={info.role}
                                  customExpertise={info.expertise}
                                />
                              );
                            })}
                        </div>
                      </div>
                    </div>

                    {/* 하단 2단: 메인 작업실 가로 전체 배치 */}
                    <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #2d2d3a', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', minHeight: '130px', overflow: 'visible' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: 'auto', textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>💻 메인 작업실</span>
                      
                      {(() => {
                        const totalAgentCount = Object.keys(agentState).length;
                        const deskCount = totalAgentCount > 0 
                          ? (totalAgentCount <= 4 ? totalAgentCount : 4) 
                          : 4;

                        return (
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: `repeat(${deskCount}, 1fr)`, 
                            gap: '15px 5px', 
                            justifyItems: 'center', 
                            alignItems: 'end', 
                            marginTop: '10px',
                            position: 'relative',
                            zIndex: 50,
                            overflow: 'visible',
                            paddingBottom: '5px'
                          }}>
                            {/* 💻 요원별 순차 루프 대신, 직원 수에 맞춘 deskCount 책상 시트를 기준으로 렌더링 (헌법 3-1번) */}
                            {Array.from({ length: deskCount }).map((_, seatIdx) => {
                              // 현재 이 책상 자리에 배정된 요원 찾기
                              const assignedAgentName = Object.keys(deskAssignments).find(
                                name => deskAssignments[name] === seatIdx
                              );

                              if (assignedAgentName) {
                                const info = (agentState[assignedAgentName] || { status: 'idle', room: 'DevRoom', log: '' }) as any;
                                const isPresent = info.room === 'DevRoom';

                                if (isPresent) {
                                  // 실제로 메인 작업실에 존재할 때만 요원 본체와 책상을 함께 렌더링
                                  const svgContent = config[assignedAgentName] || SVG_ASSETS['svgAlice'];
                                  return (
                                    <Agent 
                                      key={assignedAgentName}
                                      name={assignedAgentName}
                                      svgContent={svgContent}
                                      showDesk={true}
                                      isAbsent={false}
                                      status={info.status}
                                      log={info.log}
                                      selectedStudioType={selectedStudio.type}
                                      customRole={info.role}
                                      customExpertise={info.expertise}
                                    />
                                  );
                                }
                              }

                              // 요원이 없거나 다른 방으로 이동(부재중)했다면, 빈 책상만 렌더링 (요원 본체는 언마운트하여 점프 이동 방지)
                              return (
                                <Agent 
                                  key={`empty-seat-${seatIdx}`}
                                  name=""
                                  svgContent=""
                                  showDesk={true}
                                  isAbsent={true}
                                  status="idle"
                                  log=""
                                  selectedStudioType={selectedStudio.type}
                                />
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </LayoutGroup>
              );
              })()}
            </div>

            {/* 터미널 로그 목록 (가운데) */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#09060c] font-mono text-xs flex flex-col gap-2 scrollbar-thin scrollbar-thumb-purple-950/30">
              {logs.map((log, index) => {
                const colorMap: Record<string, string> = {
                  Alice: 'text-red-400', Carol: 'text-pink-400', Bob: 'text-sky-400', Dave: 'text-emerald-400',
                  Justice: 'text-amber-400', Solomon: 'text-purple-400', Scribe: 'text-cyan-400',
                  Beat: 'text-rose-400', Budget: 'text-teal-400', Trend: 'text-fuchsia-400',
                  '대표님': 'text-yellow-400'
                };
                const colorClass = colorMap[log.agent] || 'text-[#cbd5e1]';
                
                return (
                  <div key={index} className="leading-relaxed hover:bg-purple-950/5 p-1 rounded transition-colors flex items-start gap-1">
                    <span className={`font-bold font-mono flex-shrink-0 ${colorClass}`}>[{log.agent}]</span>
                    <span className={`font-mono ${log.error ? 'text-red-400 font-bold' : 'text-zinc-300'}`}>
                      {log.msg}
                    </span>
                  </div>
                );
              })}
              
              {logs.length === 0 && (
                <div className="flex-1 flex items-center justify-center flex-col gap-2 opacity-30 select-none">
                  <Bot size={32} className="text-purple-900" />
                  <span className="text-[10px] text-zinc-500 font-mono">시뮬레이션 로그가 이곳에 표시됩니다.</span>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* 업무 지시 패널 (하단) */}
            <div className="p-3 bg-[#110b19] border-t border-[#2d223c] flex-shrink-0 flex flex-col gap-2">
              
              {/* 동적 지시 성격 구분 라벨 및 초기화 단추 */}
              <div className="flex justify-between items-center px-1 py-0.5 select-none">
                <div className="flex items-center">
                  <span className={`text-[10px] font-extrabold px-4 py-1.5 rounded-md ${artifacts.length > 0 ? 'bg-purple-950/60 text-purple-300 border border-purple-800/40' : 'bg-blue-950/60 text-blue-300 border border-blue-800/40'}`}>
                    {artifacts.length > 0 ? '✍️ 수정 작업 지시 상태' : '🌠 신규 업무 지시 상태'}
                  </span>
                </div>
                
                {artifacts.length > 0 && (
                  <button 
                    disabled={isWorking}
                    onClick={() => {
                      if (confirm('정말로 이 스튜디오의 아카이브 기록을 모두 초기화하고 완전히 처음부터 신규 업무 지시를 내리시겠습니까?')) {
                        socket?.emit('reset_studio_state', selectedStudio.id);
                        setTaskInput('');
                      }
                    }}
                    className={`flex items-center gap-1.5 text-[10px] font-extrabold px-4 py-1.5 rounded-lg border transition-all ${isWorking ? 'bg-zinc-800 text-zinc-500 border-zinc-700/50 cursor-not-allowed' : 'bg-purple-600 text-white border-purple-500 hover:bg-purple-500 shadow-sm'}`}
                  >
                    <RefreshCw size={10} />
                    <span>🌠 새 작업지시</span>
                  </button>
                )}
              </div>

              {/* 파일 첨부 미리보기 */}
              {attachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="relative w-11 h-11 border border-purple-800/40 rounded-lg overflow-hidden bg-purple-950/20 flex-shrink-0 group">
                      {file.mimeType.startsWith('image/') ? (
                        <img src={file.url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-purple-300 font-mono">DOC</div>
                      )}
                      <button 
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 인풋 영역 */}
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  multiple 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                
                {/* 첨부단추 */}
                <button 
                  disabled={isWorking}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2.5 rounded-lg border transition-all ${isWorking ? 'text-zinc-600 border-zinc-900 cursor-not-allowed' : 'text-purple-400 border-purple-800/40 hover:bg-purple-950/20 hover:text-white'}`}
                  title="파일 첨부"
                >
                  <Paperclip size={15} />
                </button>

                {/* 텍스트 인풋 */}
                <textarea 
                  disabled={isWorking}
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendTask();
                    }
                  }}
                  placeholder={isWorking ? "🤖 AI 에이전트들이 작업 지시를 받아 열일하는 중입니다..." : (artifacts.length > 0 ? "스튜디오에 피드백(수정 작업 지시)을 남겨주세요... (엔터 전송)" : "스튜디오에 지시할 신규 개발/자문 업무 내용을 상세히 입력해주세요... (엔터 전송)")}
                  className={`flex-1 px-3 py-2 rounded-xl border text-xs focus:outline-none resize-none font-sans leading-relaxed h-24 overflow-y-auto scrollbar-thin transition-all ${isWorking ? 'bg-[#1a1226]/50 border-purple-900/20 text-zinc-500 cursor-not-allowed' : 'bg-[#0a050f] border-purple-800/40 text-white focus:border-purple-600 focus:ring-1 focus:ring-purple-600/40'}`}
                />

                {/* 전송단추 */}
                <button 
                  disabled={isWorking || (!taskInput.trim() && attachments.length === 0)}
                  onClick={handleSendTask}
                  className={`px-4 py-2 h-10 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 flex-shrink-0 ${isWorking || (!taskInput.trim() && attachments.length === 0) ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed' : 'bg-purple-600 text-white border border-purple-500 hover:bg-purple-500'}`}
                >
                  <Send size={12} />
                  <span>전송</span>
                </button>
              </div>
            </div>
          </div>
        )}

          {/* ==========================================
              [우측 서브 사이드바] 스튜디오 산출물 아카이브
             ========================================== */}
          {(isMobile ? activeMobileView === 'archive' : showDesktopArchive) && (
            <div className={`${isMobile ? 'w-full' : 'w-80'} flex flex-col h-full bg-[#150e1e] flex-shrink-0 select-none border-l border-[#2d223c]`}>
              
              {/* 헤더 */}
              <div className="p-4 border-b border-[#2d223c] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isMobile && (
                    <button
                      onClick={() => setActiveMobileView('detail')}
                      className="p-1 rounded-lg bg-[#2b1f3c] text-purple-300 hover:text-white transition-all mr-1"
                    >
                      <ArrowLeft size={14} />
                    </button>
                  )}
                  <Server size={15} className="text-purple-400 animate-pulse" />
                  <span className="text-xs font-extrabold text-purple-200 tracking-wider font-sans uppercase">아카이브</span>
                </div>
                {isMobile && (
                  <span className="text-[10px] font-mono text-purple-400 bg-purple-950/30 px-2 py-0.5 rounded-full border border-purple-900/20">
                    총 {artifacts.length}개
                  </span>
                )}
              </div>

            {/* 아카이브 목록 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-purple-950/20">
              {artifacts.map((art, index) => {
                const gradients = [
                  'from-[#1e1b4b] to-[#312e81]',
                  'from-[#2e1065] to-[#4c1d95]',
                  'from-[#0f172a] to-[#1e3a8a]',
                  'from-[#064e3b] to-[#065f46]'
                ];
                const bgGradient = gradients[index % gradients.length];
                const isGame = selectedStudio.type === 'game';

                return (
                  <div 
                    key={art.id}
                    className={`p-3.5 rounded-xl border border-purple-800/20 bg-gradient-to-br ${bgGradient} shadow-md flex flex-col gap-3 transition-transform hover:scale-[1.01]`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-extrabold text-zinc-100 truncate tracking-tight">{art.name}</span>
                        <span className="text-[8px] text-purple-300/80 font-mono tracking-tighter mt-1">{new Date(art.createdAt).toLocaleString('ko-KR')}</span>
                      </div>
                      
                      <button 
                        onClick={(e) => handleDeleteArtifact(art.id, e)}
                        className="p-1 text-zinc-400 hover:text-red-400 hover:bg-black/20 rounded-md transition-colors flex-shrink-0"
                        title="산출물 삭제"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>

                    {/* 인터랙티브 제어 버튼 파트 */}
                    <div className="flex gap-1.5 flex-wrap">
                      {isGame ? (
                        <>
                          {/* 게임 실행 */}
                          <button 
                            onClick={() => window.open(art.fileUrl, '_blank')}
                            className="flex-1 min-w-[50px] py-1.5 rounded-lg bg-blue-600/90 text-white font-extrabold text-[10px] shadow hover:bg-blue-500 flex items-center justify-center gap-1 transition-colors"
                          >
                            <Play size={10} fill="currentColor" />
                            실행
                          </button>
                          
                          {/* 소스 수정 */}
                          <button 
                            onClick={() => handleOpenEditor(art)}
                            className="flex-1 min-w-[50px] py-1.5 rounded-lg bg-zinc-800 text-zinc-200 font-extrabold text-[10px] border border-zinc-700/50 hover:bg-zinc-700 hover:text-white flex items-center justify-center gap-1 transition-colors"
                          >
                            소스
                          </button>

                          {/* PM2 런칭 */}
                          {art.isDeployed ? (
                            <button 
                              disabled={isDeploying === art.id}
                              onClick={() => handleUndeployGame(art)}
                              className="flex-1 min-w-[50px] py-1.5 rounded-lg bg-red-900/80 text-white font-extrabold text-[10px] hover:bg-red-800 flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                            >
                              회수
                            </button>
                          ) : (
                            <button 
                              disabled={isDeploying === art.id}
                              onClick={() => handleDeployGame(art)}
                              className="flex-1 min-w-[50px] py-1.5 rounded-lg bg-purple-600 text-white font-extrabold text-[10px] hover:bg-purple-500 flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                            >
                              런칭
                            </button>
                          )}

                          {/* 품질 검수 */}
                          <button 
                            disabled={isWorking}
                            onClick={() => handleRunManualQA(art)}
                            className="p-1.5 rounded-lg bg-emerald-600/90 text-white font-extrabold text-[10px] hover:bg-emerald-500 flex items-center justify-center gap-1 transition-colors disabled:opacity-40"
                            title="Dave 수동 정밀 검수"
                          >
                            <ShieldCheck size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          {/* 문서 뷰어 팝업 */}
                          <button 
                            onClick={() => setViewDoc(art)}
                            className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white font-extrabold text-[10px] shadow hover:bg-blue-500 flex items-center justify-center gap-1 transition-colors"
                          >
                            <Play size={10} fill="currentColor" />
                            문서 보기
                          </button>
                          
                          {/* 클립보드 복사 */}
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(art.content || '');
                              alert('문서 본문이 클립보드에 복사되었습니다!');
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-[#2c1d3c] text-purple-300 font-extrabold text-[10px] border border-purple-800/30 hover:bg-[#3d2c52] hover:text-white flex items-center justify-center gap-1 transition-colors"
                          >
                            <Copy size={10} />
                            복사
                          </button>

                          {/* 다운로드 */}
                          <button 
                            onClick={() => handleDownloadDoc(art)}
                            className="flex-1 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 font-extrabold text-[10px] border border-zinc-700/50 hover:bg-zinc-700 hover:text-white flex items-center justify-center gap-1 transition-colors"
                          >
                            <Download size={10} />
                            다운
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {artifacts.length === 0 && (
                <div className="text-center py-24 opacity-30 select-none">
                  <Bot size={32} className="mx-auto text-purple-900 mb-3" />
                  <p className="text-[10px] text-zinc-500 font-mono">생성된 아카이브가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  )
      : (
        /* 개설된 스튜디오가 전혀 없거나 선택하지 않았을 때의 웰컴 스크린 */
        (!isMobile || activeMobileView !== 'list') && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none p-8 text-center bg-[#0a050f]">
            <div className="w-16 h-16 rounded-2xl bg-purple-950/20 border border-purple-850/40 flex items-center justify-center text-purple-400 shadow-xl animate-bounce" style={{ animationDuration: '3s' }}>
              <Building2 size={32} />
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-sm font-extrabold text-purple-200 tracking-wider">알로팝 다중 분야 AI 스튜디오</h2>
              <p className="text-[11px] text-zinc-500 leading-relaxed max-w-sm">좌측 목록에서 기존 개설된 AI 스튜디오 방에 입장하시거나, <br />새로운 전문 영역(게임, 법률, 공연 등)의 스튜디오를 직접 만들어 보세요!</p>
            </div>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="mt-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white border border-purple-500 text-xs font-bold shadow-lg hover:bg-purple-500 hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus size={14} />
              새 스튜디오 생성
            </button>
          </div>
        )
      )}

      {/* ==========================================
          [신규 생성 모달창] (새 스튜디오 개설 팝업)
         ========================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[1000] bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-[#1d142b] border border-[#3b2d52] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 font-sans animate-fade-in select-none scrollbar-thin scrollbar-thumb-purple-950/40">
            <div className="flex items-center justify-between border-b border-[#3b2d52] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <span className="font-extrabold text-xs tracking-wider text-purple-200">새 AI 협업 스튜디오 생성</span>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-white p-1 hover:bg-[#2b1f3c] rounded-md transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* 입력 폼 */}
            <div className="flex flex-col gap-4">
              
              {/* 🤖 AI 모델 선택 리스트바 (채팅창 & HUD와 100% 동일하게 완벽 연동) */}
              <div className="flex items-center justify-between bg-[#1b1227]/40 p-3 rounded-xl border border-purple-800/10">
                <span className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest">추천/설정 AI 모델</span>
                <AiModelSelector
                  selectedAiModel={selectedAiModel}
                  setSelectedAiModel={setSelectedAiModel}
                  aiModels={aiModels}
                  activeEvents={activeEvents}
                  exhaustedFreeEvents={exhaustedFreeEvents}
                  disabled={isRecommending}
                />
              </div>

              {/* 스튜디오 이름 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest">회사 (스튜디오) 이름</label>
                <input 
                  type="text" 
                  value={newStudioName}
                  onChange={(e) => setNewStudioName(e.target.value)}
                  placeholder="예: 알로팝 종합 상사, 주식회사 에이전트 연합"
                  className="bg-[#0b0512] border border-purple-800/30 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600/40"
                />
              </div>

              {/* 업무 세부 범위 내용 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest">설립 목적 및 업무 지시 개요</label>
                  
                  <button
                    type="button"
                    disabled={!newStudioDesc.trim() || isRecommending}
                    onClick={handleRecommendConfig}
                    className={`px-3 py-1 rounded-lg text-[9px] font-extrabold flex items-center gap-1 transition-all duration-300 ${
                      newStudioDesc.trim() && !isRecommending
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-md hover:shadow-purple-500/20 active:scale-95 hover:scale-105'
                        : 'bg-zinc-900/60 text-zinc-600 border border-zinc-800/40 cursor-not-allowed'
                    }`}
                  >
                    {isRecommending ? (
                      <>
                        <RefreshCw size={10} className="animate-spin text-purple-300" />
                        <span>조직 설계 중...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={10} className="text-purple-300 animate-pulse" />
                        <span>AI 추천 설정</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea 
                  value={newStudioDesc}
                  onChange={(e) => setNewStudioDesc(e.target.value)}
                  placeholder="새로 설립할 일반 사무직 회사의 주요 사업 목적이나 초기 업무를 적어주세요... (예: 2026년 마케팅 전략 수립 및 채용 기획)"
                  className="bg-[#0b0512] border border-purple-800/30 text-white rounded-xl px-3.5 py-2 text-xs h-20 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600/40 resize-none scrollbar-thin scrollbar-thumb-purple-950/40"
                />
              </div>

              {/* 기용할 에이전트 직원수 (사무직 상시 노출) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest">기용할 AI 에이전트 직원 수</label>
                  <span className="text-[10px] font-extrabold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">{newStudioAgentCount}명 기용</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="8"
                  step="1"
                  value={newStudioAgentCount}
                  onChange={(e) => setNewStudioAgentCount(parseInt(e.target.value))}
                  disabled={isRecommending}
                  className={`w-full accent-purple-600 bg-purple-950/30 h-1.5 rounded-lg appearance-none cursor-pointer ${isRecommending ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                <span className="text-[8px] text-zinc-500 tracking-tight">직원 수에 맞춰 가상 오피스 개발실의 책상 수와 렌더링이 자동으로 확장됩니다. (2인~8인)</span>
              </div>

              {/* 에이전트 개별 맞춤 설정 (사무직 상시 노출) */}
              <div className="flex flex-col gap-2 border-t border-[#3b2d52]/30 pt-3 relative">
                <label className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest">부서 배치 및 전문 분야 (성격) 설정</label>
                
                {/* AI 추천 진행 중 블러 오버레이 */}
                {isRecommending && (
                  <div className="absolute inset-0 bg-[#1d142b]/80 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center gap-2 rounded-xl border border-purple-500/20">
                    <RefreshCw size={20} className="animate-spin text-purple-400" />
                    <span className="text-[9px] font-extrabold text-purple-200 animate-pulse">AI가 최적의 조직을 설계하고 요원을 영입하는 중입니다...</span>
                  </div>
                )}

                <div className={`space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-950/40 transition-all duration-300 ${isRecommending ? 'blur-[1.5px] select-none pointer-events-none' : ''}`}>
                  {newStudioAgentsConfig.slice(0, newStudioAgentCount).map((config, idx) => {
                    const defaultNames = ['최인사', '정기획', '홍홍보', '윤재무', '김영업', '이회계', '박비서', '강지원'];
                    const defaultName = defaultNames[idx];
                    const roleOptions = ['인사', '기획', '홍보', '재무', '영업', '회계', '비서', '총무'];
                    const agentColors: Record<string, string> = {
                      '최인사': '#f87171', '정기획': '#fb923c', '홍홍보': '#f472b6', '윤재무': '#a78bfa',
                      '김영업': '#60a5fa', '이회계': '#34d399', '박비서': '#2dd4bf', '강지원': '#a8a29e'
                    };

                    return (
                      <div key={idx} className="bg-[#0b0512]/60 p-3 rounded-xl border border-purple-950 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: agentColors[defaultName] || '#a855f7' }} />
                            <input 
                              type="text"
                              value={config.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewStudioAgentsConfig(prev => prev.map((a, i) => i === idx ? { ...a, name: val } : a));
                              }}
                              placeholder={`${defaultName} (이름 직접 수정)`}
                              className="bg-[#12071d] border border-purple-900/30 text-white text-[10px] font-bold rounded px-1.5 py-0.5 focus:outline-none focus:border-purple-600 w-28 text-center"
                            />
                            <span className="text-[8px] text-zinc-500 flex-shrink-0">요원</span>
                          </div>
                          
                          <select
                            value={config.role}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewStudioAgentsConfig(prev => prev.map((a, i) => i === idx ? { ...a, role: val } : a));
                            }}
                            className="bg-[#12071d] border border-purple-900/30 text-purple-300 text-[9px] font-bold rounded px-1.5 py-0.5 focus:outline-none"
                          >
                            {Array.from(new Set([...roleOptions, config.role])).map(r => (
                              <option key={r} value={r}>{r} 부서</option>
                            ))}
                          </select>
                        </div>
                        
                        <input
                          type="text"
                          value={config.expertise}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewStudioAgentsConfig(prev => prev.map((a, i) => i === idx ? { ...a, expertise: val } : a));
                          }}
                          placeholder={`${config.name} 요원의 세부 전문성/페르소나 (예: 10년차 베테랑 ${config.role} 스페셜리스트)`}
                          className="bg-[#0c0615] border border-purple-950 text-zinc-300 rounded-lg px-2.5 py-1 text-[9px] focus:outline-none focus:border-purple-800"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>


            {/* 하단 제어 */}
            <div className="flex gap-2 justify-end pt-2 border-t border-[#3b2d52]/50">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white text-[10px] font-bold transition-all border border-zinc-700/50"
              >
                취소
              </button>
              <button 
                disabled={!newStudioName.trim()}
                onClick={handleCreateStudio}
                className={`px-5 py-2 rounded-xl text-[10px] font-extrabold transition-all ${newStudioName.trim() ? 'bg-purple-600 text-white hover:bg-purple-500 border border-purple-500 shadow-md' : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'}`}
              >
                스튜디오 개설
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          [마크다운 문서 뷰어 / 코드 에디터 모달]
         ========================================== */}
      {viewDoc && (
        <div className="fixed inset-0 z-[1000] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="w-full max-w-4xl h-[85vh] bg-[#1a1226] border border-purple-900/30 rounded-2xl shadow-2xl flex flex-col font-sans overflow-hidden">
            {/* 모달 헤더 */}
            <div className="p-4 border-b border-purple-900/20 bg-[#140e1e] flex items-center justify-between flex-shrink-0 select-none">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <span className="font-extrabold text-xs text-purple-200 tracking-wider">
                  {viewDoc.name} {showEditor ? '소스 편집기' : '상세 뷰어'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* 에디터와 일반 뷰어 전환 단추 (HTML 게임일 때만 소스 직접 편집 제공) */}
                {selectedStudio.type === 'game' && !showEditor && (
                  <button 
                    onClick={() => handleOpenEditor(viewDoc)}
                    className="px-3.5 py-1.5 rounded-lg bg-purple-900/30 border border-purple-800/40 text-purple-300 text-[10px] font-bold hover:bg-purple-800/50 hover:text-white transition-all shadow-sm"
                  >
                    소스코드 직접 편집
                  </button>
                )}
                
                {/* 닫기 */}
                <button 
                  onClick={() => {
                    setViewDoc(null);
                    setShowEditor(false);
                  }}
                  className="text-zinc-500 hover:text-white p-1 hover:bg-[#2b1f3c] rounded-md transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* 본문 콘텐츠 스크롤 뷰 */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#0a050f] scrollbar-thin scrollbar-thumb-purple-950/20">
              {showEditor ? (
                /* 1. 소스 에디터 모드 */
                <textarea 
                  value={editorCode}
                  onChange={(e) => setEditorCode(e.target.value)}
                  className="w-full h-full bg-[#050209] border border-purple-950 text-emerald-400 font-mono text-xs p-4 rounded-xl focus:outline-none focus:border-purple-800 focus:ring-1 focus:ring-purple-900/50 leading-relaxed overflow-y-auto select-text scrollbar-thin"
                  style={{ tabSize: 2 }}
                />
              ) : (
                /* 2. 일반 마크다운 문서 렌더러 모드 (CSS 예쁘게 렌더링) */
                <div className="prose prose-invert prose-purple max-w-none text-zinc-300 leading-relaxed font-sans text-xs select-text">
                  {viewDoc.content ? (
                    viewDoc.content.split('\n').map((line: string, idx: number) => {
                      if (line.startsWith('# ')) {
                        return <h1 key={idx} className="text-lg font-extrabold text-purple-300 mt-6 mb-3 pb-1.5 border-b border-purple-900/30 font-sans tracking-wide">{line.replace('# ', '')}</h1>;
                      } else if (line.startsWith('## ')) {
                        return <h2 key={idx} className="text-sm font-extrabold text-purple-400 mt-5 mb-2.5 font-sans tracking-wide">{line.replace('## ', '')}</h2>;
                      } else if (line.startsWith('### ')) {
                        return <h3 key={idx} className="text-xs font-bold text-cyan-400 mt-4 mb-2 font-sans">{line.replace('### ', '')}</h3>;
                      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                        return <li key={idx} className="ml-4 list-disc mb-1 text-zinc-300 leading-snug">{line.replace(/^[-*]\s+/, '')}</li>;
                      } else if (line.trim().startsWith('> ')) {
                        return <blockquote key={idx} className="border-l-4 border-purple-600 bg-purple-950/15 p-3 rounded-r-lg my-3 font-sans italic text-zinc-400">{line.replace(/^>\s+/, '')}</blockquote>;
                      } else if (line.trim() === '---') {
                        return <hr key={idx} className="border-purple-900/20 my-4" />;
                      } else if (line.trim() === '') {
                        return <div key={idx} className="h-2" />;
                      }
                      return <p key={idx} className="mb-2 leading-relaxed text-zinc-300">{line}</p>;
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 opacity-30 select-none">
                      <AlertCircle size={32} className="text-zinc-500" />
                      <span className="font-mono">본문이 비어있거나 올바른 문서 포맷이 아닙니다.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 모달 하단 제어 */}
            <div className="p-4 border-t border-purple-900/20 bg-[#140e1e] flex justify-between items-center flex-shrink-0 select-none">
              <div className="text-[10px] text-zinc-500 font-mono tracking-tight">
                {viewDoc.fileUrl ? `물리주소: ${viewDoc.fileUrl}` : `데이터베이스 텍스트 보관중`}
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setViewDoc(null);
                    setShowEditor(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white text-[10px] font-bold transition-all border border-zinc-700/50"
                >
                  {showEditor ? '취소' : '닫기'}
                </button>
                
                {showEditor ? (
                  <button 
                    onClick={handleSaveEditor}
                    className="px-5 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500 border border-purple-500 text-[10px] font-extrabold shadow-md transition-all"
                  >
                    수정 소스 저장
                  </button>
                ) : (
                  !viewDoc.fileUrl && (
                    <button 
                      onClick={() => handleDownloadDoc(viewDoc)}
                      className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 border border-blue-500 text-[10px] font-extrabold shadow-md transition-all flex items-center gap-1.5"
                    >
                      <Download size={11} />
                      문서 다운로드
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
