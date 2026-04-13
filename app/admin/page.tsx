'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft, Send, Save, CreditCard, ChevronLeft, Gift } from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'ANNOUNCEMENT' | 'EVENT' | 'SYSTEM'>('ANNOUNCEMENT');

  // Announcement States
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceContent, setAnnounceContent] = useState('');
  const [announceDuration, setAnnounceDuration] = useState('4');

  // Event States
  const [events, setEvents] = useState<any[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventReward, setEventReward] = useState(0);
  const [eventFreq, setEventFreq] = useState('ONCE');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');

  // System States
  const [systemSettings, setSystemSettings] = useState<any[]>([]);
  const [dirtySettings, setDirtySettings] = useState<Record<string, string>>({});

  useEffect(() => {
    const storedUser = localStorage.getItem('alo_user');
    if (!storedUser) {
      router.replace('/');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    
    fetch(`/api/users/profile?userId=${parsedUser.id}`)
      .then(res => res.json())
      .then(data => {
        if (!data.user?.isAdmin) {
          alert('관리자 권한이 없습니다.');
          router.replace('/');
        } else {
          setUser(data.user);
          loadAnnouncements();
          loadEvents();
          loadSystemSettings();
        }
      });
  }, [router]);

  const loadAnnouncements = () => {
    fetch('/api/admin/announcements')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAnnouncements(data);
      });
  };

  const loadEvents = () => {
    fetch('/api/admin/events')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setEvents(data);
      });
  };

  const loadSystemSettings = () => {
    fetch('/api/admin/system')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
            setSystemSettings(data);
            const initDirty: Record<string, string> = {};
            data.forEach(s => initDirty[s.key] = s.value);
            setDirtySettings(initDirty);
        }
      });
  };

  const handleCreateAnnouncement = async () => {
    if (!announceTitle.trim() || !announceContent.trim()) return;
    try {
      const durationMs = parseInt(announceDuration) > 0 ? parseInt(announceDuration) * 1000 : 4000;
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title: announceTitle, content: announceContent, durationMs })
      });
      if (res.ok) {
        setAnnounceTitle('');
        setAnnounceContent('');
        setAnnounceDuration('4');
        loadAnnouncements();
        alert('공지사항이 등록되었습니다.');
      }
    } catch (e) {
      alert('오류가 발생했습니다.');
    }
  };

  const handleCreateEvent = async () => {
    if (!eventTitle.trim()) return;
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          title: eventTitle, 
          description: eventDesc, 
          rewardCoins: Number(eventReward),
          rewardFrequency: eventFreq,
          startsAt: eventStartDate || null,
          endsAt: eventEndDate || null
        })
      });
      if (res.ok) {
        setEventTitle(''); setEventDesc(''); setEventReward(0);
        setEventFreq('ONCE'); setEventStartDate(''); setEventEndDate('');
        
        const startEl = document.getElementById('event-start-date') as HTMLInputElement | null;
        if (startEl) startEl.value = '';
        const endEl = document.getElementById('event-end-date') as HTMLInputElement | null;
        if (endEl) endEl.value = '';

        loadEvents();
        alert('이벤트가 생성되었습니다.');
      }
    } catch (e) {
      alert('이벤트 생성 오류 발생');
    }
  };

  const handleToggleEvent = async (eventId: string) => {
    try {
      const res = await fetch('/api/admin/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, eventId, action: 'TOGGLE_ACTIVE' })
      });
      if (res.ok) loadEvents();
    } catch(e) { }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('정말로 이 이벤트를 삭제하시겠습니까? (삭제 시 복구 불가)')) return;
    try {
      const res = await fetch(`/api/admin/events?userId=${user.id}&eventId=${eventId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        alert('이벤트가 삭제되었습니다.');
        loadEvents();
      } else {
        alert('삭제 실패');
      }
    } catch(e) { }
  };

  // handleDistributeReward Removed

  const handleSaveSystemSettings = async () => {
    try {
      // transform dirtySettings back to array format required by API
      const settingsArr = Object.keys(dirtySettings).map(key => ({
          key, value: String(dirtySettings[key]), description: systemSettings.find(s=>s.key === key)?.description || ''
      }));

      // if a new key needs to be added (for first initialization of default bonus, etc), we'd need another UI element.
      // We will blindly push dirtySettings
      const res = await fetch('/api/admin/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, settings: settingsArr })
      });
      if (res.ok) {
        alert('시스템 설정이 저장되었습니다.');
        loadSystemSettings();
      }
    } catch(e) { }
  };

  if (!user) return <div className="min-h-screen bg-background flex justify-center items-center">Loading...</div>;

  return (
    <div className="h-[100dvh] bg-background flex flex-col md:flex-row text-on-surface">
      {/* Sidebar for Desktop / Header for Mobile */}
      <div className="w-full md:w-64 bg-surface-container border-b md:border-b-0 md:border-r border-outline-variant/30 flex flex-col pt-6 px-4">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-8 font-medium">
          <ChevronLeft size={20} /> 앱으로 돌아가기
        </button>
        
        <h1 className="text-xl font-bold flex items-center gap-2 mb-6">
          <ShieldAlert className="text-primary" /> 관리자 대시보드
        </h1>

        <div className="flex xl:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 hide-scrollbar">
          <button 
            onClick={() => setActiveTab('ANNOUNCEMENT')} 
            className={`px-4 py-3 text-sm font-semibold rounded-xl text-left whitespace-nowrap transition-all ${activeTab === 'ANNOUNCEMENT' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-variant'}`}>
            📢 서버 공지사항
          </button>
          <button 
            onClick={() => setActiveTab('EVENT')} 
            className={`px-4 py-3 text-sm font-semibold rounded-xl text-left whitespace-nowrap transition-all ${activeTab === 'EVENT' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-variant'}`}>
            🎁 이벤트 관리
          </button>
          <button 
            onClick={() => setActiveTab('SYSTEM')} 
            className={`px-4 py-3 text-sm font-semibold rounded-xl text-left whitespace-nowrap transition-all ${activeTab === 'SYSTEM' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-variant'}`}>
            ⚙️ 시스템 설정
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        {activeTab === 'ANNOUNCEMENT' && (
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold mb-6 text-primary drop-shadow-sm">📢 새로운 공지사항 작성</h2>
            <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 shadow-sm mb-10">
              <input 
                type="text" 
                placeholder="공지 제목을 입력하세요" 
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary pb-2 mb-4 outline-none text-lg font-bold placeholder:text-on-surface-variant/50 transition-colors"
                value={announceTitle}
                onChange={e => setAnnounceTitle(e.target.value)}
              />
              <textarea 
                placeholder="공지 내용을 자세히 입력하세요..." 
                className="w-full bg-transparent border-none outline-none resize-none min-h-[120px] text-base placeholder:text-on-surface-variant/50"
                value={announceContent}
                onChange={e => setAnnounceContent(e.target.value)}
              />
              <div className="flex justify-end mt-4">
                <button 
                  onClick={handleCreateAnnouncement}
                  className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-primary/90 transition-transform active:scale-95 shadow-[0_0_15px_rgba(204,151,255,0.4)]">
                  <Send size={16} /> 공지 등록하기
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-on-surface-variant">
               등록된 공지 목록
            </h3>
            <div className="space-y-4">
              {announcements.map(ann => (
                <div key={ann.id} className="bg-surface-container border border-outline-variant/20 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg">{ann.title}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold tracking-tight ${ann.isActive ? 'bg-primary/20 text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>{ann.isActive ? '활성' : '비활성'}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                  <p className="text-xs text-on-surface-variant mt-4 opacity-50">{new Date(ann.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {announcements.length === 0 && (
                <div className="text-center py-10 text-on-surface-variant bg-surface-variant/20 rounded-xl border border-dashed border-outline-variant/30">
                  등록된 공지사항이 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'EVENT' && (
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold mb-6 text-tertiary drop-shadow-sm flex items-center gap-2"><Gift size={28}/> 이벤트 생성 및 보상</h2>
            
            <div className="bg-surface-container-low border border-tertiary/30 rounded-2xl p-6 shadow-sm mb-10">
              <input 
                type="text" 
                placeholder="이벤트 제목 (예: 가을 맞이 깜짝 보상!)" 
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-tertiary pb-2 mb-4 outline-none text-lg font-bold placeholder:text-on-surface-variant/50 transition-colors"
                value={eventTitle}
                onChange={e => setEventTitle(e.target.value)}
              />
              <textarea 
                placeholder="이벤트 내용 또는 지급 사유..." 
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-tertiary pb-2 mb-4 outline-none resize-none min-h-[60px] text-sm placeholder:text-on-surface-variant/50"
                value={eventDesc}
                onChange={e => setEventDesc(e.target.value)}
              />
              <div className="flex flex-col gap-2 mb-6">
                <span className="text-sm font-bold text-on-surface-variant">이벤트 기간:</span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input 
                    id="event-start-date"
                    type="datetime-local" 
                    className="bg-dark-bg border border-outline-variant/40 rounded px-3 py-2 outline-none font-mono focus:border-tertiary text-sm cursor-pointer w-[240px]" 
                    onChange={e => setEventStartDate(e.target.value)} 
                  />
                  <span className="text-zinc-500 font-bold hidden sm:inline">~</span>
                  <input 
                    id="event-end-date"
                    type="datetime-local" 
                    className="bg-dark-bg border border-outline-variant/40 rounded px-3 py-2 outline-none font-mono focus:border-tertiary text-sm cursor-pointer w-[240px]" 
                    onChange={e => setEventEndDate(e.target.value)} 
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                <span className="text-sm font-bold text-on-surface-variant flex-shrink-0 sm:w-24">지급 방식:</span>
                <select 
                  value={eventFreq} 
                  onChange={e => setEventFreq(e.target.value)} 
                  className="bg-dark-bg border border-outline-variant/40 rounded px-2 py-1.5 outline-none font-bold focus:border-tertiary text-sm"
                >
                  <option value="ONCE">1회 접속 시 1번 지급</option>
                  <option value="DAILY">매일 최초 접속 시 지급</option>
                </select>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <span className="text-sm font-bold text-on-surface-variant flex-shrink-0 w-24">지급 코인:</span>
                <input 
                    type="number" 
                    value={eventReward} 
                    onChange={e => setEventReward(Number(e.target.value))} 
                    className="bg-dark-bg border border-outline-variant/40 rounded px-3 py-1.5 w-32 outline-none font-mono focus:border-tertiary"
                />
              </div>
              <div className="flex justify-end mt-4">
                <button 
                    onClick={handleCreateEvent}
                    className="bg-tertiary text-on-tertiary px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-tertiary/90 transition-transform active:scale-95 shadow-[0_0_15px_rgba(255,180,166,0.3)]">
                  <Save size={16} /> 이벤트 생성
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-on-surface-variant">이벤트 목록</h3>
            <div className="space-y-4">
                {events.map((ev: any) => (
                    <div key={ev.id} className={`bg-surface-container border ${ev.isActive ? 'border-tertiary/50 shadow-[0_0_10px_rgba(255,180,166,0.1)]' : 'border-outline-variant/20'} rounded-xl p-5 transition-all`}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-lg">{ev.title}</span>
                            <button onClick={()=>handleToggleEvent(ev.id)} className={`text-[10px] px-2 py-1 rounded-md font-bold tracking-tight transition-colors ${ev.isActive ? 'bg-error/20 text-error hover:bg-error/30' : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-highest'}`}>
                                {ev.isActive ? '종료(비활성화) 하기' : '활성화 하기'}
                            </button>
                        </div>
                        <p className="text-xs text-on-surface-variant mb-4">{ev.description}</p>
                        
                        <div className="flex items-center justify-between border-t border-outline-variant/10 pt-4">
                            <div className="text-sm font-bold flex items-center gap-4 group">
                                <span className="bg-surface-variant text-on-surface px-2 py-1 rounded text-xs">
                                  {ev.rewardFrequency === 'DAILY' ? '매일 지급' : '1회 지급'}
                                </span>
                                <div>보상 코인: <span className="text-tertiary font-mono group-hover:scale-110 transition-transform inline-block">{ev.reward.toLocaleString()}</span> C</div>
                            </div>
                            <button 
                                onClick={()=>handleDeleteEvent(ev.id)}
                                className="bg-error/10 text-error hover:bg-error/20 font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === 'SYSTEM' && (
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold mb-6 text-secondary drop-shadow-sm">⚙️ 시스템 전체 설정</h2>
            
            <div className="bg-surface-container border border-secondary/30 rounded-2xl p-6 shadow-sm mb-10">
                
                {/* 만약 시스템 설정이 하나도 없다면 생성할 수 있게 안내 */}
                {systemSettings.length === 0 && (
                    <div className="mb-4 text-sm text-yellow-500 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                        설정 DB가 텅 비어 있습니다. 필요시 DB(Prisma)에서 기본 Key를 적재한 후 활성화됩니다.
                        (예: `SIGNUP_BONUS`, `MAINTENANCE_MODE`)
                    </div>
                )}
                
                {/* 신규 키 입력 UI (심플하게 2개만 하드코딩된 초깃값을 강제 적재하기 위한 도우미) */}
                <div className="flex flex-col gap-4 mb-6 pb-6 border-b border-outline-variant/20">
                    <div className="flex justify-between items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                        <div>
                            <div className="font-bold text-zinc-200">초기 회원가입 보상금 (SIGNUP_BONUS)</div>
                            <div className="text-[11px] text-zinc-500 mt-1">새로 가입하는 유저에게 지급될 기본 코인 양</div>
                        </div>
                        <input
                            type="text"
                            value={dirtySettings['SIGNUP_BONUS'] ?? ''}
                            onChange={e => setDirtySettings(prev => ({...prev, SIGNUP_BONUS: e.target.value}))}
                            placeholder="예: 3000"
                            className="bg-dark-bg border border-outline-variant/30 rounded-lg px-3 py-2 w-24 text-center text-sm focus:border-secondary outline-none font-mono focus:ring-1 focus:ring-secondary/50"
                        />
                    </div>
                    
                    <div className="flex justify-between items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                        <div>
                            <div className="font-bold text-zinc-200">긴급 점검 화면 노출 (MAINTENANCE_MODE)</div>
                            <div className="text-[11px] text-zinc-500 mt-1">true 입력 시, 앱 접속이 차단됩니다.</div>
                        </div>
                        <input
                            type="text"
                            value={dirtySettings['MAINTENANCE_MODE'] ?? 'false'}
                            onChange={e => setDirtySettings(prev => ({...prev, MAINTENANCE_MODE: e.target.value}))}
                            placeholder="true / false"
                            className="bg-dark-bg border border-outline-variant/30 rounded-lg px-3 py-2 w-24 text-center text-sm focus:border-red-500 outline-none font-mono focus:ring-1 focus:ring-red-500/50"
                        />
                    </div>

                    <div className="flex justify-between items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                        <div>
                            <div className="font-bold text-zinc-200">글로벌 공지 표시 시간 (ANNOUNCE_DURATION_SEC)</div>
                            <div className="text-[11px] text-zinc-500 mt-1">N초마다 홈 화면 중앙 공지가 롤링됩니다.</div>
                        </div>
                        <input
                            type="number"
                            min="1"
                            max="60"
                            value={dirtySettings['ANNOUNCE_DURATION_SEC'] ?? '4'}
                            onChange={e => setDirtySettings(prev => ({...prev, ANNOUNCE_DURATION_SEC: e.target.value}))}
                            placeholder="예: 4"
                            className="bg-dark-bg border border-outline-variant/30 rounded-lg px-3 py-2 w-24 text-center text-sm focus:border-cyan-500 outline-none font-mono focus:ring-1 focus:ring-cyan-500/50"
                        />
                    </div>
                </div>

                {systemSettings.map(s => {
                    if(s.key === 'SIGNUP_BONUS' || s.key === 'MAINTENANCE_MODE' || s.key === 'ANNOUNCE_DURATION_SEC') return null; // 위에서 별도로 렌더링
                    return (
                    <div key={s.key} className="flex justify-between items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 mb-2">
                        <div>
                            <div className="font-bold text-zinc-200">{s.key}</div>
                            <div className="text-[11px] text-zinc-500 mt-1">{s.description || '커스텀 시스템 설정'}</div>
                        </div>
                        <input
                            type="text"
                            value={dirtySettings[s.key] ?? s.value}
                            onChange={e => setDirtySettings(prev => ({...prev, [s.key]: e.target.value}))}
                            className="bg-dark-bg border border-outline-variant/30 rounded-lg px-3 py-2 w-32 text-center text-sm focus:border-secondary outline-none font-mono"
                        />
                    </div>
                )})}

                <div className="flex justify-end mt-8">
                <button 
                  onClick={handleSaveSystemSettings}
                  className="bg-secondary text-dark-bg px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-secondary/90 transition-transform active:scale-95 shadow-[0_0_15px_rgba(98,250,227,0.3)]">
                  <Save size={16} /> 설정 즉시 적용
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
