const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const rooms = await prisma.room.findMany({
    where: { isGroup: false },
    include: { members: true }
  });
  console.log(JSON.stringify(rooms, null, 2));
}
main().finally(() => prisma.$disconnect());
