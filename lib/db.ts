import Dexie, { type EntityTable } from 'dexie';

export interface AiUsageStat {
  date: string; // YYYY-MM-DD 로컬 날짜
  count: number;
}

export interface ChatMessage {
  id?: number; // IndexedDB 자동 생성 기본키 (숫자)
  messageId: string; // 고유 메시지 ID (UUID)
  senderId: string;
  senderName: string;
  receiverId: string; // 그룹/방 ID 또는 1:1 상대방 ID ("global" 등)
  content: string;
  aiAnalysis?: any;
  aiRequested?: boolean; // 사용자가 팩트체크를 켜놓고(AI 🟢) 전송했는지를 표시하는 플래그
  messageType?: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM' | 'VIDEO';
  fileUrl?: string;
  fileName?: string;
  createdAt: number; // 타임스탬프
}

const db = new Dexie('AloPopDatabase') as Dexie & {
  messages: EntityTable<
    ChatMessage,
    'id' // pk
  >;
  aiStats: EntityTable<
    AiUsageStat,
    'date' // pk
  >;
};

// 스키마 버전 1
db.version(1).stores({
  // 인덱스로 사용할 필드들 지정 (조회를 빠르게 하기 위함)
  messages: '++id, messageId, receiverId, createdAt'
});

// 스키마 버전 2 (aiStats 테이블 추가)
db.version(2).stores({
  messages: '++id, messageId, receiverId, createdAt',
  aiStats: 'date' // date 필드를 Primary Key로 사용
});

export { db };
