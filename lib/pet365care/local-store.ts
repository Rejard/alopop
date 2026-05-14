/**
 * Pet365Care 로컬 스토리지 데이터 레이어
 * 
 * 모든 개인 데이터를 브라우저 localStorage에 저장합니다.
 * 서버 API 없이 클라이언트에서 직접 CRUD.
 */

const STORE_KEY = "pet365care_data";

// ======= 데이터 타입 =======

export interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  gender: string;
  birthday?: string | null;
  weight?: number | null;
  isNeutered: boolean;
  allergies?: string | null;
  memo?: string | null;
  createdAt: string;
  updatedAt: string;
  vaccinations: Vaccination[];
}

export interface Vaccination {
  id: string;
  petId: string;
  name: string;
  date: string;
  nextDate?: string | null;
  hospital?: string | null;
  memo?: string | null;
  createdAt: string;
}

export interface CareCheck {
  petId: string;
  date: string;
  category: string;
  checked: boolean;
}

export interface ActivityLog {
  id: string;
  petId: string;
  type: "WALK" | "SLEEP";
  startTime: string;
  endTime?: string | null;
  distance?: number | null;
}

export interface HealthRecord {
  id: string;
  petId?: string | null;
  aiDiagnosis: string;
  confidence: number;
  mood?: string | null;
  createdAt: string;
}

export interface PetStore {
  pets: Pet[];
  careChecks: CareCheck[];
  activityLogs: ActivityLog[];
  healthRecords: HealthRecord[];
  settings: {
    geminiApiKey?: string;
    hospitalDbVersion?: string;
  };
}

// ======= 유틸 =======

function uuid(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

export function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ======= 스토어 로드/세이브 =======

const DEFAULT_STORE: PetStore = {
  pets: [],
  careChecks: [],
  activityLogs: [],
  healthRecords: [],
  settings: {},
};

export function loadStore(): PetStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_STORE };
    return { ...DEFAULT_STORE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STORE };
  }
}

