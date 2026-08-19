// OFFICE_STYLE, CHATTER, SIM_CHATTER, and SVGs for AI Studio Panel

export const OFFICE_STYLE = `
  @keyframes coffeeDrip {
    0% { transform: translateY(0); opacity: 0; }
    20% { opacity: 1; }
    80% { transform: translateY(8px); opacity: 1; }
    100% { transform: translateY(8px); opacity: 0; }
  }
  @keyframes steamRise {
    0% { transform: translateY(0) rotate(10deg); opacity: 0; scale: 1; }
    50% { opacity: 0.8; }
    100% { transform: translateY(-10px) rotate(10deg); opacity: 0; scale: 1.5; }
  }
  @keyframes neonTableGlow {
    0% { box-shadow: 0 8px 15px rgba(0,0,0,0.6); border-color: #581c87; }
    50% { box-shadow: 0 0 15px rgba(168,85,247,0.8); border-color: #a855f7; }
    100% { box-shadow: 0 8px 15px rgba(0,0,0,0.6); border-color: #581c87; }
  }
  .coffee-drip-flow-active {
    animation: coffeeDrip 1.5s infinite linear;
  }
  .coffee-cup-steam-active {
    animation: steamRise 2s infinite ease-out;
  }
  .meeting-table-neon-active {
    animation: neonTableGlow 2s infinite ease-in-out;
  }
`;

