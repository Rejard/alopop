const fs = require("fs");
const glob = require("glob");

const replacements = {
  // backgrounds
  "bg-zinc-950": "bg-dark-bg",
  "bg-zinc-900/90": "bg-surface-variant/40",
  "bg-zinc-900/50": "bg-surface-variant/20 hover:bg-surface-variant/40",
  "bg-zinc-800/60": "bg-surface-variant/40",
  "bg-zinc-800/50": "bg-surface-container-high hover:bg-surface-variant/40",
  "bg-zinc-800/40": "bg-surface-variant/40 text-on-surface-variant",
  "bg-zinc-900": "bg-surface-container-low",
  "bg-zinc-800": "bg-surface-container-high",
  "bg-[var(--background)]": "bg-dark-bg",
  "bg-black/60": "bg-dark-bg/80",
  "bg-black/40": "bg-surface-container-lowest",
  "bg-purple-600": "soul-gradient text-white",
  "bg-purple-500": "bg-primary",
  "bg-zinc-100": "bg-surface-container-lowest",

  // text colors
  "text-zinc-100": "text-on-surface",
  "text-zinc-200": "text-on-surface hover:text-primary",
  "text-zinc-300": "text-on-surface-variant",
  "text-zinc-400": "text-on-surface-variant text-sm", // heuristic
  "text-zinc-500": "text-on-surface-variant/60 text-xs",
  "text-zinc-600": "text-outline-variant",
  "text-zinc-900": "text-primary",

  // borders
  "border-zinc-800": "border-outline-variant/15",
  "border-zinc-700/50": "border-outline-variant/10",
  "border-zinc-700/30": "border-outline-variant/5",
  "border-zinc-700": "border-outline-variant/20",

  // hovers
  "hover:bg-zinc-900": "hover:bg-surface-variant/60",
  "hover:bg-zinc-800/50": "hover:bg-surface-container-low",
  "hover:bg-zinc-800": "hover:bg-surface-container-high",
  "hover:bg-zinc-700": "hover:bg-surface-variant/40",
  "hover:text-white": "hover:text-on-surface transition-colors",
  "hover:text-zinc-300": "hover:text-on-surface-variant",

  // shadow
  "shadow-lg": "shadow-ambient",
  "shadow-2xl": "shadow-ambient shadow-[0_0_60px_-15px_rgba(204,151,255,0.15)]",

  // specific
  "sm:rounded-[2.5rem]": "sm:rounded-[24px]",
  "sm:border-[8px]": "sm:border",
};

const mapReplacements = (fileContent) => {
  let modified = fileContent;
  Object.keys(replacements).forEach((key) => {
    // Escape regex specials from key
    const escapedKey = key.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    // Match only if surrounded by word boundaries or quotes/spaces
    const tokenRegex = new RegExp(`(?<=[\\s'"\\\`])${escapedKey}(?=[\\s'"\\\`])`, "g");
    modified = modified.replace(tokenRegex, replacements[key]);
  });
  return modified;
};

const files = [
  "app/page.tsx",
  "app/login/page.tsx",
  "app/invite/[code]/page.tsx",
  "components/SettingsModal.tsx"
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    const newContent = mapReplacements(content);
    fs.writeFileSync(file, newContent, "utf8");
    console.log(`Updated ${file}`);
  }
});

