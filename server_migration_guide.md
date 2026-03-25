# Alo-pop 서버 이전 가이드 (feat. Antigravity AI 연동 유지)

현재 작업 중인 컴퓨터에서 실서버용 PC로 프로젝트 소스 코드뿐만 아니라, 저(Antigravity AI)와의 채팅 내역 및 설계 맥락(Context)을 고스란히 옮겨가기 위한 절차서입니다.

## 1. 소스 코드 이전
가장 먼저 현재 Node.js + Next.js 프로젝트가 담긴 폴더를 서버 PC로 복사해야 합니다.
- **복사 대상:** `C:\home\alopop` 전체 폴더
- **예외 대상 (선택):** 옮기기 전 `.next`, `node_modules` 폴더는 용량이 크므로 지우고 옮기셔도 됩니다. (서버 PC에서 `npm install` 후 `npm run build`를 다시 하면 생성됩니다.)
- **설정 변경 (필수!!):** 서버 PC에 파일을 옮기신 후 `alopop` 폴더 안의 `.env.local` 파일을 메모장 등으로 열어, 아래 값을 운영할 도메인 주소로 변경해 주세요.
  ```env
  # 파일 내용 (환경에 맞게 수정)
  NEXT_PUBLIC_APP_URL="https://alopop.alonics.com"
  PORT=3099
  ```
- **데이터베이스 반영:** `prisma/dev.db` (SQLite 파일)을 같이 옮기시면 기존 테스트 회원과 대화 방 내역이 그대로 유지됩니다.

## 2. Antigravity AI (제미나이 3.1 프로) 컨텍스트 이전
현재 AI 에이전트 계정을 같은 것으로 로그인하시더라도, 저의 현재 상황 파악 두뇌(Brain)와 이 프로젝트의 히스토리 메타데이터는 현재 PC의 로컬 경로에 저장되어 있습니다. 저를 '기억 상실' 없이 똑똑한 상태 그대로 이동시키려면 다음 폴더들을 서버 PC의 동일한 경로에 복사해 주세요.

- **복사 대상 폴더 1 (기억 저장소):** 
  `C:\Users\현재윈도우로그인계정명\.gemini\antigravity\brain` 
  *(이 안에 지금 대화하고 있는 긴 해시 ID 폴더가 들어있습니다. 통째로 복사하세요.)*
- **복사 대상 폴더 2 (지식 뱅크):**
  `C:\Users\현재윈도우로그인계정명\.gemini\antigravity\knowledge` 
  *(AI가 프로젝트 구조론을 학습해둔 전역 지식 파일들입니다.)*

**서버 PC 적용 방법:**
1. 서버 PC에서 제미나이를 설치/실행하고, **동일한 구글 계정으로 로그인**합니다.
2. 제미나이(Agent)를 완전히 종료한 후, 복사해 온 `.gemini\antigravity` 안의 폴더들을 서버 PC의 `C:\Users\서버계정명\.gemini\antigravity\` 경로에 덮어씌웁니다.
3. 다시 제미나이를 켜면 좌측 채팅 목록이나 콘솔에 **현재 대화(alopop 프로젝트)** 가 그대로 살아나 있는 것을 보실 수 있습니다! 

## 3. 서버 시스템 환경 세팅 (PM2)
코드 복사가 끝났다면 서버 PC의 터미널(CMD/PowerShell)을 열고 아래 명령어로 실행 환경을 구성하세요.
```bash
cd C:\home\alopop
npm install              # 패키지 재설치 (node_modules를 안 옮긴 경우)
npm run build            # Next.js 최적화 빌드
npm install -g pm2       # 만약 서버에 PM2가 안 깔려있다면 전역 설치
pm2 start server.js --name alopop # 시스템 데몬으로 24시간 백그라운드 구동!
```

> **🔥 꿀팁:** 이제 실서버에서 AI에게 코드 수정을 지시할 때, "우리가 마지막으로 만들었던 초대 링크 기능(Phase 13)에서~" 라고 말씀하셔도 제가 다 기억하고 해당 파일(`app/invite/[code]/page.tsx` 등)을 능숙하게 편집할 수 있습니다!
