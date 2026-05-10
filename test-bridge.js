// OpenClaw-Alopop Bridge Client
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

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
  console.log(`\n💬 [Alopop] Received task: ${message}`);
  
  if (!isClawConnected) {
    console.error("❌ OpenClaw is not connected.");
    return;
  }

  const finalMessage = role ? `[당신의 페르소나 및 역할 지시사항: ${role}]\n\n${message}` : message;

  console.log(`🚀 Executing: openclaw agent --agent main -m "..."`);
  
  let child;
  if (process.platform === 'win32') {
    try {
      const npmRoot = execSync('npm root -g').toString().trim();
      const openclawScript = path.join(npmRoot, 'openclaw', 'openclaw.mjs');
      child = spawn('node', [openclawScript, 'agent', '--agent', 'main', '-m', finalMessage]);
    } catch (err) {
      console.log("⚠️ Could not find global openclaw.mjs. Falling back to openclaw.cmd...");
      // Fallback
      child = spawn('openclaw.cmd', ["agent", "--agent", "main", "-m", finalMessage], { shell: true });
    }
  } else {
    child = spawn('openclaw', ["agent", "--agent", "main", "-m", finalMessage]);
  }

  let finalOutput = "";

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    finalOutput += chunk.toString();
    alopopSocket.emit("claw_message", { content: chunk.toString() });
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    alopopSocket.emit("claw_message", { content: chunk.toString() });
  });

  child.on("close", (code) => {
    console.log(`✅ Task finished with code ${code}`);
    if (roomId) {
      const out = finalOutput.trim() ? finalOutput.trim() : `✅ 바탕화면 제어 작업이 완료되었습니다. (종료 코드: ${code})\n(에이전트가 반환한 텍스트 메시지가 없습니다.)`;
      alopopSocket.emit("claw_task_complete", { roomId, finalOutput: out });
    }
    
    // Remove the global child reference once finished
    if (globalChild === child) globalChild = null;
  });
  
  // Store a global reference to kill it on SIGINT
  globalChild = child;
});

let globalChild = null;

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
});

alopopSocket.on("execute_claw", (data, callback) => {
  // Backwards compatibility for UI test connections
  if (callback) callback({ success: true, message: "Use agent_task for actual commands." });
});
