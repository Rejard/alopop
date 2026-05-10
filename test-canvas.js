const WebSocket = require('ws');
const config = JSON.parse(require('fs').readFileSync('C:/Users/lemai/.openclaw/openclaw.json', 'utf8'));
const ws = new WebSocket('ws://127.0.0.1:18789');
ws.on('open', () => {
    ws.send(JSON.stringify({
        type: 'req',
        id: '1',
        method: 'connect',
        params: {
            minProtocol: 3, maxProtocol: 3,
            client: { id: 'test', version: '1.0.0', platform: 'win32', mode: 'backend' },
            role: 'operator', scopes: ['operator.read'],
            auth: { token: config.gateway.auth.token }
        }
    }));
});
ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.payload && msg.payload.type === 'hello-ok') {
        const url = msg.payload.canvasHostUrl;
        console.log('URL:', url);
        const http = require('http');
        http.get(url, (res) => {
            console.log('Content-Type:', res.headers['content-type']);
            res.on('data', c => {
                console.log('Got', c.length, 'bytes');
                console.log('Sample:', c.toString('utf8').substring(0, 100));
            });
            setTimeout(()=>process.exit(0), 1000);
        });
    }
});
