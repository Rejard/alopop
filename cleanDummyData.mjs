import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Cleaning up chaos dummy data...");
  const deletedUsers = await prisma.user.deleteMany({
    where: { username: { startsWith: 'ChaosBot_' } }
  });
  const deletedRooms = await prisma.room.deleteMany({
    where: { name: '[TEST] Chaos Doom Room' }
  });
  console.log(`✅ Deleted ${deletedUsers.count} users and ${deletedRooms.count} rooms.`);
  
  if (fs.existsSync('chaos_config.json')) {
    fs.unlinkSync('chaos_config.json');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
