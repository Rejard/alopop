const fs = require('fs');
const path = require('path');

const base64Img = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const dummyImagePath = path.join(process.cwd(), 'public', 'uploads', 'dummy.png');

if (!fs.existsSync(path.join(process.cwd(), 'public', 'uploads'))) {
  fs.mkdirSync(path.join(process.cwd(), 'public', 'uploads'), { recursive: true });
}
fs.writeFileSync(dummyImagePath, Buffer.from(base64Img, 'base64'));

async function testApi() {
  const fetch = (await import('node-fetch')).default;
  try {
    const res = await fetch('http://localhost:3099/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: "Is this image a fake?",
        imageUrl: "/uploads/dummy.png",
        provider: "gemini-free"
      })
    });
    
    console.log("Status:", res.status);
    const json = await res.text();
    console.log("Response:", json);
  } catch(e) {
    console.error("Express Error:", e);
  }
}

testApi();
