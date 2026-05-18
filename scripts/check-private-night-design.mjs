import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const checks = [
  {
    file: "app/globals.css",
    required: [
      "--color-background: #09070d",
      "--color-dark-bg: #09070d",
      "--color-on-primary: #08060b",
      "--color-tertiary: #ffb4a6",
      "--color-error: #ff6b8a",
      "--alo-bg-night",
      "--alo-surface",
      "--alo-accent-mint",
      ".alo-mobile-shell",
      ".alo-app-shell",
      ".alo-side-rail",
      ".alo-content-panel",
      ".alo-chat-composer",
      ".alo-primary-action",
    ],
  },
  {
    file: "app/page.tsx",
    required: [
      "alo-app-shell",
      "alo-side-rail",
      "alo-content-panel",
      "alo-chat-composer",
      "getOpenClawCommand",
      "PowerShell 연동 명령어",
      "navigator.clipboard.writeText(getOpenClawCommand())",
      "/openclaw-bridge.js",
      "fileInputRef",
      "handleSendMessage",
    ],
  },
  {
    file: "app/login/page.tsx",
    required: ["alo-mobile-shell", "alo-primary-action", "단톡방에 AI 친구를 초대하세요"],
    banned: ["bg-[#0a0a0a]", "rounded-2xl"],
  },
  {
    file: "app/invite/[code]/page.tsx",
    required: ["alo-mobile-shell", "alo-primary-action", "Private Night"],
    banned: ["max-w-sm bg-surface-container rounded-lg"],
  },
  {
    file: "app/admin/agent/page.tsx",
    required: ["alo-mobile-shell", "alo-card", "OpenClaw AI 에이전트"],
    banned: ["bg-gray-50", "bg-blue-500"],
  },
  {
    file: "app/pet365care/pet365-layout.css",
    required: ["--pet365-alo-bg", "linear-gradient", "#09070d"],
  },
  {
    file: "components/pet365care/BottomNav.tsx",
    required: ["#09070d", "#62fae3", "#9c48ea"],
    banned: ["bg-white border-t border-gray-100", "#FF7F6E"],
  },
  {
    file: "app/pet365care/social/page.tsx",
    required: [
      "handleLike",
      "handleUploadImages",
      "handlePost",
      "handleComment",
      "handleDeleteComment",
      "fileRef",
      "#9c48ea",
      "#62fae3",
    ],
    banned: ["#FF7B6E", "#FF9A8B", "from-amber-400 via-orange-400 to-rose-500"],
  },
  {
    file: "app/pet365care/page.tsx",
    required: [
      "fetchPetData",
      "toggleCheck",
      "toggleAction",
      "notifyCareComplete",
      "generateCareTip",
      "#9c48ea",
      "#62fae3",
    ],
    banned: ["#FF7B6E", "from-amber-400 to-orange-500", "from-yellow-300 to-orange-400", "from-orange-50 to-amber-50"],
  },
  {
    file: "app/pet365care/care/page.tsx",
    required: [
      "handleCameraClick",
      "handleFileChange",
      "analyzeImage",
      "addHealthRecord",
      "fileInputRef",
      "#9c48ea",
      "#62fae3",
    ],
    banned: ["#FF7B6E", "#D74F3B", "#FF8A7A", "#8E3B29", "#A73A2A", "from-rose-50 to-orange-50"],
  },
  {
    file: "app/pet365care/health/page.tsx",
    required: ["프리미엄 멤버십", "#9c48ea", "#62fae3"],
    banned: ["#FF7B6E", "#D24B35"],
  },
  {
    file: "app/pet365care/hospitals/page.tsx",
    required: ["handleSync", "handleCall", "tel:", "setViewMode", "#9c48ea", "#62fae3"],
    banned: ["bg-rose-500", "text-rose-500", "focus:ring-rose-200"],
  },
  {
    file: "app/pet365care/profile/page.tsx",
    required: [
      "handleRecoverPets",
      "handleAddPet",
      "handleUpdatePet",
      "handleDeletePet",
      "requestDeletePet",
      "/api/pet365care/backup",
      "formatBackupSummary",
      "복원 검증 실패",
      "#9c48ea",
      "#62fae3",
    ],
    banned: ["#FF7B6E", "#FF6B6B"],
  },
  {
    file: "lib/pet365care/local-store.ts",
    required: [
      "unwrapStore",
      "data.format === \"pet365care-store\"",
      "raw.includes('\"store\"')",
      "saveStore(normalized)",
    ],
  },
  {
    file: "app/pet365care/admin/page.tsx",
    required: [
      "/api/pet365care/admin/sync-cli",
      "sync-hospitals.ts --clear",
      "navigator.clipboard.writeText",
      "#9c48ea",
      "#62fae3",
    ],
    banned: ["#FF7B6E"],
  },
];

const failures = [];

for (const check of checks) {
  const content = read(check.file);
  for (const text of check.required || []) {
    if (!content.includes(text)) {
      failures.push(`${check.file} missing ${JSON.stringify(text)}`);
    }
  }
  for (const text of check.banned || []) {
    if (content.includes(text)) {
      failures.push(`${check.file} still contains ${JSON.stringify(text)}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("private night design contract ok");
