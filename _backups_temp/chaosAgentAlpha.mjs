import { io } from 'socket.io-client';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('chaos_config.json', 'utf8'));
const URL = 'http://127.0.0.1:3099';

console.log(`🚀 Alpha Agent (소켓 폭격기) starting with ${config.users.length} clients...`);

const sockets = [];
config.users.forEach(user => {
  const socket = io(URL, { query: { userId: user.id } });
  
  socket.on('connect', () => {
    socket.emit('register', user.id);
    socket.emit('join_room', config.roomId);
  });
  
  sockets.push(socket);
});

// 1초마다 50%의 확률로 메시지 전송 (초당 약 50건의 메시지, 서버 내부적으로는 5,000건의 브로드캐스팅)
setInterval(() => {
  sockets.forEach(socket => {
    if (socket.connected && Math.random() < 0.5) {
      socket.emit('send_message', {
        roomId: config.roomId,
        senderId: socket.io.opts.query.userId,
        content: `Chaos Alpha Attack! Random: ${Math.random()}`,
        messageType: 'TEXT'
      });
    }
  });
}, 1000);
