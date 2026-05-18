"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Heart, X, Loader2, BarChart3, Pencil, Trash2, Download, Upload, CloudDownload } from "lucide-react";
import { usePet365Auth } from "@/lib/pet365care/use-pet365-auth";
import Link from "next/link";
import {
  getPets, addPet as addPetStore, updatePet as updatePetStore,
  deletePet as deletePetStore,
  exportStore, importStore, getBackupStats,
  getPreferredAi, setPreferredAi,
  type BackupSummary,
  type Pet,
} from "@/lib/pet365care/local-store";
import { notifyPetRegistered, notifyPetUpdated, notifyPetDeleted } from "@/lib/pet365care/notify";
import LZString from "lz-string";
import { useConfirm } from "@/components/ui/ConfirmProvider";

type PetWithVax = Pet;
type BackupInfo = {
  size: number;
  petCount: number;
  version: number;
  updatedAt: string;
  summary?: BackupSummary;
};
type AiModelOption = {
  id: string;
  name: string;
};
type AvailableModels = {
  openai: AiModelOption[];
  gemini: AiModelOption[];
  anthropic: AiModelOption[];
};

const SPECIES = [
  { value: "dog", label: "강아지", emoji: "🐶" },
  { value: "cat", label: "고양이", emoji: "🐱" },
  { value: "rabbit", label: "토끼", emoji: "🐰" },
  { value: "hamster", label: "햄스터", emoji: "🐹" },
  { value: "bird", label: "새/앵무새", emoji: "🦜" },
  { value: "turtle", label: "거북이", emoji: "🐢" },
  { value: "duck", label: "오리", emoji: "🦆" },
  { value: "hedgehog", label: "고슴도치", emoji: "🦔" },
  { value: "fish", label: "물고기", emoji: "🐟" },
  { value: "other", label: "기타", emoji: "🐾" },
];
const getEmoji = (s: string) => SPECIES.find(x => x.value === s)?.emoji || "🐾";

