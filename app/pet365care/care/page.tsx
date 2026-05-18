"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Gift, FileText, ChevronDown, Loader2, X, Clock, Edit2, Sparkles, Droplets, Bone, Activity, Smile, Moon, Syringe, Plus, Trash2, RefreshCw } from "lucide-react";
import { usePet365Auth } from "@/lib/pet365care/use-pet365-auth";
import { getErrorMessage } from "@/lib/pet365care/errors";
import { analyzeImage, generateHistorySummary, generateWeeklyRoutineCoaching, generateDailyOverallDiagnosis } from "@/lib/pet365care/gemini-client";
import { loadStore, todayStr, getAiDailyOverall, saveAiDailyOverall, addHealthRecord, getHealthRecords, updateHealthRecord, getPets, updatePet as updatePetStore, getAiSummary, saveAiSummary, getWeeklyCareStats, getAiWeeklyCoaching, saveAiWeeklyCoaching, getMedicalRecords, addMedicalRecord, deleteMedicalRecord, updateMedicalRecord, getMedications, addMedication, updateMedication, deleteMedication, getPreferredAi, type HealthRecord, type Pet, type WeeklyCareStats, type MedicalRecord, type MedicalRecordType, type Medication } from "@/lib/pet365care/local-store";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export default function CarePage() {
  const [activeTab, setActiveTab] = useState("일상");
  const { user } = usePet365Auth();
  const confirmModal = useConfirm();
  
  // Camera & AI State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ diagnosis: string; confidence: number; mood: string } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  // Pets & History State
  const [pets, setPets] = useState<Pet[]>([]);
  const [history, setHistory] = useState<HealthRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<string | null>("ALL");

  // Summary State
  const [summaries, setSummaries] = useState<Record<string, {text: string, updatedAt: string}>>({});
  const [summarizing, setSummarizing] = useState<Record<string, boolean>>({});
  
  const [dailyOverall, setDailyOverall] = useState<string | null>(null);
  const [dailyOverallLoading, setDailyOverallLoading] = useState(false);

  // Weekly Care Stats State
  const [dailyPetId, setDailyPetId] = useState<string | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyCareStats | null>(null);
  const [weeklyCoaching, setWeeklyCoaching] = useState<string | null>(null);
  const [isCoaching, setIsCoaching] = useState(false);

  // Medical Timeline State
  const [medicalPetId, setMedicalPetId] = useState<string | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  
  // Static Tags & Medication Forms
  const [isEditTagsOpen, setIsEditTagsOpen] = useState(false);
  const [tagsForm, setTagsForm] = useState({ allergies: "", chronicDiseases: "" });
  
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [medForm, setMedForm] = useState({ name: "", frequency: "매일", memo: "", time: "09:00" });
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  
  // Medical Form States
  const [recordFormType, setRecordFormType] = useState<MedicalRecordType | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordForm, setRecordForm] = useState({
    title: "",
    date: new Date().toISOString().split('T')[0],
    nextDate: "",
    hospital: "",
    memo: "",
    attachments: [] as string[]
  });

  useEffect(() => {
    const loadedPets = getPets();
    setPets(loadedPets);
    if (loadedPets.length > 0) {
      if (!dailyPetId) setDailyPetId(loadedPets[0].id);
      if (!medicalPetId) setMedicalPetId(loadedPets[0].id);
    }
  }, []);

  const fetchAiDailyDiagnosis = async (force: boolean = false) => {
    try {
      const pList = getPets();
      if (pList.length === 0) {
        setDailyOverall("반려동물을 먼저 등록해 주세요!");
        return;
      }
      
      if (!force) {
        const cached = getAiDailyOverall();
        if (cached && cached.date === todayStr()) {
          setDailyOverall(cached.text);
          return;
        }
      }
      
      setDailyOverallLoading(true);
      const tDate = todayStr();
      
      let sumWeeklyAvg = 0;
      let sumToday = 0;
      let validPetCount = 0;
      
      for (const p of pList) {
        const stats = getWeeklyCareStats(p.id);
        if (!stats || !stats.dailyRates || stats.dailyRates.length === 0) continue;
        
        sumWeeklyAvg += stats.overallRate;
        
        const todayStat = stats.dailyRates.find(r => r.date === tDate);
        sumToday += todayStat ? todayStat.rate : 0;
        
        validPetCount++;
      }
      
      if (validPetCount === 0 || sumToday === 0) {
        const emptyMsg = "아직 오늘 기록이 없어요! 밥이나 간식 등 루틴을 기록해 주시면 아이들의 건강을 분석해 드릴게요 🐾";
        setDailyOverall(emptyMsg);
        saveAiDailyOverall(emptyMsg);
        setDailyOverallLoading(false);
        return;
      }
      
      const avgWeekly = Math.round(sumWeeklyAvg / validPetCount);
      const avgToday = Math.round(sumToday / validPetCount);
      
      const petsInfo = pList.map(p => `- 이름: ${p.name}, 종류: ${p.species}`).join('\n');
      const recordsText = `오늘의 전체 평균 루틴 달성률: ${avgToday}%\n최근 7일 전체 평균 루틴 달성률: ${avgWeekly}%`;
      
      const res = await generateDailyOverallDiagnosis(petsInfo, recordsText, user?.username);
      setDailyOverall(res);
      saveAiDailyOverall(res);
      setDailyOverallLoading(false);
    } catch (err) {
      console.error("AI Daily Diagnosis error:", err);
      setDailyOverall("진단 정보를 불러오는 중 문제가 발생했어요.");
      setDailyOverallLoading(false);
    }
  };

  useEffect(() => {
    fetchAiDailyDiagnosis(false);
  }, [user?.username]);

  useEffect(() => {
    if (activeTab === "일상" && dailyPetId) {
      const stats = getWeeklyCareStats(dailyPetId);
      setWeeklyStats(stats);
      
      const cached = getAiWeeklyCoaching(dailyPetId);
      if (cached) {
        setWeeklyCoaching(cached.text);
      } else {
        setWeeklyCoaching(null);
      }
    }
  }, [activeTab, dailyPetId]);

  useEffect(() => {
    if (activeTab === "의료" && medicalPetId) {
      setMedicalRecords(getMedicalRecords(medicalPetId));
      setMedications(getMedications(medicalPetId));
    }
  }, [activeTab, medicalPetId]);

  useEffect(() => {
    if (activeTab === "기록" && user?.id) {
      const timer = window.setTimeout(() => {
        setHistoryLoading(true);
        setHistory(getHealthRecords());
        
        // Load summaries for all pets
        const newSummaries: Record<string, {text: string, updatedAt: string}> = {};
        const pList = getPets();
        for (const p of pList) {
          const s = getAiSummary(p.id);
          if (s) newSummaries[p.id] = s;
        }
        setSummaries(newSummaries);
        
        setHistoryLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
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
    setAnalysisResult(null);
    setAnalysisError(null);
    setSelectedPetId(pets.length > 0 ? pets[0].id : null); // 첫 번째 동물을 기본 선택

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = async () => {
      URL.revokeObjectURL(objectUrl); // 즉시 원본 메모리 해제
      
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      let width = img.width;
      let height = img.height;
      const maxDim = 600;
      
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
      
      const base64String = canvas.toDataURL("image/jpeg", 0.6); // Quality 60%

      try {
        const aiPref = getPreferredAi();
        const apiKey = "alopop-internal";
        if (!apiKey) {
          throw new Error("프로필 설정에서 AI 주치의 설정을 먼저 확인해주세요.");
        }

        const result = await analyzeImage(base64String);
        setAnalysisResult({
          diagnosis: result.diagnosis,
          confidence: result.confidence,
          mood: result.mood || "",
        });
      } catch (err: unknown) {
        console.error(err);
        setAnalysisError(`분석 실패: ${getErrorMessage(err)}`);
      } finally {
        setAnalyzing(false);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setAnalysisError("이미지를 불러올 수 없습니다.");
      setAnalyzing(false);
    };

    img.src = objectUrl;
  };

  const handleOpenAddForm = (type: MedicalRecordType) => {
    setIsAddMenuOpen(false);
    setEditingRecordId(null);
    setRecordFormType(type);
    setRecordForm({
      title: type === 'VAX' ? '종합백신' : type === 'PARASITE' ? '심장사상충 예방약' : type === 'HOSPITAL' ? '일반 진료' : '이상 증상',
      date: new Date().toISOString().split('T')[0],
      nextDate: "",
      hospital: "",
      memo: "",
      attachments: []
    });
  };

  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    if (recordForm.attachments.length + files.length > 10) {
      confirmModal({ title: "알림", message: "사진은 최대 10장까지 첨부할 수 있습니다.", type: "info" });
      return;
    }
    
    files.forEach(file => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        let width = img.width;
        let height = img.height;
        const maxDim = 400; // 썸네일 수준으로 강제 압축 (로컬 스토리지 한계 극복)
        
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
        
        setRecordForm(prev => ({
          ...prev,
          attachments: [...prev.attachments, base64String]
        }));
      };
      img.src = objectUrl;
    });
  };

  const handleRemoveAttachment = (index: number) => {
    setRecordForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSubmitRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicalPetId || !recordFormType) return;
    
    if (editingRecordId) {
      updateMedicalRecord(editingRecordId, {
        type: recordFormType,
        date: recordForm.date,
        title: recordForm.title || `${recordFormType} 기록`,
        memo: recordForm.memo || null,
        nextDate: recordForm.nextDate || null,
        hospital: recordForm.hospital || null,
        attachments: recordForm.attachments
      });
    } else {
      addMedicalRecord({
        petId: medicalPetId,
        type: recordFormType,
        date: recordForm.date,
        title: recordForm.title,
        memo: recordForm.memo || null,
        nextDate: recordForm.nextDate || null,
        hospital: recordForm.hospital || null,
        attachments: recordForm.attachments
      });
    }
    
    setMedicalRecords(getMedicalRecords(medicalPetId));
    setRecordFormType(null);
    setEditingRecordId(null);
  };

  const handleEditRecord = (record: MedicalRecord) => {
    setEditingRecordId(record.id);
    setRecordFormType(record.type);
    setRecordForm({
      title: record.title,
      date: record.date,
      nextDate: record.nextDate || "",
      hospital: record.hospital || "",
      memo: record.memo || "",
      attachments: record.attachments || []
    });
  };

  const handleDeleteRecord = async (id: string) => {
    const isOk = await confirmModal({
      title: "기록 삭제",
      message: "이 의료 기록을 삭제하시겠어요?",
      type: "danger",
      confirmText: "삭제",
    });
    if (!isOk) return;
    
    deleteMedicalRecord(id);
    if (medicalPetId) {
      setMedicalRecords(getMedicalRecords(medicalPetId));
    }
  };

  const handleToggleNeutered = async (petId: string, currentStatus: boolean) => {
    const isOk = await confirmModal({
      title: "중성화 상태 변경",
      message: `이 반려동물의 중성화 상태를 '${!currentStatus ? '완료' : '미완료'}'로 변경하시겠습니까?`,
      type: "info",
      confirmText: "변경",
    });
    if (!isOk) return;
    
    updatePetStore(petId, { isNeutered: !currentStatus });
    setPets(getPets());
  };

  const handleSaveTags = () => {
    if (!medicalPetId) return;
    updatePetStore(medicalPetId, { 
      allergies: tagsForm.allergies || undefined, 
      chronicDiseases: tagsForm.chronicDiseases || undefined 
    });
    setPets(getPets());
    setIsEditTagsOpen(false);
  };

  const handleSaveMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicalPetId) return;

    if (editingMedId) {
      updateMedication(editingMedId, {
        name: medForm.name,
        frequency: medForm.frequency,
        time: medForm.time || null,
        memo: medForm.memo || null,
      });
    } else {
      addMedication({
        petId: medicalPetId,
        name: medForm.name,
        frequency: medForm.frequency,
        isActive: true,
        time: medForm.time || null,
        memo: medForm.memo || null,
        checkLogs: []
      });
    }
    
    setMedications(getMedications(medicalPetId));
    setIsMedModalOpen(false);
    setEditingMedId(null);
    setMedForm({ name: "", frequency: "매일", memo: "", time: "09:00" });
  };

  const handleEditMedication = (med: Medication) => {
    setEditingMedId(med.id);
    setMedForm({
      name: med.name,
      frequency: med.frequency,
      memo: med.memo || "",
      time: med.time || "09:00"
    });
    setIsMedModalOpen(true);
  };

  const handleDeleteMedication = async (id: string) => {
    const isOk = await confirmModal({
      title: "복용 기록 삭제",
      message: "이 투약/복용 관리를 삭제하시겠어요?",
      type: "danger",
      confirmText: "삭제",
    });
    if (!isOk) return;
    deleteMedication(id);
    if (medicalPetId) setMedications(getMedications(medicalPetId));
  };

  const handleToggleMedCheck = (med: Medication) => {
    if (!medicalPetId) return;
    const today = new Date().toISOString().split('T')[0];
    const logs = med.checkLogs || [];
    const isChecked = logs.includes(today);
    
    let newLogs;
    if (isChecked) {
      newLogs = logs.filter(d => d !== today);
    } else {
      newLogs = [...logs, today];
    }
    
    updateMedication(med.id, { checkLogs: newLogs });
    setMedications(getMedications(medicalPetId));
  };


  const handleSaveResult = () => {
    if (!analysisResult) return;
    addHealthRecord({
      petId: selectedPetId === "OTHER" ? null : selectedPetId,
      aiDiagnosis: analysisResult.diagnosis,
      confidence: analysisResult.confidence,
      mood: analysisResult.mood,
    });
    setAnalysisResult(null);
    if (activeTab === "기록") {
      setHistory(getHealthRecords());
    }
  };

  const handleGenerateSummary = async (petId: string) => {
    const pet = pets.find(p => p.id === petId);
    if (!pet) return;
    
    // Get recent records for this pet (up to 10)
    const petRecords = history.filter(r => r.petId === petId).slice(0, 10);
    if (petRecords.length === 0) return;
    
    setSummarizing(prev => ({ ...prev, [petId]: true }));
    
    try {
      const recordsText = petRecords.map((r, i) => `[${i+1}] 진단: ${r.aiDiagnosis}`).join('\n');
      const summaryText = await generateHistorySummary(pet.name, recordsText);
      
      saveAiSummary(petId, summaryText);
      setSummaries(prev => ({ ...prev, [petId]: { text: summaryText, updatedAt: new Date().toISOString() } }));
    } catch (e) {
      console.error("Summary generation failed:", e);
    } finally {
      setSummarizing(prev => ({ ...prev, [petId]: false }));
    }
  };

  const handleWeeklyCoaching = async () => {
    if (!dailyPetId || !weeklyStats) return;
    const pet = pets.find(p => p.id === dailyPetId);
    if (!pet) return;

    setIsCoaching(true);
    try {
      const texts = `주간 평균 달성률: ${weeklyStats.overallRate}%\n항목별 달성률:\n${weeklyStats.itemStats.map(s => {
        let name = s.category;
        if (s.category === "feed") name = "밥";
        if (s.category === "water") name = "물";
        if (s.category === "snack") name = "간식";
        if (s.category === "play") name = "놀이";
        if (s.category === "teeth") name = "양치";
        if (s.category === "walk") name = "산책";
        if (s.category === "sleep") name = "수면";
        if (s.category === "brush") name = "빗질";
        return `- ${name}: ${s.rate}%`;
      }).join('\n')}`;
      
      const coachingText = await generateWeeklyRoutineCoaching(pet.name, texts, user?.username);
      setWeeklyCoaching(coachingText);
      saveAiWeeklyCoaching(pet.id, coachingText);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCoaching(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-[#f7f5fb] pb-6 font-['Plus_Jakarta_Sans',sans-serif]">
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
          <h1 className="text-[#9c48ea] font-extrabold text-xl tracking-tight">Pet365Care</h1>
        </div>
      </header>

      {/* Analysis Modal Overlay */}
      {(analyzing || analysisResult || analysisError) && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 sm:absolute pointer-events-auto">
          <div className="bg-white rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            {analyzing ? (
              <div className="p-10 flex flex-col items-center justify-center text-center gap-6">
                <div className="w-24 h-24 bg-[#efe7ff] rounded-full flex items-center justify-center animate-pulse">
                  <Loader2 className="animate-spin text-[#9c48ea]" size={40} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {getPreferredAi().provider === 'openai' ? 'ChatGPT' : getPreferredAi().provider === 'anthropic' ? 'Claude' : 'Gemini'} AI가 판독 중입니다...
                  </h3>
                  <p className="text-sm font-medium text-gray-500 max-w-[200px] mx-auto">사진의 픽셀 하나하나 분석하여 건강 상태를 확인하고 있어요.</p>
                </div>
              </div>
            ) : analysisResult ? (
              <div className="p-8 flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">분석 완료</h3>
                  </div>
                  <button onClick={() => setAnalysisResult(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                    <X size={20} className="text-gray-600" />
                  </button>
                </div>
                
                <div className="bg-gray-50 rounded-2xl p-4 mb-5 overflow-y-auto shrink-0 hide-scrollbar" style={{maxHeight: '180px'}}>
                  <p className="text-[14px] font-medium text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {analysisResult.diagnosis}
                  </p>
                </div>

                <div className="mb-5">
                  <p className="text-sm font-bold text-gray-900 mb-2">어떤 동물의 분석 결과인가요?</p>
                  <div className="flex flex-wrap gap-2">
                    {pets.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => setSelectedPetId(p.id)}
                        className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${selectedPetId === p.id ? 'bg-[#9c48ea] text-white border-[#9c48ea]' : 'bg-white text-gray-600 border-gray-200'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                    <button 
                      onClick={() => setSelectedPetId("OTHER")}
                      className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${selectedPetId === "OTHER" ? 'bg-[#9c48ea] text-white border-[#9c48ea]' : 'bg-white text-gray-600 border-gray-200'}`}
                    >
                      기타 (미등록)
                    </button>
                  </div>
                </div>
                
                <button onClick={handleSaveResult} className="w-full py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white font-bold rounded-2xl shadow-lg transition-transform active:scale-[0.98]">
                  결과 저장 및 닫기
                </button>
              </div>
            ) : analysisError ? (
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                  <X size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">분석 오류</h3>
                <p className="text-sm font-medium text-gray-600 mb-6">{analysisError}</p>
                <button onClick={() => setAnalysisError(null)} className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl">
                  닫기
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="px-6 flex flex-col gap-6">
        
        {/* Main AI Camera Button */}
        <button 
          onClick={handleCameraClick}
          className="relative w-full bg-gradient-to-r from-[#9c48ea] via-[#cc97ff] to-[#62fae3] rounded-[32px] p-6 flex items-center gap-4 text-left shadow-lg shadow-[#9c48ea]/20 active:scale-[0.98] transition-transform overflow-hidden group"
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
        <div onClick={() => fetchAiDailyDiagnosis(true)} className="bg-[#efe7ff] rounded-[32px] p-6 flex items-start gap-4 shadow-sm border border-[#9c48ea]/10 cursor-pointer hover:bg-[#e8ddff] transition-colors relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-[#9c48ea]/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <RefreshCw size={18} />
          </div>
          {dailyOverallLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <Loader2 className="animate-spin text-[#9c48ea]" size={24} />
            </div>
          )}
          <div className="w-12 h-12 bg-[#62fae3] rounded-full flex items-center justify-center text-[#08060b] shadow-inner shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256">
              <path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,206.51C111.45,210.15,56,161.4,56,104a72,72,0,0,1,144,0C200,161.4,144.55,210.15,128,222.51ZM128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Z"></path>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">AI 일일 진단</h3>
            <p className="text-sm font-medium text-gray-600 leading-snug">
              {dailyOverall || `${user?.username ? `${user.username}님의` : "나의"} 사랑스러운 아이들 기록을 불러오는 중입니다...`}
            </p>
          </div>
        </div>

        {/* Promotion Box */}
        <div className="bg-[#e8fbf8] rounded-[32px] p-6 flex flex-col gap-4 shadow-sm relative overflow-hidden">
          {/* Cutout illusion dots */}
          <div className="absolute top-1/2 -left-4 -translate-y-1/2 w-8 h-8 rounded-full bg-[#f7f5fb]"></div>
          <div className="absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-8 rounded-full bg-[#f7f5fb]"></div>

          <div className="flex items-center gap-3">
             <div className="w-10 h-10 flex items-center justify-center text-[#9c48ea]">
               <Gift size={28} strokeWidth={2.5} />
             </div>
             <div>
                <h4 className="font-bold text-gray-900 text-base">강쥐가 행복해 보여요!</h4>
                <p className="text-xs font-medium text-gray-600">프리미엄 관절 영양제는 어떠세요?</p>
             </div>
          </div>
          <button className="w-full py-4 bg-[#09070d] hover:bg-[#17111f] text-white font-bold rounded-2xl shadow-md transition-colors text-sm tracking-wide">
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
                  ? "bg-[#9c48ea] text-white shadow-md"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Inner Tab Content (Daily Care) */}
        {activeTab === "일상" && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 mt-2">
            {/* Pet Selector for Daily Tab */}
            <div className="flex flex-wrap gap-2">
              {pets.map(p => (
                <button 
                  key={p.id}
                  onClick={() => setDailyPetId(p.id)}
                  className={`px-4 py-2.5 rounded-[20px] text-sm font-bold border transition-all ${dailyPetId === p.id ? 'bg-[#09070d] text-white border-[#09070d] shadow-md scale-105' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Weekly Average Progress */}
            {weeklyStats && (
              <div className="bg-white rounded-[24px] p-5 flex items-center justify-between shadow-sm border border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">이번 주 평균 루틴 달성률</h3>
                  <p className="text-xs font-medium text-gray-500">{weeklyStats.overallRate >= 80 ? "완벽해요! 아주 건강한 한 주예요 🎉" : "꾸준한 케어가 건강의 비결이에요!"}</p>
                </div>
                <div className="w-16 h-16 shrink-0 relative flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                    <path className="text-gray-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-[#9c48ea] transition-all duration-1000 ease-out" strokeWidth="3" strokeDasharray={`${weeklyStats.overallRate}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span className="absolute text-sm font-bold text-gray-800">{weeklyStats.overallRate}%</span>
                </div>
              </div>
            )}

            {/* Weekly Bar Chart */}
            {weeklyStats && (
              <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4 text-sm">최근 7일 루틴 기록</h3>
                <div className="flex items-end justify-between h-32 gap-2 mt-2">
                  {weeklyStats.dailyRates.map((day, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 gap-2 group h-full">
                      <span className="text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{day.rate}%</span>
                      <div className="w-full bg-gray-100 rounded-full h-full flex flex-col justify-end overflow-hidden relative">
                        <div 
                          className="w-full bg-gradient-to-t from-[#9c48ea] to-[#c78bfa] rounded-full transition-all duration-700 ease-out" 
                          style={{ height: `${day.rate}%` }} 
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${i === 6 ? 'text-[#9c48ea]' : 'text-gray-500'}`}>{day.dayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Itemized Stats */}
            {weeklyStats && (
              <div className="grid grid-cols-4 gap-3">
                {weeklyStats.itemStats.map(stat => {
                  let icon = <Bone size={20} />;
                  let name = stat.category;
                  if (stat.category === "feed") { name = "밥"; icon = <Bone size={20} />; }
                  if (stat.category === "water") { name = "물"; icon = <Droplets size={20} />; }
                  if (stat.category === "snack") { name = "간식"; icon = <Gift size={20} />; }
                  if (stat.category === "play") { name = "놀이"; icon = <Smile size={20} />; }
                  if (stat.category === "teeth") { name = "양치"; icon = <Sparkles size={20} />; }
                  if (stat.category === "walk") { name = "산책"; icon = <Activity size={20} />; }
                  if (stat.category === "sleep") { name = "수면"; icon = <Moon size={20} />; }
                  if (stat.category === "brush") { name = "빗질"; icon = <Sparkles size={20} />; }

                  return (
                    <div key={stat.category} className="bg-white rounded-2xl p-3 flex flex-col items-center justify-center gap-1 shadow-sm border border-gray-100 relative overflow-hidden">
                      <div className="text-[#9c48ea] mb-1">{icon}</div>
                      <span className="text-[11px] font-bold text-gray-700">{name}</span>
                      <span className="text-[10px] font-black text-[#9c48ea]">{stat.rate}%</span>
                      {stat.rate >= 80 && (
                        <div className="absolute top-1 right-1 text-[10px]">👑</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* AI Weekly Coaching */}
            <div className="bg-[#efe7ff] rounded-[32px] p-6 shadow-sm border border-[#9c48ea]/10 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#9c48ea]/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#9c48ea] text-white rounded-full flex items-center justify-center shadow-inner">
                    <Sparkles size={16} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-[15px]">AI 주간 분석 리포트</h3>
                </div>
                <button 
                  onClick={handleWeeklyCoaching}
                  disabled={isCoaching || !weeklyStats}
                  className="px-3 py-1.5 bg-white text-[#9c48ea] text-xs font-bold rounded-full shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {isCoaching ? "분석 중..." : "리포트 받기"}
                </button>
              </div>
              
              <div className="bg-white/60 rounded-2xl p-4 backdrop-blur-sm min-h-[80px] flex items-center">
                {isCoaching ? (
                  <div className="w-full flex justify-center py-2">
                    <Loader2 className="animate-spin text-[#9c48ea]" size={20} />
                  </div>
                ) : weeklyCoaching ? (
                  <p className="text-sm font-medium text-gray-800 leading-relaxed">
                    {weeklyCoaching}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-gray-500 text-center w-full">
                    이번 주 달성률을 바탕으로 AI 리포트를 받아보세요!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Medical Tab */}
        {activeTab === "의료" && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 mt-2 relative min-h-[400px]">
            {/* Pet Selector for Medical Tab */}
            <div className="flex flex-wrap gap-2">
              {pets.map(p => (
                <button 
                  key={p.id}
                  onClick={() => setMedicalPetId(p.id)}
                  className={`px-4 py-2.5 rounded-[20px] text-sm font-bold border transition-all ${medicalPetId === p.id ? 'bg-[#09070d] text-white border-[#09070d] shadow-md scale-105' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {medicalPetId && (() => {
              const selectedPet = pets.find(p => p.id === medicalPetId);
              if (!selectedPet) return null;
              return (
                <div className="flex flex-col gap-4 pb-24">
                  {/* Static Profile Tags (Neutering, Allergies, Chronic) */}
                  <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 relative">
                    <button onClick={() => { setTagsForm({ allergies: selectedPet.allergies || "", chronicDiseases: selectedPet.chronicDiseases || "" }); setIsEditTagsOpen(true); }} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <div className="flex flex-wrap gap-2 pr-10">
                      <button 
                        onClick={() => handleToggleNeutered(selectedPet.id, !!selectedPet.isNeutered)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedPet.isNeutered ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        <span>🏥 중성화</span>
                        <div className={`w-6 h-3 rounded-full relative transition-colors ${selectedPet.isNeutered ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-white transition-transform ${selectedPet.isNeutered ? 'translate-x-3' : 'translate-x-0'}`} />
                        </div>
                      </button>
                      {selectedPet.allergies && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600">
                          <span>⚠️ {selectedPet.allergies}</span>
                        </div>
                      )}
                      {selectedPet.chronicDiseases && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-600">
                          <span>🩺 {selectedPet.chronicDiseases}</span>
                        </div>
                      )}
                      {!selectedPet.allergies && !selectedPet.chronicDiseases && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gray-50 text-gray-400">
                          <span>알레르기/만성질환 없음</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Daily Medication Checklist */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between ml-1 mt-2 mb-1">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">복용 관리</h3>
                      <button onClick={() => setIsMedModalOpen(true)} className="text-xs font-bold text-[#9c48ea] hover:bg-[#9c48ea]/10 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                        <Plus size={14} /> 약 추가
                      </button>
                    </div>
                    {medications.length === 0 ? (
                      <div className="bg-gray-50 rounded-[24px] p-6 text-center border border-dashed border-gray-200">
                        <p className="text-sm font-medium text-gray-500 mb-1">등록된 복용 약이 없습니다.</p>
                        <p className="text-xs text-gray-400">우측 상단 '약 추가'를 눌러 등록해보세요!</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {medications.map(med => {
                          const today = new Date().toISOString().split('T')[0];
                          const isChecked = (med.checkLogs || []).includes(today);
                          return (
                            <div key={med.id} className="bg-white rounded-[20px] p-4 flex items-center justify-between gap-3 shadow-sm border border-gray-100">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-900 truncate">{med.name}</p>
                                <div className="flex gap-2 mt-1">
                                  <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{med.frequency}</span>
                                  {med.memo && <span className="text-[11px] font-medium text-gray-400 truncate">{med.memo}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-1">
                                  <button onClick={() => handleEditMedication(med)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors shrink-0">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => handleDeleteMedication(med.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                                <button 
                                  onClick={() => handleToggleMedCheck(med)}
                                  className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all shrink-0 ${isChecked ? 'bg-gradient-to-br from-[#9c48ea] to-[#6d28d9] text-white shadow-md shadow-purple-500/20' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                >
                                  {isChecked ? <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center"><div className="w-2.5 h-2.5 bg-white rounded-full" /></div> : <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Health Timeline Feed */}
                  <div className="flex flex-col gap-3">
                    <h3 className="font-bold text-gray-900 ml-1 mt-2 mb-1 flex items-center gap-2">건강 타임라인</h3>
                    {medicalRecords.length === 0 ? (
                      <div className="bg-gray-50 rounded-[24px] p-8 text-center border border-dashed border-gray-200">
                        <FileText size={32} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-sm font-medium text-gray-500 mb-1">등록된 의료 기록이 없습니다.</p>
                        <p className="text-xs text-gray-400">하단의 + 버튼을 눌러 첫 기록을 추가해보세요!</p>
                      </div>
                    ) : (
                      medicalRecords.map((record) => (
                        <div key={record.id} className="bg-white rounded-2xl p-4 flex items-start gap-3 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-inner ${record.type === 'VAX' ? 'bg-blue-100 text-blue-600' : record.type === 'PARASITE' ? 'bg-emerald-100 text-emerald-600' : record.type === 'SYMPTOM' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}`}>
                            {record.type === 'VAX' ? '💉' : record.type === 'PARASITE' ? '🐛' : record.type === 'SYMPTOM' ? '🤢' : '🏥'}
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="font-bold text-gray-900 text-[15px] truncate">{record.title}</p>
                            <p className="text-xs font-medium text-gray-500 mt-1">
                              {record.date}
                              {record.hospital && ` · ${record.hospital}`}
                            </p>
                            {record.nextDate && (
                              <p className="text-xs text-emerald-600 font-bold mt-1 bg-emerald-100/50 inline-block px-2 py-0.5 rounded-md">
                                다음 예정: {record.nextDate}
                              </p>
                            )}
                            {record.memo && <p className="text-xs font-medium text-gray-600 mt-1.5 whitespace-pre-wrap">{record.memo}</p>}
                            
                            {record.attachments && record.attachments.length > 0 && (
                              <div className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                                {record.attachments.map((img, i) => (
                                  <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                    <img src={img} alt="첨부 사진" className="h-16 w-16 object-cover rounded-xl border border-gray-200" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <button 
                              onClick={() => handleEditRecord(record)} 
                              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors shrink-0"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteRecord(record.id)} 
                              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Universal Add Button (FAB) */}
            <button
              onClick={() => setIsAddMenuOpen(true)}
              className="fixed bottom-24 right-5 w-14 h-14 bg-gradient-to-r from-[#9c48ea] to-[#6d28d9] text-white rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all z-20"
            >
              <Plus size={28} />
            </button>
            
            {/* Action Sheet (Bottom Menu) */}
            {isAddMenuOpen && (
              <>
                <div className="fixed inset-0 bg-black/40 z-[300] animate-in fade-in duration-200" onClick={() => setIsAddMenuOpen(false)} />
                <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-6 z-[310] animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
                  <h3 className="font-bold text-gray-900 text-lg mb-4">어떤 기록을 남길까요?</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleOpenAddForm('VAX')} className="bg-blue-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-blue-100 transition-colors">
                      <span className="text-2xl">💉</span>
                      <span className="font-bold text-blue-700 text-sm">예방접종</span>
                    </button>
                    <button onClick={() => handleOpenAddForm('PARASITE')} className="bg-emerald-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-emerald-100 transition-colors">
                      <span className="text-2xl">🐛</span>
                      <span className="font-bold text-emerald-700 text-sm">구충·사상충</span>
                    </button>
                    <button onClick={() => handleOpenAddForm('HOSPITAL')} className="bg-purple-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-purple-100 transition-colors">
                      <span className="text-2xl">🏥</span>
                      <span className="font-bold text-purple-700 text-sm">병원 진료</span>
                    </button>
                    <button onClick={() => handleOpenAddForm('SYMPTOM')} className="bg-red-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-red-100 transition-colors">
                      <span className="text-2xl">🤢</span>
                      <span className="font-bold text-red-700 text-sm">이상 증상</span>
                    </button>
                  </div>
                  <button onClick={() => setIsAddMenuOpen(false)} className="w-full mt-5 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-colors">
                    닫기
                  </button>
                </div>
              </>
            )}

            {/* Medical Record Form Modal */}
            {recordFormType && (
              <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-200">
                <div className="absolute inset-0 bg-black/50" onClick={() => { setRecordFormType(null); setEditingRecordId(null); }} />
                <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto hide-scrollbar animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                      {recordFormType === 'VAX' ? '💉 접종 기록' : recordFormType === 'PARASITE' ? '🐛 구충·사상충' : recordFormType === 'HOSPITAL' ? '🏥 병원 진료' : '🤢 이상 증상'} {editingRecordId ? '수정' : '추가'}
                    </h3>
                    <button onClick={() => { setRecordFormType(null); setEditingRecordId(null); }} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X size={20} /></button>
                  </div>
                  
                  <form onSubmit={handleSubmitRecord} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-gray-700">기록 제목 *</label>
                      <input type="text" required value={recordForm.title} onChange={e => setRecordForm({...recordForm, title: e.target.value})} placeholder={recordFormType === 'VAX' ? '광견병, 종합백신 등' : '진단명이나 증상을 간단히 적어주세요'} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-bold text-gray-700">날짜 *</label>
                        <input type="date" required value={recordForm.date} onChange={e => setRecordForm({...recordForm, date: e.target.value})} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30" />
                      </div>
                      {(recordFormType === 'VAX' || recordFormType === 'PARASITE' || recordFormType === 'HOSPITAL') && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-bold text-gray-700">다음 {recordFormType === 'HOSPITAL' ? '재진' : '예정'}일</label>
                          <input type="date" value={recordForm.nextDate} onChange={e => setRecordForm({...recordForm, nextDate: e.target.value})} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30" />
                        </div>
                      )}
                    </div>

                    {(recordFormType === 'VAX' || recordFormType === 'HOSPITAL') && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-bold text-gray-700">병원명</label>
                        <input type="text" value={recordForm.hospital} onChange={e => setRecordForm({...recordForm, hospital: e.target.value})} placeholder="방문하신 동물병원 이름" className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30" />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-gray-700">상세 메모</label>
                      <textarea value={recordForm.memo} onChange={e => setRecordForm({...recordForm, memo: e.target.value})} placeholder="자세한 증상이나 의사 선생님의 소견을 메모해두세요." rows={3} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 resize-none" />
                    </div>

                    {recordFormType === 'HOSPITAL' && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-bold text-gray-700 flex items-center justify-between">
                          <span>사진 첨부 (영수증, 진단서 등)</span>
                          <span className="text-xs text-gray-400 font-normal">{recordForm.attachments.length}/10</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {recordForm.attachments.map((img, idx) => (
                            <div key={idx} className="relative w-16 h-16 rounded-xl border border-gray-200 overflow-hidden group">
                              <img src={img} alt="첨부" className="w-full h-full object-cover" />
                              <button type="button" onClick={() => handleRemoveAttachment(idx)} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={20} className="text-white" />
                              </button>
                            </div>
                          ))}
                          {recordForm.attachments.length < 10 && (
                            <button type="button" onClick={() => attachmentInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors">
                              <Camera size={24} />
                            </button>
                          )}
                        </div>
                        <input type="file" accept="image/*" multiple ref={attachmentInputRef} className="hidden" onChange={handleAddAttachment} />
                        <p className="text-[11px] text-gray-400 mt-1">※ 기기 용량 관리를 위해 사진은 썸네일 크기(최대 400px)로 자동 압축되어 보관됩니다.</p>
                      </div>
                    )}
                    
                    <button type="submit" className="w-full bg-gradient-to-r from-[#9c48ea] to-[#6d28d9] text-white font-bold rounded-xl py-3.5 mt-2 active:scale-[0.98] transition-transform">
                      기록 저장하기
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Edit Static Tags Modal */}
            {isEditTagsOpen && (
              <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-200">
                <div className="absolute inset-0 bg-black/50" onClick={() => setIsEditTagsOpen(false)} />
                <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-xl font-black text-gray-900">태그 수정</h3>
                    <button onClick={() => setIsEditTagsOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X size={20} /></button>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-gray-700 flex items-center gap-1.5"><span className="text-amber-500">⚠️</span> 알레르기</label>
                      <input type="text" value={tagsForm.allergies} onChange={e => setTagsForm({...tagsForm, allergies: e.target.value})} placeholder="예: 닭고기, 연어, 집먼지진드기 등" className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-gray-700 flex items-center gap-1.5"><span className="text-red-500">🩺</span> 만성질환</label>
                      <input type="text" value={tagsForm.chronicDiseases} onChange={e => setTagsForm({...tagsForm, chronicDiseases: e.target.value})} placeholder="예: 슬개골 탈구, 심부전, 당뇨 등" className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30" />
                    </div>
                    <button onClick={handleSaveTags} className="w-full bg-gray-900 text-white font-bold rounded-xl py-3.5 mt-2 active:scale-[0.98] transition-transform">
                      태그 저장
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Medication Modal */}
            {isMedModalOpen && (
              <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-200">
                <div className="absolute inset-0 bg-black/50" onClick={() => { setIsMedModalOpen(false); setEditingMedId(null); }} />
                <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-xl font-black text-gray-900">💊 약 {editingMedId ? '수정' : '추가'}</h3>
                    <button onClick={() => { setIsMedModalOpen(false); setEditingMedId(null); }} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleSaveMedication} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-gray-700">약 이름 *</label>
                      <input type="text" required value={medForm.name} onChange={e => setMedForm({...medForm, name: e.target.value})} placeholder="예: 심장약, 관절 영양제 등" className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-bold text-gray-700">복용 주기 *</label>
                        <select value={medForm.frequency} onChange={e => setMedForm({...medForm, frequency: e.target.value})} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30 appearance-none">
                          <option value="매일">매일</option>
                          <option value="주 1회">주 1회</option>
                          <option value="주 2회">주 2회</option>
                          <option value="주 3회">주 3회</option>
                          <option value="월 1회">월 1회</option>
                          <option value="증상 있을 때만">증상 있을 때만</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-bold text-gray-700">알람 시간</label>
                        <input type="time" value={medForm.time} onChange={e => setMedForm({...medForm, time: e.target.value})} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-gray-700">추가 메모</label>
                      <input type="text" value={medForm.memo} onChange={e => setMedForm({...medForm, memo: e.target.value})} placeholder="예: 식후 복용, 반 알만 쪼개서 등" className="w-full bg-gray-50 rounded-xl px-4 py-3 font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/30" />
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-[#9c48ea] to-[#6d28d9] text-white font-bold rounded-xl py-3.5 mt-2 active:scale-[0.98] transition-transform">
                      추가하기
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "기록" && (() => {
          const filteredHistory = history.filter(record => {
            if (historyFilter === "ALL") return true;
            if (historyFilter === "OTHER") return !record.petId;
            return record.petId === historyFilter;
          });

          return (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 mt-2">
            <h3 className="font-bold text-gray-900 ml-1 text-[15px] flex items-center gap-2">
              <Clock size={16} className="text-[#9c48ea]" /> AI 분석 기록
            </h3>

            {/* Pet Filter */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 px-1">
              <button 
                onClick={() => setHistoryFilter("ALL")}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${historyFilter === "ALL" ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200'}`}
              >
                전체
              </button>
              {pets.map(p => (
                <button 
                  key={p.id}
                  onClick={() => setHistoryFilter(p.id)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${historyFilter === p.id ? 'bg-[#9c48ea] text-white border-[#9c48ea]' : 'bg-white text-gray-500 border-gray-200'}`}
                >
                  {p.name}
                </button>
              ))}
              <button 
                onClick={() => setHistoryFilter("OTHER")}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${historyFilter === "OTHER" ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200'}`}
              >
                기타 (미등록)
              </button>
            </div>

            {/* History Summary Cards */}
            {!historyLoading && filteredHistory.length > 0 && (() => {
              const petsToSummarize = historyFilter === "ALL" 
                ? pets.filter(p => history.some(r => r.petId === p.id))
                : historyFilter !== "OTHER"
                  ? pets.filter(p => p.id === historyFilter)
                  : [];

              return petsToSummarize.map(p => {
                const isSummarizing = summarizing[p.id];
                const summary = summaries[p.id];
                const petRecordCount = history.filter(r => r.petId === p.id).length;

                return (
                  <div key={p.id} className="bg-gradient-to-r from-[#efe7ff] to-[#e8fbf8] rounded-[24px] p-5 border border-[#9c48ea]/10 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#9c48ea]">
                        <Sparkles size={14} /> 
                        <span>[{p.name}] AI 분석 요약</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-400">총 {petRecordCount}회</span>
                    </div>
                    
                    <div className="min-h-[40px] mb-4">
                      {isSummarizing ? (
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                          <Loader2 className="animate-spin text-[#9c48ea]" size={16} />
                          AI 주치의가 기록을 종합하고 있습니다...
                        </div>
                      ) : summary ? (
                        <p className="text-sm font-medium text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {summary.text}
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-gray-500 leading-relaxed">
                          AI 분석을 통해 최근 건강 트렌드를 요약해 보세요!
                        </p>
                      )}
                    </div>

                    <button 
                      onClick={() => handleGenerateSummary(p.id)}
                      disabled={isSummarizing}
                      className="w-full py-2.5 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-xl shadow-sm border border-gray-200 transition-colors disabled:opacity-50"
                    >
                      {isSummarizing ? '분석 중...' : 'AI 분석'}
                    </button>
                  </div>
                );
              });
            })()}
            
            {historyLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-[#9c48ea]" size={24} />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="bg-white rounded-[24px] p-8 text-center shadow-sm border border-gray-100">
                <FileText size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">해당 동물의 분석 기록이 없습니다.</p>
              </div>
            ) : historyFilter !== "ALL" ? (
              <div className="flex flex-col gap-3">
                {filteredHistory.map((record) => {
                  const date = new Date(record.createdAt);
                  const dateString = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
                  const petName = pets.find(p => p.id === record.petId)?.name || "기타 (미등록)";
                  
                  return (
                    <div 
                      key={record.id} 
                      className="bg-white rounded-[24px] p-5 flex flex-col gap-3 shadow-sm border border-transparent hover:border-[#9c48ea]/20 transition-all"
                    >
                       <div 
                         className="flex justify-between items-center cursor-pointer"
                         onClick={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}
                       >
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">{petName}</span>
                            <span className="text-xs font-bold text-[#9c48ea] bg-[#efe7ff] px-2.5 py-1 rounded-full">사진 분석 완료</span>
                          </div>
                          <span className="text-xs font-semibold text-gray-400">{dateString}</span>
                       </div>
                       
                       <p 
                         onClick={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}
                         className={`cursor-pointer text-sm font-medium text-gray-700 leading-relaxed transition-all whitespace-pre-wrap ${expandedRecordId === record.id ? '' : 'line-clamp-3'}`}
                       >
                         {record.aiDiagnosis}
                       </p>
                       
                       {expandedRecordId !== record.id && (
                         <div 
                           className="text-center pt-1 cursor-pointer"
                           onClick={() => setExpandedRecordId(record.id)}
                         >
                           <ChevronDown size={18} className="mx-auto text-gray-300" />
                         </div>
                       )}

                       {expandedRecordId === record.id && (
                         <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                           <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 mb-1">
                             <Edit2 size={14} />
                             <span>누구의 기록인가요? (재지정)</span>
                           </div>
                           <div className="flex flex-wrap gap-2">
                             {pets.map(p => {
                               const isSelected = record.petId === p.id;
                               return (
                                 <button
                                   key={p.id}
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     updateHealthRecord(record.id, { petId: p.id });
                                     setHistory(getHealthRecords());
                                   }}
                                   className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${isSelected ? 'bg-[#9c48ea] text-white border-[#9c48ea]' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                                 >
                                   {p.name}
                                 </button>
                               )
                             })}
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 updateHealthRecord(record.id, { petId: null });
                                 setHistory(getHealthRecords());
                               }}
                               className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${!record.petId ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                             >
                               기타 (미등록)
                             </button>
                           </div>
                         </div>
                       )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          );
        })()}

      </main>

    </div>
  );
}
