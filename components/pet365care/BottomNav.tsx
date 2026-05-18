"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShieldPlus, Sprout, User, Users } from "lucide-react";
import { useEffect } from "react";

type AlarmPet = {
  id: string;
  name: string;
  species?: string;
};

type AlarmMedication = {
  id: string;
  petId: string;
  name: string;
  isActive?: boolean;
  time?: string;
  checkLogs?: string[];
};

type AlarmMedicalRecord = {
  id: string;
  petId: string;
  type?: string;
  title: string;
  nextDate?: string;
};

type AlarmStore = {
  pets?: AlarmPet[];
  medications?: AlarmMedication[];
  medicalRecords?: AlarmMedicalRecord[];
};

export default function Pet365BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "소셜", path: "/pet365care/social", icon: Users },
    { name: "건강", path: "/pet365care/health", icon: ShieldPlus },
    { name: "홈", path: "/pet365care", icon: Home },
    { name: "케어", path: "/pet365care/care", icon: Sprout },
    { name: "프로필", path: "/pet365care/profile", icon: User },
  ];

  useEffect(() => {
    // Check alarms every 1 minute
    const checkAlarms = async () => {
      if (typeof window === "undefined") return;
      const storeRaw = localStorage.getItem("pet365care-store");
      if (!storeRaw) return;
      
      try {
        const store = JSON.parse(storeRaw) as AlarmStore;
        const pets = store.pets || [];
        const medications = store.medications || [];
        const medicalRecords = store.medicalRecords || [];
        
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        
        let sentAlarms: Record<string, boolean> = {};
        try {
          sentAlarms = JSON.parse(localStorage.getItem("pet365_sent_alarms") || "{}");
        } catch {}

        let alarmSent = false;

        const sendNotify = async (pet: AlarmPet, msg: string, alarmKey: string) => {
          if (sentAlarms[alarmKey]) return; // Already sent
          try {
            await fetch('/api/pet365care/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                petName: pet.name,
                species: pet.species || 'other',
                roomName: 'Pet365 봇 알림',
                message: msg
              })
            });
            sentAlarms[alarmKey] = true;
            alarmSent = true;
          } catch (err) {
            console.error("Alarm failed", err);
          }
        };

        // 1. Medication Alarms
        for (const med of medications) {
          if (!med.isActive || !med.time) continue;
          
          const pet = pets.find((p) => p.id === med.petId);
          if (!pet) continue;

          // Check if today is already checked
          const isCheckedToday = (med.checkLogs || []).includes(todayStr);
          if (isCheckedToday) continue;

          // Check if time has passed
          if (timeStr >= med.time) {
            const alarmKey = `med_${med.id}_${todayStr}`;
            await sendNotify(pet, `[약 복용 알림] 삐빅! ${pet.name}의 '${med.name}' 약 먹일 시간입니다! 잊지 말고 챙겨주세요! 💊`, alarmKey);
          }
        }

        // 2. Hospital Alarms
        for (const rec of medicalRecords) {
          if (rec.type !== 'HOSPITAL' || !rec.nextDate) continue;
          
          const pet = pets.find((p) => p.id === rec.petId);
          if (!pet) continue;

          if (rec.nextDate === todayStr) {
            const alarmKey = `hosp_today_${rec.id}_${todayStr}`;
            await sendNotify(pet, `[병원 방문 D-DAY] 오늘은 ${pet.name}의 '${rec.title}' 병원 방문 예정일입니다! 🏥 잊지 마세요!`, alarmKey);
          } else if (rec.nextDate === tomorrowStr) {
            const alarmKey = `hosp_tmrw_${rec.id}_${todayStr}`; // Use todayStr to not re-send today
            await sendNotify(pet, `[병원 방문 D-1] 내일은 ${pet.name}의 '${rec.title}' 병원 방문 예정일입니다! 🏥 미리 준비해주세요!`, alarmKey);
          }
        }

        if (alarmSent) {
          localStorage.setItem("pet365_sent_alarms", JSON.stringify(sentAlarms));
        }

      } catch (err) {
        console.error("Failed to parse store for alarms", err);
      }
    };

    checkAlarms(); // Check immediately on mount
    const timer = setInterval(checkAlarms, 60000); // Check every minute
    return () => clearInterval(timer);
  }, []);

  return (
    <nav className="flex-shrink-0 w-full max-w-[430px] mx-auto bg-[#09070d]/96 border-t border-white/10 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] z-[200] shadow-[0_-18px_42px_rgba(9,7,13,0.38)] relative">
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
                    ? "bg-gradient-to-br from-[#9c48ea] to-[#62fae3] text-[#09070d] shadow-[0_8px_22px_rgba(98,250,227,0.25)]"
                    : "text-white/42 hover:text-white/70"
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
