"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Script from "next/script";
import { Heart, MessageCircle, Send, X, Loader2, Trash2, Camera, MapPin, List, Map, Users, CalendarDays, Edit3 } from "lucide-react";
import { usePet365Auth } from "@/lib/pet365care/use-pet365-auth";

type Author = { id: string; username: string; avatar_url: string | null };
type StructuredMeetup = {
  type: string | null;
  local: {
    regionName: string | null;
    regionLat: number | null;
    regionLng: number | null;
    verifiedAt: string | null;
    topic: string | null;
    joinMode: string | null;
    radiusKm: number | null;
  } | null;
  mate: {
    startPlace: string | null;
    startTime: string | null;
    routeSummary: string | null;
    durationMinutes: number | null;
    capacity: number | null;
  } | null;
};
type Post = {
  id: string; content: string; images: string[]; category: string;
  meetup?: StructuredMeetup;
  likeCount: number; commentCount: number; isLiked: boolean; isMine: boolean;
  author: Author; createdAt: string;
};
type Comment = { id: string; content: string; isMine: boolean; author: Author; createdAt: string };
type LocalMeetup = {
  id: string;
  title: string;
  category: "local" | "mate";
  place: string;
  time: string;
  members: string;
  lat: number;
  lng: number;
};
type VerifiedRegion = {
  name: string;
  lat: number;
  lng: number;
  verifiedAt: string;
  expiresAt: string;
};
type MeetupSearchRadius = "all" | "1" | "3" | "5";
type VerifyLocalRegionOptions = { openMapAfter?: boolean };

type KakaoMapsWithServices = typeof window.kakao.maps & {
  services?: {
    Geocoder: new () => {
      coords2RegionCode: (
        lng: number,
        lat: number,
        callback: (result: Array<{ region_type?: string; region_2depth_name?: string; region_3depth_name?: string }>, status: string) => void
      ) => void;
    };
    Status?: { OK: string };
  };
};

const CATEGORIES = [
  { value: "all", label: "전체", emoji: "🔥" },
  { value: "daily", label: "일상", emoji: "📸" },
  { value: "walk", label: "산책", emoji: "🐕" },
  { value: "health", label: "건강", emoji: "💊" },
  { value: "funny", label: "웃김", emoji: "😂" },
  { value: "local", label: "지역모임", emoji: "📍" },
  { value: "mate", label: "산책 메이트", emoji: "🦮" },
];

const WRITE_CATEGORIES = CATEGORIES.filter(c =>
  c.value === "daily" || c.value === "walk" || c.value === "health" || c.value === "funny"
);

const FALLBACK_IMAGES: Record<string, string> = {
  daily: "/pet365care/social-fallbacks/daily.svg",
  walk: "/pet365care/social-fallbacks/walk.svg",
  health: "/pet365care/social-fallbacks/health.svg",
  funny: "/pet365care/social-fallbacks/funny.svg",
  local: "/pet365care/social-fallbacks/local.svg",
  mate: "/pet365care/social-fallbacks/mate.svg",
};

const LOCAL_MEETUP_SEEDS = [
  {
    id: "cityhall-local",
    title: "시청 덕수궁 반려인 모임",
    place: "서울광장 인근",
    time: "일요일 오후 2:00",
    members: "8/12명",
    lat: 37.5665,
    lng: 126.9780,
  },
  { id: "jamsil-local", title: "잠실 반려인 수다 모임", place: "석촌호수 서호", time: "금요일 오후 7:30", members: "11/20명", lat: 37.5112, lng: 127.0982 },
  { id: "yeonnam-local", title: "연남동 소형견 보호자 모임", place: "연남동 경의선숲길", time: "토요일 오후 3:00", members: "7/15명", lat: 37.5623, lng: 126.9256 },
  { id: "mapo-local", title: "마포 노령견 케어 정보방", place: "공덕역 인근", time: "수요일 오후 8:00", members: "15/25명", lat: 37.5444, lng: 126.9519 },
  { id: "gangnam-local", title: "강남 반려견 동네 친구들", place: "선릉역 인근", time: "목요일 오후 7:00", members: "13/22명", lat: 37.5045, lng: 127.0490 },
  { id: "seorae-local", title: "서래마을 반려묘 보호자 모임", place: "서래마을 카페거리", time: "일요일 오전 11:00", members: "6/12명", lat: 37.4983, lng: 126.9986 },
  { id: "eunpyeong-local", title: "은평구 산책 정보 공유방", place: "불광천 산책로", time: "화요일 오후 8:30", members: "18/30명", lat: 37.6003, lng: 126.9227 },
  { id: "nowon-local", title: "노원 대형견 보호자 모임", place: "중계근린공원", time: "토요일 오전 10:00", members: "9/18명", lat: 37.6490, lng: 127.0768 },
  { id: "dongdaemun-local", title: "동대문 반려인 동네 톡", place: "청량리역 인근", time: "월요일 오후 7:30", members: "10/20명", lat: 37.5802, lng: 127.0468 },
  { id: "guro-local", title: "구로 직장인 반려인 모임", place: "구로디지털단지역", time: "목요일 오후 8:00", members: "12/18명", lat: 37.4853, lng: 126.9015 },
  { id: "gwangjin-local", title: "광진구 초보 보호자 모임", place: "어린이대공원역", time: "일요일 오후 4:00", members: "14/24명", lat: 37.5480, lng: 127.0747 },
  { id: "hanam-local", title: "하남 미사 반려인 모임", place: "미사호수공원", time: "토요일 오후 5:00", members: "16/30명", lat: 37.5660, lng: 127.1905 },
  { id: "bundang-local", title: "분당 펫푸드 정보 모임", place: "정자동 카페거리", time: "수요일 오후 7:00", members: "19/28명", lat: 37.3706, lng: 127.1067 },
  { id: "pangyo-local", title: "판교 반려견 출퇴근러 모임", place: "판교역 광장", time: "금요일 오후 8:00", members: "8/16명", lat: 37.3947, lng: 127.1112 },
  { id: "suwon-local", title: "수원 광교 반려인 커뮤니티", place: "광교호수공원", time: "일요일 오후 3:30", members: "21/35명", lat: 37.2837, lng: 127.0657 },
  { id: "goyang-local", title: "고양 일산 펫케어 모임", place: "일산호수공원", time: "토요일 오후 2:00", members: "17/30명", lat: 37.6584, lng: 126.7698 },
  { id: "guri-local", title: "구리 장자호수 반려인 모임", place: "장자호수공원", time: "일요일 오전 10:30", members: "6/15명", lat: 37.5866, lng: 127.1402 },
  { id: "anyang-local", title: "안양 동안구 반려인 톡", place: "평촌중앙공원", time: "화요일 오후 8:00", members: "12/20명", lat: 37.3908, lng: 126.9612 },
  { id: "bucheon-local", title: "부천 상동 반려동물 모임", place: "상동호수공원", time: "목요일 오후 7:30", members: "20/32명", lat: 37.5054, lng: 126.7525 },
  { id: "siheung-local", title: "시흥 배곧 반려인 모임", place: "배곧생명공원", time: "토요일 오전 11:00", members: "9/18명", lat: 37.3693, lng: 126.7296 },
  { id: "yongin-local", title: "용인 수지 반려가족 모임", place: "수지구청역 인근", time: "일요일 오후 5:00", members: "13/25명", lat: 37.3224, lng: 127.0959 },
  { id: "uijeongbu-local", title: "의정부 반려견 정보 공유방", place: "부용천 산책로", time: "월요일 오후 8:00", members: "11/22명", lat: 37.7381, lng: 127.0457 },
  { id: "namyangju-local", title: "남양주 다산 반려인 모임", place: "다산중앙공원", time: "금요일 오후 7:00", members: "18/27명", lat: 37.6200, lng: 127.1541 },
  { id: "gimpo-local", title: "김포 한강신도시 반려인 모임", place: "라베니체 인근", time: "토요일 오후 4:00", members: "14/28명", lat: 37.6457, lng: 126.6684 },
  { id: "paju-local", title: "파주 운정 반려묘 집사 모임", place: "운정호수공원", time: "일요일 오후 1:00", members: "7/15명", lat: 37.7261, lng: 126.7596 },
  { id: "hwaseong-local", title: "동탄 반려견 생활정보 모임", place: "동탄호수공원", time: "수요일 오후 8:00", members: "22/40명", lat: 37.1723, lng: 127.1066 },
  { id: "uiwang-local", title: "의왕 백운호수 반려인 모임", place: "백운호수", time: "토요일 오후 2:30", members: "8/18명", lat: 37.3802, lng: 127.0008 },
  { id: "gunpo-local", title: "군포 산본 반려인 모임", place: "중앙공원", time: "목요일 오후 8:00", members: "12/24명", lat: 37.3580, lng: 126.9330 },
  { id: "osan-local", title: "오산 반려동물 동네방", place: "오산천 산책로", time: "일요일 오전 9:30", members: "10/20명", lat: 37.1498, lng: 127.0771 },
  { id: "icheon-local", title: "이천 반려인 주말 모임", place: "설봉공원", time: "토요일 오후 3:30", members: "6/15명", lat: 37.2794, lng: 127.4265 },
] as const;

