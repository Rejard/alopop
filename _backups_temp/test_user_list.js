const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- [DB 유저 조회 테스트] ---');
  try {
    const users = await prisma.user.findMany({
      take: 10,
      select: {
        id: true,
        username: true,
        isAdmin: true,
        walletBalance: true,
        isAi: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log('최근 가입 유저 10명:');
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error fetching users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
