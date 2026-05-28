const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Update existing users walletBalance to 10,000...');
  
  const result = await prisma.user.updateMany({
    data: {
      walletBalance: 10000,
    },
  });
  
  console.log(`Successfully updated ${result.count} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
