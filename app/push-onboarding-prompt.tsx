'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY_PREFIX = 'push-onboarding-dismissed-v1:';

function base64UrlToUint8Array(base64Url: string) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

export default function PushOnboardingPrompt() {
  const { isLoaded, userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const storageKey = useMemo(() => (userId ? `${STORAGE_KEY_PREFIX}${userId}` : null), [userId]);

  useEffect(() => {
    if (!isLoaded || !userId || typeof window === 'undefined') return;

    const dismissed = storageKey ? localStorage.getItem(storageKey) === '1' : false;
    if (dismissed) return;

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) return;

    if (Notification.permission === 'denied') return;

    let cancelled = false;

    const checkAndOpen = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/push-sw.js');
        const subscription = await registration.pushManager.getSubscription();
        const devicePushEnabled = Boolean(subscription);

        if (devicePushEnabled) {
          if (devicePushEnabled && storageKey) {
            localStorage.setItem(storageKey, '1');
          }
          return;
        }

        if (!cancelled) {
          setOpen(true);
        }
      } catch {
        // noop
      }
    };

    checkAndOpen();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, storageKey, userId]);

  const dismiss = () => {
    if (storageKey) localStorage.setItem(storageKey, '1');
    setOpen(false);
  };

  const enablePush = async () => {
    try {
      setLoading(true);

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('Clé VAPID publique manquante côté client.');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        dismiss();
        return;
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js');
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
        });
      }

      const saveSubscriptionRes = await fetch('/api/push/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });

      if (!saveSubscriptionRes.ok) {
        throw new Error('Impossible d’enregistrer la subscription push.');
      }

      const patchSettingsRes = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyPushEnabled: true }),
      });

      if (!patchSettingsRes.ok) {
        throw new Error('Impossible d’activer les notifications push sur le compte.');
      }

      dismiss();
    } catch {
      dismiss();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-3 sm:p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
        <h3 className="text-base font-bold text-gray-900">Activer les notifications push ?</h3>
        <p className="mt-2 text-sm text-gray-600">
          Reçois ton rappel quotidien directement sur cet appareil.
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={enablePush}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Activation...' : 'Activer'}
          </button>
        </div>
      </div>
    </div>
  );
}
