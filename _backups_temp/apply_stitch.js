const fs = require("fs");

const classMap = {
  "bg-zinc-950": "bg-dark-bg",
  "bg-zinc-900\/90": "bg-surface-variant/40",
  "bg-zinc-900\/50": "bg-surface-variant/20 hover:bg-surface-variant/40",
  "bg-zinc-800\/60": "bg-surface-variant/40 text-on-surface-variant",
  "bg-zinc-800\/50": "bg-surface-container-high hover:bg-surface-variant/40",
  "bg-zinc-800\/40": "bg-surface-variant/40 text-on-surface-variant",
  "bg-zinc-900": "bg-surface-container-low",
  "bg-zinc-800": "bg-surface-container-high",
  "bg-black\/60": "bg-dark-bg/80",
  "bg-black\/40": "bg-surface-container-lowest",
  "bg-purple-600": "soul-gradient text-white shadow-inner-glow",
  "bg-purple-500\/20": "bg-primary/20",
  "hover:bg-purple-500": "hover:brightness-110 shadow-[0_0_20px_rgba(168,85,247,0.3)]",
  "bg-zinc-100": "bg-surface-container-lowest",
  "bg-white": "bg-surface-container-lowest text-on-surface hover:bg-surface-container-low",

  "text-zinc-100": "text-on-surface",
  "text-zinc-200": "text-on-surface hover:text-primary transition-colors",
  "text-zinc-300": "text-on-surface-variant",
  "text-zinc-400": "text-on-surface-variant",
  "text-zinc-500": "text-on-surface-variant/70",
  "text-zinc-600": "text-outline-variant",
  "text-zinc-900": "text-primary font-bold",
  "text-purple-400": "text-primary text-glow-purple",

  "border-zinc-800\/80": "border-outline-variant/20",
  "border-zinc-800\/50": "border-outline-variant/15",
  "border-zinc-800": "border-outline-variant/15",
  "border-zinc-700\/50": "border-outline-variant/10",
  "border-zinc-700\/30": "border-outline-variant/5",
  "border-zinc-700": "border-outline-variant/20",

  "hover:bg-zinc-900": "hover:bg-surface-variant/60",
  "hover:bg-zinc-800\/50": "hover:bg-surface-container-low",
  "hover:bg-zinc-800": "hover:bg-surface-container-high",
  "hover:bg-zinc-700": "hover:bg-surface-variant/40",
  "hover:bg-zinc-100": "hover:brightness-110 active:scale-95",
  "hover:text-white": "hover:text-on-surface transition-colors",
  "hover:text-zinc-300": "hover:text-on-surface-variant",

  "shadow-2xl": "shadow-ambient shadow-[0_0_60px_-15px_rgba(204,151,255,0.15)]",
  "shadow-lg": "shadow-ambient",

  "sm:rounded-[2.5rem]": "sm:rounded-[24px]"
};

function applyClasses(text) {
  let result = text;
  Object.keys(classMap).forEach(key => {
    // Only replace whole classes (surrounded by space, quotes, or backticks)
    const regex = new RegExp(`(?<=[\\\\s\\"\\'\\\`])${key.replace(/[/]/g, "\\\\$&")}(?=[\\\\s\\"\\'\\\`])`, "g");
    result = result.replace(regex, classMap[key]);
  });
  return result;
}

const files = [
  "app/page.tsx",
  "app/login/page.tsx",
  "app/invite/[code]/page.tsx",
  "components/SettingsModal.tsx"
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, "utf-8");
    let matches = Array.from(content.matchAll(/className=["'\`\\](.*?)[\\"'\`]/g));
    
    // Process only className values
    let newContent = content;
    matches.forEach(m => {
      let originalClassName = m[1];
      let newClassName = applyClasses(originalClassName);
      // clean up extra spaces
      newClassName = newClassName.replace(/\\s+/g, " ").trim();
      if (originalClassName !== newClassName) {
        newContent = newContent.replace(
          `className="${originalClassName}"`, 
          `className="${newClassName}"`
        );
        newContent = newContent.replace(
          `className=\`${originalClassName}\``, 
          `className=\`${newClassName}\``
        );
      }
    });

    // Also catch some special cases like `bg-zinc-950 flex` that might be missed by the regex due to being at the start
    newContent = applyClasses(newContent);

    fs.writeFileSync(f, newContent, "utf-8");
    console.log(`Applied stitch to ${f}`);
  }
});