const WALK_MATE_SEEDS = [
  { id: "mangwon-walk", title: "망원 한강공원 소형견 산책", place: "망원 한강공원", time: "토요일 오전 9:30", members: "6/10명", lat: 37.5559, lng: 126.8955 },
  { id: "banpo-walk", title: "반포 대형견 저녁 산책", place: "반포 한강공원", time: "오늘 오후 7:00", members: "4/8명", lat: 37.5106, lng: 126.9958 },
  { id: "seoulforest-walk", title: "서울숲 아침 산책 메이트", place: "서울숲 5번 출입구", time: "내일 오전 8:00", members: "3/6명", lat: 37.5443, lng: 127.0375 },
  { id: "namsan-walk", title: "남산 둘레길 천천히 걷기", place: "장충단공원", time: "토요일 오전 10:00", members: "5/8명", lat: 37.5582, lng: 127.0060 },
  { id: "olympic-walk", title: "올림픽공원 중형견 산책", place: "평화의문 앞", time: "일요일 오전 9:00", members: "7/12명", lat: 37.5206, lng: 127.1215 },
  { id: "worldcup-walk", title: "월드컵공원 노을 산책", place: "평화의공원", time: "금요일 오후 6:30", members: "4/10명", lat: 37.5638, lng: 126.8946 },
  { id: "yangjae-walk", title: "양재천 퇴근 산책", place: "영동2교", time: "화요일 오후 8:00", members: "5/9명", lat: 37.4847, lng: 127.0358 },
  { id: "boramae-walk", title: "보라매공원 초보견 산책", place: "보라매공원 정문", time: "토요일 오후 4:00", members: "6/10명", lat: 37.4929, lng: 126.9195 },
  { id: "cheonggye-walk", title: "청계천 짧은 밤산책", place: "청계광장", time: "오늘 오후 8:30", members: "3/7명", lat: 37.5690, lng: 126.9787 },
  { id: "bukseoul-walk", title: "북서울꿈의숲 산책", place: "방문자센터 앞", time: "일요일 오전 11:00", members: "8/12명", lat: 37.6216, lng: 127.0413 },
  { id: "gwanggyo-walk", title: "광교호수공원 한 바퀴", place: "광교호수공원 원천호수", time: "토요일 오전 9:00", members: "6/12명", lat: 37.2837, lng: 127.0657 },
  { id: "bundang-walk", title: "탄천 산책 메이트", place: "정자교 아래", time: "수요일 오후 7:30", members: "4/8명", lat: 37.3713, lng: 127.1086 },
  { id: "pangyo-walk", title: "판교 퇴근 후 산책", place: "화랑공원", time: "목요일 오후 8:00", members: "5/10명", lat: 37.3967, lng: 127.1124 },
  { id: "ilsan-walk", title: "일산호수공원 느린 산책", place: "노래하는분수대", time: "일요일 오후 4:30", members: "7/14명", lat: 37.6584, lng: 126.7698 },
  { id: "misa-walk", title: "미사호수공원 저녁 산책", place: "미사호수공원 남문", time: "금요일 오후 7:30", members: "6/12명", lat: 37.5660, lng: 127.1905 },
  { id: "pyeongchon-walk", title: "평촌중앙공원 산책", place: "평촌중앙공원 분수대", time: "토요일 오후 5:00", members: "5/9명", lat: 37.3908, lng: 126.9612 },
  { id: "sangdong-walk", title: "상동호수공원 소형견 산책", place: "상동호수공원", time: "일요일 오전 10:00", members: "4/8명", lat: 37.5054, lng: 126.7525 },
  { id: "suwoncheon-walk", title: "수원천 산책 메이트", place: "화홍문", time: "목요일 오후 7:00", members: "6/10명", lat: 37.2871, lng: 127.0173 },
  { id: "guri-walk", title: "장자호수공원 산책", place: "장자호수공원 광장", time: "토요일 오후 3:00", members: "3/8명", lat: 37.5866, lng: 127.1402 },
  { id: "dasan-walk", title: "다산중앙공원 아침 산책", place: "다산중앙공원", time: "일요일 오전 8:30", members: "5/10명", lat: 37.6200, lng: 127.1541 },
  { id: "gimpo-walk", title: "라베니체 강변 산책", place: "라베니체 수변길", time: "금요일 오후 8:00", members: "6/12명", lat: 37.6457, lng: 126.6684 },
  { id: "paju-walk", title: "운정호수공원 산책", place: "운정호수공원", time: "토요일 오전 10:30", members: "7/14명", lat: 37.7261, lng: 126.7596 },
  { id: "dongtan-walk", title: "동탄호수공원 야간 산책", place: "동탄호수공원", time: "오늘 오후 8:00", members: "8/16명", lat: 37.1723, lng: 127.1066 },
  { id: "uiwang-walk", title: "백운호수 산책 메이트", place: "백운호수 제방길", time: "일요일 오후 3:00", members: "4/9명", lat: 37.3802, lng: 127.0008 },
  { id: "sanbon-walk", title: "산본 중앙공원 산책", place: "산본 중앙공원", time: "화요일 오후 7:30", members: "5/10명", lat: 37.3580, lng: 126.9330 },
  { id: "osan-walk", title: "오산천 아침 산책", place: "오산천 산책로", time: "토요일 오전 8:00", members: "3/7명", lat: 37.1498, lng: 127.0771 },
  { id: "uijeongbu-walk", title: "부용천 산책 메이트", place: "부용천 산책로", time: "목요일 오후 7:30", members: "6/11명", lat: 37.7381, lng: 127.0457 },
  { id: "baeghyeon-walk", title: "백현동 카페거리 산책", place: "백현동 카페거리", time: "금요일 오후 6:30", members: "4/8명", lat: 37.3850, lng: 127.1135 },
  { id: "hanam-deokpung-walk", title: "덕풍천 산책 메이트", place: "덕풍천 산책로", time: "일요일 오전 9:30", members: "5/10명", lat: 37.5390, lng: 127.2054 },
  { id: "siheung-walk", title: "배곧생명공원 산책", place: "배곧생명공원", time: "토요일 오후 6:00", members: "6/12명", lat: 37.3693, lng: 126.7296 },
] as const;