export const CHATTER: Record<string, string[]> = {
  Alice: ['구조 구상 중...', '기획서 작성...', '시나리오 고민...', '유저 플로우 짜는 중', '아, 이 기능은 뺄까?', '와이어프레임 뼈대 잡기', '일정 산출 중...', 'WBS 점검하기', '스프린트 백로그 정리', 'Jira 티켓 생성 중...', '이거 우선순위 낮출게요', '레퍼런스 찾는 중', '경쟁사 앱 확인 중', 'A/B 테스트 기획...', '사용성 테스트 일정 잡기', '개발팀에 물어봐야겠다', '디자인팀이랑 싱크 맞추기', '이거 스펙 픽스 맞죠?', '비즈니스 로직 정리', 'API 명세서 확인 중', '이 기능 꼭 들어가야 하나요?', '런칭 목표일 계산 중...', 'MVP 스펙 줄이기', '회의 자료 준비 중...'],
  Carol: ['디자인 픽싱 중...', '컬러 매칭...', 'UI 위치 조정...', '여긴 여백이 더 필요해', '이 폰트는 좀 깨지네...', '애니메이션 효과 생각 중', '로고 시안 작업...', '피그마 컴포넌트 묶기', '디자인 시스템 수정 중', '여기에 그라데이션 넣을까?', 'CSS 값 추출 중', '다크모드 컬러 잡기', '버튼 크기가 좀 작나?', '이 아이콘이 더 직관적이네', '벡터 이미지 따는 중', '개발 리소스 내보내기', '마진 몇으로 했더라?', '폰트 자간 조절...', '타이포그래피 테스트', '모바일 화면에서 어떨지 상상 중', '이 레이아웃 깔끔하네', '와이어프레임 바탕으로 시안 그리기', '핸드오프 준비', '이펙트는 은은하게...'],
  Bob: ['코드 작성 중...', '디버깅 진행...', '빌드 컴파일링...', '아, 오타 잡았다!', '왜 여기서 랜더링이 안 되지?', '스택오버플로우 검색 중...', '의존성 패키지 설치...', 'NPM 인스톨 중', '아 깃 충돌 났네 ㅠㅠ', '코드 포맷터 돌리는 중', '메모리 누수 잡는 중', 'Vite 빌드는 빠르네', '이거 레거시 코드 같은데...', '리팩토링 각 섰다', '아, API 아직 안 나왔구나', '이 변수명 뭐로 짓지?', '클린 코드 책 좀 봐야겠다', '비동기 처리 버그 잡는 중', '콘솔창이 빨갛네요', '무한 루프 돌았네 ㄷㄷ', '앗, 오타... 세미콜론!', '깃허브에 푸시 중...', 'PR 리뷰 남기는 중', '코드 한 줄 짰는데 1시간 지남...'],
  Dave: ['테스트 케이스 작성...', '로그 확인 중...', 'QA 검수 중...', '이 버튼 왜 두 번 눌리죠?', '이거 예외 처리 안 됐네요.', '오, 여긴 완벽하네.', '모바일에서 텍스트 잘려요', '재현 경로 캡처 중', '버그 리포트 작성', '이거 기획 버그인가요?', '엣지 케이스 테스트', '여기서 뒤로가기 누르면 뻗네요', '오류 팝업이 안 떠요', '네트워크 끊고 테스트해볼게요', '앱이 크래시납니다', '다크모드에서 흰 글씨가 안 보여요', '반응형인데 모바일에서 깨져요', '퍼포먼스 테스트 중...', '메모리 점유율이 너무 높아요', '로딩 스피너가 무한정 돕니다', '화면 렌더링이 느려요', '캐시 지우고 다시 해볼게요', '이거 기수정 버그 아닌가요?', '이 기능 스펙 아웃됐나요?'],
  Justice: [
    '이 대법원 판례 인용하면 승소율 올라가겠네.',
    '의뢰인의 정당한 권리를 변호하겠습니다.',
    '계약서 제5조 제2항의 독소조항을 찾아냈어요.',
    '상대방 소송 대리인의 준비서면을 정독 중입니다.',
    '손해배상 청구 취지를 더 명확히 정돈해야 해요.',
    '의뢰인 보호를 위한 법적 안전장치 확보!',
    '법리와 사실관계를 대조하는 중입니다.',
    '헌법 정신 and 법률 규정에 따른 철저한 변론 전략.',
    '이 사건은 형사보다는 민사 조정을 먼저 타진하죠.',
    '상고 이유서 초안 구성 중...',
    '가처분 신청서 요건 세부 검토 중',
    '법원 행정처 최신 실무 지침 확인 완료'
  ],
  Solomon: [
    '유사한 민사 하급심 판례 12건을 정밀 분석했어요.',
    '상대측 주장의 모순점을 논리적으로 입증해 보겠습니다.',
    '사실 관계를 뒤집을 수 있는 스모킹 건을 확보 중...',
    '이 판결이 나온 역사적 맥락을 분석해야 합니다.',
    '증거 자료의 신빙성 여부를 엄격하게 감정 중.',
    '법리적 예외 조항이 적용될 수 있는지 서칭 중...',
    '승소 확률 92% 시뮬레이션 결과가 나왔습니다.',
    '조정안 합의 가이드라인을 최종 도출하는 중.',
    '사건의 쟁점과 증거 효력을 매핑하고 있어요.',
    '검찰 측 제출 증거의 오류 여부 재검토',
    '판례 데이터베이스 크로스 체크 진행 중',
    '과실 비율 분석 통계 모델 구동 중...'
  ],
  Scribe: [
    '증인 신문 조서 속기록을 신속하게 텍스트화 중...',
    '공판 기일 기록을 100% 무결하게 백업 완료.',
    '녹취록의 잡음을 제거하고 발언을 한 자도 빠짐없이 속기 중.',
    '사건 철 파일링 시스템을 체계화하고 있습니다.',
    '속기 키보드의 압력 센서를 체크하는 중.',
    '공판 자료 번역본을 대조하여 교정하고 있어요.',
    '대표변호사님 변론 요지 속기 준비 완료!',
    '재판 기록의 보관 시한과 법적 보안 규정 검토.',
    '속기 오타 하나가 판결을 바꿀 수도 있습니다. 신중하게...',
    '공판 속기 단축키 데이터베이스 갱신 중',
    '사건 접수 번호별 디지털 카탈로깅 작업',
    '서면 제출 전 최종 오탈자 전수 교열 중'
  ],
  Beat: [
    '무대 연출 콘셉트를 ‘도심 속의 자연’으로 확정합니다.',
    '공연 큐시트 초안을 타임라인별로 세밀하게 밸런싱 중...',
    '아티스트 대기실 동선과 무대 진입 경로가 겹치지 않게 조율!',
    '무대 조명 연출 시퀀서를 비트에 맞춰 동기화하는 중.',
    '메인 오프닝 곡의 코러스 구간에 폭죽 특수효과 세팅.',
    '관객 안전 사고 방지를 위한 경호 구역 배치도 확인 중.',
    '음향 반사판 위치를 미세 조정하여 완벽한 음향 분산 도모.',
    '무대 중앙 특수 LED 스크린 재생 소스 테스트 중.',
    '감독관들과 리허설 무전기 채널 맞추기.',
    '오케스트라 악기 세팅 및 헤드룸 밸런스 체크',
    '인이어 모니터링 주파수 신호 간섭 확인',
    '리허설 녹화본 프레임별 모니터링 진행'
  ],
  Budget: [
    '티켓 판매 수수료를 감안한 BEP(손익분기점) 재산출 중.',
    '음향 및 특수효과 외주 비용 단가를 조정하고 있습니다.',
    '스폰서십 기업들과 매칭 펀드 비율 최종 협의 중.',
    '제작 원가 대비 협찬금 확보율 120% 달성 전략 수립.',
    '현장 굿즈(MD) 판매 매출 정산서 세부 마감 중.',
    '부가가치세 및 원천세 공제 세율을 정밀하게 대입합니다.',
    '행사장 대관료 선금 지급 전표 결재 승인 중.',
    '마케팅 예산이 손실 없이 효율적으로 투입되도록 감시 중.',
    '예비비를 8% 추가 확보하여 예상치 못한 지출에 대비.',
    '카드사 제휴 티켓 할인 분담금 비율 계산',
    '아티스트 출연료 송금 전표 최종 결재',
    '행사 보증보험 가입 요율 대조 중...'
  ],
  Trend: [
    'MZ세대를 타깃으로 한 인스타그램 쇼츠 바이럴 기획 중!',
    '네이버 티켓 예매 오픈 30분 전 사전 알림 이벤트를 세팅합니다.',
    '인플루언서 섭외 단가와 홍보 피드 가이드를 정돈 중.',
    '공연 공식 포스터 메인 카피: ‘당신의 감성을 두드릴 단 하나의 무대’',
    '보도자료 배포 시점을 포털 메인 노출 시간대에 맞추어 대기.',
    '네티즌 피드백 빅데이터를 수집하여 바이럴 톤앤매너 수정.',
    '사전 예매자 대상의 한정판 MD 증정 이벤트 챌린지 구성.',
    '광고비 대비 전환율(ROAS)이 350%를 돌파했습니다!',
    '공식 팬덤 커뮤니티에 특별 메시지 발송 대기 중.',
    '유튜브 숏츠용 아티스트 응원 인터뷰 편집 기획',
    '카카오톡 플러스친구 타겟 메시지 카피 라이팅',
    '구글 애널리틱스 연령별 유입 분석 차트 점검'
  ],
  '임변호': [
    '이 대법원 판례 인용하면 승소율 올라가겠네.',
    '의뢰인의 정당한 권리를 변호하겠습니다.',
    '계약서 제5조 제2항의 독소조항을 찾아냈어요.',
    '상대방 소송 대리인의 준비서면을 정독 중입니다.',
    '손해배상 청구 취지를 더 명확히 정돈해야 해요.',
    '의뢰인 보호를 위한 법적 안전장치 확보!',
    '법리와 사실관계를 대조하는 중입니다.',
    '헌법 정신과 법률 규정에 따른 철저한 변론 전략.',
    '이 사건은 형사보다는 민사 조정을 먼저 타진하죠.',
    '상고 이유서 초안 구성 중...',
    '가처분 신청서 요건 세부 검토 중',
    '법원 행정처 최신 실무 지침 확인 완료'
  ],
  '지분석': [
    '유사한 민사 하급심 판례 12건을 정밀 분석했어요.',
    '상대측 주장의 모순점을 논리적으로 입증해 보겠습니다.',
    '사실 관계를 뒤집을 수 있는 스모킹 건을 확보 중...',
    '이 판결이 나온 역사적 맥락을 분석해야 합니다.',
    '증거 자료의 신빙성 여부를 엄격하게 감정 중.',
    '법리적 예외 조항이 적용될 수 있는지 서칭 중...',
    '승소 확률 92% 시뮬레이션 결과가 나왔습니다.',
    '조정안 합의 가이드라인을 최종 도출하는 중.',
    '사건의 쟁점과 증거 효력을 매핑하고 있어요.',
    '검찰 측 제출 증거의 오류 여부 재검토',
    '판례 데이터베이스 크로스 체크 진행 중',
    '과실 비율 분석 통계 모델 구동 중...'
  ],
  '서기록': [
    '증인 신문 조서 속기록을 신속하게 텍스트화 중...',
    '공판 기일 기록을 100% 무결하게 백업 완료.',
    '녹취록의 잡음을 제거하고 발언을 한 자도 빠짐없이 속기 중.',
    '사건 철 파일링 시스템을 체계화하고 있습니다.',
    '속기 키보드의 압력 센서를 체크하는 중.',
    '공판 자료 번역본을 대조하여 교정하고 있어요.',
    '대표변호사님 변론 요지 속기 준비 완료!',
    '재판 기록의 보관 시한 and 법적 보안 규정 검토.',
    '속기 오타 하나가 판결을 바꿀 수도 있습니다. 신중하게...',
    '공판 속기 단축키 데이터베이스 갱신 중',
    '사건 접수 번호별 디지털 카탈로깅 작업',
    '서면 제출 전 최종 오탈자 전수 교열 중'
  ],
  '오기획': [
    '무대 연출 콘셉트를 ‘도심 속의 자연’으로 확정합니다.',
    '공연 큐시트 초안을 타임라인별로 세밀하게 밸런싱 중...',
    '아티스트 대기실 동선과 무대 진입 경로가 겹치지 않게 조율!',
    '무대 조명 연출 시퀀서를 비트에 맞춰 동기화하는 중.',
    '메인 오프닝 곡의 코러스 구간에 폭죽 특수효과 세팅.',
    '관객 안전 사고 방지를 위한 경호 구역 배치도 확인 중.',
    '음향 반사판 위치를 미세 조정하여 완벽한 음향 분산 도모.',
    '무대 중앙 특수 LED 스크린 재생 소스 테스트 중.',
    '감독관들과 리허설 무전기 채널 맞추기.',
    '오케스트라 악기 세팅 및 헤드룸 밸런스 체크',
    '인이어 모니터링 주파수 신호 간섭 확인',
    '리허설 녹화본 프레임별 모니터링 진행'
  ],
  '한재무': [
    '티켓 판매 수수료를 감안한 BEP(손익분기점) 재산출 중.',
    '음향 및 특수효과 외주 비용 단가를 조정하고 있습니다.',
    '스폰서십 기업들과 매칭 펀드 비율 최종 협의 중.',
    '제작 원가 대비 협찬금 확보율 120% 달성 전략 수립.',
    '현장 굿즈(MD) 판매 매출 정산서 세부 마감 중.',
    '부가가치세 및 원천세 공제 세율을 정밀하게 대입합니다.',
    '행사장 대관료 선금 지급 전표 결재 승인 중.',
    '마케팅 예산이 손실 없이 효율적으로 투입되도록 감시 중.',
    '예비비를 8% 추가 확보하여 예상치 못한 지출에 대비.',
    '카드사 제휴 티켓 할인 분담금 비율 계산',
    '아티스트 출연료 송금 전표 최종 결재',
    '행사 보증보험 가입 요율 대조 중...'
  ],
  '윤홍보': [
    'MZ세대를 타깃으로 한 인스타그램 쇼츠 바이럴 기획 중!',
    '네이버 티켓 예매 오픈 30분 전 사전 알림 이벤트를 세팅합니다.',
    '인플루언서 섭외 단가와 홍보 피드 가이드를 정돈 중.',
    '공연 공식 포스터 메인 카피: ‘당신의 감성을 두드릴 단 하나의 무대’',
    '보도자료 배포 시점을 포털 메인 노출 시간대에 맞추어 대기.',
    '네티즌 피드백 빅데이터를 수집하여 바이럴 톤앤매너 수정.',
    '사전 예매자 대상의 한정판 MD 증정 이벤트 챌린지 구성.',
    '광고비 대비 전환율(ROAS)이 350%를 돌파했습니다!',
    '공식 팬덤 커뮤니티에 특별 메시지 발송 대기 중.',
    '유튜브 숏츠용 아티스트 응원 인터뷰 편집 기획',
    '카카오톡 플러스친구 타겟 메시지 카피 라이팅',
    '구글 애널리틱스 연령별 유입 분석 차트 점검'
  ],
  '김장부': [
    '매출 및 매입 세금계산서 전표 입력 중...',
    '복식부기 장부 대조 작업 중입니다.',
    '앗, 이 전표 적격증빙이 누락되었네요.',
    '통장 거래 내역과 장부 잔액 매칭 중.',
    '월말 세무 기장 마감 보고서 작성 중...',
    '급여 대장 원천세 계산기 작동 중',
    '계정과목 분류 체계를 검토하는 중입니다.',
    '소모품비 전표 처리 기준 체크!',
    '카드 매출 영수증 대조 속도 업!',
    '세무 대리인 동의 절차 서류 정리 중',
    '가지급금 계정 잔액 관리 중...',
    '일계표와 월계표 무결성 검증 완료'
  ],
  '이절세': [
    '조세특례제한법상 세액공제 항목 분석 중...',
    '기업부설연구소 설립을 통한 세액감면 검토!',
    '고용증대 세액공제 최적화 시뮬레이션 중.',
    '합법적 절세 방안 시나리오 3종 수립 완료.',
    '소득세 및 법인세 분납 플랜 구성 중...',
    '지방세 감면 특례 조항 서칭 중입니다.',
    '창업중소기업 세액감면 적용 대상 체크!',
    '통합투자세액공제 최대화 전략 검토 중',
    '의뢰인의 세무 리스크 비용 최소화 방안!',
    '세법 개정안 반영 절세 전략서 교정 중',
    '공동사업자 소득 분배 비율 최적화 분석',
    '세금 감면 한도액 크로스 체크 완료'
  ],
  '박감사': [
    '국세청 통합조사 리스크 사전 감사 진행 중...',
    '매출 누락 가능성 및 리스크 사전 진단.',
    '가공경비 계상 여부 정밀 감리 중입니다.',
    '적격증빙 미비 가산세 가중치 시뮬레이션.',
    '특수관계인 간 부당행위계산부인 규정 점검!',
    '재무비율 분석을 통한 세무조사 타겟 방어.',
    '현금영수증 미발행 가산세 리스크 리포트.',
    '재고 자산 평가 방법 적정성 체크 중',
    '세무 감사 대비 소명 자료 패키징 중...',
    '부가가치세 조기 환급 현장 확인 대비',
    '장부 불일치 원인 추적 정밀 감리 돌입',
    '조사관 예상 질의응답 리스트 구성 완료'
  ],
  '정신고': [
    '종합소득세 신고서 서식 최종 검토 중...',
    '부가가치세 예정 및 확정 신고 대기!',
    '법인세 신고 세액조정계산서 정독 중입니다.',
    '원천징수이행상황신고서 국세청 전송 준비.',
    '지방소득세 특별징수 명세서 크로스 체크.',
    '세무 조정 사항 및 가산세 계산기 가동.',
    '신고 기한 마감 임박! 꼼꼼히 재검토.',
    '해외 거래처 원천징수 세율 대조 중...',
    '면세사업자 수입금액 현황 신고서 점검',
    '중간예납 신고 절차 가이드라인 수립',
    '전자신고 오류 검증 프로그램 기동 완료',
    '신고 누락 방지를 위한 최종 점검 체크리스트'
  ],
  '최재무': [
    '결산 재무제표(대차대조표/손익계산서) 최종 마감 중...',
    '경영 상태 분석 및 부채 비율 점검.',
    '투자 유치 대비 재무 구조 건전성 강화 플랜.',
    'CFO 최종 자문서 날인 완료 중...',
    '현금 흐름표(Cash Flow) 실시간 모니터링.',
    '차기 연도 세무 리스크 예산 배정액 확정.',
    '매출 채권 회수 기일 및 대손충당금 검토.',
    '은행 대출 연장 심사용 재무 자료 조율 중',
    '경영진 대상 최종 결산 세무 보고서 마감',
    '배당금 지급 한도 및 절세 플랜 최종 검토',
    '운전자본 회전율 극대화 시나리오 도출',
    'CFO 재무 실무 지침 가이드 배포 완료'
  ],
  '최인사': [
    '이번 채용 공고 서류 필터링 중...',
    '앗, 올해 연차 촉진제 결재 올려야지.',
    '인재 풀 뒤적뒤적... 좋은 분 없나?',
    '어우, 이번 면접 스케줄 장난 아니네.',
    '평가 시즌이 다가온다... 벌써 두렵다.',
    '신규 입사자 온보딩 키트 세팅 완료!',
    '대표님, 인사 평가 보고서 컨펌 부탁드립니다.',
    '커피 수혈 시급... 탕비실로 런!',
    '이번 채용 트렌드는 블라인드인가.',
    '역량 평가 지표 다시 만지는 중',
    '경력직 처우 협의 메일 송신 완료',
    '연차 반려하면 퇴사각인가 ㄷㄷ'
  ],
  '정기획': [
    '차년도 경영 계획 장표 그리는 중...',
    '비즈니스 모델 피벗 해야 하나?',
    '이 기획안, 부장님 결재 반려각인가 ㄷㄷ',
    '지표 모니터링 중... 대시보드 깨짐 ㅠ',
    '차주 주간 보고 장표 깎는 노인...',
    '경쟁사 동향 파악 보고서 작성',
    '이 사업은 ROI가 안 맞을 것 같은데.',
    '스프린트 회의 준비 완료!',
    '대표님 결재 대기 중... 심장이 쫄깃',
    '브레인스토밍 아이디어 쥐어짜기',
    '일정 딜레이 방지책 수립 중',
    '기획서 폰트 나눔스퀘어로 통일하자'
  ],
  '홍홍보': [
    '보도자료 배포 시점 타이밍 재는 중',
    '인스타 릴스 조회수 대박 났네!',
    '브랜드 캐릭터 굿즈 시안 검토 중',
    '어휴, 악성 바이럴 댓글 대응 중...',
    '보도자료 엠바고 걸려 있습니다!',
    '이번 캠페인 ROAS 400% 존버!',
    '유튜브 쇼츠 편집 피드백 작성 중',
    '인플루언서 섭외 메일 회신 대기',
    '신제품 카피 문구 쥐어짜는 중',
    '탕비실 다과 먹으면서 뇌 비우기',
    '브랜드 인지도 설문조사 통계 돌리기',
    '트렌드 리포트 분석 완료!'
  ],
  '윤재무': [
    'CFO 최종 예산 통제 승인 대기',
    '이번 달 판관비가 왜 이렇게 튀었지?',
    '자금 흐름표 일일 마감 중...',
    '회사 통장 잔액 맞춰보기',
    '투자사 미팅 준비 완료',
    '세무 조사 대비 예비비 확보!',
    '법인카드 사적 사용 필터링 중 ㄷㄷ',
    '비용 승인 결재... 일단 보류!',
    '내년도 예산안 대폭 삭감 분위기...',
    '재무 건전성 지표 시뮬레이션',
    '외화 환율 변동 추이 모니터링',
    '월급날 잔고 확보 완료!'
  ],
  '김영업': [
    '중요 바이어 미팅 제안서 송신!',
    '이번 딜 성사되면 인센티브 얼마지? 흐뭇',
    '제안 미팅 가는 길... 차 막힌다 ㅠ',
    '신규 판로 개척 파트너십 제안 중',
    '매출 목표 달성률 95%! 5% 남았다',
    '고객사 불만 사항 긴급 대응 중',
    '영업 세일즈 피치 맹연습 중',
    '계약서 법무 검토 완료 대기',
    '오늘 저녁 바이어 접대 회식인가...',
    '경쟁사 견적서 몰래 입수 완료!',
    '영업망 지도 그리는 중',
    '월말 실적 마감 압박 ㄷㄷ'
  ],
  '이회계': [
    '세금계산서 발행 내역 전수 조사',
    '매출 매입 전표 입력 마감 중...',
    '영수증 풀칠하던 시절이 그리운가',
    '부가세 신고용 증빙 누락 발견 ㅠ',
    '가지급금 명세서 정돈하는 중',
    '원천세 납부 영수증 철 파일링',
    '계정과목이 이게 맞나? 고민 중',
    '감사법인 수임료 전표 처리 완료',
    '법인세 공제 감면 항목 더 없나?',
    '숫자 하나 틀리면 밤샘이다 ㄷㄷ',
    '엑셀 수식 에러 발생... 아 멘붕',
    '재무제표 계정 대조 완료!'
  ],
  '박비서': [
    '대표님 일일 스케줄 최종 싱크',
    '오후 3시 외부 미팅 동선 체크!',
    '대표님 차 안 막히게 우회 경로 확인',
    '회의실 다과 세팅 완료했습니다',
    '대표님 결재 안건 사전 스크리닝',
    '임원 회의 일정 조율 완료',
    '대표님 휴가 가시면 나도 연차각?',
    '비서실 행정 문서 보안 철저!',
    '외부 VIP 영전 축하 화환 송부',
    '전화 응대... 네, 비서실입니다',
    '대표님 메일함 대리 정돈 중',
    '오후 회의록 작성 대기 중'
  ],
  '강지원': [
    '사무실 형광등 교체 민원 접수',
    '탕비실 믹스커피 대량 구매 완료!',
    '사무용품 신청 내역 최종 발주',
    '회사 통근버스 노선 개편안 검토',
    '복리후생 명절 선물 세트 조사',
    '소방 안전 점검 대행 업체 계약',
    '비품 창고 먼지 털기 대작전',
    '워크숍 펜션 예약 현황 체크',
    '인프라 서버실 에어컨 가동 확인',
    '쓰레기 분리배출 안내문 부착 완료',
    '사우회 경조사비 집행 전표 결재',
    '어휴, 회사 복지 예산 쪼들리네'
  ]
};

