import { PrismaClient } from '@prisma/client';

// PrismaClient 싱글톤 패턴 (Next.js 핫 리로딩 중복 DB 커넥션 방지)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