const LOCAL_MEETUPS: LocalMeetup[] = [
  ...LOCAL_MEETUP_SEEDS.map(meetup => ({ ...meetup, category: "local" as const })),
  ...WALK_MATE_SEEDS.map(meetup => ({ ...meetup, category: "mate" as const })),
];

const MEETUP_RADIUS_OPTIONS: { value: MeetupSearchRadius; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "1", label: "1km" },
  { value: "3", label: "3km" },
  { value: "5", label: "5km" },
];

const MEETUP_MAP_LEVEL_BY_RADIUS: Record<MeetupSearchRadius, number> = {
  all: 10,
  "1": 5,
  "3": 6,
  "5": 7,
};

const DEFAULT_MEETUP_SEARCH_LOCATION = { lat: 37.5665, lng: 126.9780 };

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
const PET365_VERIFIED_REGION_KEY = "pet365care_verified_region";
const REGION_VERIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getStoredVerifiedRegion() {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(PET365_VERIFIED_REGION_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as VerifiedRegion;
    if (new Date(parsed.expiresAt).getTime() > Date.now()) return parsed;
    window.localStorage.removeItem(PET365_VERIFIED_REGION_KEY);
  } catch {
    window.localStorage.removeItem(PET365_VERIFIED_REGION_KEY);
  }
  return null;
}

function getDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const earthRadiusKm = 6371;
  const latDelta = (to.lat - from.lat) * Math.PI / 180;
  const lngDelta = (to.lng - from.lng) * Math.PI / 180;
  const fromLat = from.lat * Math.PI / 180;
  const toLat = to.lat * Math.PI / 180;
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(date).toLocaleDateString("ko-KR");
}

