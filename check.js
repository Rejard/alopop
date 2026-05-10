const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.user.findMany({ where: { isAgent: true } }).then(console.log).finally(() => prisma.$disconnect());
