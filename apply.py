import os
import re

class_map = {
    "bg-zinc-950": "bg-dark-bg",
    "bg-zinc-900/90": "bg-surface-variant/40 backdrop-blur-md",
    "bg-[var(--background)]": "bg-dark-bg",
    "bg-zinc-900/50": "bg-surface-variant/40",
    "bg-zinc-800/60": "bg-surface-variant/40",
    "bg-zinc-800/50": "bg-surface-container-high",
    "bg-zinc-800/40": "bg-surface-variant/40 text-on-surface-variant",
    "bg-zinc-900": "bg-surface-container-low",
    "bg-zinc-800": "bg-surface-container-high",
    "bg-black/60": "bg-dark-bg/80",
    "bg-black/40": "bg-surface-container-lowest",
    "bg-purple-600": "soul-gradient text-white",
    "bg-purple-500/20": "bg-primary/10",
    "bg-zinc-100": "bg-surface-container-lowest",
    "bg-white": "bg-surface-container-lowest text-on-surface",

    "text-zinc-100": "text-on-surface",
    "text-zinc-200": "text-on-surface",
    "text-zinc-300": "text-on-surface-variant",
    "text-zinc-400": "text-on-surface-variant",
    "text-zinc-500": "text-on-surface-variant/60",
    "text-zinc-600": "text-outline-variant",
    "text-zinc-900": "text-primary",
    
    "border-zinc-800/80": "border-outline-variant/20",
    "border-zinc-800/50": "border-outline-variant/15",
    "border-zinc-800": "border-outline-variant/15",
    "border-zinc-700/50": "border-outline-variant/10",
    "border-zinc-700/30": "border-outline-variant/5",
    "border-zinc-700": "border-outline-variant/20",

    "hover:bg-zinc-900": "hover:bg-surface-variant/60",
    "hover:bg-zinc-800/50": "hover:bg-surface-container-low",
    "hover:bg-zinc-800": "hover:bg-surface-container-high",
    "hover:bg-zinc-700": "hover:bg-surface-variant/40",
    "hover:text-white": "hover:text-on-surface",
    "hover:text-zinc-300": "hover:text-on-surface-variant",

    "shadow-2xl": "shadow-[0_0_60px_-15px_rgba(204,151,255,0.15)]",
    "shadow-lg": "shadow-ambient",

    "sm:rounded-[2.5rem]": "sm:rounded-[24px]",
    "sm:border-[8px]": "sm:border",
    
    "text-purple-400": "text-primary text-glow-purple",
    "hover:border-zinc-700": "hover:border-outline-variant/30",
    "active:scale-95": "active:scale-95 transition-transform"
}

files = [
    "app/page.tsx",
    "app/login/page.tsx",
    "app/invite/[code]/page.tsx",
    "components/SettingsModal.tsx"
]

for f in files:
    if os.path.exists(f):
        with open(f, "r", encoding="utf-8") as file:
            content = file.read()
        
        # We find parts inside className="...", className={`...`} and replace
        # A simpler way is to just do word boundary replacements for tailwind classes
        # But we must handle slashes.
        for k, v in class_map.items():
            pattern = r"(?<![a-zA-Z0-9_-])" + re.escape(k) + r"(?![a-zA-Z0-9_-])"
            content = re.sub(pattern, v, content)

        with open(f, "w", encoding="utf-8") as file:
            file.write(content)
        print(f"Patched {f}")

