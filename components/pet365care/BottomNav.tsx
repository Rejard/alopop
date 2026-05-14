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
    <nav className="absolute bottom-0 w-full bg-white/95 backdrop-blur-md rounded-t-[32px] px-4 py-4 shadow-[0_-15px_40px_-10px_rgba(0,0,0,0.05)] z-[200] pointer-events-auto">
      <div className="flex justify-between items-center relative gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex-1 flex flex-col items-center justify-center transition-all duration-300 relative group`}
            >
              <div
                className={`flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 ${
                  isActive
                    ? "bg-[#FF7F6E] text-white rounded-[24px] shadow-lg shadow-[#FF7F6E]/30 scale-110 -translate-y-2"
                    : "text-gray-400 hover:text-gray-800"
                }`}
              >
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span
                  className={`text-[10px] font-bold tracking-tight mt-1 transition-colors duration-300 ${
                    isActive ? "text-white" : "text-gray-400 group-hover:text-gray-800"
                  }`}
                >
                  {item.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
