import { prisma } from './prisma';

export interface ChatMessage {
  id?: number;
  messageId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  aiAnalysis?: any;
  aiRequested?: boolean;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM' | 'VIDEO';
  fileUrl?: string;
  fileName?: string;
  createdAt: number;
}

export { prisma };
export default prisma;
