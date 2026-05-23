"use client";

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

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function Pet365AlarmBridge() {
  useEffect(() => {
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
        const todayStr = formatLocalDate(now);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = formatLocalDate(tomorrow);
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        let sentAlarms: Record<string, boolean> = {};
        try {
          sentAlarms = JSON.parse(localStorage.getItem("pet365_sent_alarms") || "{}");
        } catch {}

        let alarmSent = false;

        const sendNotify = async (pet: AlarmPet, message: string, alarmKey: string) => {
          if (sentAlarms[alarmKey]) return;
          try {
            await fetch("/api/pet365care/notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                petName: pet.name,
                species: pet.species || "other",
                roomName: "Pet365 알림",
                message,
              }),
            });
            sentAlarms[alarmKey] = true;
            alarmSent = true;
          } catch (err) {
            console.error("Alarm failed", err);
          }
        };

        for (const med of medications) {
          if (!med.isActive || !med.time) continue;

          const pet = pets.find((item) => item.id === med.petId);
          if (!pet) continue;
          if ((med.checkLogs || []).includes(todayStr)) continue;

          if (timeStr >= med.time) {
            const alarmKey = `med_${med.id}_${todayStr}`;
            await sendNotify(pet, `[복용 알림] ${pet.name}의 '${med.name}' 먹을 시간입니다. 잊지 말고 챙겨주세요.`, alarmKey);
          }
        }

        for (const rec of medicalRecords) {
          if (rec.type !== "HOSPITAL" || !rec.nextDate) continue;

          const pet = pets.find((item) => item.id === rec.petId);
          if (!pet) continue;

          if (rec.nextDate === todayStr) {
            const alarmKey = `hosp_today_${rec.id}_${todayStr}`;
            await sendNotify(pet, `[병원 방문 D-DAY] 오늘은 ${pet.name}의 '${rec.title}' 병원 방문 예정일입니다.`, alarmKey);
          } else if (rec.nextDate === tomorrowStr) {
            const alarmKey = `hosp_tmrw_${rec.id}_${todayStr}`;
            await sendNotify(pet, `[병원 방문 D-1] 내일은 ${pet.name}의 '${rec.title}' 병원 방문 예정일입니다. 미리 준비해주세요.`, alarmKey);
          }
        }

        if (alarmSent) {
          localStorage.setItem("pet365_sent_alarms", JSON.stringify(sentAlarms));
        }
      } catch (err) {
        console.error("Failed to parse store for alarms", err);
      }
    };

    checkAlarms();
    const timer = setInterval(checkAlarms, 60000);
    return () => clearInterval(timer);
  }, []);

  return null;
}
