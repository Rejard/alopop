"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePet365Auth } from "@/lib/pet365care/use-pet365-auth";
import { ArrowLeft, MapPin, Phone, Globe, Clock, AlertCircle, Search, Loader2, Navigation, Map, List, RefreshCw } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { searchHospitals, syncHospitals, getMeta, getHospitalCount, type Hospital } from "@/lib/pet365care/hospital-db";

type HospitalWithDist = Hospital & { distance: number | null };

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (cb: () => void) => void;
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (container: HTMLElement, options: Record<string, unknown>) => {
          setCenter: (latlng: unknown) => void;
          setLevel: (level: number) => void;
          relayout: () => void;
        };
        Marker: new (options: Record<string, unknown>) => {
          setMap: (map: unknown | null) => void;
        };
        InfoWindow: new (options: Record<string, unknown>) => {
          open: (map: unknown, marker: unknown) => void;
          close: () => void;
        };
        CustomOverlay: new (options: Record<string, unknown>) => {
          setMap: (map: unknown | null) => void;
        };
        event: {
          addListener: (target: unknown, type: string, handler: () => void) => void;
        };
      };
    };
  }
}

const DISTANCE_FILTERS = [
  { key: "all", label: "전체", km: Infinity },
  { key: "near", label: "1km", km: 1 },
  { key: "mid", label: "3km", km: 3 },
  { key: "far", label: "5km", km: 5 },
];

// 거리 필터 → 카카오맵 줌 레벨 매핑 (여유 있게)
const ZOOM_LEVELS: Record<string, number> = {
  near: 5,   // 1km 반경 → level 5 (~1.5km 표시)
  mid: 7,    // 3km 반경 → level 7 (~4km 표시)
  far: 8,    // 5km 반경 → level 8 (~8km 표시)
  all: 9,    // 전체 → level 9 (~20km 반경)
};

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

