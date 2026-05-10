// OpenClaw-Alopop Bridge Client
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

let globalChild = null;

// Auto-install dependencies and restart if needed
let missingDeps = false;
try { require.resolve("socket.io-client"); require.resolve("ws"); require.resolve("screenshot-desktop"); } catch (e) { missingDeps = true; }

if (missingDeps) {
  console.log("📦 Installing required dependencies locally...");
  execSync("npm install socket.io-client ws screenshot-desktop --no-save", { stdio: "inherit" });
  console.log("🔄 Restarting bridge script with new dependencies...");
  // Restart the current script with the exact same arguments
  execSync(`node "${__filename}" ${process.argv.slice(2).join(" ")}`, { stdio: "inherit" });
  process.exit(0);
}

const { io } = require("socket.io-client");
const WebSocket = require("ws");
const screenshot = require("screenshot-desktop");

const args = process.argv.slice(2);
let token = null;
let serverUrl = "http://localhost:3000"; // Default local
let clawUrl = "ws://127.0.0.1:18789";
let role = null;

for (const arg of args) {
  if (arg.startsWith("--token=")) token = arg.substring(8);
  else if (arg.startsWith("--server=")) serverUrl = arg.substring(9);
  else if (arg.startsWith("--claw=")) clawUrl = arg.substring(7);
  else if (arg.startsWith("--role=")) role = arg.substring(7);
}

if (!token) {
  console.error("❌ Error: --token argument is required.");
  process.exit(1);
}

// Get OpenClaw config token
let openclawToken = "";
try {
  const configPath = path.join(process.env.USERPROFILE || process.env.HOME, ".openclaw", "openclaw.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  openclawToken = config.gateway.auth.token;
} catch (e) {
  console.log("⚠️ Could not read OpenClaw config token. Gateway connection might fail.");
}

console.log(`🔗 Connecting to Alopop Server: ${serverUrl}...`);
const alopopSocket = io(serverUrl, { auth: { token }, transports: ["websocket", "polling"] });

let clawSocket = null;
let isClawConnected = false;
let canvasHostUrl = null;
let canvasInterval = null;
let clawRetryCount = 0;
const CLAW_MAX_RETRIES = 3;

function sendScreenshot() {
  screenshot({ format: "jpeg", quality: 60 }).then((img) => {
    const base64Image = "data:image/jpeg;base64," + img.toString("base64");
    alopopSocket.emit("claw_canvas", { data: base64Image });
  }).catch((err) => {
    console.error("Screen capture failed:", err);
  });
}

function connectClaw() {
  if (clawRetryCount >= CLAW_MAX_RETRIES) {
    console.log(`ℹ️ OpenClaw Gateway 연결 ${CLAW_MAX_RETRIES}회 실패 → 스크린 스트리밍 없이 Agent-Only 모드로 동작합니다.`);
    return;
  }
  clawRetryCount++;
  console.log(`🔌 Connecting to local OpenClaw Gateway (${clawRetryCount}/${CLAW_MAX_RETRIES}): ${clawUrl}...`);
  clawSocket = new WebSocket(clawUrl);

  clawSocket.on("open", () => {
    clawRetryCount = 0; // 연결 성공 시 카운터 리셋
    console.log("🔄 Sending WS Handshake to OpenClaw Gateway...");
  });

  clawSocket.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.event === "connect.challenge") {
        const req = {
          type: "req",
          id: "1",
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: { id: "gateway-client", version: "1.0.0", platform: process.platform, mode: "backend" },
            role: "operator",
            scopes: ["operator.read", "operator.write", "operator.admin"],
            auth: { token: openclawToken }
          }
        };
        clawSocket.send(JSON.stringify(req));
      }
      
      if (msg.payload && msg.payload.type === "hello-ok") {
        isClawConnected = true;
        console.log("✅ Connected to OpenClaw Gateway!");
        if (!canvasInterval) {
            console.log(`📺 Real-time Screen Streaming started...`);
            canvasInterval = setInterval(sendScreenshot, 3000);
        }
      }
    } catch (e) {
      console.error("Failed to parse OpenClaw message:", e);
    }
  });

  clawSocket.on("close", () => {
    isClawConnected = false;
    clearInterval(canvasInterval);
    canvasInterval = null;
    if (clawRetryCount < CLAW_MAX_RETRIES) {
      console.log(`❌ OpenClaw Gateway 연결 끊김. ${5}초 후 재시도...`);
      setTimeout(connectClaw, 5000);
    } else {
      console.log(`ℹ️ OpenClaw Gateway 연결 ${CLAW_MAX_RETRIES}회 실패 → Agent-Only 모드로 전환.`);
    }
  });

  clawSocket.on("error", (err) => {
    // 에러는 close 이벤트에서 재시도하므로 여기서는 조용히 로깅만
    if (clawRetryCount <= 1) console.error("❌ OpenClaw Gateway 연결 실패:", err.message);
  });
}

