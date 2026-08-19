import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = 
  globalForPrisma.prisma ||
  new PrismaClient();

prisma.$use(async (params, next) => {
  if (params.model === 'Transaction' && (params.action === 'create' || params.action === 'createMany')) {
    if (params.action === 'create') {
      const data = params.args.data;
      if (data && data.senderId && data.receiverId && data.senderId === data.receiverId) {
        throw new Error('Self-transactions are not allowed');
      }
    } else if (params.action === 'createMany') {
      const data = params.args.data;
      if (Array.isArray(data)) {
        params.args.data = data.filter(t => t.senderId !== t.receiverId);
      }
    }
  }
  return next(params);
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;