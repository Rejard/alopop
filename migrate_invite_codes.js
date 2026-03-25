const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function generateInviteCode() { // 대문자 영문 + 숫자 조합 6자리
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function main() {
  const users = await prisma.user.findMany({
    where: { inviteCode: null }
  });

  console.log(`기존 유저 ${users.length}명의 초대 코드를 발급합니다.`);

  for (const user of users) {
    let code;
    let isUnique = false;
    
    while (!isUnique) {
      code = generateInviteCode();
      const existing = await prisma.user.findUnique({ where: { inviteCode: code } });
      if (!existing) {
        isUnique = true;
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { inviteCode: code }
    });
    console.log(`User ${user.username} (ID: ${user.id}) -> Invite Code: ${code}`);
  }

  console.log('초대 코드 마이그레이션이 완료되었습니다.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
