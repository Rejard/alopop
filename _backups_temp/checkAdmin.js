const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({where: {email: 'lemaiiisk@gmail.com'}});
  console.log('user:', user);

  if (user && !user.isAdmin) {
    const updated = await prisma.user.update({
      where: { email: 'lemaiiisk@gmail.com' },
      data: { isAdmin: true }
    });
    console.log('updated:', updated);
  }
}
main().finally(() => prisma.$disconnect());
