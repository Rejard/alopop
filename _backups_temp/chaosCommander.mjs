import { spawn, execSync } from 'child_process';
import fs from 'fs';

const userCount = parseInt(process.argv[2], 10) || 100;
const durationSec = parseInt(process.argv[3], 10) || 180;
const DURATION = durationSec * 1000;

fs.writeFileSync('chaos_log.txt', '');
fs.writeFileSync('chaos_status.json', JSON.stringify({ status: 'running', userCount, durationSec, startTime: Date.now() }));

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync('chaos_log.txt', line);
  process.stdout.write(line);
}

log("==================================================");
log(`☠️ INITIATING CHAOS APOCALYPSE (${durationSec} SEC TEST, ${userCount} USERS) ☠️`);
log("==================================================");

log("Generating dummy data...");
try {
  const out = execSync(`node createDummyData.mjs ${userCount}`, { encoding: 'utf8' });
  fs.appendFileSync('chaos_log.txt', out);
  log("Dummy data created.");
} catch (e) {
  log("Failed to create dummy data: " + e.message);
  if (e.stdout) fs.appendFileSync('chaos_log.txt', e.stdout);
  if (e.stderr) fs.appendFileSync('chaos_log.txt', e.stderr);
  fs.writeFileSync('chaos_status.json', JSON.stringify({ status: 'error', error: e.message }));
  process.exit(1);
}

const agents = [
  'chaosAgentAlpha.mjs', 
  'chaosAgentBravo.mjs', 
  'chaosAgentCharlie.mjs', 
  'chaosAgentDelta.mjs'
];
const processes = [];

agents.forEach(agent => {
  const p = spawn('node', [agent]);
  p.stdout.on('data', data => fs.appendFileSync('chaos_log.txt', data));
  p.stderr.on('data', data => fs.appendFileSync('chaos_log.txt', data));
  processes.push(p);
});

log(`⏱️ Chaos agents deployed. Running for ${durationSec} seconds...`);

setTimeout(() => {
  log("\n==================================================");
  log("🛑 HALTING CHAOS APOCALYPSE 🛑");
  log("==================================================");
  
  processes.forEach(p => {
    try { p.kill(); } catch(e) {}
  });
  
  log("Agents terminated. Cleaning up dummy data in 3 seconds...");
  setTimeout(() => {
    try {
      const out = execSync('node cleanDummyData.mjs', { encoding: 'utf8' });
      fs.appendFileSync('chaos_log.txt', out);
      log("🎉 All Done! Test completed.");
    } catch(e) {
      log("Cleanup failed: " + e.message);
    }
    fs.writeFileSync('chaos_status.json', JSON.stringify({ status: 'idle' }));
    process.exit(0);
  }, 3000);
}, DURATION);
