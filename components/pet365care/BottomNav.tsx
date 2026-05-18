"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShieldPlus, Sprout, User, Users } from "lucide-react";

export default function Pet365BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "소셜", path: "/pet365care/social", icon: Users },
    { name: "건강", path: "/pet365care/health", icon: ShieldPlus },
    { name: "홈", path: "/pet365care", icon: Home },
    { name: "케어", path: "/pet365care/care", icon: Sprout },
    { name: "프로필", path: "/pet365care/profile", icon: User },
  ];

  return (
    <nav className="flex-shrink-0 w-full bg-[#09070d]/95 border-t border-white/10 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] z-[200] shadow-[0_-18px_42px_rgba(9,7,13,0.35)] relative">
      <div className="flex justify-between items-center gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.name}
              href={item.path}
              className="flex-1 flex flex-col items-center justify-center py-1"
            >
              <div
                className={`flex flex-col items-center justify-center w-12 h-10 rounded-2xl transition-colors duration-200 ${
                  isActive
                    ? "bg-gradient-to-br from-[#9c48ea] to-[#62fae3] text-[#09070d]"
                    : "text-white/45"
                }`}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.7 : 2} />
              </div>
              <span
                className={`text-[10px] font-bold tracking-tight mt-0.5 ${
                  isActive ? "text-[#62fae3]" : "text-white/45"
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
