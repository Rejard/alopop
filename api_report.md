# 알로팝 프로젝트 API 리포트

본 리포트는 `c:\home\alopop\app\api` 디렉토리 내의 API 라우트들을 분석하여 요약한 내용입니다.

---

## 1. 관리자 및 시스템 API
*   **admin/agent/route.ts**: 에이전트 관리 (GET: 목록 조회, POST: 생성, PUT: 수정)
*   **admin/announcements/route.ts**: 공지사항 관리
*   **admin/chaos/route.ts**: 시스템 카오스 테스트/관리
*   **admin/events/route.ts**: 이벤트 관리
*   **admin/system/route.ts**: 시스템 설정 및 관리

## 2. 인증 및 사용자 API
*   **auth/google/route.ts**: 구글 OAuth 인증
*   **users/route.ts**: 사용자 목록 및 관리
*   **users/profile/route.ts**: 사용자 프로필 관리
*   **users/avatar/route.ts**: 사용자 아바타 관리
*   **users/keys/route.ts**: 사용자 키/인증 정보 관리
*   **users/ai/route.ts**: AI 사용자 관리
*   **users/ai/generate-avatar/route.ts**: AI 아바타 생성
*   **users/ai/[aiUserId]/route.ts**: 특정 AI 사용자 상세 관리

## 3. 채팅 및 친구 API
*   **chat/route.ts**: 채팅 메시지 처리
*   **chat/friend/route.ts**: 친구와의 채팅
*   **chat/sponsor/route.ts**: 스폰서 관련 채팅
*   **friends/route.ts**: 친구 목록 및 관계 관리
*   **friends/[friendId]/route.ts**: 특정 친구 상세 관리

## 4. 방(Room) 관리 API
*   **rooms/route.ts**: 채팅방 목록 및 관리
*   **rooms/delegate/route.ts**: 방 권한 위임
*   **rooms/invite/route.ts**: 방 초대
*   **rooms/kick/route.ts**: 방 강퇴
*   **rooms/leave/route.ts**: 방 나가기
*   **rooms/read/route.ts**: 메시지 읽음 처리
*   **rooms/sponsor/route.ts**: 스폰서 방 관리
*   **rooms/update/route.ts**: 방 정보 수정
*   **rooms/user/route.ts**: 방 내 사용자 관리

## 5. 기타 유틸리티 및 기능
*   **diagnostics/route.ts**: 시스템 진단
*   **models/route.ts**: 모델 정보 조회
*   **push/subscribe/route.ts**: 푸시 알림 구독
*   **push/vapidPublic/route.ts**: VAPID 공개 키 제공
*   **upload/route.ts**: 파일 업로드
*   **user/events/claim/route.ts**: 사용자 이벤트 보상 수령
*   **wallet/send/route.ts**: 지갑 전송 기능
