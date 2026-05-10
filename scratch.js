const http = require('http');

// First, get the gateway token
const token = "cfe14a56c62eed60095fb3555ecc92b2af814637a3e9a428";

const WebSocket = require('ws');
const gatewayWs = new WebSocket("ws://127.0.0.1:18789", {
  headers: { Authorization: "Bearer " + token }
});

gatewayWs.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.event === "connect.challenge") {
    gatewayWs.send(JSON.stringify({
      type: "req",
      id: "1",
      method: "connect",
      params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: "test", version: "1.0", platform: "win32", mode: "backend" },
        role: "operator",
        scopes: ["operator.read", "operator.write", "operator.admin"],
        auth: { token: token },
        caps: ["canvas"]
      }
    }));
  }

  if (msg.type === "res" && msg.ok && msg.payload && msg.payload.type === "hello-ok") {
    const base = msg.payload.canvasHostUrl;
    console.log("Canvas Host URL:", base);
    
    // Test fetching UI with the canvas URL AND the gateway token
    const fullUrl = base + '/__openclaw__/canvas?token=' + token;
    console.log("Full URL:", fullUrl);
    http.get(fullUrl, (res) => {
      console.log('canvas HTTP Status:', res.statusCode);
      let buf = [];
      res.on('data', d => buf.push(d));
      res.on('end', () => {
         console.log('canvas data len:', Buffer.concat(buf).toString().length);
         process.exit(0);
      });
    }).on('error', e => console.error(e));
  }
});
