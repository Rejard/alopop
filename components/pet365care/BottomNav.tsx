"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, ShieldPlus, Home, Sprout, User } from "lucide-react";

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
    <nav className="flex-shrink-0 w-full bg-white border-t border-gray-100 px-2 pt-2 pb-3 z-[200]">
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
                    ? "bg-[#FF7F6E] text-white"
                    : "text-gray-400"
                }`}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span
                className={`text-[10px] font-bold tracking-tight mt-0.5 ${
                  isActive ? "text-[#FF7F6E]" : "text-gray-400"
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
