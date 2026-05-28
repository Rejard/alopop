import { io } from 'socket.io-client';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('chaos_config.json', 'utf8'));
const URL = 'http://127.0.0.1:3099';

console.log(`🚀 Charlie Agent (유령 유저 / 연결 끊기 봇) starting...`);

const ghostUsers = config.users.slice(6, 16); // 10 users

setInterval(() => {
  ghostUsers.forEach(user => {
    // 매번 새로운 소켓 생성
    const socket = io(URL, { query: { userId: user.id }, forceNew: true });
    socket.on('connect', () => {
      socket.emit('register', user.id);
      socket.emit('join_room', config.roomId);
      
      // 0.1초 ~ 0.6초 사이에 강제로 연결을 끊어버림 (오프라인 상태로 만들기)
      setTimeout(() => {
        socket.disconnect();
      }, Math.random() * 500 + 100);
    });
  });
}, 2000); // 2초마다 10명이 동시에 들어왔다가 팅기는 행위 반복
