import { io } from 'socket.io-client';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('chaos_config.json', 'utf8'));
const URL = 'http://127.0.0.1:3099';

console.log(`🚀 Delta Agent (파괴자 / Fuzzer) starting...`);

const user = config.users[20];
const socket = io(URL, { query: { userId: user.id } });

socket.on('connect', () => {
  setInterval(() => {
    // 1. null 데이터 발송
    socket.emit('send_message', null);
    
    // 2. undefined 룸
    socket.emit('join_room', undefined);
    
    // 3. 쓰레기 JSON 포맷 발송
    socket.emit('register', { weird: 'object', hacker: true });
    
    // 4. 비정상적으로 큰 데이터 발송 (50KB)
    socket.emit('send_message', {
      roomId: 'fake-room-id-that-does-not-exist',
      senderId: 'fake-user-id',
      content: 'x'.repeat(50000) 
    });
  }, 500); // 0.5초마다 쓰레기 데이터를 마구 던짐
});
