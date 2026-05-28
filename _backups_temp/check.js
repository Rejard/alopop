const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findUnique({
  where: { agentToken: 'cfe14a56c62eed60095fb3555ecc92b2af814637a3e9a428' }
}).then(console.log).finally(() => prisma.$disconnect());