export const SIM_CHATTER: Record<string, string[]> = {
  desk: ['집중해서 작업 중...', '타이핑 중...', '(모니터를 뚫어져라 보는 중)', '자세 고쳐 앉기...', '아이고 목 뻐근해', '이번 스프린트 빡세네...', '오늘 퇴근하고 뭐 하지?', '눈물 좀 넣고...', '(인공눈물 톡톡)', '키보드 타건감 좋네', '마우스 배터리 없나?', '아, 멍때렸다', '다들 엄청 열심히 하네', '점심에 많이 먹어서 졸려', '이번 릴리즈 잘 돼야 할텐데', '메일 알람이 계속 우네', '슬랙에 누가 태그했네', '노래 들으면서 일해야지', '휴가 며칠 남았더라?', '(허리 스트레칭 쭈욱)', '오늘따라 시간이 잘 가네', '코드 리뷰 해줘야겠다', '이건 내일 할까...', '일단 커밋부터 해두자', '(물 홀짝)'],
  pantry: ['아 역시 아아가 최고야.', '당 충전 중...', '오늘 점심 뭐 먹죠?', '(스트레칭) 으쌰!', '커피 내리는 소리.. 쪼르륵', '잠깐 머리 좀 식히고...', '얼음 많이 주세요', '냉장고에 내 빵 어디갔어?', '오늘 날씨 좋네요', '다들 바쁘시네', '창밖 구경 중...', '탕비실 간식 채워졌나?', '이 초콜릿 맛있네', '원두 갈아야겠다', '아 믹스커피 먹을까', '물 많이 마셔야지', '어휴, 한숨 돌리네', '회의 너무 길었어...', '여기서 5분만 눈 붙이고 싶다', '(스마트폰 알림 확인 중)', '유튜브 잠깐 볼까', '주말에 뭐 하세요?', '다이어트 해야 하는데...', '(기지개 쭈욱)', '팀장님 안 계시나요?'],
  conference: ['그래서 결론이 뭔가요?', '일정 조율이 필요합니다.', '그건 다음 버전에 넣죠.', '저번 회의록 어디 갔지?', '좋은 아이디어 없을까요?', '다들 어떻게 생각하세요?', '화면 공유 보이시나요?', '제 말 들리시나요?', '아, 마이크가 꺼져있었네요', '이 안건은 빠르게 넘어갈게요', '이거 기획 의도가 뭔가요?', '보수적으로 일정 잡겠습니다', '그건 기술적으로 조금 어렵습니다', '일단 MVP로 쳐내죠', '다른 부서랑 협의가 필요해요', '오늘 회의는 여기까지 하시죠', '이 내용 누가 정리하실래요?', '이거 우선순위가 어떻게 되나요?', '그 이슈, 트래커에 있나요?', '레퍼런스 띄워볼게요', '자, 집중합시다', '이건 논외니까 나중에 얘기하죠', '추가 의견 없으신가요?', '(격렬한 프레젠테이션 진행 중)']
};

