/**
 * Pet365Care 알림 — Alopop 내부 채팅 직접 연결
 *
 * 기존 postMessage 브릿지 대신 서버 API를 통해
 * 펫별 봇 유저 → 유저에게 1:1 채팅 메시지를 직접 전송합니다.
 * 
 * - roomName: 순수 펫 이름 (이모지 없음)
 * - species 이모지는 서버에서 봇 유저의 avatar로 설정
 */

import { getSpeciesEmoji } from './utils';

async function sendNotification(data: {
  type: string;
  petName: string;
  species: string;
  roomName: string;
  message: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/pet365care/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      console.error('[Pet365Care Notify] Error:', res.status, await res.text());
      return false;
    }
    const result = await res.json();
    return result.success === true;
  } catch (e) {
    console.error('[Pet365Care Notify] Fetch failed:', e);
    return false;
  }
}

export function notifyPetRegistered(petName: string, species: string, breed: string): void {
  const emoji = getSpeciesEmoji(species);
  sendNotification({
    type: 'PET_REGISTERED',
    petName,
    species,
    roomName: petName,
    message: `${emoji} ${petName}(${breed})이(가) 등록되었어요!\n\n앞으로 ${petName}의 건강 관리 알림을 이곳으로 보내드릴게요. 🎉`,
  });
}

export function notifyPetUpdated(petName: string, species: string): void {
  sendNotification({
    type: 'PET_UPDATED',
    petName,
    species,
    roomName: petName,
    message: `📝 ${petName}의 정보가 업데이트되었어요!`,
  });
}

export function notifyPetDeleted(petName: string, species: string): void {
  sendNotification({
    type: 'PET_DELETED',
    petName,
    species,
    roomName: petName,
    message: `👋 ${petName}의 등록이 해제되었어요. 언제든 다시 등록해주세요!`,
  });
}

export function notifyVaccination(petName: string, species: string, vacName: string, nextDate?: string | null): void {
  let msg = `💉 ${petName}의 ${vacName} 접종이 완료되었어요!`;
  if (nextDate) msg += `\n📅 다음 접종 예정일: ${nextDate}`;

  sendNotification({
    type: 'VACCINATION_ADDED',
    petName,
    species,
    roomName: petName,
    message: msg,
  });
}

export function notifyCareComplete(petName: string, species: string): void {
  sendNotification({
    type: 'CARE_COMPLETE',
    petName,
    species,
    roomName: petName,
    message: `🎉 ${petName}의 오늘 케어를 모두 완료했어요! 최고에요! 🏆`,
  });
}
