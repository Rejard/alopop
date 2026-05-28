import fs from 'fs';

const config = JSON.parse(fs.readFileSync('chaos_config.json', 'utf8'));
const URL = 'http://127.0.0.1:3099/api/chat/sponsor';

console.log(`🚀 Bravo Agent (API 난사/금융 해커) starting...`);

// 5명의 유저를 공격자로 선정
const attackers = config.users.slice(1, 6);

async function attack(user) {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-alopop-internal': 'ALO_POP_INTERNAL_SECRET_DEFAULT' // 테스트용 시크릿
      },
      body: JSON.stringify({
        roomId: config.roomId,
        message: {
          senderId: user.id,
          content: "Tell me a joke",
          messageType: 'TEXT'
        }
      })
    });
    
    if (res.status === 429) {
      process.stdout.write('🛡️'); // 방어 성공
    } else if (res.status === 200) {
      const data = await res.json();
      if (data.error === 'INSUFFICIENT_FUNDS') process.stdout.write('💸'); // 잔액 부족 튕김
      else process.stdout.write('✅');
    } else {
      process.stdout.write('❌');
    }
  } catch (e) {
    process.stdout.write('💥');
  }
}

// 1초마다 1인당 10번씩 총 50번의 API 폭격을 가함 (Rate Limiter가 대부분 막아야 함)
setInterval(() => {
  attackers.forEach(user => {
    for(let i=0; i<10; i++) attack(user);
  });
}, 1000);