const svgAlice = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#fff"/>
  <path d="M 35 70 L 65 70 L 50 90 Z" fill="#ffcccc"/> 
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#333"/>
  <circle cx="50" cy="40" r="30" fill="#ffe6e6"/>
  <circle cx="40" cy="40" r="3" fill="#333"/>
  <circle cx="60" cy="40" r="3" fill="#333"/>
  <path d="M 45 50 Q 50 55 55 50" stroke="#333" stroke-width="2" fill="transparent"/>
  <path d="M 20 40 Q 50 0 80 40 L 80 60 Q 50 20 20 60 Z" fill="#b34700"/>
  <rect x="33" y="35" width="14" height="10" rx="2" stroke="#ff4d4d" stroke-width="2" fill="transparent"/>
  <rect x="53" y="35" width="14" height="10" rx="2" stroke="#ff4d4d" stroke-width="2" fill="transparent"/>
  <line x1="47" y1="40" x2="53" y2="40" stroke="#ff4d4d" stroke-width="2"/>
</svg>`;

const svgCarol = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#ffe6f2"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#ff80df"/>
  <circle cx="40" cy="95" r="5" fill="#fff"/>
  <circle cx="50" cy="40" r="30" fill="#fff0f5"/>
  <ellipse cx="40" cy="40" rx="4" ry="5" fill="#333"/><circle cx="41" cy="39" r="1.5" fill="#fff"/>
  <ellipse cx="60" cy="40" rx="4" ry="5" fill="#333"/><circle cx="61" cy="39" r="1.5" fill="#fff"/>
  <path d="M 47 52 Q 50 50 53 52" stroke="#333" stroke-width="2" fill="transparent"/>
  <path d="M 20 30 Q 50 -10 80 30 L 85 80 Q 80 60 75 50 Q 50 10 25 50 M 15 80 Q 20 60 20 30" fill="#ffb3ff"/>
  <ellipse cx="40" cy="15" rx="25" ry="10" fill="#ff4da6"/>
</svg>`;

