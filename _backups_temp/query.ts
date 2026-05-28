import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.user.findMany({ where: { isAi: true }, orderBy: { createdAt: 'desc' }, take: 1 })
  .then((res: any) => console.log(JSON.stringify(res, null, 2)))
  .catch((e: any) => console.error(e))
  .finally(() => p.$disconnect());
