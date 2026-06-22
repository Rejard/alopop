'use client';

import { useEffect } from 'react';

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

function getStoredUserId() {
  const stored = localStorage.getItem('alo_user');
  if (!stored) return null;

  try {
    const user = JSON.parse(stored);
    return typeof user?.id === 'string' ? user.id : null;
  } catch {
    return null;
  }
}

async function fetchVapidPublicKey() {
  const vapidRes = await fetch('/api/push/vapidPublic');
  if (!vapidRes.ok) throw new Error('Failed to get VAPID key');
  const { publicKey } = await vapidRes.json();
  return urlBase64ToUint8Array(publicKey);
}

async function syncPushSubscription(userId: string, subscription: PushSubscription) {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      subscription,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to sync push subscription');
  }
}

export async function subscribeToPush(registration?: ServiceWorkerRegistration | null, userId?: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, reason: 'unsupported' as const };
  }

  const resolvedUserId = userId || getStoredUserId();
  if (!resolvedUserId) {
    return { success: false, reason: 'missing-user' as const };
  }

  const activeRegistration = registration || await navigator.serviceWorker.ready;
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') {
    return { success: false, reason: 'denied' as const };
  }

  let subscription = await activeRegistration.pushManager.getSubscription();
  if (!subscription) {
    const applicationServerKey = await fetchVapidPublicKey();
    subscription = await activeRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  await syncPushSubscription(resolvedUserId, subscription);
  return { success: true, endpoint: subscription.endpoint };
}

export async function unsubscribeFromPush(registration?: ServiceWorkerRegistration | null, userId?: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, reason: 'unsupported' as const };
  }

  const resolvedUserId = userId || getStoredUserId();
  if (!resolvedUserId) {
    return { success: false, reason: 'missing-user' as const };
  }

  const activeRegistration = registration || await navigator.serviceWorker.ready;
  const subscription = await activeRegistration.pushManager.getSubscription();

  if (!subscription) {
    return { success: true, endpoint: null };
  }

  const endpoint = subscription.endpoint;
  const response = await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok) {
    throw new Error('Failed to unsubscribe push subscription');
  }

  await subscription.unsubscribe();
  return { success: true, endpoint };
}

export function PwaRegistry() {
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then(
        async (registration) => {
          console.log('ServiceWorker registration successful');

          const userId = getStoredUserId();
          if (!userId || Notification.permission !== 'granted') return;

          try {
            const subscription = await registration.pushManager.getSubscription();
            if (!subscription) return;

            await syncPushSubscription(userId, subscription);
            console.log('Push subscription synced with server.');
          } catch (e) {
            console.error('Failed to sync push notifications', e);
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
