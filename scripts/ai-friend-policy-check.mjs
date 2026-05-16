import fs from 'node:fs';

const page = fs.readFileSync('app/page.tsx', 'utf8');
const friendRoute = fs.readFileSync('app/api/chat/friend/route.ts', 'utf8');

const checks = [
  [
    'sponsor rooms keep the user selected provider/model for AI friends',
    !page.includes('const friendProvider = isSponsorMode') && !page.includes('const friendAiModel = isSponsorMode'),
  ],
  [
    'friend route loads AI persona from the database',
    friendRoute.includes('aiPrompt: true') && friendRoute.includes('const personaPrompt ='),
  ],
  [
    'friend route resolves keys for the AI owner, not the delegate browser',
    friendRoute.includes('const effectiveAiUser =') && friendRoute.includes('recordFreeEventUsage(effectiveAiUser.id'),
  ],
  [
    'friend route applies sponsor fallback only after event/personal key resolution',
    friendRoute.indexOf('resolveAiKeyForRequest') < friendRoute.indexOf('let sponsorBilling'),
  ],
  [
    'friend route checks sponsor payer balance before generateText',
    friendRoute.indexOf('effectiveAiUser.walletBalance < sponsorPrice') < friendRoute.indexOf('generateText({'),
  ],
  [
    'friend route does not trust client supplied systemPrompt',
    !friendRoute.includes('systemPrompt ||'),
  ],
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
