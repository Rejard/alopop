const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    await prisma.systemSetting.upsert({
      where: { key: 'WELCOME_BONUS' },
      update: {},
      create: {
        key: 'WELCOME_BONUS',
        value: '100'
      }
    });
  }
  catch (error) {
  }
  finally {
    await prisma.$disconnect();
  }
}

main();