export default function SocialPage() {
  const { user } = usePet365Auth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [hotPost, setHotPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // 글쓰기
  const [showWrite, setShowWrite] = useState(false);
  const [writeContent, setWriteContent] = useState("");
  const [writeCategory, setWriteCategory] = useState("daily");
  const [writeImages, setWriteImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [localTopic, setLocalTopic] = useState("동네 정보 공유");
  const [localJoinMode, setLocalJoinMode] = useState("채팅형");
  const [localRadiusKm, setLocalRadiusKm] = useState("3");
  const [mateStartPlace, setMateStartPlace] = useState("");
  const [mateStartTime, setMateStartTime] = useState("");
  const [mateRouteSummary, setMateRouteSummary] = useState("");
  const [mateDurationMinutes, setMateDurationMinutes] = useState("40");
  const [mateCapacity, setMateCapacity] = useState("6");

  // 지역 모임
  const [showLocalMeetups, setShowLocalMeetups] = useState(false);
  const [activeMeetupType, setActiveMeetupType] = useState<"local" | "mate">("local");
  const [localViewMode, setLocalViewMode] = useState<"list" | "map">("list");
  const [meetupSearchRadiusKm, setMeetupSearchRadiusKm] = useState<MeetupSearchRadius>("1");
  const [mapReady, setMapReady] = useState(false);
  const [verifiedRegion, setVerifiedRegion] = useState<VerifiedRegion | null>(() => getStoredVerifiedRegion());
  const [verifyingRegion, setVerifyingRegion] = useState(false);
  const [viewerLocation, setViewerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown | null>(null);
  const markerRefs = useRef<{ setMap: (map: unknown | null) => void }[]>([]);
  const overlayRefs = useRef<{ setMap: (map: unknown | null) => void }[]>([]);

  // 상세/댓글
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editingSaving, setEditingSaving] = useState(false);

  // 이미지 뷰어
  const [viewImage, setViewImage] = useState<string | null>(null);

  const fetchPosts = useCallback(async (cat: string, cursor?: string | null) => {
    if (!cursor) setLoading(true);
    try {
      const params = new URLSearchParams({ category: cat, limit: "20" });
      if (cursor) params.set("cursor", cursor);
      const r = await fetch(`/api/pet365care/social/posts?${params}`);
      const d = await r.json();
      if (d.success) {
        if (cursor) {
          setPosts(prev => [...prev, ...d.data.posts]);
        } else {
          setPosts(d.data.posts);
        }
        setHasMore(d.data.hasMore);
        setNextCursor(d.data.nextCursor);
      }
    } catch { /* */ }
    setLoading(false);
  }, []);

  const fetchHotPost = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("sort", "hot");
      params.set("limit", "1");
      const r = await fetch(`/api/pet365care/social/posts?${params}`);
      const d = await r.json();
      if (d.success) setHotPost(d.data.posts[0] || null);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    if (user) {
      const timeoutId = window.setTimeout(() => {
        void fetchPosts(category);
        void fetchHotPost();
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [user, category, fetchPosts, fetchHotPost]);

  const handleLike = async (postId: string) => {
    const r = await fetch("/api/pet365care/social/like", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    const d = await r.json();
    if (d.success) {
      const update = (p: Post) => p.id === postId ? { ...p, isLiked: d.data.liked, likeCount: p.likeCount + (d.data.liked ? 1 : -1) } : p;
      setPosts(prev => prev.map(update));
      if (detailPost?.id === postId) setDetailPost(prev => prev ? update(prev) : null);
      if (hotPost?.id === postId) setHotPost(prev => prev ? update(prev) : null);
    }
  };

  const handleUploadImages = async (files: FileList) => {
    if (writeImages.length + files.length > 4) { alert("최대 4장까지 가능합니다"); return; }
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append("files", f));
    try {
      const r = await fetch("/api/pet365care/social/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d.success) setWriteImages(prev => [...prev, ...d.data.urls]);
      else alert(d.error);
    } catch { alert("업로드 실패"); }
    setUploading(false);
  };

  const buildPostContent = () => {
    const body = writeContent.trim();
    if (writeCategory === "local") {
      return [
        `[지역 모임] ${localTopic}`,
        `동네 인증: ${verifiedRegion?.name || "미인증"}`,
        `모임 방식: ${localJoinMode}`,
        `동네 반경: ${localRadiusKm}km`,
        "",
        body,
      ].join("\n");
    }
    if (writeCategory === "mate") {
      return [
        "[산책 메이트]",
        `출발 장소: ${mateStartPlace.trim()}`,
        `출발 시간: ${mateStartTime}`,
        `산책 코스: ${mateRouteSummary.trim()}`,
        `예상 시간: ${mateDurationMinutes}분`,
        `모집 인원: ${mateCapacity}명`,
        "",
        body,
      ].join("\n");
    }
    return body;
  };

  const isPostDisabled =
    posting ||
    !writeContent.trim() ||
    (writeCategory === "local" && !verifiedRegion) ||
    (writeCategory === "mate" && (!mateStartPlace.trim() || !mateStartTime || !mateRouteSummary.trim()));
  const showWriteCategoryChips = writeCategory !== "local" && writeCategory !== "mate";

  const buildMeetupPayload = () => {
    if (writeCategory === "local" && verifiedRegion) {
      return {
        local: {
          region: verifiedRegion,
          topic: localTopic,
          joinMode: localJoinMode,
          radiusKm: localRadiusKm,
        },
      };
    }
    if (writeCategory === "mate") {
      return {
        mate: {
          startPlace: mateStartPlace.trim(),
          startTime: mateStartTime,
          routeSummary: mateRouteSummary.trim(),
          durationMinutes: mateDurationMinutes,
          capacity: mateCapacity,
        },
      };
    }
    return undefined;
  };

  const handlePost = async () => {
    if (isPostDisabled) return;
    const content = buildPostContent();
    const meetup = buildMeetupPayload();
    setPosting(true);
    try {
      const r = await fetch("/api/pet365care/social/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, images: writeImages, category: writeCategory, meetup }),
      });
      const d = await r.json();
      if (d.success) {
        setPosts(prev => [d.data, ...prev]);
        setHotPost(prev => prev || d.data);
        setShowWrite(false); setWriteContent(""); setWriteImages([]); setWriteCategory("daily");
        setMateStartPlace(""); setMateStartTime(""); setMateRouteSummary(""); setMateDurationMinutes("40"); setMateCapacity("6");
      }
    } catch { /* */ }
    setPosting(false);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const r = await fetch(`/api/pet365care/social/posts?id=${postId}`, { method: "DELETE" });
    const d = await r.json();
    if (d.success) {
      setPosts(prev => prev.filter(p => p.id !== postId));
      if (hotPost?.id === postId) setHotPost(null);
      setDetailPost(null);
    }
  };

  const startEditPost = (post: Post) => {
    setDetailPost(null);
    setEditingPost(post);
    setEditContent(post.content);
  };

  const handleEditPost = async () => {
    if (!editingPost || !editContent.trim()) return;
    setEditingSaving(true);
    try {
      const r = await fetch("/api/pet365care/social/posts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingPost.id, content: editContent }),
      });
      const d = await r.json();
      if (d.success) {
        const updated = (p: Post) => p.id === editingPost.id ? { ...p, content: d.data.content, createdAt: d.data.createdAt || p.createdAt } : p;
        setPosts(prev => prev.map(updated));
        setHotPost(prev => prev?.id === editingPost.id ? updated(prev) : prev);
        setDetailPost(prev => prev?.id === editingPost.id ? updated(prev) : prev);
        setEditingPost(null);
        setEditContent("");
      } else {
        alert(d.error || "수정에 실패했습니다");
      }
    } catch {
      alert("수정에 실패했습니다");
    }
    setEditingSaving(false);
  };

  const openComposer = (nextCategory: string, seed = "") => {
    setDetailPost(null);
    setEditingPost(null);
    setWriteCategory(nextCategory);
    setWriteContent(seed);
    if (nextCategory !== "mate") {
      setMateStartPlace(""); setMateStartTime(""); setMateRouteSummary(""); setMateDurationMinutes("40"); setMateCapacity("6");
    }
    setShowWrite(true);
  };

  const verifyLocalRegion = ({ openMapAfter = false }: VerifyLocalRegionOptions = {}) => {
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 위치 인증을 사용할 수 없습니다.");
      return;
    }
    setVerifyingRegion(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const saveRegion = (name: string) => {
          const region: VerifiedRegion = {
            name,
            lat: Math.round(lat * 1000) / 1000,
            lng: Math.round(lng * 1000) / 1000,
            verifiedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + REGION_VERIFICATION_TTL_MS).toISOString(),
          };
          setVerifiedRegion(region);
          setViewerLocation({ lat: region.lat, lng: region.lng });
          window.localStorage.setItem(PET365_VERIFIED_REGION_KEY, JSON.stringify(region));
          setVerifyingRegion(false);
          if (openMapAfter) setLocalViewMode("map");
        };

        const maps = window.kakao?.maps as KakaoMapsWithServices | undefined;
        const geocoderFactory = maps?.services?.Geocoder;
        if (!geocoderFactory) {
          saveRegion("현재 위치 인증 완료");
          return;
        }

        window.kakao.maps.load(() => {
          const geocoder = new geocoderFactory();
          geocoder.coords2RegionCode(lng, lat, (result, status) => {
            const okStatus = maps?.services?.Status?.OK || "OK";
            if (status !== okStatus || result.length === 0) {
              saveRegion("현재 위치 인증 완료");
              return;
            }
            const region = result.find(item => item.region_type === "H") || result[0];
            const regionName = [region.region_2depth_name, region.region_3depth_name].filter(Boolean).join(" ");
            saveRegion(regionName || "현재 위치 인증 완료");
          });
        });
      },
      () => {
        setVerifyingRegion(false);
        alert("위치 인증을 설정해주세요. 지도는 내 위치 인증 후 열 수 있어요.");
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const openLocalMeetups = () => {
    setActiveMeetupType("local");
    setCategory("local");
    setNextCursor(null);
    setShowLocalMeetups(true);
  };

  const openWalkMateMeetups = () => {
    setActiveMeetupType("mate");
    setCategory("mate");
    setNextCursor(null);
    setShowLocalMeetups(true);
  };

  const openMeetupMap = () => {
    verifyLocalRegion({ openMapAfter: true });
  };

  const selectedMeetups = useMemo(
    () => {
      const meetupSearchLocation = viewerLocation || verifiedRegion || DEFAULT_MEETUP_SEARCH_LOCATION;
      return LOCAL_MEETUPS
        .filter(meetup => meetup.category === activeMeetupType)
        .map(meetup => ({ ...meetup, distanceKm: getDistanceKm(meetup, meetupSearchLocation) }))
        .filter(meetup => meetupSearchRadiusKm === "all" || meetup.distanceKm <= Number(meetupSearchRadiusKm))
        .sort((a, b) => a.distanceKm - b.distanceKm);
    },
    [activeMeetupType, meetupSearchRadiusKm, verifiedRegion, viewerLocation]
  );

  useEffect(() => {
    if (!showLocalMeetups || viewerLocation || verifiedRegion || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setViewerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, [showLocalMeetups, verifiedRegion, viewerLocation]);

  const clearLocalMapObjects = useCallback(() => {
    markerRefs.current.forEach(marker => marker.setMap(null));
    overlayRefs.current.forEach(overlay => overlay.setMap(null));
    markerRefs.current = [];
    overlayRefs.current = [];
  }, []);

  const initLocalMeetupMap = useCallback(() => {
    if (!showLocalMeetups || localViewMode !== "map" || !mapContainerRef.current || !window.kakao?.maps) return;

    window.kakao.maps.load(() => {
      clearLocalMapObjects();
      const mapCenter = verifiedRegion || viewerLocation || DEFAULT_MEETUP_SEARCH_LOCATION;
      const center = new window.kakao.maps.LatLng(mapCenter.lat, mapCenter.lng);
      const mapLevel = MEETUP_MAP_LEVEL_BY_RADIUS[meetupSearchRadiusKm];
      const map = new window.kakao.maps.Map(mapContainerRef.current!, { center, level: mapLevel });
      mapInstanceRef.current = map;

      const myLocationOverlay = new window.kakao.maps.CustomOverlay({
        position: center,
        yAnchor: 0.5,
        content: `
          <div style="display:flex;align-items:center;gap:6px;transform:translate(-50%,-50%);font-family:'Plus Jakarta Sans',sans-serif;">
            <span style="width:18px;height:18px;border-radius:999px;background:#2563eb;border:3px solid white;box-shadow:0 0 0 5px rgba(37,99,235,0.22),0 8px 18px rgba(37,99,235,0.35);display:block;"></span>
            <span style="background:#2563eb;color:white;font-size:11px;font-weight:900;border-radius:999px;padding:5px 9px;box-shadow:0 8px 18px rgba(37,99,235,0.24);white-space:nowrap;">내 위치</span>
          </div>
        `,
      });
      myLocationOverlay.setMap(map);
      overlayRefs.current.push(myLocationOverlay);

      selectedMeetups.forEach(meetup => {
        const position = new window.kakao.maps.LatLng(meetup.lat, meetup.lng);
        const marker = new window.kakao.maps.Marker({ position, map });
        markerRefs.current.push(marker);

        const content = `
          <div style="padding:10px 12px;border-radius:14px;background:white;box-shadow:0 8px 22px rgba(0,0,0,0.18);font-family:'Plus Jakarta Sans',sans-serif;min-width:170px;border:1px solid #f0f0f0;">
            <p style="font-weight:900;font-size:13px;color:#171321;margin:0 0 5px;">${meetup.title}</p>
            <p style="font-size:11px;color:#6b7280;margin:0 0 6px;">${meetup.place} · ${meetup.time}</p>
            <span style="font-size:10px;font-weight:800;color:#09070d;background:#62fae3;padding:3px 8px;border-radius:99px;">${meetup.members}</span>
          </div>
        `;
        const overlay = new window.kakao.maps.CustomOverlay({ content, position, yAnchor: 1.35 });
        overlayRefs.current.push(overlay);

        window.kakao.maps.event.addListener(marker, "click", () => {
          overlayRefs.current.forEach(item => item.setMap(null));
          overlay.setMap(map);
        });
      });
    });
  }, [clearLocalMapObjects, localViewMode, meetupSearchRadiusKm, selectedMeetups, showLocalMeetups, verifiedRegion, viewerLocation]);

  useEffect(() => {
    if (!mapReady || localViewMode !== "map" || !showLocalMeetups) return;
    const timer = window.setTimeout(initLocalMeetupMap, 80);
    return () => {
      window.clearTimeout(timer);
      clearLocalMapObjects();
    };
  }, [clearLocalMapObjects, initLocalMeetupMap, localViewMode, mapReady, showLocalMeetups]);

  const openDetail = async (post: Post) => {
    setShowWrite(false);
    setEditingPost(null);
    setDetailPost(post); setLoadingComments(true);
    const r = await fetch(`/api/pet365care/social/comments?postId=${post.id}`);
    const d = await r.json();
    if (d.success) setComments(d.data);
    setLoadingComments(false);
  };

  const handleComment = async () => {
    if (!commentText.trim() || !detailPost) return;
    setSendingComment(true);
    const r = await fetch("/api/pet365care/social/comments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: detailPost.id, content: commentText }),
    });
    const d = await r.json();
    if (d.success) {
      setComments(prev => [...prev, d.data]);
      setCommentText("");
      const update = (p: Post) => p.id === detailPost.id ? { ...p, commentCount: p.commentCount + 1 } : p;
      setPosts(prev => prev.map(update));
      setDetailPost(prev => prev ? update(prev) : null);
    }
    setSendingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const r = await fetch(`/api/pet365care/social/comments?id=${commentId}`, { method: "DELETE" });
    const d = await r.json();
    if (d.success && detailPost) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      const update = (p: Post) => p.id === detailPost.id ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p;
      setPosts(prev => prev.map(update));
      setDetailPost(prev => prev ? update(prev) : null);
    }
  };

  const getAvatar = (author: Author) => {
    if (author.avatar_url) return <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />;
    return <span className="text-sm font-bold text-white">{author.username[0]}</span>;
  };

  const getCategoryMeta = (value: string) => CATEGORIES.find(c => c.value === value) || CATEGORIES[1];
  const getHeroImage = (post: Post | null) => {
    if (post?.images?.[0]) return post.images[0];
    return FALLBACK_IMAGES[post?.category || "walk"] || FALLBACK_IMAGES.daily;
  };
  const heroMeta = getCategoryMeta(hotPost?.category || "walk");

  return (
    <div className="pet365-page flex flex-col min-h-full pb-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {KAKAO_KEY && (
        <Script src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=services`} strategy="afterInteractive" onLoad={() => setMapReady(true)} />
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
            <span className="text-xl">🐱</span>
          </div>
          <h1 className="text-[#9c48ea] font-extrabold text-xl tracking-tight">Pet365Care</h1>
        </div>
      </header>

      {!showWrite && !editingPost && !detailPost && !viewImage && (
      <main className="px-5 flex flex-col gap-6">
        {/* Hero Card — 통합 인기 콘텐츠 */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 px-1">
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">오늘의 핫한 이야기</h2>
            <p className="text-sm font-semibold text-[#9c48ea]">지금 가장 반응이 뜨거운 소셜 글이에요 🔥</p>
          </div>
          <button
            type="button"
            onClick={() => hotPost && openDetail(hotPost)}
            className="h-52 rounded-[28px] overflow-hidden relative pet365-gradient-hero text-left active:scale-[0.99] transition-transform"
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url("${getHeroImage(hotPost)}")` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-1.5">
              <div className="flex gap-2 mb-0.5">
                <span className="bg-[#62fae3] text-[#09070d] text-[10px] font-black px-2.5 py-0.5 rounded-full tracking-wider">HOT</span>
                <span className="bg-white/30 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                  {heroMeta.emoji} {heroMeta.label}
                </span>
              </div>
              <h3 className="text-white text-lg font-bold leading-tight line-clamp-2">
                {hotPost ? hotPost.content : "아직 인기 글을 기다리고 있어요"}
              </h3>
              <p className="text-white/80 text-xs font-medium">
                {hotPost ? `❤️ ${hotPost.likeCount} · 💬 ${hotPost.commentCount} · ${timeAgo(hotPost.createdAt)}` : "첫 소셜 글을 남겨보세요"}
              </p>
            </div>
          </button>
        </section>

        {/* Activity Categories */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-gray-900 px-1">어떤 활동을 찾으시나요?</h2>
          <button
            type="button"
            aria-label="Open daily share composer"
            onClick={() => openComposer("daily")}
            className="pet365-soft-panel rounded-[24px] p-4 flex items-center justify-between cursor-pointer transition-colors relative overflow-hidden h-24 text-left active:scale-[0.99]"
          >
            <div className="flex flex-col z-10 pl-1">
              <h3 className="text-base font-bold text-gray-900 mb-0.5">📸 일상 공유</h3>
              <p className="text-xs text-gray-600 font-medium">우리 아이의 귀여운 순간을<br/>자랑해보세요</p>
            </div>
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-[#9c48ea] mr-1 z-10">
              <Camera size={18} />
            </div>
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={openLocalMeetups}
              className="pet365-card-tight p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors h-28 active:scale-[0.99]"
            >
              <div className="w-10 h-10 bg-[#FFF3CD] rounded-full flex items-center justify-center text-lg mb-2">📍</div>
              <h3 className="text-sm font-bold text-gray-900">지역 모임</h3>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5">동네 친구 만들기</p>
            </button>
            <button
              type="button"
              onClick={openWalkMateMeetups}
              className="pet365-card-tight p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors h-28 active:scale-[0.99]"
            >
              <div className="w-10 h-10 bg-[#F2C99D]/40 rounded-full flex items-center justify-center text-lg mb-2">🐾</div>
              <h3 className="text-sm font-bold text-gray-900">산책 메이트</h3>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5">함께 걷는 즐거움</p>
            </button>
          </div>
        </section>

        {showLocalMeetups && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {activeMeetupType === "mate" ? "산책 메이트 목록" : "내 주변 지역 모임"}
                </h2>
                <p className="text-xs font-semibold text-gray-500">
                  {activeMeetupType === "mate" ? "정해진 장소와 시간에 만나 함께 출발해요." : "동네 반려인들과 넓게 이어지는 모임이에요."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => localViewMode === "list" ? openMeetupMap() : setLocalViewMode("list")}
                className="pet365-chip flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold active:scale-95"
              >
                {localViewMode === "list" ? <Map size={14} /> : <List size={14} />}
                {localViewMode === "list" ? "지도에서 보기" : "목록 보기"}
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar px-1">
              {MEETUP_RADIUS_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMeetupSearchRadiusKm(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-black whitespace-nowrap transition-all active:scale-95 ${
                    meetupSearchRadiusKm === option.value ? "pet365-chip-active" : "pet365-chip"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {localViewMode === "map" ? (
              <div className="pet365-card overflow-hidden">
                {KAKAO_KEY ? (
                  <div ref={mapContainerRef} className="h-72 w-full bg-white/10" />
                ) : (
                  <div className="h-72 w-full bg-white/10 p-5 flex flex-col justify-end">
                    <MapPin className="text-[#62fae3] mb-3" size={28} />
                    <p className="text-sm font-bold text-gray-900">카카오맵 키가 설정되면 모임 핀이 표시됩니다.</p>
                    <p className="text-xs text-gray-500 mt-1">지금은 모임 목록으로 먼저 둘러볼 수 있어요.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
                {selectedMeetups.length === 0 ? (
                  <div className="pet365-card-tight min-w-full p-5">
                    <p className="text-sm font-black text-gray-900">선택한 범위 안에 모임이 없어요</p>
                    <p className="text-xs font-semibold text-gray-500 mt-1">범위를 넓히거나 전체로 바꿔서 더 많은 모임을 볼 수 있어요.</p>
                  </div>
                ) : selectedMeetups.map(meetup => {
                  const meta = getCategoryMeta(meetup.category);
                  return (
                    <article key={meetup.id} className="pet365-card-tight min-w-[250px] p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="pet365-chip-active rounded-full px-2.5 py-1 text-[10px] font-black">{meta.emoji} {meta.label}</span>
                        <span className="text-[11px] font-bold text-gray-500">{meetup.distanceKm.toFixed(1)}km</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-gray-900 leading-snug">{meetup.title}</h3>
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-gray-500"><MapPin size={12} /> {meetup.place}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-gray-500"><CalendarDays size={12} /> {meetup.time}</p>
                        <p className="mt-1 text-xs font-bold text-gray-500">{meetup.members}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCategory(meetup.category);
                          setNextCursor(null);
                        }}
                        className="pet365-soft-panel mt-auto rounded-2xl px-3 py-2 text-xs font-black text-left active:scale-[0.99]"
                      >
                        관련 글 보기
                      </button>
                    </article>
                  );
                })}
              </div>
            )}

            {activeMeetupType === "local" ? (
              <button
                type="button"
                onClick={() => openComposer("local", "[지역 모임]\n장소:\n일시:\n모집 인원:\n\n")}
                className="pet365-primary-action rounded-[20px] px-4 py-3 text-left font-black text-sm active:scale-[0.99]"
              >
                <Users size={16} className="mb-1" /> 지역 모임 만들기
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openComposer("mate", "[산책 메이트]\n장소:\n시간:\n모집 인원:\n\n")}
                className="pet365-night-action rounded-[20px] px-4 py-3 text-left font-black text-sm active:scale-[0.99]"
              >
                <MapPin size={16} className="mb-1" /> 산책 메이트 모집
              </button>
            )}
          </section>
        )}

        {/* 커뮤니티 피드 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-gray-900 px-1">📝 커뮤니티</h2>
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => { setCategory(c.value); setNextCursor(null); }}
                className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                  category === c.value
                    ? "pet365-chip-active"
                    : "pet365-chip"
                }`}
              >
                <span>{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* Posts */}
        <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#9c48ea]" size={28} /></div>
        ) : posts.length === 0 ? (
          <div className="pet365-card p-8 flex flex-col items-center text-center">
            <span className="text-5xl mb-3">📝</span>
            <p className="text-sm text-gray-500 font-medium">아직 게시물이 없어요.<br/>첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          <>
            {posts.map(post => (
              <article key={post.id} className="pet365-card overflow-hidden">
                {/* Author */}
                <div className="flex items-center gap-3 p-4 pb-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9c48ea] to-[#62fae3] flex items-center justify-center overflow-hidden shadow-sm">
                    {getAvatar(post.author)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[13px] text-gray-900">{post.author.username}</p>
                    <p className="text-[11px] text-gray-400 font-medium">{timeAgo(post.createdAt)} · {CATEGORIES.find(c => c.value === post.category)?.label || post.category}</p>
                  </div>
                  {post.isMine && (
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); startEditPost(post); }} className="p-1.5 text-gray-300 hover:text-[#9c48ea] transition-colors">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="px-4 pb-3 cursor-pointer" onClick={() => openDetail(post)}>
                  <p className="text-[14px] text-gray-800 leading-relaxed line-clamp-3 whitespace-pre-wrap">{post.content}</p>
                </div>

                {/* Images */}
                {post.images.length > 0 && (
                  <div className={`grid gap-1 px-1 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {post.images.slice(0, 4).map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setViewImage(img)}
                        className={`relative cursor-pointer overflow-hidden ${
                          post.images.length === 1 ? "h-56 rounded-2xl mx-3" :
                          post.images.length === 3 && i === 0 ? "row-span-2 h-full rounded-l-2xl" : "h-28 last:rounded-br-2xl first:rounded-tl-2xl"
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        {i === 3 && post.images.length > 4 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg">+{post.images.length - 4}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-6 px-4 py-3">
                  <button onClick={() => handleLike(post.id)} className="flex items-center gap-1.5 group">
                    <Heart
                      size={18}
                      className={`transition-all group-active:scale-125 ${post.isLiked ? "fill-red-500 text-red-500" : "text-gray-400"}`}
                    />
                    <span className={`text-xs font-bold ${post.isLiked ? "text-red-500" : "text-gray-400"}`}>{post.likeCount || ""}</span>
                  </button>
                  <button onClick={() => openDetail(post)} className="flex items-center gap-1.5 text-gray-400">
                    <MessageCircle size={18} />
                    <span className="text-xs font-bold">{post.commentCount || ""}</span>
                  </button>
                </div>
              </article>
            ))}

            {hasMore && (
              <button
                onClick={() => fetchPosts(category, nextCursor)}
                className="py-3 text-sm font-bold text-[#9c48ea] text-center"
              >
                더 보기
              </button>
            )}
          </>
        )}
        </div>
      </main>
      )}

      {/* 글쓰기 모달 */}
      {showWrite && (
        <main className="pet365-compose-screen flex flex-1 min-h-0 flex-col px-5 pb-5">
          <div className="pet365-card flex min-h-0 flex-1 flex-col px-5 py-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-gray-900">새 글 작성</h2>
              <button onClick={() => setShowWrite(false)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Category chips */}
            {showWriteCategoryChips && (
              <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
                {WRITE_CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setWriteCategory(c.value)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      writeCategory === c.value ? "bg-[#9c48ea] text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>
            )}

            {writeCategory === "local" && (
              <div className="pet365-card-tight p-4 mb-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gray-900">지역 인증이 필요해요</p>
                    <p className="text-xs font-semibold text-gray-500 mt-1">
                      지역 모임은 인증된 동네 기준으로만 게시할 수 있어요.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => verifyLocalRegion()}
                    disabled={verifyingRegion}
                    className="pet365-primary-action shrink-0 rounded-2xl px-3 py-2 text-xs font-black disabled:opacity-50"
                  >
                    {verifyingRegion ? "인증 중" : "동네 인증"}
                  </button>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-gray-600">
                  {verifiedRegion ? `인증된 동네: ${verifiedRegion.name}` : "아직 인증된 동네가 없습니다"}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={localTopic} onChange={e => setLocalTopic(e.target.value)} className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-800 outline-none">
                    <option>동네 정보 공유</option>
                    <option>반려인 친목</option>
                    <option>병원/미용 추천</option>
                    <option>분실 제보</option>
                    <option>카페/장소 후기</option>
                  </select>
                  <select value={localJoinMode} onChange={e => setLocalJoinMode(e.target.value)} className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-800 outline-none">
                    <option>채팅형</option>
                    <option>오프라인 번개</option>
                    <option>정보 공유</option>
                  </select>
                </div>
                <label className="flex items-center justify-between gap-3 text-xs font-bold text-gray-500">
                  동네 반경
                  <select value={localRadiusKm} onChange={e => setLocalRadiusKm(e.target.value)} className="bg-gray-50 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 outline-none">
                    <option value="1">1km</option>
                    <option value="3">3km</option>
                    <option value="5">5km</option>
                  </select>
                </label>
              </div>
            )}

            {writeCategory === "mate" && (
              <div className="pet365-card-tight p-4 mb-4 flex flex-col gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">산책 메이트 약속</p>
                  <p className="text-xs font-semibold text-gray-500 mt-1">
                    정확한 출발 장소, 출발 시간, 코스를 정해야 모집할 수 있어요.
                  </p>
                </div>
                <input
                  value={mateStartPlace}
                  onChange={e => setMateStartPlace(e.target.value)}
                  placeholder="출발 장소"
                  className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-800 outline-none"
                />
                <input
                  type="datetime-local"
                  value={mateStartTime}
                  onChange={e => setMateStartTime(e.target.value)}
                  className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-800 outline-none"
                />
                <textarea
                  value={mateRouteSummary}
                  onChange={e => setMateRouteSummary(e.target.value)}
                  placeholder="산책 코스"
                  className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-800 outline-none resize-none min-h-20"
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold text-gray-500">
                    예상 시간
                    <input value={mateDurationMinutes} onChange={e => setMateDurationMinutes(e.target.value)} inputMode="numeric" className="mt-1 w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-800 outline-none" />
                  </label>
                  <label className="text-xs font-bold text-gray-500">
                    모집 인원
                    <input value={mateCapacity} onChange={e => setMateCapacity(e.target.value)} inputMode="numeric" className="mt-1 w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-800 outline-none" />
                  </label>
                </div>
              </div>
            )}

            <textarea
              value={writeContent}
              onChange={e => setWriteContent(e.target.value)}
              placeholder={
                writeCategory === "local"
                  ? "동네 반려인들과 나눌 이야기를 적어보세요"
                  : writeCategory === "mate"
                    ? "함께 걸을 보호자들에게 전할 안내를 적어보세요"
                    : "반려동물과의 일상을 공유해보세요 ✨"
              }
              className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-[14px] text-gray-800 font-medium outline-none resize-none min-h-[120px] focus:ring-2 focus:ring-[#9c48ea]/20 border border-transparent focus:border-[#9c48ea]/20"
              autoFocus
            />

            {/* Image preview */}
            {writeImages.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar">
                {writeImages.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setWriteImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || writeImages.length >= 4}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 rounded-xl text-xs font-bold text-gray-600 disabled:opacity-40"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  사진 {writeImages.length}/4
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && handleUploadImages(e.target.files)} />
              </div>

              <button
                onClick={handlePost}
                disabled={isPostDisabled}
                className="px-6 py-2.5 bg-gradient-to-r from-[#9c48ea] to-[#62fae3] text-[#09070d] rounded-2xl font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform"
              >
                {posting ? <Loader2 size={16} className="animate-spin" /> : writeCategory === "mate" ? "모집하기" : "게시하기"}
              </button>
            </div>
          </div>
        </main>
      )}

      {editingPost && (
        <main className="pet365-edit-screen flex flex-1 min-h-0 flex-col px-5 pb-5">
          <div className="pet365-card flex min-h-0 flex-1 flex-col gap-4 px-5 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-900">글 수정</h2>
              <button onClick={() => setEditingPost(null)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full flex-1 bg-gray-50 rounded-2xl px-4 py-3.5 text-[16px] text-gray-800 font-medium outline-none resize-none min-h-[50vh] focus:ring-2 focus:ring-[#9c48ea]/20 border border-transparent focus:border-[#9c48ea]/20"
              autoFocus
            />
            <button
              onClick={handleEditPost}
              disabled={editingSaving || !editContent.trim()}
              className="px-6 py-3 bg-gradient-to-r from-[#9c48ea] to-[#62fae3] text-[#09070d] rounded-2xl font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform"
            >
              {editingSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : "수정 저장"}
            </button>
          </div>
        </main>
      )}

      {/* 상세/댓글 모달 */}
      {detailPost && (
        <main className="pet365-detail-screen flex flex-1 min-h-0 flex-col px-5 pb-5">
          <div className="pet365-card flex min-h-0 flex-1 flex-col px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9c48ea] to-[#62fae3] flex items-center justify-center overflow-hidden">
                  {getAvatar(detailPost.author)}
                </div>
                <div>
                  <p className="font-bold text-[13px] text-gray-900">{detailPost.author.username}</p>
                  <p className="text-[11px] text-gray-400">{timeAgo(detailPost.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {detailPost.isMine && (
                  <button onClick={() => startEditPost(detailPost)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                    <Edit3 size={14} className="text-gray-500" />
                  </button>
                )}
                <button onClick={() => setDetailPost(null)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar mb-3">
              <p className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap mb-3">{detailPost.content}</p>

              {detailPost.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto mb-4 hide-scrollbar">
                  {detailPost.images.map((img, i) => (
                    <img key={i} src={img} alt="" onClick={() => setViewImage(img)} className="h-40 rounded-xl object-cover cursor-pointer flex-shrink-0" />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 mb-4 pb-3 border-b border-gray-100">
                <button onClick={() => handleLike(detailPost.id)} className="flex items-center gap-1.5">
                  <Heart size={18} className={detailPost.isLiked ? "fill-red-500 text-red-500" : "text-gray-400"} />
                  <span className={`text-xs font-bold ${detailPost.isLiked ? "text-red-500" : "text-gray-400"}`}>{detailPost.likeCount}</span>
                </button>
                <span className="text-xs font-bold text-gray-400">💬 {detailPost.commentCount}</span>
              </div>

              {/* Comments */}
              {loadingComments ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
              ) : comments.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">첫 번째 댓글을 남겨보세요!</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
                        {getAvatar(c.author)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-800">{c.author.username}</span>
                          <span className="text-[10px] text-gray-400">{timeAgo(c.createdAt)}</span>
                          {c.isMine && (
                            <button onClick={() => handleDeleteComment(c.id)} className="text-gray-300 hover:text-red-400 ml-auto">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                        <p className="text-[13px] text-gray-700 mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comment input */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100 shrink-0">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleComment()}
                placeholder="댓글을 입력하세요..."
                className="flex-1 bg-gray-50 rounded-full px-4 py-2.5 text-sm text-gray-800 outline-none font-medium"
              />
              <button
                onClick={handleComment}
                disabled={sendingComment || !commentText.trim()}
                className="w-9 h-9 bg-[#9c48ea] rounded-full flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform"
              >
                {sendingComment ? <Loader2 size={14} className="animate-spin text-white" /> : <Send size={14} className="text-white" />}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* 이미지 뷰어 */}
      {viewImage && (
        <main className="pet365-image-screen flex flex-1 min-h-0 flex-col px-5 pb-5">
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[28px] bg-black" onClick={() => setViewImage(null)}>
            <img src={viewImage} alt="" className="max-w-full max-h-full object-contain" />
            <button className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center" onClick={() => setViewImage(null)}>
              <X size={20} className="text-white" />
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