const svgBob = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#4da6ff"/>
  <line x1="35" y1="80" x2="65" y2="80" stroke="#003366" stroke-width="3"/>
  <line x1="35" y1="90" x2="65" y2="90" stroke="#003366" stroke-width="3"/>
  <line x1="45" y1="70" x2="45" y2="110" stroke="#003366" stroke-width="3"/>
  <line x1="55" y1="70" x2="55" y2="110" stroke="#003366" stroke-width="3"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#1a1a1a"/>
  <circle cx="50" cy="40" r="30" fill="#f2e6d9"/>
  <line x1="35" y1="38" x2="45" y2="40" stroke="#333" stroke-width="2"/>
  <line x1="65" y1="38" x2="55" y2="40" stroke="#333" stroke-width="2"/>
  <ellipse cx="40" cy="42" rx="2" ry="2" fill="#333"/>
  <ellipse cx="60" cy="42" rx="2" ry="2" fill="#333"/>
  <path d="M 37 46 Q 40 48 43 46" stroke="#999" stroke-width="1" fill="transparent"/>
  <path d="M 57 46 Q 60 48 63 46" stroke="#999" stroke-width="1" fill="transparent"/>
  <line x1="48" y1="52" x2="52" y2="52" stroke="#333" stroke-width="2"/>
  <path d="M 15 45 Q 50 -20 85 45 Q 70 20 60 30 Q 50 15 40 30 Q 30 20 15 45 Z" fill="#4d3319"/>
