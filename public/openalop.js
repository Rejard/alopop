// OpenAlop Remote Agent Client
// Run this file on your local PC to connect it to the Alopop network.

const { execSync, exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// Auto-install socket.io-client if it's missing
try {
  require.resolve("socket.io-client");
} catch (e) {
  console.log("📦 Installing required dependency: socket.io-client...");
  execSync("npm install socket.io-client --no-save", { stdio: "inherit" });
}

const { io } = require("socket.io-client");

// Parse arguments
const args = process.argv.slice(2);
let token = null;
let serverUrl = "https://alopop.alonics.com";

for (const arg of args) {
  if (arg.startsWith("--token=")) {
    token = arg.split("=")[1];
  } else if (arg.startsWith("--server=")) {
    serverUrl = arg.split("=")[1];
  }
}

if (!token) {
  console.error("❌ Error: --token argument is required.");
  console.log("Usage: node openalop.js --token=YOUR_AGENT_TOKEN");
  process.exit(1);
}

console.log(`🔗 Connecting to OpenAlop Server: ${serverUrl}...`);
const socket = io(serverUrl, {
  auth: { token },
  transports: ["websocket", "polling"],
});

socket.on("connect", () => {
  console.log(`\n✅ Connected to Alopop Server successfully!`);
  console.log(`🤖 OpenAlo Agent is ready and waiting for instructions from the chat...`);
  console.log(`📂 Current working directory: ${process.cwd()}\n`);
});

socket.on("auth_error", (data) => {
  console.error("\n❌ Authentication Failed:", data.error);
  console.log("Please check your Agent Token and try again.");
  process.exit(1);
});

socket.on("disconnect", (reason) => {
  console.log(`\n❌ Disconnected from server: ${reason}`);
  console.log("Attempting to reconnect...");
});

// Listen for tool execution requests from the server
socket.on("execute_tool", async (data, callback) => {
  const { tool, args: toolArgs } = data;
  console.log(`\n🔧 [Server Request] Executing tool: ${tool}`);
  console.log(`📦 Arguments:`, JSON.stringify(toolArgs));

  try {
    let result = null;
    
    if (tool === "run_command") {
      if (!toolArgs || !toolArgs.command) throw new Error("Missing required argument: command");
      result = await new Promise((resolve) => {
        exec(toolArgs.command, { cwd: process.cwd() }, (error, stdout, stderr) => {
          resolve({
            stdout: stdout || "",
            stderr: stderr || "",
            error: error ? error.message : null
          });
        });
      });
    } 
    else if (tool === "read_file") {
      if (!toolArgs || !toolArgs.path) throw new Error("Missing required argument: path");
      const filePath = path.resolve(process.cwd(), toolArgs.path);
      const content = fs.readFileSync(filePath, "utf-8");
      result = { content: content.substring(0, 10000) }; // Limit return size
    } 
    else if (tool === "write_file") {
      if (!toolArgs || !toolArgs.path || toolArgs.content === undefined) throw new Error("Missing required argument: path or content");
      const filePath = path.resolve(process.cwd(), toolArgs.path);
      if (!filePath.toLowerCase().startsWith(process.cwd().toLowerCase())) {
        throw new Error("Access denied: Cannot write files outside of the configured working directory.");
      }
      fs.writeFileSync(filePath, toolArgs.content, "utf-8");
      result = { success: true, message: `File written to ${filePath}` };
    } 
    else if (tool === "list_dir") {
      const dirPath = path.resolve(process.cwd(), (toolArgs && toolArgs.path) ? toolArgs.path : ".");
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      const list = files.map(f => `${f.isDirectory() ? "[DIR]" : "[FILE]"} ${f.name}`);
      result = { files: list };
    } 
    else {
      throw new Error(`Unknown tool: ${tool}`);
    }

    console.log(`✅ Tool ${tool} completed. Sending results to server...`);
    callback(result);
  } catch (err) {
    console.error(`❌ Tool execution error:`, err);
    callback({ error: err.message || String(err) });
  }
});
