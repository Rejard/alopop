import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const userCount = parseInt(process.argv[2], 10) || 100;
  console.log(`🔥 Generating ${userCount} dummy users and a chaos room...`);
  
  const room = await prisma.room.create({
    data: {
      name: "[TEST] Chaos Doom Room",
      isGroup: true,
      sponsorMode: true,
      sponsorModel: "openai",
      sponsorPrice: 10
    }
  });

  const users = [];
  for (let i = 1; i <= userCount; i++) {
    const user = await prisma.user.create({
      data: {
        username: `ChaosBot_${i}`,
        walletBalance: 1000,
        isAdmin: false
      }
    });
    users.push(user);
    
    await prisma.roomMember.create({
      data: {
        userId: user.id,
        roomId: room.id,
        isHost: i === 1 
      }
    });
  }

  console.log(`✅ Created 100 users. Room ID: ${room.id}`);
  
  fs.writeFileSync('chaos_config.json', JSON.stringify({
    roomId: room.id,
    hostId: users[0].id,
    users: users.map(u => ({ id: u.id, username: u.username }))
  }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