alopopSocket.on("connect", () => {
  console.log(`✅ Connected to Alopop Server successfully!`);
  console.log(`🤖 OpenClaw Agent 대기 중... 알로팝에서 명령을 보내주세요!`);
  // Gateway 연결은 --claw 플래그로 명시적으로 요청한 경우에만 시도
  const hasClawFlag = args.some(a => a.startsWith("--claw="));
  if (hasClawFlag && !isClawConnected) {
    connectClaw();
  }
});

alopopSocket.on("auth_error", (data) => {
  console.error("\n❌ Authentication Failed:", data.error);
  process.exit(1);
});

alopopSocket.on("disconnect", (reason) => {
  console.log(`\n❌ Disconnected from Alopop server: ${reason}`);
});

// 채팅방별 세션 ID 저장소 (대화 연속성 유지)
const roomSessions = new Map();

function getSessionId(roomId) {
  if (!roomId) return require('crypto').randomUUID();
  if (!roomSessions.has(roomId)) {
    roomSessions.set(roomId, require('crypto').randomUUID());
  }
  return roomSessions.get(roomId);
}

function resetSession(roomId) {
  if (roomId && roomSessions.has(roomId)) {
    roomSessions.delete(roomId);
    console.log(`🔄 세션 리셋: ${roomId}`);
  }
}

