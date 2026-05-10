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

function sendScreenshot() {
  screenshot({ format: "jpeg", quality: 60 }).then((img) => {
    const base64Image = "data:image/jpeg;base64," + img.toString("base64");
    alopopSocket.emit("claw_canvas", { data: base64Image });
  }).catch((err) => {
    console.error("Screen capture failed:", err);
  });
}

function connectClaw() {
  console.log(`🔌 Connecting to local OpenClaw Gateway: ${clawUrl}...`);
  clawSocket = new WebSocket(clawUrl);

  clawSocket.on("open", () => {
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
    console.log("❌ Disconnected from OpenClaw Gateway. Reconnecting in 5s...");
    setTimeout(connectClaw, 5000);
  });

  clawSocket.on("error", (err) => {
    console.error("❌ OpenClaw WebSocket error:", err.message);
  });
}

alopopSocket.on("connect", () => {
  console.log(`✅ Connected to Alopop Server successfully!`);
  if (!isClawConnected) connectClaw();
});

alopopSocket.on("auth_error", (data) => {
  console.error("\n❌ Authentication Failed:", data.error);
  process.exit(1);
});

alopopSocket.on("disconnect", (reason) => {
  console.log(`\n❌ Disconnected from Alopop server: ${reason}`);
});

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
  if (!isClawConnected) {
    console.error("❌ OpenClaw is not connected.");
    return;
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
      // Tell the server the task is 'complete' so the UI stops loading state
      if (roomId) alopopSocket.emit("claw_task_complete", { roomId, finalOutput: "🛑 강제 중지됨" });
      return;
    }

    console.log("⚠️ 에이전트가 이미 작업 중이므로 새 명령을 무시합니다.");
    alopopSocket.emit("claw_message", { content: "⚠️ 현재 에이전트가 이전 작업을 열심히 수행 중입니다! 작업이 완전히 끝난 후 새 명령을 내려주시거나, 강제로 멈추시려면 채팅창에 **!중지** 를 입력해 주세요." });
    
    // We must emit claw_task_complete here for the rejected task, so the server doesn't wait forever for this specific event.
    if (roomId) alopopSocket.emit("claw_task_complete", { roomId, finalOutput: "(이전 작업 수행 중으로 인해 명령이 무시되었습니다.)" });
    return;
  }

  let child;
  if (process.platform === 'win32') {
    try {
      const npmRoot = execSync('npm root -g').toString().trim();
      const openclawScript = path.join(npmRoot, 'openclaw', 'openclaw.mjs');
      const crypto = require('crypto');
      const sessionId = crypto.randomUUID();
      child = spawn('node', [openclawScript, 'agent', '--agent', 'main', '--session-id', sessionId, '--timeout', '600', '--thinking', 'off', '--verbose', 'on', '-m', finalMessage]);
    } catch (err) {
      console.log("⚠️ Could not find global openclaw.mjs. Falling back to openclaw.cmd...");
      // Fallback
      child = spawn('openclaw.cmd', ["agent", "--agent", "main", "--session-id", require('crypto').randomUUID(), "--timeout", "600", "--thinking", "off", "--verbose", "on", "-m", finalMessage], { shell: true });
    }
  } else {
    const crypto = require('crypto');
    const sessionId = crypto.randomUUID();
    child = spawn('openclaw', ['agent', '--agent', 'main', '--session-id', sessionId, '--timeout', '600', '--thinking', 'off', '-m', finalMessage]);
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

  child.stdout.on("data", (chunk) => {
    resetInactivityTimer(); // 출력이 오면 타이머 리셋
    stdoutBuffer += chunk.toString();
    let lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop(); // Keep the last incomplete line

    let filteredLines = lines.filter(line => {
      const lower = line.toLowerCase();
      if (lower.includes('[plugins] loading')) return false;
      if (lower.includes('[plugins] loaded')) return false;
      if (lower.includes('registered plugin command:')) return false;
      return true;
    });

    if (filteredLines.length > 0) {
      const out = filteredLines.join('\n') + '\n';
      process.stdout.write(out);
      finalOutput += out;
      alopopSocket.emit("claw_message", { content: out });
    }
  });

  child.stderr.on("data", (chunk) => {
    resetInactivityTimer(); // 출력이 오면 타이머 리셋
    stderrBuffer += chunk.toString();
    let lines = stderrBuffer.split('\n');
    stderrBuffer = lines.pop(); // Keep the last incomplete line

    let filteredLines = lines.filter(line => {
      const lower = line.toLowerCase();
      if (lower.includes('[plugins] loading')) return false;
      if (lower.includes('[plugins] loaded')) return false;
      if (lower.includes('registered plugin command:')) return false;
      return true;
    });

    if (filteredLines.length > 0) {
      const out = filteredLines.join('\n') + '\n';
      process.stderr.write(out);
      alopopSocket.emit("claw_message", { content: out });
    }
  });

  child.on("close", (code) => {
    // 타임아웃 타이머 정리
    clearTimeout(inactivityTimer);

    // Flush remaining buffers
    if (stdoutBuffer) {
      const lower = stdoutBuffer.toLowerCase();
      if (!lower.includes('[plugins] loading') && !lower.includes('[plugins] loaded') && !lower.includes('registered plugin command:')) {
        const out = stdoutBuffer + '\n';
        process.stdout.write(out);
        finalOutput += out;
        alopopSocket.emit("claw_message", { content: out });
      }
    }
    if (stderrBuffer) {
      const lower = stderrBuffer.toLowerCase();
      if (!lower.includes('[plugins] loading') && !lower.includes('[plugins] loaded') && !lower.includes('registered plugin command:')) {
        const out = stderrBuffer + '\n';
        process.stderr.write(out);
        alopopSocket.emit("claw_message", { content: out });
      }
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
