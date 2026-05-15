import fs from 'node:fs';

const page = fs.readFileSync('app/page.tsx', 'utf8');

const avatarWrapperPattern = /<div className="relative w-12 h-12[^"]*overflow-hidden[^"]*">[\s\S]*?unreadCounts\[room\.id\] > 0/;
const hasSeparatedAvatarClip = page.includes('data-chat-room-avatar-clip');
const hasOuterBadgeAnchor = page.includes('data-chat-room-avatar-wrap');

if (avatarWrapperPattern.test(page)) {
  console.error('FAIL chat room unread badge is inside an overflow-hidden avatar container');
  process.exit(1);
}

if (!hasSeparatedAvatarClip || !hasOuterBadgeAnchor) {
  console.error('FAIL chat room avatar clipping and badge anchoring are not separated');
  process.exit(1);
}

console.log('PASS chat room unread badge can render outside the avatar image');
