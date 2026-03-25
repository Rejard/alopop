'use client';

import { useEffect } from 'react';

// URL-safe base64 변환 함수
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PwaRegistry() {
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then(
        async (registration) => {
          console.log('ServiceWorker registration successful');
          
          // 로그인한 유저 세션 확인 (로컬 스토리지)
          const stored = localStorage.getItem('alo_user');
          if (!stored) return;
          const user = JSON.parse(stored);

          try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
              console.log('Push notification permission denied');
              return;
            }

            const vapidRes = await fetch('/api/push/vapidPublic');
            if (!vapidRes.ok) throw new Error('Failed to get VAPID Key');
            const { publicKey } = await vapidRes.json();
            
            const convertedVapidKey = urlBase64ToUint8Array(publicKey);
            
            // 기존 구독 정보 확인 및 새로 발급
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
              });
            }

            // 백엔드에 구독 정보 전송하여 DB에 저장
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                subscription: subscription
              })
            });
            console.log('Push subscription synced with server.');
          } catch (e) {
            console.error('Failed to subscribe to push notifications', e);
          }
        },
        (err) => {
          console.log('ServiceWorker registration failed: ', err);
        }
      );
    }
  }, []);

  return null;
}