</svg>`;

const svgDave = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#33cc33"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#111"/>
  <rect x="45" y="70" width="10" height="40" fill="#fff"/>
  <path d="M 47 70 L 53 70 L 50 100 Z" fill="#b30000"/>
  <circle cx="50" cy="40" r="30" fill="#e6ffe6"/>
  <rect x="32" y="35" width="16" height="12" rx="2" stroke="#111" stroke-width="3" fill="transparent"/>
  <rect x="52" y="35" width="16" height="12" rx="2" stroke="#111" stroke-width="3" fill="transparent"/>
  <line x1="48" y1="41" x2="52" y2="41" stroke="#111" stroke-width="3"/>
  <circle cx="40" cy="41" r="2" fill="#111"/>
  <circle cx="60" cy="41" r="2" fill="#111"/>
  <path d="M 45 52 Q 50 55 55 52" stroke="#333" stroke-width="2" fill="transparent"/>
  <path d="M 20 40 Q 50 -10 80 40 L 75 25 Q 50 0 25 25 Z" fill="#111"/>
</svg>`;

const svgEve = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#fff5f5"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#ec4899"/>
  <circle cx="50" cy="40" r="30" fill="#ffe3e3"/>
  <circle cx="40" cy="40" r="3.5" fill="#333"/>
  <circle cx="60" cy="40" r="3.5" fill="#333"/>
  <path d="M 46 50 Q 50 55 54 50" stroke="#333" stroke-width="2.5" fill="transparent"/>
  <path d="M 20 40 Q 50 5 80 40 L 80 70 Q 50 30 20 70 Z" fill="#ec4899"/>
  <circle cx="35" cy="15" r="8" fill="#f43f5e"/>
  <circle cx="65" cy="15" r="8" fill="#f43f5e"/>
</svg>`;

const svgFrank = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#f0fdf4"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#10b981"/>
  <circle cx="50" cy="40" r="30" fill="#dcfce7"/>
  <circle cx="40" cy="40" r="3" fill="#333"/>
  <circle cx="60" cy="40" r="3" fill="#333"/>
  <path d="M 45 49 Q 50 51 55 49" stroke="#333" stroke-width="2" fill="transparent"/>
  <path d="M 22 25 Q 50 -10 78 25 L 82 50 Q 50 15 18 50 Z" fill="#047857"/>
  <rect x="32" y="34" width="16" height="12" rx="2" stroke="#10b981" stroke-width="2" fill="rgba(16,185,129,0.1)"/>
  <rect x="52" y="34" width="16" height="12" rx="2" stroke="#10b981" stroke-width="2" fill="rgba(16,185,129,0.1)"/>
  <line x1="48" y1="40" x2="52" y2="40" stroke="#10b981" stroke-width="2"/>
</svg>`;

const svgGrace = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#faf5ff"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#8b5cf6"/>
  <circle cx="50" cy="40" r="30" fill="#f3e8ff"/>
  <circle cx="39" cy="41" r="3" fill="#333"/>
  <circle cx="61" cy="41" r="3" fill="#333"/>
  <path d="M 44 51 Q 50 54 56 51" stroke="#333" stroke-width="2" fill="transparent"/>
  <path d="M 18 35 Q 50 -5 82 35 L 85 65 Q 50 25 15 65 Z" fill="#6d28d9"/>
  <ellipse cx="50" cy="12" rx="14" ry="7" fill="#a78bfa"/>
</svg>`;

const svgHank = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#fffbeb"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#f59e0b"/>
  <circle cx="50" cy="40" r="30" fill="#fef3c7"/>
  <circle cx="41" cy="40" r="3.5" fill="#333"/>
  <circle cx="59" cy="40" r="3.5" fill="#333"/>
  <path d="M 45 52 Q 50 49 55 52" stroke="#333" stroke-width="2.5" fill="transparent"/>
  <path d="M 25 28 Q 50 -5 75 28 Z" fill="#b45309"/>
  <path d="M 15 25 L 85 25 L 80 10 L 20 10 Z" fill="#d97706"/>
</svg>`;

const svgJustice = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#d97706"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#1e293b"/>
  <circle cx="50" cy="40" r="30" fill="#fef3c7"/>
  <circle cx="40" cy="40" r="3.5" fill="#111"/>
  <circle cx="60" cy="40" r="3.5" fill="#111"/>
  <path d="M 42 52 Q 50 48 58 52" stroke="#111" stroke-width="2.5" fill="transparent"/>
  <path d="M 15 35 Q 50 -15 85 35 L 75 80 Z" fill="#1e1b4b"/>
  <rect x="47" y="10" width="6" height="12" fill="#fbbf24"/>
</svg>`;

const svgSolomon = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#7c3aed"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#1e1b4b"/>
  <circle cx="50" cy="40" r="30" fill="#faf5ff"/>
  <circle cx="40" cy="38" r="3" fill="#333"/>
  <circle cx="60" cy="38" r="3" fill="#333"/>
  <path d="M 45 49 Q 50 53 55 49" stroke="#333" stroke-width="2" fill="transparent"/>
  <path d="M 10 40 Q 50 -25 90 40 L 80 80 Z" fill="#4c1d95"/>
  <path d="M 40 70 L 60 70 L 50 82 Z" fill="#fbbf24"/>
</svg>`;

const svgScribe = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#0891b2"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#0f172a"/>
  <circle cx="50" cy="40" r="30" fill="#ecfeff"/>
  <circle cx="41" cy="42" r="2.5" fill="#334155"/>
  <circle cx="59" cy="42" r="2.5" fill="#334155"/>
  <path d="M 45 52 Q 50 55 55 52" stroke="#334155" stroke-width="2" fill="transparent"/>
  <path d="M 20 30 Q 50 -10 80 30 Z" fill="#0369a1"/>