// Listen for chat messages
alopopSocket.on("agent_task", (data) => {
  const { message, roomId } = data;

  // ---- 메시지 정제: 시스템 쓰레기 제거, 마지막 사용자 명령만 추출 ----
  let cleanedMessage = message;
  if (typeof message === 'string') {
    const lines = message.split('\n');
    const cleanLines = lines.filter(line => {
      const trimmed = line.trim();
      // Remove [undefined]: system completion messages
      if (trimmed.startsWith('[undefined]:')) return false;
      // Remove standalone completion notices
      if (trimmed.includes('바탕화면 제어 작업이 완료되었습니다')) return false;
      if (trimmed.includes('에이전트가 반환한 텍스트 메시지가 없습니다')) return false;
      if (trimmed.includes('종료 코드:')) return false;
      if (trimmed === '(에이전트가 반환한 텍스트 메시지가 없습니다.)') return false;
      // Remove forced-stop system messages
      if (trimmed.includes('강제 중지됨')) return false;
      if (trimmed.includes('이전 작업 수행 중으로 인해 명령이 무시되었습니다')) return false;
      return true;
    });
    cleanedMessage = cleanLines.join('\n').trim();

    // If after cleaning, extract only the last actual user command
    // Chat context format: [username]: message
    const userLines = cleanLines.filter(l => {
      const t = l.trim();
      return t.match(/^\[.+\]:/) && !t.startsWith('[undefined]:') && !t.startsWith('[system]:');
    });
    if (userLines.length > 0) {
      // Use only the last user message to avoid context pollution
      const lastUserLine = userLines[userLines.length - 1];
      const colonIdx = lastUserLine.indexOf(':');
      cleanedMessage = colonIdx > 0 ? lastUserLine.substring(colonIdx + 1).trim() : lastUserLine;
    }
  }

  // If message is completely empty after cleaning, ignore it
  if (!cleanedMessage) {
    console.log("⚠️ 메시지가 비어 있어 무시합니다 (시스템 쓰레기만 존재).");
    if (roomId) alopopSocket.emit("claw_task_complete", { roomId, finalOutput: "(빈 명령 무시됨)" });
    return;
  }

  console.log(`\n======================================================`);
  console.log(`💬 [Alopop -> OpenClaw] 타겟 명령 수신됨!!`);
  console.log(`정제된 명령: ${cleanedMessage}`);
  console.log(`======================================================\n`);
  // Gateway 연결 여부와 무관하게 agent는 child_process로 직접 실행
  if (!isClawConnected) {
    console.log("ℹ️ OpenClaw Gateway 미연결 상태 (스크린 스트리밍 비활성). Agent는 직접 실행합니다.");
  }

  const baseMessage = role ? `[당신의 페르소나 및 역할 지시사항: ${role}]\n\n${cleanedMessage}` : cleanedMessage;
  const finalMessage = `[현재 터미널 실행 위치: ${process.cwd()}]\n\n${baseMessage}`;

  console.log(`🚀 [실행 중] 명령을 에이전트에 전달합니다...\n전달할 전체 텍스트: ${finalMessage}\n`);
  
  if (globalChild) {
    if (message.includes("!중지") || message.includes("!stop") || message.includes("!kill")) {
      console.log("⚠️ 사용자의 중지 명령으로 에이전트를 강제 종료합니다.");
      globalChild.isKilledByUser = true;
      try {
        globalChild.kill();
      } catch(e) {}
      globalChild = null;
      alopopSocket.emit("claw_message", { content: "🛑 에이전트 작업이 사용자에 의해 강제 중지되었습니다." });
      if (roomId) alopopSocket.emit("claw_task_complete", { roomId, finalOutput: "🛑 강제 중지됨" });
      return;
    }

    console.log("⚠️ 에이전트가 이미 작업 중이므로 새 명령을 무시합니다.");
    alopopSocket.emit("claw_message", { content: "⚠️ 현재 에이전트가 이전 작업을 열심히 수행 중입니다! 작업이 완전히 끝난 후 새 명령을 내려주시거나, 강제로 멈추시려면 채팅창에 **!중지** 를 입력해 주세요." });
    
    // We must emit claw_task_complete here for the rejected task, so the server doesn't wait forever for this specific event.
    if (roomId) alopopSocket.emit("claw_task_complete", { roomId, finalOutput: "(이전 작업 수행 중으로 인해 명령이 무시되었습니다.)" });
    return;
  }

  // !새대화 명령으로 세션 리셋
  if (cleanedMessage === '!새대화' || cleanedMessage === '!reset') {
    resetSession(roomId);
    alopopSocket.emit("claw_message", { content: "🔄 새로운 대화 세션을 시작합니다!" });
    if (roomId) alopopSocket.emit("claw_task_complete", { roomId, finalOutput: "🔄 세션 리셋 완료" });
    return;
  }

  // 채팅방 기반 세션 ID (같은 방에서는 대화 기억 유지)
  const sessionId = getSessionId(roomId);
  console.log(`🧠 세션: ${sessionId.substring(0, 8)}... (방: ${roomId || 'none'})`);

  let child;
  if (process.platform === 'win32') {
    try {
      const npmRoot = execSync('npm root -g').toString().trim();
      const openclawScript = path.join(npmRoot, 'openclaw', 'openclaw.mjs');
      child = spawn('node', [openclawScript, 'agent', '--local', '--agent', 'main', '--session-id', sessionId, '--timeout', '600', '--thinking', 'off', '--verbose', 'on', '-m', finalMessage]);
    } catch (err) {
      console.log("⚠️ Could not find global openclaw.mjs. Falling back to openclaw.cmd...");
      child = spawn('openclaw.cmd', ["agent", "--local", "--agent", "main", "--session-id", sessionId, "--timeout", "600", "--thinking", "off", "--verbose", "on", "-m", finalMessage], { shell: true });
    }
  } else {
    child = spawn('openclaw', ['agent', '--local', '--agent', 'main', '--session-id', sessionId, '--timeout', '600', '--thinking', 'off', '-m', finalMessage]);
  }

  // 🖥️ 에이전트 작업 중 실시간 스크린 스트리밍 시작 (gateway 불필요)
  if (!canvasInterval) {
    console.log(`📺 실시간 스크린 스트리밍 시작...`);
    canvasInterval = setInterval(sendScreenshot, 3000);
  }

  let finalOutput = "";
  let stdoutBuffer = "";
  let stderrBuffer = "";

  // ---- 자동 타임아웃: 5분간 출력 없으면 멈춘 것으로 간주하고 강제 종료 ----
  const INACTIVITY_TIMEOUT_MS = 300 * 1000; // 5분
  let inactivityTimer = setTimeout(() => {
    if (globalChild === child) {
      console.log("⏰ [타임아웃] 에이전트가 5분간 응답 없음 → 자동 강제 종료합니다.");
      child.isTimedOut = true;
      try { child.kill(); } catch(e) {}
      globalChild = null;
      alopopSocket.emit("claw_message", { content: "⏰ 에이전트가 5분간 응답이 없어 자동으로 중단되었습니다. 다시 명령을 내려주세요." });
      if (roomId) alopopSocket.emit("claw_task_complete", { roomId, finalOutput: "⏰ 타임아웃 (5분 무응답)" });
    }
  }, INACTIVITY_TIMEOUT_MS);

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      if (globalChild === child) {
        console.log("⏰ [타임아웃] 에이전트가 5분간 응답 없음 → 자동 강제 종료합니다.");
        child.isTimedOut = true;
        try { child.kill(); } catch(e) {}
        globalChild = null;
        alopopSocket.emit("claw_message", { content: "⏰ 에이전트가 5분간 응답이 없어 자동으로 중단되었습니다. 다시 명령을 내려주세요." });
        if (roomId) alopopSocket.emit("claw_task_complete", { roomId, finalOutput: "⏰ 타임아웃 (5분 무응답)" });
      }
    }, INACTIVITY_TIMEOUT_MS);
  }

  // OpenClaw 내부 노이즈 로그 필터 (사용자에게 불필요한 진단 메시지 차단)
  function isNoiseLine(line) {
    const lower = line.toLowerCase().trim();
    if (!lower) return true;
    if (lower.includes('[plugins] loading')) return true;
    if (lower.includes('[plugins] loaded')) return true;
    if (lower.includes('registered plugin command:')) return true;
    if (lower.includes('[diagnostic]')) return true;
    if (lower.includes('[agent/embedded]')) return true;
    if (lower.includes('[agents/harness]')) return true;
    if (lower.startsWith('gateway client error:')) return true;
    if (lower.startsWith('embedded fallback:')) return true;
    if (lower.startsWith('gateway target:')) return true;
    if (lower.startsWith('source:')) return true;
    if (lower.startsWith('config:')) return true;
    if (lower.startsWith('bind:')) return true;
    if (lower.startsWith('possible causes:')) return true;
    if (lower.startsWith('- gateway')) return true;
    if (lower.startsWith('- tls mismatch')) return true;
    if (lower.includes('run `openclaw doctor`')) return true;
    if (lower.includes('gatewatransporterror')) return true;
    if (lower.includes('gateway closed')) return true;
    if (lower.includes('no close reason')) return true;
    if (lower.includes('abnormal closure')) return true;
    return false;
  }

  child.stdout.on("data", (chunk) => {
    resetInactivityTimer();
    stdoutBuffer += chunk.toString();
    let lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop();

    let filteredLines = lines.filter(line => !isNoiseLine(line));

    if (filteredLines.length > 0) {
      const out = filteredLines.join('\n') + '\n';
      process.stdout.write(out);
      finalOutput += out;
      alopopSocket.emit("claw_message", { content: out });
    }
  });

  child.stderr.on("data", (chunk) => {
    resetInactivityTimer();
    stderrBuffer += chunk.toString();
    let lines = stderrBuffer.split('\n');
    stderrBuffer = lines.pop();

    let filteredLines = lines.filter(line => !isNoiseLine(line));

    if (filteredLines.length > 0) {
      const out = filteredLines.join('\n') + '\n';
      process.stderr.write(out);
      alopopSocket.emit("claw_message", { content: out });
    }
  });

  child.on("close", (code) => {
    // 타임아웃 타이머 정리
    clearTimeout(inactivityTimer);

    // 🖥️ 스크린 스트리밍 중지
    if (canvasInterval) {
      clearInterval(canvasInterval);
      canvasInterval = null;
      console.log(`📺 스크린 스트리밍 종료.`);
    }

    // Flush remaining buffers
    if (stdoutBuffer && !isNoiseLine(stdoutBuffer)) {
      const out = stdoutBuffer + '\n';
      process.stdout.write(out);
      finalOutput += out;
      alopopSocket.emit("claw_message", { content: out });
    }
    if (stderrBuffer && !isNoiseLine(stderrBuffer)) {
      const out = stderrBuffer + '\n';
      process.stderr.write(out);
      alopopSocket.emit("claw_message", { content: out });
    }

    console.log(`✅ Task finished with code ${code}`);
    if (roomId && !child.isKilledByUser && !child.isTimedOut) {
      const out = finalOutput.trim() ? finalOutput.trim() : `✅ 작업이 완료되었습니다. (종료 코드: ${code})`;
      alopopSocket.emit("claw_task_complete", { roomId, finalOutput: out });
    }
    
    // Remove the global child reference once finished
    if (globalChild === child) globalChild = null;
  });
  
  // Store a global reference to kill it on SIGINT
  globalChild = child;
});

// Ensure child processes are killed when the user presses Ctrl+C or the bridge exits
process.on("SIGINT", () => {
  if (globalChild) {
    console.log("\n⚠️ Caught SIGINT! Killing running openclaw agent to prevent zombie processes...");
    globalChild.kill();
  }
  process.exit();
});

process.on("exit", () => {
  if (globalChild) {
    globalChild.kill();
  }
});

alopopSocket.on("execute_claw", (data, callback) => {
  if (callback) callback({ success: true, message: "Use agent_task for actual commands." });
});