export default function ProfilePage() {
  const confirmModal = useConfirm();
  const { user } = usePet365Auth();
  
  const [pets, setPets] = useState<PetWithVax[]>([]);
  const [loadingPets, setLoadingPets] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedPet, setSelectedPet] = useState<PetWithVax | null>(null);
  const [editMode, setEditMode] = useState(false);

  const emptyForm = { name: "", species: "dog", breed: "", age: "", gender: "male", birthday: "", weight: "", isNeutered: false, allergies: "", memo: "" };
  const [form, setForm] = useState(emptyForm);
  const [recovering, setRecovering] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState("");

  // 백업 상태
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");

  // AI 설정 상태
  const [availableModels, setAvailableModels] = useState<AvailableModels>({ openai: [], gemini: [], anthropic: [] });
  const [preferredAiState, setPreferredAiState] = useState<{provider?: string, model?: string}>({});

  const handleAiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      setPreferredAi(undefined, undefined);
      setPreferredAiState({});
      return;
    }
    const [provider, model] = val.split(':');
    setPreferredAi(provider, model);
    setPreferredAiState({ provider, model });
  };

  useEffect(() => {
    if (user?.id) {
      const timer = window.setTimeout(() => {
        setLoadingPets(true);
        setPets(getPets());
        setLoadingPets(false);
        // 서버 백업 상태 조회
        fetch('/api/pet365care/backup').then(r => r.json()).then(d => {
          if (d.success && d.data) setBackupInfo(d.data);
        }).catch(() => {});
        // AI 모델 리스트 및 설정 로드
        fetch('/api/models').then(r => r.json()).then(d => setAvailableModels(d)).catch(() => {});
        setPreferredAiState(getPreferredAi());
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [user]);

  // 채팅방 봇에서 반려동물 복구
  const handleRecoverPets = async () => {
    setRecovering(true);
    setRecoverMsg('');
    try {
      const r = await fetch('/api/pet365care/recover-pets');
      const d = await r.json();
      if (!d.success || !d.data?.pets?.length) {
        setRecoverMsg('복구할 반려동물이 없습니다.');
        return;
      }
      const existingPets = getPets();
      let added = 0;
      for (const bot of d.data.pets) {
        // 이미 같은 이름이 있으면 스킵
        if (existingPets.some(p => p.name === bot.name)) continue;
        addPetStore({
          name: bot.name,
          species: bot.species,
          breed: '',
          age: 0,
          gender: 'male',
          birthday: null,
          weight: null,
          isNeutered: false,
          allergies: null,
          memo: '채팅방에서 자동 복구됨',
        });
        added++;
      }
      setPets(getPets());
      setRecoverMsg(added > 0 ? `✅ ${added}마리 복구 완료! 상세 정보를 수정해주세요.` : '이미 모두 등록되어 있습니다.');
    } catch {
      setRecoverMsg('❌ 복구에 실패했습니다.');
    } finally {
      setRecovering(false);
    }
  };

  const handleAddPet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setIsAdding(true);
    try {
      const newPet = addPetStore({
        name: form.name, species: form.species, breed: form.breed,
        age: Number(form.age) || 0, gender: form.gender,
        birthday: form.birthday || null, weight: form.weight ? Number(form.weight) : null,
        isNeutered: !!form.isNeutered, allergies: form.allergies || null, memo: form.memo || null,
      });
      setPets([newPet, ...pets]);
      setIsAddModalOpen(false);
      setForm(emptyForm);
      notifyPetRegistered(newPet.name, newPet.species, newPet.breed);
    } finally { setIsAdding(false); }
  };

  const handleUpdatePet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPet) return;
    setIsAdding(true);
    try {
      const updated = updatePetStore(selectedPet.id, {
        name: form.name, species: form.species, breed: form.breed,
        age: Number(form.age) || 0, gender: form.gender,
        birthday: form.birthday || null, weight: form.weight ? Number(form.weight) : null,
        isNeutered: !!form.isNeutered, allergies: form.allergies || null, memo: form.memo || null,
      });
      if (updated) {
        const fullPet = getPets().find(p => p.id === updated.id)!;
        setPets(pets.map(p => p.id === fullPet.id ? fullPet : p));
        setSelectedPet(fullPet);
        setEditMode(false);
        notifyPetUpdated(fullPet.name, fullPet.species);
      }
    } finally { setIsAdding(false); }
  };

  const handleDeletePet = () => {
    if (!selectedPet) return;
    deletePetStore(selectedPet.id);
    notifyPetDeleted(selectedPet.name, selectedPet.species);
    setPets(pets.filter(p => p.id !== selectedPet.id));
    setSelectedPet(null);
  };

  const requestDeletePet = async () => {
    if (!selectedPet) return;
    const isOk = await confirmModal({
      title: "반려동물 삭제",
      message: `${selectedPet.name} 정보를 삭제합니다.\n케어 체크와 활동 기록도 함께 삭제됩니다.`,
      type: "danger",
      confirmText: "삭제하기",
    });
    if (isOk) handleDeletePet();
  };

  const openEdit = (pet: PetWithVax) => {
    setForm({ name: pet.name, species: pet.species, breed: pet.breed, age: String(pet.age), gender: pet.gender, birthday: pet.birthday || "", weight: pet.weight ? String(pet.weight) : "", isNeutered: pet.isNeutered, allergies: pet.allergies || "", memo: pet.memo || "" });
    setEditMode(true);
  };

  const formatBackupSummary = (summary: BackupSummary) => (
    `펫 ${summary.petCount}마리 · 접종 ${summary.vaxCount}건 · 케어 ${summary.careCount}건 · 활동 ${summary.activityCount}건 · 분석 ${summary.healthCount}건`
  );

  return (
    <div className="pet365-page flex flex-col min-h-full pb-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <header className="pet365-topbar flex items-center justify-center p-6 rounded-b-[28px]">
        <h1 className="text-gray-900 font-extrabold text-xl tracking-tight">내 정보</h1>
      </header>

      {/* Main Content */}
      <main className="px-6 flex flex-col gap-6 mt-6">
        
        {/* Profile Info */}
        <section className="pet365-card p-6 flex items-center justify-between cursor-pointer transition-colors">
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-4 border-gray-100 shadow-sm relative">
               {user?.avatar_url ? (
                 // eslint-disable-next-line @next/next/no-img-element -- Alopop avatar URLs may be authenticated by the host app.
                 <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
               ) : (
                 <span className="text-3xl">🐱</span>
               )}
               <div className="absolute inset-0 bg-black/10"></div>
             </div>
             <div>
                <h2 className="font-bold text-xl text-gray-900 leading-tight">
                  {user ? `${user.username} 님` : "행복한 맥스 님"}
                </h2>
                <p className="text-sm text-gray-500 font-medium">Pet365Care 회원</p>
             </div>
          </div>
          <ChevronRight className="text-gray-400" />
        </section>

        {/* Pet Profiles */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
             <h3 className="font-bold text-gray-900 text-lg">나의 반려동물</h3>
             <button onClick={() => setIsAddModalOpen(true)} className="text-sm font-semibold text-[#9c48ea]">+ 추가하기</button>
          </div>
          
          {loadingPets ? (
             <div className="flex justify-center p-4"><Loader2 className="animate-spin text-[#9c48ea]" /></div>
          ) : pets.length === 0 ? (
             <div className="pet365-card p-6 flex flex-col items-center justify-center text-center">
                <span className="text-4xl mb-3">🐶</span>
                <p className="text-sm text-gray-500 font-medium">등록된 가족이 없습니다.<br/>새로운 반려동물을 등록해보세요!</p>
                <button
                  onClick={handleRecoverPets}
                  disabled={recovering}
                  className="mt-4 flex items-center gap-2 bg-gradient-to-r from-[#9c48ea] to-[#62fae3] text-white font-bold text-sm px-5 py-2.5 rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
                >
                  {recovering ? <><Loader2 size={16} className="animate-spin" /> 복구 중...</> : <><Download size={16} /> 채팅방에서 불러오기</>}
                </button>
                {recoverMsg && <p className="text-xs font-medium text-gray-600 mt-3">{recoverMsg}</p>}
             </div>
          ) : (
             pets.map((pet) => (
                <div key={pet.id} onClick={() => { setSelectedPet(pet); setEditMode(false); }} className="pet365-card p-5 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all">
                   <div className="w-12 h-12 pet365-soft-panel rounded-2xl flex items-center justify-center text-xl">{getEmoji(pet.species)}</div>
                   <div className="flex-1">
                     <h4 className="font-bold text-gray-900 text-[15px]">{pet.name}</h4>
                     <p className="text-xs text-gray-500 font-medium mt-0.5">{pet.breed} · {pet.age}살 · {pet.gender === 'male' ? '♂' : '♀'}{pet.weight ? ` · ${pet.weight}kg` : ''}</p>
                   </div>
                   <div className="flex items-center gap-1">
                     <ChevronRight size={16} className="text-gray-400" />
                   </div>
                </div>
             ))
          )}
        </section>

        {/* Settings Menu */}
        <section className="pet365-card p-2 flex flex-col">

          <Link href="/pet365care/hospitals" className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-colors text-left group">
            <div className="w-10 h-10 bg-[#efe7ff] rounded-full flex items-center justify-center text-[#9c48ea] group-hover:bg-[#e8ddff] transition-colors">
               <Heart size={20} />
            </div>
            <div className="flex-1 font-semibold text-[15px] text-gray-800">동물 병원 찾기</div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
          {user?.isAdmin && (
            <>
              <div className="h-px bg-gray-100 my-1 mx-4"></div>
              <Link href="/pet365care/admin" className="flex items-center gap-4 p-4 hover:bg-blue-50 rounded-2xl transition-colors text-left group">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 group-hover:bg-blue-100 transition-colors">
                   <BarChart3 size={20} />
                </div>
                <div className="flex-1 font-semibold text-[15px] text-blue-600">관리자 대시보드</div>
                <ChevronRight size={18} className="text-gray-400" />
              </Link>
            </>
          )}
        </section>

        {/* ☁️ 데이터 백업/복원 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-gray-900 text-lg">🤖 AI 주치의 설정</h3>
          </div>
          <div className="pet365-card p-5 mb-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-700">분석 모델 선택</label>
                <select 
                  value={preferredAiState.provider ? `${preferredAiState.provider}:${preferredAiState.model}` : ""} 
                  onChange={handleAiChange} 
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 appearance-none"
                >
                  <option value="">🎁 알로팝 이벤트 AI (무료 제공 시)</option>
                  <optgroup label="Google (Gemini)">
                    {availableModels.gemini.map((m) => (
                      <option key={m.id} value={`gemini:${m.id}`}>{m.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="OpenAI (ChatGPT)">
                    {availableModels.openai.map((m) => (
                      <option key={m.id} value={`openai:${m.id}`}>{m.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Anthropic (Claude)">
                    {availableModels.anthropic.map((m) => (
                      <option key={m.id} value={`anthropic:${m.id}`}>{m.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                ※ 모델을 지정하면 <strong>본인의 API 키</strong>가 과금됩니다. 본앱 하단 <strong>설정 {'>'} API 키 관리</strong>에서 키를 등록해 주세요.<br/>
                ※ <strong>이벤트 AI</strong> 선택 시 무료 이벤트 제공 횟수가 소진될 때까지 설정 없이 이용할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-gray-900 text-lg">☁️ 데이터 백업</h3>
          </div>
          <div className="pet365-card p-5">
            {backupInfo ? (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full">💾 세이브 슬롯</span>
                  <span className="text-[10px] font-semibold text-gray-400">v{backupInfo.version}</span>
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  마지막 백업: {new Date(backupInfo.updatedAt).toLocaleString('ko-KR')} · {backupInfo.summary ? formatBackupSummary(backupInfo.summary) : `펫 ${backupInfo.petCount}마리`} · {(backupInfo.size / 1024).toFixed(1)}KB
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-400 font-medium mb-4">아직 백업이 없습니다. 폰 교체 전에 백업하세요!</p>
            )}

            {/* 백업 안내 멘트 */}
            <div className="bg-purple-50 rounded-xl p-3.5 mb-4 border border-purple-100">
              <p className="text-xs font-medium text-purple-700 leading-relaxed">
                💡 <strong>백업/복원 이용 안내</strong><br/>
                기기 간 데이터 이동을 위한 임시 보관 기능입니다. 용량 관리를 위해 <strong>사진 파일은 백업에서 제외</strong>되며, 서버에 보관된 데이터는 <strong>약 1시간 후 자동으로 안전하게 삭제</strong>됩니다. 폰을 바꾸거나 데이터를 옮기실 때 가볍게 이용해 주세요! 🐾
              </p>
            </div>

            <div className="flex gap-2">
              {/* 서버에 백업 */}
              <button
                onClick={async () => {
                  setBackupLoading(true); setBackupMsg('');
                  try {
                    const raw = exportStore();
                    const stats = getBackupStats();
                    const compressed = LZString.compressToUTF16(raw);
                    const r = await fetch('/api/pet365care/backup', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ compressed, originalSize: stats.sizeBytes, petCount: stats.petCount }),
                    });
                    const d = await r.json();
                    if (d.success) {
                      setBackupInfo({ ...d.data, summary: stats });
                      const ratio = Math.round((1 - compressed.length / raw.length) * 100);
                      setBackupMsg(`✅ 백업 완료! ${formatBackupSummary(stats)} (${(stats.sizeBytes / 1024).toFixed(1)}KB → ${(compressed.length * 2 / 1024).toFixed(1)}KB, ${ratio}% 압축)`);
                    } else setBackupMsg(`❌ ${d.error}`);
                  } catch { setBackupMsg('❌ 백업 실패'); }
                  finally { setBackupLoading(false); }
                }}
                disabled={backupLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#9c48ea] to-[#62fae3] text-white font-bold text-sm rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {backupLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                백업
              </button>

              {/* 서버에서 복원 */}
              <button
                onClick={async () => {
                  const isOk = await confirmModal({
                    title: "서버 백업 복원",
                    message: "서버 백업 데이터로 복원합니다.\n현재 로컬 데이터를 덮어씁니다.\n계속하시겠습니까?",
                    type: "danger",
                    confirmText: "복원하기"
                  });
                  if (!isOk) return;
                  setBackupLoading(true); setBackupMsg('');
                  try {
                    const r = await fetch('/api/pet365care/backup', { method: 'PUT' });
                    const d = await r.json();
                    if (d.success && d.data?.compressed) {
                      const raw = LZString.decompressFromUTF16(d.data.compressed);
                      if (!raw) { setBackupMsg('❌ 데이터 해제 실패'); return; }
                      const beforeRestore = exportStore();
                      const result = importStore(raw);
                      if (!result.verified || result.petCount !== d.data.petCount) {
                        importStore(beforeRestore);
                        setPets(getPets());
                        setBackupMsg('❌ 복원 검증 실패: 백업 수량과 복원 수량이 일치하지 않아 이전 데이터로 되돌렸습니다.');
                        return;
                      }
                      const restoredPets = getPets();
                      setPets(restoredPets);
                      setSelectedPet(current => current ? restoredPets.find(pet => pet.id === current.id) || null : null);
                      setBackupInfo({ ...d.data, summary: result });
                      setBackupMsg(`✅ 복원 완료! ${formatBackupSummary(result)} 로드됨`);
                    } else setBackupMsg(`❌ ${d.error || '백업이 없습니다'}`);
                  } catch { setBackupMsg('❌ 복원 실패'); }
                  finally { setBackupLoading(false); }
                }}
                disabled={backupLoading || !backupInfo}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-bold text-sm rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {backupLoading ? <Loader2 size={16} className="animate-spin" /> : <CloudDownload size={16} />}
                복원
              </button>
            </div>

            {backupMsg && <p className="text-xs font-medium text-gray-600 mt-3 text-center">{backupMsg}</p>}
            <p className="text-[10px] text-gray-400 mt-2 text-center">⚠️ 복원 시 현재 로컬 데이터를 덮어씁니다</p>
          </div>
        </section>

      </main>

      {/* Add Pet Bottom Sheet Modal */}
      {isAddModalOpen && (
         <div className="fixed inset-0 z-[300] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsAddModalOpen(false)}></div>
            <div className="bg-white w-full rounded-t-[40px] px-6 py-8 relative z-10 animate-in slide-in-from-bottom-full duration-300 shadow-2xl flex flex-col max-h-[90vh]">
               <button onClick={() => setIsAddModalOpen(false)} className="absolute top-6 right-6 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                 <X size={20} />
               </button>
               
               <h2 className="text-2xl font-black text-gray-900 mb-6">동물 등록하기</h2>
               
               <form onSubmit={handleAddPet} className="flex flex-col gap-4 overflow-y-auto hide-scrollbar pb-6">
                  <div className="flex flex-col gap-2">
                     <label className="text-sm font-bold text-gray-700 ml-1">이름 *</label>
                     <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="초코" className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">동물 종류 *</label>
                        <select value={form.species} onChange={e => setForm({...form, species: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 appearance-none cursor-pointer">
                           {SPECIES.map(s => <option key={s.value} value={s.value}>{s.label} {s.emoji}</option>)}
                        </select>
                     </div>
                     <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">성별 *</label>
                        <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 appearance-none cursor-pointer">
                           <option value="male">왕자님 ♂</option>
                           <option value="female">공주님 ♀</option>
                        </select>
                     </div>
                  </div>
                  <div className="flex flex-col gap-2">
                     <label className="text-sm font-bold text-gray-700 ml-1">품종 *</label>
                     <input type="text" required value={form.breed} onChange={e => setForm({...form, breed: e.target.value})} placeholder="푸들, 말티즈 등" className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">나이 *</label>
                        <input type="number" min="0" max="30" required value={form.age} onChange={e => setForm({...form, age: e.target.value})} placeholder="3" className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                     </div>
                     <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">체중 (kg)</label>
                        <input type="number" step="0.1" min="0" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} placeholder="5.2" className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                     </div>
                  </div>
                  <div className="flex flex-col gap-2">
                     <label className="text-sm font-bold text-gray-700 ml-1">생년월일</label>
                     <input type="date" value={form.birthday} onChange={e => setForm({...form, birthday: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                  </div>
                  <label className="flex items-center gap-3 bg-gray-50 rounded-2xl px-5 py-3.5 cursor-pointer">
                     <input type="checkbox" checked={form.isNeutered} onChange={e => setForm({...form, isNeutered: e.target.checked})} className="w-5 h-5 rounded accent-[#9c48ea]" />
                     <span className="font-medium text-gray-700">중성화 완료</span>
                  </label>
                  <div className="flex flex-col gap-2">
                     <label className="text-sm font-bold text-gray-700 ml-1">알레르기</label>
                     <input type="text" value={form.allergies} onChange={e => setForm({...form, allergies: e.target.value})} placeholder="닭고기, 소고기 등" className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                  </div>
                  <div className="flex flex-col gap-2">
                     <label className="text-sm font-bold text-gray-700 ml-1">메모/특이사항</label>
                     <textarea value={form.memo} onChange={e => setForm({...form, memo: e.target.value})} placeholder="특이사항을 자유롭게 기록하세요" rows={2} className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30 resize-none" />
                  </div>
                  
                  {/* Submit Button */}
                  <button type="submit" disabled={isAdding} className="w-full bg-gradient-to-r from-[#9c48ea] to-[#62fae3] text-white font-bold text-lg rounded-2xl py-4 mt-2 shadow-lg shadow-[#9c48ea]/20 active:scale-[0.98] transition-transform flex items-center justify-center">
                     {isAdding ? <Loader2 className="animate-spin" /> : "저장하기"}
                  </button>
               </form>
            </div>
         </div>
      )}

      {/* Pet Detail Modal */}
      {selectedPet && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setSelectedPet(null); setEditMode(false); }}></div>
          <div className="bg-white w-full rounded-t-[40px] px-6 py-8 relative z-10 shadow-2xl flex flex-col max-h-[90vh]">
            <button onClick={() => { setSelectedPet(null); setEditMode(false); }} className="absolute top-6 right-6 z-20 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500"><X size={20} /></button>

            {editMode ? (
              <>
                <h2 className="text-2xl font-black text-gray-900 mb-6">{selectedPet.name} 수정</h2>
                <form onSubmit={handleUpdatePet} className="flex flex-col gap-4 overflow-y-auto hide-scrollbar pb-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">이름 *</label>
                    <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">동물 종류</label>
                      <select value={form.species} onChange={e => setForm({...form, species: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 font-medium text-gray-900 outline-none appearance-none cursor-pointer">
                        {SPECIES.map(s => <option key={s.value} value={s.value}>{s.label} {s.emoji}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">성별</label>
                      <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 font-medium text-gray-900 outline-none appearance-none cursor-pointer">
                        <option value="male">왕자님 ♂</option><option value="female">공주님 ♀</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">품종</label>
                    <input type="text" required value={form.breed} onChange={e => setForm({...form, breed: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">나이</label>
                      <input type="number" min="0" max="30" required value={form.age} onChange={e => setForm({...form, age: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">체중 (kg)</label>
                      <input type="number" step="0.1" min="0" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">생년월일</label>
                    <input type="date" value={form.birthday} onChange={e => setForm({...form, birthday: e.target.value})} className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                  </div>
                  <label className="flex items-center gap-3 bg-gray-50 rounded-2xl px-5 py-3.5 cursor-pointer">
                    <input type="checkbox" checked={form.isNeutered} onChange={e => setForm({...form, isNeutered: e.target.checked})} className="w-5 h-5 rounded accent-[#9c48ea]" />
                    <span className="font-medium text-gray-700">중성화 완료</span>
                  </label>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">알레르기</label>
                    <input type="text" value={form.allergies} onChange={e => setForm({...form, allergies: e.target.value})} placeholder="닭고기, 소고기 등" className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">메모</label>
                    <textarea value={form.memo} onChange={e => setForm({...form, memo: e.target.value})} rows={2} className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 border border-transparent focus:border-[#9c48ea]/30 resize-none" />
                  </div>
                  <button type="submit" disabled={isAdding} className="w-full bg-gradient-to-r from-[#9c48ea] to-[#62fae3] text-white font-bold text-lg rounded-2xl py-4 mt-2 shadow-lg shadow-[#9c48ea]/20 active:scale-[0.98] transition-transform flex items-center justify-center">
                    {isAdding ? <Loader2 className="animate-spin" /> : "수정 완료"}
                  </button>
                </form>
              </>
            ) : (
              <div className="overflow-y-auto hide-scrollbar pb-6">
                {/* Pet Header */}
                <div className="flex items-center gap-4 mb-4 pr-12">
                  <div className="w-16 h-16 pet365-soft-panel rounded-3xl flex items-center justify-center shrink-0 text-3xl">{getEmoji(selectedPet.species)}</div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-black text-gray-900 truncate">{selectedPet.name}</h2>
                    <p className="text-sm text-gray-500 font-medium truncate">{SPECIES.find(s => s.value === selectedPet.species)?.label} · {selectedPet.breed}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-6">
                  <button onClick={() => openEdit(selectedPet)} className="h-12 rounded-2xl pet365-soft-panel text-[#9c48ea] font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                    <Pencil size={17} /> 수정
                  </button>
                  <button onClick={requestDeletePet} className="h-12 rounded-2xl bg-red-50 text-red-500 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                    <Trash2 size={17} /> 삭제
                  </button>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-gray-50 rounded-2xl p-4"><p className="text-xs text-gray-400 font-bold mb-1">나이</p><p className="font-bold text-gray-900">{selectedPet.age}살</p></div>
                  <div className="bg-gray-50 rounded-2xl p-4"><p className="text-xs text-gray-400 font-bold mb-1">성별</p><p className="font-bold text-gray-900">{selectedPet.gender === 'male' ? '♂ 남아' : '♀ 여아'}</p></div>
                  <div className="bg-gray-50 rounded-2xl p-4"><p className="text-xs text-gray-400 font-bold mb-1">체중</p><p className="font-bold text-gray-900">{selectedPet.weight ? `${selectedPet.weight}kg` : '-'}</p></div>

                  {selectedPet.birthday && <div className="bg-gray-50 rounded-2xl p-4 col-span-2"><p className="text-xs text-gray-400 font-bold mb-1">생일</p><p className="font-bold text-gray-900">🎂 {selectedPet.birthday}</p></div>}
                  {selectedPet.allergies && <div className="bg-amber-50 rounded-2xl p-4 col-span-2"><p className="text-xs text-amber-500 font-bold mb-1">⚠️ 알레르기</p><p className="font-bold text-gray-900">{selectedPet.allergies}</p></div>}
                  {selectedPet.memo && <div className="bg-gray-50 rounded-2xl p-4 col-span-2"><p className="text-xs text-gray-400 font-bold mb-1">메모</p><p className="text-sm text-gray-700">{selectedPet.memo}</p></div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