</svg>`;

const svgBeat = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#e11d48"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#2d0612"/>
  <circle cx="50" cy="40" r="30" fill="#fff5f5"/>
  <circle cx="38" cy="40" r="3" fill="#111"/>
  <circle cx="62" cy="40" r="3" fill="#111"/>
  <path d="M 43 51 Q 50 56 57 51" stroke="#111" stroke-width="2" fill="transparent"/>
  <path d="M 15 42 Q 50 -15 85 42 L 75 75 Z" fill="#9013fe"/>
  <circle cx="50" cy="18" r="7" fill="#ff007f"/>
</svg>`;

const svgBudget = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#059669"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#064e3b"/>
  <circle cx="50" cy="40" r="30" fill="#ecfdf5"/>
  <circle cx="40" cy="40" r="3" fill="#111"/>
  <circle cx="60" cy="40" r="3" fill="#111"/>
  <path d="M 46 51 L 54 51" stroke="#111" stroke-width="2"/>
  <path d="M 20 35 Q 50 -15 80 35 Z" fill="#10b981"/>
</svg>`;

const svgTrend = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#db2777"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#4d052e"/>
  <circle cx="50" cy="40" r="30" fill="#fdf2f8"/>
  <ellipse cx="40" cy="41" rx="3.5" ry="4.5" fill="#111"/>
  <ellipse cx="60" cy="41" rx="3.5" ry="4.5" fill="#111"/>
  <path d="M 45 52 Q 50 49 55 52" stroke="#111" stroke-width="2" fill="transparent"/>
  <path d="M 15 28 Q 50 -15 85 28 Z" fill="#f472b6"/>
</svg>`;

const svg김장부 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#0284c7"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#0c4a6e"/>
  <circle cx="50" cy="40" r="30" fill="#f0f9ff"/>
  <circle cx="40" cy="40" r="3" fill="#111"/>
  <circle cx="60" cy="40" r="3" fill="#111"/>
  <path d="M 44 51 Q 50 54 56 51" stroke="#111" stroke-width="2.2" fill="transparent"/>
  <path d="M 15 35 Q 50 -15 85 35 Z" fill="#0284c7"/>
  <rect x="42" y="86" width="16" height="12" rx="1" fill="#fff" stroke="#0284c7" stroke-width="1.5"/>
  <line x1="46" y1="90" x2="54" y2="90" stroke="#0284c7" stroke-width="1"/>
  <line x1="46" y1="93" x2="52" y2="93" stroke="#0284c7" stroke-width="1"/>
</svg>`;

const svg이절세 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#059669"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#064e3b"/>
  <circle cx="50" cy="40" r="30" fill="#f0fdf4"/>
  <circle cx="39" cy="38" r="3.5" fill="#111"/>
  <circle cx="61" cy="38" r="3.5" fill="#111"/>
  <rect x="34" y="33" width="12" height="9" rx="1" stroke="#10b981" stroke-width="1.8" fill="transparent"/>
  <rect x="54" y="33" width="12" height="9" rx="1" stroke="#10b981" stroke-width="1.8" fill="transparent"/>
  <line x1="46" y1="37" x2="54" y2="37" stroke="#10b981" stroke-width="1.8"/>
  <path d="M 45 49 Q 50 52 55 49" stroke="#111" stroke-width="2" fill="transparent"/>
  <path d="M 20 30 Q 50 -15 80 30 Z" fill="#10b981"/>
</svg>`;

const svg박감사 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#d97706"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#451a03"/>
  <circle cx="50" cy="40" r="30" fill="#fefdf0"/>
  <circle cx="40" cy="40" r="3" fill="#111"/>
  <circle cx="60" cy="40" r="3" fill="#111"/>
  <path d="M 45 52 Q 50 49 55 52" stroke="#111" stroke-width="2" fill="transparent"/>
  <path d="M 15 32 Q 50 -15 85 32 L 80 50 Z" fill="#b45309"/>
  <circle cx="70" cy="88" r="6" stroke="#fbbf24" stroke-width="1.8" fill="transparent"/>
  <line x1="74" y1="92" x2="79" y2="97" stroke="#fbbf24" stroke-width="1.8"/>
</svg>`;

const svg정신고 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#ea580c"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#7c2d12"/>
  <circle cx="50" cy="40" r="30" fill="#fff7ed"/>
  <circle cx="41" cy="40" r="2.5" fill="#111"/>
  <circle cx="59" cy="40" r="2.5" fill="#111"/>
  <path d="M 44 51 Q 50 54 56 51" stroke="#111" stroke-width="2" fill="transparent"/>
  <path d="M 20 28 Q 50 -15 80 28 Z" fill="#ea580c"/>
  <path d="M 45 84 L 55 84 L 55 96 L 45 96 Z" fill="#ffedd5" stroke="#ea580c" stroke-width="1"/>
  <path d="M 48 88 L 52 92 M 52 88 L 48 92" stroke="#ea580c" stroke-width="1.2"/>
</svg>`;

const svg최재무 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#7c3aed"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#2e1065"/>
  <circle cx="50" cy="40" r="30" fill="#faf5ff"/>
  <circle cx="39" cy="40" r="3" fill="#111"/>
  <circle cx="61" cy="40" r="3" fill="#111"/>
  <path d="M 45 52 Q 50 55 55 52" stroke="#111" stroke-width="2" fill="transparent"/>
  <path d="M 15 42 L 32.5 25 L 50 42 L 67.5 25 L 85 42 L 80 60 L 20 60 Z" fill="#6d28d9"/>
  <circle cx="50" cy="18" r="4.5" fill="#eab308"/>
  <circle cx="32.5" cy="18" r="4.5" fill="#eab308"/>
  <circle cx="67.5" cy="18" r="4.5" fill="#eab308"/>
  <circle cx="50" cy="90" r="6" fill="#fbbf24"/>
  <text x="47" y="94.5" font-family="sans-serif" font-size="6.5" font-weight="bold" fill="#7c3aed">$</text>
</svg>`;

const svg최인사 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#fee2e2"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#f87171"/>
  <circle cx="50" cy="40" r="30" fill="#fef2f2"/>
  <circle cx="40" cy="40" r="3" fill="#333"/>
  <circle cx="60" cy="40" r="3" fill="#333"/>
  <path d="M 45 50 Q 50 54 55 50" stroke="#333" stroke-width="2" fill="transparent"/>
  <path d="M 22 30 Q 50 -10 78 30 L 82 50 Q 50 15 18 50 Z" fill="#991b1b"/>
  <rect x="42" y="86" width="16" height="12" rx="1" fill="#fff" stroke="#f87171" stroke-width="1.5"/>
  <text x="46" y="94.5" font-family="sans-serif" font-size="7" font-weight="bold" fill="#f87171">HR</text>
</svg>`;