export default function HospitalsPage() {
  const { user } = usePet365Auth();
  const [hospitals, setHospitals] = useState<HospitalWithDist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [distanceFilter, setDistanceFilter] = useState("near");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [userLat, setUserLat] = useState(0);
  const [userLng, setUserLng] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<"loading" | "granted" | "denied">("loading");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [mapReady, setMapReady] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<HospitalWithDist | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [dbCount, setDbCount] = useState(0);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const markerRefs = useRef<{ setMap: (map: unknown | null) => void }[]>([]);
  const overlayRefs = useRef<{ setMap: (map: unknown | null) => void }[]>([]);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) {
      const timer = window.setTimeout(() => setGpsStatus("denied"), 0);
      return () => window.clearTimeout(timer);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setGpsStatus("granted"); },
      () => setGpsStatus("denied"),
      { timeout: 5000 }
    );
  }, []);

  // IndexedDB 데이터 확인
  useEffect(() => {
    getHospitalCount().then(setDbCount);
  }, []);

  // 검색
  const doSearch = useCallback(async () => {
    if (!user?.id) return;
    if (dbCount === 0) { setLoading(false); return; }
    setLoading(true);
    try {
      const maxKm = DISTANCE_FILTERS.find(f => f.key === distanceFilter)?.km || Infinity;
      const results = await searchHospitals({
        query: searchQuery || undefined,
        lat: userLat || undefined,
        lng: userLng || undefined,
        maxDistance: maxKm < Infinity ? maxKm : undefined,
        emergencyOnly,
      });
      setHospitals(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, dbCount, userLat, userLng, distanceFilter, emergencyOnly, searchQuery]);

  useEffect(() => {
    if (gpsStatus === "loading") return;
    const timer = window.setTimeout(doSearch, 0);
    return () => window.clearTimeout(timer);
  }, [gpsStatus, doSearch]);

  // 동기화
  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    const result = await syncHospitals((msg) => setSyncMsg(msg));
    if (result.success) {
      setDbCount(result.count);
      doSearch();
    }
    setSyncing(false);
  };

  // 카카오맵
  const clearMapObjects = useCallback(() => {
    markerRefs.current.forEach(marker => marker.setMap(null));
    overlayRefs.current.forEach(overlay => overlay.setMap(null));
    markerRefs.current = [];
    overlayRefs.current = [];
  }, []);

  const relayoutMap = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.kakao?.maps) return;

    requestAnimationFrame(() => {
      map.relayout();
      if (userLat && userLng) {
        map.setCenter(new window.kakao.maps.LatLng(userLat, userLng));
      }
    });
  }, [userLat, userLng]);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.kakao?.maps) return;
    window.kakao.maps.load(() => {
      clearMapObjects();
      const center = userLat && userLng
        ? new window.kakao.maps.LatLng(userLat, userLng)
        : new window.kakao.maps.LatLng(37.5000, 126.7700);
      const level = ZOOM_LEVELS[distanceFilter] || 7;
      const map = new window.kakao.maps.Map(mapContainerRef.current!, { center, level });
      mapInstanceRef.current = map;
      relayoutMap();

      hospitals.forEach(h => {
        const position = new window.kakao.maps.LatLng(h.lat, h.lng);
        const marker = new window.kakao.maps.Marker({ position, map });
        markerRefs.current.push(marker);
        const content = `
          <div style="padding:8px 12px;border-radius:12px;background:white;box-shadow:0 2px 12px rgba(0,0,0,0.15);font-family:'Plus Jakarta Sans',sans-serif;min-width:160px;border:1px solid #f0f0f0;">
            <p style="font-weight:800;font-size:13px;color:#1a1a1a;margin:0 0 4px;">${h.name}</p>
            <p style="font-size:11px;color:#888;margin:0 0 6px;">${h.address}</p>
            <div style="display:flex;gap:6px;align-items:center;">
              ${h.isEmergency ? '<span style="font-size:10px;font-weight:700;color:#ef4444;background:#fef2f2;padding:2px 8px;border-radius:99px;">24시 응급</span>' : ''}
              <a href="tel:${h.phone}" style="font-size:11px;font-weight:700;color:#9c48ea;text-decoration:none;">📞 ${h.phone}</a>
            </div>
          </div>
        `;
        const overlay = new window.kakao.maps.CustomOverlay({ content, position, yAnchor: 1.3 });
        overlayRefs.current.push(overlay);
        let isOverlayOpen = false;
        window.kakao.maps.event.addListener(marker, "click", () => {
          overlayRefs.current.forEach(item => item.setMap(null));
          isOverlayOpen = !isOverlayOpen;
          overlay.setMap(isOverlayOpen ? map : null);
          setSelectedHospital(h);
        });
      });

      if (userLat && userLng) {
        const myPos = new window.kakao.maps.LatLng(userLat, userLng);
        new window.kakao.maps.CustomOverlay({
          content: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.5);"></div>',
          position: myPos, yAnchor: 0.5,
        }).setMap(map);
      }
    });
  }, [clearMapObjects, hospitals, relayoutMap, userLat, userLng, distanceFilter]);

  useEffect(() => {
    if (viewMode !== "map" || !mapReady || loading) return;

    const timer = window.setTimeout(initMap, 100);
    return () => {
      window.clearTimeout(timer);
      clearMapObjects();
    };
  }, [viewMode, mapReady, loading, initMap, clearMapObjects]);

  useEffect(() => {
    if (viewMode !== "map") return;

    window.addEventListener("resize", relayoutMap);
    window.visualViewport?.addEventListener("resize", relayoutMap);

    return () => {
      window.removeEventListener("resize", relayoutMap);
      window.visualViewport?.removeEventListener("resize", relayoutMap);
    };
  }, [viewMode, relayoutMap]);

  const handleCall = (phone: string) => { window.location.href = `tel:${phone}`; };

  const meta = getMeta();

  return (
    <div className="pet365-page flex flex-col min-h-full pb-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {KAKAO_KEY && (
        <Script src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`} strategy="afterInteractive" onLoad={() => setMapReady(true)} />
      )}

      {/* Header */}
      <header className="pet365-topbar rounded-b-[28px] px-6 pt-6 pb-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Link href="/pet365care/profile" className="w-10 h-10 bg-white/70 rounded-full flex items-center justify-center text-gray-600"><ArrowLeft size={20} /></Link>
            <h1 className="text-gray-900 font-extrabold text-xl tracking-tight">동물 병원 찾기</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* 동기화 버튼 */}
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${
                syncing ? "bg-gray-200 text-gray-400" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              }`}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "동기화 중" : "동기화"}
            </button>
            {KAKAO_KEY && (
              <button onClick={() => setViewMode(viewMode === "list" ? "map" : "list")} className="w-10 h-10 bg-white/70 rounded-full flex items-center justify-center text-gray-600 hover:bg-white transition-colors">
                {viewMode === "list" ? <Map size={18} /> : <List size={18} />}
              </button>
            )}
          </div>
        </div>

        {/* 동기화 상태 */}
        {syncMsg && (
          <div className="bg-emerald-50 rounded-2xl p-3 mb-4 border border-emerald-100">
            <p className="text-xs font-medium text-emerald-700">{syncMsg}</p>
          </div>
        )}

        {/* DB 상태 */}
        {meta && (
          <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-gray-400">
            <span>🏥 {meta.count.toLocaleString()}개 병원</span>
            <span>•</span>
            <span>마지막 동기화: {new Date(meta.syncedAt).toLocaleDateString("ko-KR")}</span>
          </div>
        )}

        {dbCount === 0 && !syncing && (
          <div className="bg-[#efe7ff] rounded-2xl p-4 mb-4 border border-[#9c48ea]/10 text-center">
            <p className="text-sm font-bold text-[#9c48ea] mb-2">🏥 병원 데이터가 없습니다</p>
            <p className="text-xs text-gray-600 mb-3">&quot;동기화&quot; 버튼을 눌러 전국 동물병원 데이터를 받아주세요.</p>
            <button onClick={handleSync} className="bg-[#9c48ea] text-white px-4 py-2.5 rounded-2xl text-sm font-bold active:scale-95">
              <RefreshCw size={14} className="inline mr-1" /> 지금 동기화
            </button>
          </div>
        )}

        {/* Search */}
        {dbCount > 0 && (
          <>
            <div className="relative mb-4">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="병원 이름으로 검색"
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); }}
                className="w-full bg-gray-50 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#9c48ea]/20 transition-all border border-transparent focus:border-[#9c48ea]/20"
              />
            </div>
            <div className="flex items-center gap-2">
              {DISTANCE_FILTERS.map(f => (
                <button key={f.key} onClick={() => setDistanceFilter(f.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${distanceFilter === f.key ? "bg-[#9c48ea] text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {f.label}
                </button>
              ))}
              <div className="w-px h-6 bg-gray-200 mx-1"></div>
              <button onClick={() => setEmergencyOnly(!emergencyOnly)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${emergencyOnly ? "bg-red-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                <AlertCircle size={12} /> 응급
              </button>
            </div>
          </>
        )}
      </header>

      {/* Map View */}
      {viewMode === "map" && (
        <div className="px-4 mt-4" onTouchStart={() => { (document.activeElement as HTMLElement)?.blur(); }}>
          {/* Wrapper: 둥근 모서리 + overflow-hidden 분리 → 맵 타일 렌더링 충돌 방지 */}
          <div className="rounded-[24px] overflow-hidden shadow-md border border-gray-200 bg-gray-100">
            <div ref={mapContainerRef} className="w-full h-[clamp(360px,58dvh,620px)]" style={{ touchAction: 'pan-x pan-y' }} />
          </div>
          {selectedHospital && (
            <div className="pet365-card p-5 mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-[15px]">{selectedHospital.name}</h3>
                  {selectedHospital.isEmergency && <span className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded-full">24시 응급</span>}
                </div>
                {selectedHospital.distance !== null && <span className="text-sm font-black text-[#9c48ea]">{selectedHospital.distance}km</span>}
              </div>
              <p className="text-xs text-gray-500">{selectedHospital.address}</p>
              <button onClick={() => handleCall(selectedHospital.phone)} className="w-full flex items-center justify-center gap-2 py-3 pet365-primary-action font-bold text-sm rounded-2xl mt-1 active:scale-[0.98]">
                <Phone size={16} /> {selectedHospital.phone}
              </button>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && dbCount > 0 && (
        <main className="px-6 mt-5 flex flex-col gap-3" onTouchStart={() => { (document.activeElement as HTMLElement)?.blur(); }}>
          {gpsStatus === "denied" && (
            <div className="bg-[#e8fbf8] rounded-2xl p-3 flex items-center gap-2 border border-[#62fae3]/20">
              <Navigation size={14} className="text-[#0f766e] shrink-0" />
              <p className="text-xs font-medium text-[#0f766e]">위치 권한이 없어 거리 정보를 제공할 수 없습니다.</p>
            </div>
          )}
          {!loading && (
            <p className="text-xs font-bold text-gray-400 ml-1">
              {hospitals.length === 0 ? "검색 결과가 없습니다" : `${hospitals.length}개 병원`}
            </p>
          )}
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[#9c48ea]" size={28} /></div>
          ) : (
            hospitals.map(h => (
              <div key={h.id} className="pet365-card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 text-[15px]">{h.name}</h3>
                      {h.isEmergency && <span className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded-full">24시 응급</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      <MapPin size={12} className="shrink-0" />
                      <span className="line-clamp-1">{h.address}</span>
                    </div>
                  </div>
                  {h.distance !== null && (
                    <div className="bg-[#efe7ff] rounded-2xl px-3 py-1.5 text-center shrink-0 ml-3">
                      <p className="text-lg font-black text-[#9c48ea]">{h.distance}</p>
                      <p className="text-[9px] font-bold text-[#9c48ea]/70">km</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {h.openHours && <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full"><Clock size={10} /> {h.openHours}</span>}
                  {h.specialties?.split(",").map(s => <span key={s.trim()} className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">{s.trim()}</span>)}
                </div>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => handleCall(h.phone)} className="flex-1 flex items-center justify-center gap-2 py-3 pet365-primary-action font-bold text-sm rounded-2xl transition-colors active:scale-[0.98]">
                    <Phone size={16} /> 전화하기
                  </button>
                  {h.website && (
                    <a href={h.website} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 font-bold text-sm rounded-2xl hover:bg-gray-200 transition-colors">
                      <Globe size={16} /> 홈페이지
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </main>
      )}
    </div>
  );
}