export function saveStore(store: PetStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

// ======= 펫 CRUD =======

export function getPets(): Pet[] {
  return loadStore().pets;
}

export function addPet(data: Omit<Pet, "id" | "createdAt" | "updatedAt" | "vaccinations">): Pet {
  const store = loadStore();
  const pet: Pet = {
    ...data,
    id: uuid(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    vaccinations: [],
  };
  store.pets.push(pet);
  saveStore(store);
  return pet;
}

export function updatePet(id: string, data: Partial<Omit<Pet, "id" | "createdAt" | "vaccinations">>): Pet | null {
  const store = loadStore();
  const idx = store.pets.findIndex(p => p.id === id);
  if (idx === -1) return null;
  store.pets[idx] = { ...store.pets[idx], ...data, updatedAt: nowISO() };
  saveStore(store);
  return store.pets[idx];
}

export function deletePet(id: string): boolean {
  const store = loadStore();
  const before = store.pets.length;
  store.pets = store.pets.filter(p => p.id !== id);
  // 관련 데이터도 삭제
  store.careChecks = store.careChecks.filter(c => c.petId !== id);
  store.activityLogs = store.activityLogs.filter(a => a.petId !== id);
  store.pets.forEach(p => {
    p.vaccinations = p.vaccinations.filter(v => v.petId !== id);
  });
  saveStore(store);
  return store.pets.length < before;
}

// ======= 접종 CRUD =======

export function addVaccination(petId: string, data: Omit<Vaccination, "id" | "petId" | "createdAt">): Vaccination | null {
  const store = loadStore();
  const pet = store.pets.find(p => p.id === petId);
  if (!pet) return null;
  const vax: Vaccination = {
    ...data,
    id: uuid(),
    petId,
    createdAt: nowISO(),
  };
  pet.vaccinations.push(vax);
  pet.updatedAt = nowISO();
  saveStore(store);
  return vax;
}

export function deleteVaccination(petId: string, vaxId: string): boolean {
  const store = loadStore();
  const pet = store.pets.find(p => p.id === petId);
  if (!pet) return false;
  const before = pet.vaccinations.length;
  pet.vaccinations = pet.vaccinations.filter(v => v.id !== vaxId);
  saveStore(store);
  return pet.vaccinations.length < before;
}

// ======= 케어 체크리스트 =======

const DEFAULT_CATEGORIES = ["feed", "water", "walk", "snack", "play", "teeth"];

export function getCareChecklist(petId: string, date?: string): { items: CareCheck[]; checkedCount: number; totalCount: number; completionRate: number } {
  const store = loadStore();
  const d = date || todayStr();
  let items = store.careChecks.filter(c => c.petId === petId && c.date === d);

  // 없으면 기본 항목 생성
  if (items.length === 0) {
    items = DEFAULT_CATEGORIES.map(category => ({
      petId,
      date: d,
      category,
      checked: false,
    }));
    store.careChecks.push(...items);
    saveStore(store);
  }

  const checkedCount = items.filter(i => i.checked).length;
  const totalCount = items.length;
  return {
    items,
    checkedCount,
    totalCount,
    completionRate: totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0,
  };
}

export function toggleCareCheck(petId: string, category: string, checked: boolean, date?: string): void {
  const store = loadStore();
  const d = date || todayStr();
  const idx = store.careChecks.findIndex(c => c.petId === petId && c.date === d && c.category === category);
  if (idx !== -1) {
    store.careChecks[idx].checked = checked;
  } else {
    store.careChecks.push({ petId, date: d, category, checked });
  }
  saveStore(store);
}

// ======= 활동 기록 =======

export function getActivityToday(petId: string): { walkDistance: number; sleepHours: number; sleepMinutes: number; activeWalkId: string | null; activeSleepId: string | null } {
  const store = loadStore();
  const today = todayStr();
  const logs = store.activityLogs.filter(a => a.petId === petId && a.startTime.startsWith(today));

  let totalWalkDistance = 0;
  let totalSleepMinutes = 0;
  let activeWalkId: string | null = null;
  let activeSleepId: string | null = null;
  const now = Date.now();

  for (const log of logs) {
    if (log.type === "WALK") {
      totalWalkDistance += log.distance || 0;
      if (!log.endTime) activeWalkId = log.id;
    }
    if (log.type === "SLEEP") {
      if (log.endTime) {
        totalSleepMinutes += (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 60000;
      } else {
        activeSleepId = log.id;
        totalSleepMinutes += (now - new Date(log.startTime).getTime()) / 60000;
      }
    }
  }

  return {
    walkDistance: Number(totalWalkDistance.toFixed(2)),
    sleepHours: Math.floor(totalSleepMinutes / 60),
    sleepMinutes: Math.floor(totalSleepMinutes % 60),
    activeWalkId,
    activeSleepId,
  };
}

export function startActivity(petId: string, type: "WALK" | "SLEEP"): ActivityLog {
  const store = loadStore();
  const log: ActivityLog = {
    id: uuid(),
    petId,
    type,
    startTime: nowISO(),
  };
  store.activityLogs.push(log);
  saveStore(store);
  return log;
}

export function stopActivity(petId: string, type: "WALK" | "SLEEP"): ActivityLog | null {
  const store = loadStore();
  const log = store.activityLogs.find(a => a.petId === petId && a.type === type && !a.endTime);
  if (!log) return null;

  const now = new Date();
  log.endTime = now.toISOString();

  if (type === "WALK") {
    const hours = (now.getTime() - new Date(log.startTime).getTime()) / (1000 * 60 * 60);
    log.distance = Number((hours * 4.0).toFixed(2)); // 4km/h 평균
  }

  saveStore(store);
  return log;
}

// ======= 스트릭 =======

export function getStreaks(petId: string): { currentStreak: number; bestStreak: number; totalWalks: number } {
  const store = loadStore();
  const walks = store.activityLogs.filter(a => a.petId === petId && a.type === "WALK");

  const walkDates = [...new Set(walks.map(w => w.startTime.slice(0, 10)))].sort().reverse();

  let currentStreak = 0;
  const today = new Date();
  const checkDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (let i = 0; i < 365; i++) {
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
    if (walkDates.includes(dateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (i === 0) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    } else {
      break;
    }
  }

  let bestStreak = 0;
  let tempStreak = 0;
  const sorted = [...walkDates].sort();
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      tempStreak = diff === 1 ? tempStreak + 1 : 1;
    }
    bestStreak = Math.max(bestStreak, tempStreak);
  }

  return { currentStreak, bestStreak, totalWalks: walks.length };
}

// ======= 건강 기록 =======

export function addHealthRecord(record: Omit<HealthRecord, "id" | "createdAt">): HealthRecord {
  const store = loadStore();
  const hr: HealthRecord = {
    ...record,
    id: uuid(),
    createdAt: nowISO(),
  };
  store.healthRecords.unshift(hr); // 최신이 앞에
  saveStore(store);
  return hr;
}

export function getHealthRecords(): HealthRecord[] {
  return loadStore().healthRecords;
}

// ======= 설정 =======

export function getSettings(): PetStore["settings"] {
  return loadStore().settings;
}

export function updateSettings(updates: Partial<PetStore["settings"]>): void {
  const store = loadStore();
  store.settings = { ...store.settings, ...updates };
  saveStore(store);
}
