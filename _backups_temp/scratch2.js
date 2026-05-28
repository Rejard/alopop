const http = require('http');

http.get('http://127.0.0.1:18789/', (res) => {
  console.log('GET / -> Status:', res.statusCode);
  let buf = '';
  res.on('data', d => buf += d);
  res.on('end', () => console.log('Length:', buf.length, 'Preview:', buf.substring(0, 100).replace(/\n/g, ' ')));
});

http.get('http://127.0.0.1:18789/ui/', (res) => {
  console.log('GET /ui/ -> Status:', res.statusCode);
  let buf = '';
  res.on('data', d => buf += d);
  res.on('end', () => console.log('Length:', buf.length, 'Preview:', buf.substring(0, 100).replace(/\n/g, ' ')));
});
