import fs from 'node:fs';

const policy = fs.existsSync('lib/sponsor-policy.ts') ? fs.readFileSync('lib/sponsor-policy.ts', 'utf8') : '';
const sponsorRoute = fs.readFileSync('app/api/chat/sponsor/route.ts', 'utf8');
const friendRoute = fs.readFileSync('app/api/chat/friend/route.ts', 'utf8');
const settingsRoute = fs.readFileSync('app/api/rooms/sponsor/route.ts', 'utf8');

const checks = [
  ['sponsor policy helper exists', policy.includes('resolveSponsorModel') && policy.includes('MAX_SPONSOR_PRICE')],
  ['sponsor route rejects env fallback', !/process\.env\.(OPENAI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|ANTHROPIC_API_KEY)/.test(sponsorRoute)],
  ['sponsor route charges after AI success in a transaction', sponsorRoute.indexOf('generateObject') < sponsorRoute.indexOf('prisma.$transaction')],
  ['friend route does not trust raw isDelegate alone', friendRoute.includes('resolveSponsorDelegateAccess')],
  ['settings route validates sponsor model allowlist', settingsRoute.includes('resolveSponsorModel')],
  ['settings route validates sponsor price ceiling', settingsRoute.includes('MAX_SPONSOR_PRICE')],
];

let failed = false;
for (const [name, pass] of checks) {
  if (pass) console.log(`PASS ${name}`);
  else {
    failed = true;
    console.error(`FAIL ${name}`);
  }
}

if (failed) process.exit(1);
