const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- [DB 스튜디오 조회 테스트] ---');
  try {
    const studios = await prisma.studio.findMany({
      take: 5,
      include: {
        owner: {
          select: {
            username: true
          }
        },
        logs: {
          take: 3
        },
        artifacts: {
          take: 3
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log('스튜디오 목록:');
    console.log(JSON.stringify(studios, null, 2));
  } catch (err) {
    console.error('Error fetching studios:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
