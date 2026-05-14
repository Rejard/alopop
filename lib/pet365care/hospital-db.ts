/**
 * 동물병원 IndexedDB 캐시
 * 
 * 서버의 hospitals.json을 다운로드 → IndexedDB에 저장 → 오프라인 검색
 */

const DB_NAME = "pet365care_hospitals";
const DB_VERSION = 1;
const STORE_NAME = "hospitals";
const META_KEY = "pet365care_hospitals_meta";

export interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string | null;
  lat: number;
  lng: number;
  openHours: string | null;
  specialties: string | null;
  isEmergency: boolean;
}

interface HospitalMeta {
  version: string;
  count: number;
  syncedAt: string;
}

// ======= IndexedDB 초기화 =======

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("isEmergency", "isEmergency", { unique: false });
      }
    };
  });
}

// ======= 메타 정보 =======

export function getMeta(): HospitalMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMeta(meta: HospitalMeta): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

// ======= 동기화 =======

export async function syncHospitals(
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    onProgress?.("서버에서 병원 데이터를 다운로드 중...");

    // 서버에서 JSON 다운로드
    const res = await fetch("/data/hospitals.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`다운로드 실패: ${res.status}`);

    const hospitals: Hospital[] = await res.json();
    onProgress?.(`${hospitals.length}개 병원 데이터 저장 중...`);

    // IndexedDB에 저장
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // 기존 데이터 삭제
    store.clear();

    // 새 데이터 삽입
    for (const h of hospitals) {
      store.put(h);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();

    // 메타 저장
    const meta: HospitalMeta = {
      version: new Date().toISOString().slice(0, 10),
      count: hospitals.length,
      syncedAt: new Date().toISOString(),
    };
    saveMeta(meta);

    onProgress?.(`✅ ${hospitals.length}개 병원 동기화 완료!`);
    return { success: true, count: hospitals.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    onProgress?.(`❌ 동기화 실패: ${msg}`);
    return { success: false, count: 0, error: msg };
  }
}

// ======= 검색 =======

// Haversine 거리 계산 (km)
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchHospitals(options: {
  query?: string;
  lat?: number;
  lng?: number;
  maxDistance?: number; // km
  emergencyOnly?: boolean;
}): Promise<(Hospital & { distance: number | null })[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  const all: Hospital[] = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();

  let results = all;

  // 이름 검색
  if (options.query) {
    const q = options.query.toLowerCase();
    results = results.filter(h => h.name.toLowerCase().includes(q) || h.address.toLowerCase().includes(q));
  }

  // 응급 필터
  if (options.emergencyOnly) {
    results = results.filter(h => h.isEmergency);
  }

  // 거리 계산 + 필터
  let withDistance: (Hospital & { distance: number | null })[];

  if (options.lat && options.lng) {
    withDistance = results.map(h => ({
      ...h,
      distance: Math.round(haversine(options.lat!, options.lng!, h.lat, h.lng) * 100) / 100,
    }));

    if (options.maxDistance && options.maxDistance < Infinity) {
      withDistance = withDistance.filter(h => h.distance !== null && h.distance <= options.maxDistance!);
    }

    withDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  } else {
    withDistance = results.map(h => ({ ...h, distance: null }));
    withDistance.sort((a, b) => a.name.localeCompare(b.name));
  }

  return withDistance;
}

// ======= 데이터 유무 확인 =======

export async function getHospitalCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const count: number = await new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return count;
  } catch {
    return 0;
  }
}
