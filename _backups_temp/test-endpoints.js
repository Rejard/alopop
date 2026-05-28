const WebSocket = require('ws');
const http = require('http');

const gatewayWs = new WebSocket("ws://127.0.0.1:18789", {
  headers: { Authorization: "Bearer cfe14a56c62eed60095fb3555ecc92b2af814637a3e9a428" }
});

gatewayWs.on('error', e => console.error("WS error:", e));

gatewayWs.on('open', () => {
  console.log("WS open");
  gatewayWs.send(JSON.stringify({
    id: "req-1",
    method: "hello",
    payload: { role: "client", capabilities: ["canvas"] }
  }));
});

gatewayWs.on('message', (data) => {
  console.log("Got message:", data.toString());
  const msg = JSON.parse(data.toString());
  if (msg.payload && msg.payload.type === "hello-ok") {
    const base = msg.payload.canvasHostUrl;
    console.log("Base:", base);
    
    // Fetch /__openclaw__/canvas
    http.get(base + '/__openclaw__/canvas', (res) => {
      console.log('canvas HTTP Status:', res.statusCode);
      // Fetch /__openclaw__/a2ui
      http.get(base + '/__openclaw__/a2ui', (res2) => {
        console.log('a2ui HTTP Status:', res2.statusCode);
        process.exit(0);
      });
    }).on('error', e => console.error("HTTP error:", e));
  }
});