const svg정기획 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#ffedd5"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#fb923c"/>
  <circle cx="50" cy="40" r="30" fill="#fff7ed"/>
  <circle cx="40" cy="40" r="3" fill="#333"/>
  <circle cx="60" cy="40" r="3" fill="#333"/>
  <path d="M 45 50 Q 50 53 55 50" stroke="#333" stroke-width="2" fill="transparent"/>
  <path d="M 20 45 Q 50 5 80 45 Q 70 20 60 30 Q 50 15 40 30 Q 30 20 20 45 Z" fill="#c2410c"/>
  <rect x="42" y="86" width="16" height="12" rx="1" fill="#fff" stroke="#fb923c" stroke-width="1.5"/>
  <line x1="46" y1="90" x2="54" y2="90" stroke="#fb923c" stroke-width="1"/>
  <line x1="46" y1="93" x2="52" y2="93" stroke="#fb923c" stroke-width="1"/>
</svg>`;

const svg홍홍보 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#fdf2f8"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#f472b6"/>
  <circle cx="50" cy="40" r="30" fill="#fff1f2"/>
  <circle cx="40" cy="40" r="3" fill="#333"/>
  <circle cx="60" cy="40" r="3" fill="#333"/>
  <path d="M 46 50 Q 50 55 54 50" stroke="#333" stroke-width="2.5" fill="transparent"/>
  <path d="M 18 35 Q 50 -5 82 35 L 85 65 Q 50 25 15 65 Z" fill="#be185d"/>
  <path d="M 44 85 L 56 85 L 56 97 L 44 97 Z" fill="#ffe4e6" stroke="#f472b6" stroke-width="1"/>
  <circle cx="50" cy="91" r="2.5" fill="#be185d"/>
</svg>`;

const svg윤재무 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#faf5ff"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#a78bfa"/>
  <circle cx="50" cy="40" r="30" fill="#f3e8ff"/>
  <circle cx="39" cy="40" r="3" fill="#111"/>
  <circle cx="61" cy="40" r="3" fill="#111"/>
  <path d="M 45 52 Q 50 55 55 52" stroke="#111" stroke-width="2" fill="transparent"/>
  <path d="M 15 42 L 32.5 25 L 50 42 L 67.5 25 L 85 42 L 80 60 L 20 60 Z" fill="#6d28d9"/>
  <circle cx="50" cy="90" r="6" fill="#fbbf24"/>
  <text x="47" y="94.5" font-family="sans-serif" font-size="6.5" font-weight="bold" fill="#7c3aed">$</text>
</svg>`;

const svg김영업 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#eff6ff"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#60a5fa"/>
  <circle cx="50" cy="40" r="30" fill="#f0f9ff"/>
  <circle cx="40" cy="38" r="3" fill="#333"/>
  <circle cx="60" cy="38" r="3" fill="#333"/>
  <path d="M 44 49 Q 50 53 56 49" stroke="#333" stroke-width="2" fill="transparent"/>
  <path d="M 15 35 Q 50 -15 85 35 Z" fill="#1d4ed8"/>
  <rect x="42" y="86" width="16" height="12" rx="1" fill="#fff" stroke="#60a5fa" stroke-width="1.5"/>
  <text x="45.5" y="94.5" font-family="sans-serif" font-size="6" font-weight="bold" fill="#1d4ed8">BIZ</text>
</svg>`;

const svg이회계 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#ecfdf5"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#34d399"/>
  <circle cx="50" cy="40" r="30" fill="#f0fdf4"/>
  <circle cx="40" cy="40" r="3" fill="#111"/>
  <circle cx="60" cy="40" r="3" fill="#111"/>
  <path d="M 45 52 Q 50 49 55 52" stroke="#111" stroke-width="2.5" fill="transparent"/>
  <path d="M 20 30 Q 50 -15 80 30 Z" fill="#047857"/>
  <rect x="42" y="86" width="16" height="12" rx="1" fill="#fff" stroke="#34d399" stroke-width="1.5"/>
  <line x1="46" y1="90" x2="54" y2="90" stroke="#34d399" stroke-width="1"/>
</svg>`;

const svg박비서 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#f0fdfa"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#2dd4bf"/>
  <circle cx="50" cy="40" r="30" fill="#f2fcfb"/>
  <circle cx="40" cy="40" r="3" fill="#333"/>
  <circle cx="60" cy="40" r="3" fill="#333"/>
  <path d="M 46 51 Q 50 55 54 51" stroke="#333" stroke-width="2" fill="transparent"/>
  <path d="M 18 32 Q 50 -10 82 32 L 85 55 Q 50 20 15 55 Z" fill="#0d9488"/>
  <circle cx="50" cy="14" r="5" fill="#0d9488"/>
</svg>`;

const svg강지원 = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="35" y="70" width="30" height="40" rx="10" fill="#f5f5f4"/>
  <rect x="30" y="80" width="40" height="30" rx="5" fill="#a8a29e"/>
  <circle cx="50" cy="40" r="30" fill="#fafaf9"/>
  <circle cx="41" cy="40" r="3.5" fill="#333"/>
  <circle cx="59" cy="40" r="3.5" fill="#333"/>
  <path d="M 45 52 Q 50 49 55 52" stroke="#333" stroke-width="2.5" fill="transparent"/>
  <path d="M 25 28 Q 50 -5 75 28 Z" fill="#44403c"/>
  <path d="M 15 25 L 85 25 L 80 10 L 20 10 Z" fill="#78716c"/>
</svg>`;

export const SVG_ASSETS: Record<string, string> = {
  svgAlice, svgCarol, svgBob, svgDave,
  svgEve, svgFrank, svgGrace, svgHank,
  svgJustice, svgSolomon, svgScribe,
  svgBeat, svgBudget, svgTrend,
  svg임변호: svgJustice, svg지분석: svgSolomon, svg서기록: svgScribe,
  svg오기획: svgBeat, svg한재무: svgBudget, svg윤홍보: svgTrend,
  svg김장부, svg이절세, svg박감사, svg정신고, svg최재무,
  svg최인사, svg정기획, svg홍홍보, svg윤재무, svg김영업, svg이회계, svg박비서, svg강지원
};
