'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import Link from 'next/link';

type SettingsState = {
  email: string;
  weeklyEmailEnabled: boolean;
  dailyEmailEnabled: boolean;
  dailyPushEnabled: boolean;
  subscriptionStatus:
    | 'FREE'
    | 'TRIALING'
    | 'ACTIVE'
    | 'PAST_DUE'
    | 'CANCELED'
    | 'INCOMPLETE'
    | 'INCOMPLETE_EXPIRED'
    | 'UNPAID';
  subscriptionInterval: 'NONE' | 'MONTHLY' | 'YEARLY';
  subscriptionCurrentPeriodEnd: string | null;
  trialEndsAt: string | null;
  subscriptionCancelAtPeriodEnd: boolean;
  showEmailTestActions: boolean;
};

export default function SettingsPage() {
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<'weekly' | 'daily' | 'push' | null>(null);
  const [testingKey, setTestingKey] = useState<'weekly' | 'daily' | 'push' | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushDeviceEnabled, setPushDeviceEnabled] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const base64UrlToUint8Array = (base64Url: string) => {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);

    for (let i = 0; i < raw.length; i += 1) {
      output[i] = raw.charCodeAt(i);
    }

    return output;
  };

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur');
      }
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    syncPushStatus();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    const sessionId = params.get('session_id');

    setBillingStatus(billing);

    if (billing === 'success' || billing === 'portal_return') {
      syncBillingStatus(sessionId);
    }
  }, []);

  const syncPushStatus = async () => {
    if (typeof window === 'undefined') return;

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setPushSupported(supported);

    if (!supported) {
      setPushDeviceEnabled(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/push-sw.js');
      const subscription = await registration.pushManager.getSubscription();
      setPushDeviceEnabled(Boolean(subscription));
    } catch {
      setPushDeviceEnabled(false);
    }
  };

  const patchAccountPushEnabled = async (enabled: boolean) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyPushEnabled: enabled }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erreur');
    }

    setSettings((current) =>
      current
        ? {
            ...current,
            dailyPushEnabled: data.settings.dailyPushEnabled,
          }
        : current
    );
  };

  const getUserSubscriptionsCount = async () => {
    const res = await fetch('/api/push/subscriptions');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Impossible de lire les subscriptions push.');
    }

    return Array.isArray(data.subscriptions) ? data.subscriptions.length : 0;
  };

  const subscribePushForCurrentDevice = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      throw new Error('Push non supporté sur cet appareil/navigateur.');
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      throw new Error('Clé VAPID publique manquante côté client.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permission notifications refusée.');
    }

    const registration = await navigator.serviceWorker.register('/push-sw.js');
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
      });
    }

    const res = await fetch('/api/push/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Impossible d’enregistrer la subscription push.');
    }
  };

  const unsubscribePushForCurrentDevice = async () => {
    try {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js');
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch('/api/push/subscriptions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
      }
    } catch {
      // no-op: la préférence compte reste la source de vérité
    }
  };

  const updateToggle = async (
    key: 'weeklyEmailEnabled' | 'dailyEmailEnabled',
    value: boolean
  ) => {
    if (!settings) return;

    const previous = settings;
    setSuccess('');
    setError('');
    if (key === 'weeklyEmailEnabled') {
      setSavingKey('weekly');
    } else if (key === 'dailyEmailEnabled') {
      setSavingKey('daily');
    } else {
      setSavingKey('push');
    }
    setSettings({ ...settings, [key]: value });

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur');
      }

      setSettings((current) =>
        current
          ? {
              ...current,
              weeklyEmailEnabled: data.settings.weeklyEmailEnabled,
              dailyEmailEnabled: data.settings.dailyEmailEnabled,
              dailyPushEnabled: data.settings.dailyPushEnabled,
            }
          : current
      );
      setSuccess('Préférence mise à jour.');
    } catch (err) {
      setSettings(previous);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSavingKey(null);
    }
  };

  const updatePushToggle = async (value: boolean) => {
    if (!settings) return;

    const previous = settings;
    const previousDeviceEnabled = pushDeviceEnabled;
    setSuccess('');
    setError('');
    setSavingKey('push');
    setPushDeviceEnabled(value);

    try {
      if (value) {
        await subscribePushForCurrentDevice();
        await patchAccountPushEnabled(true);
      } else {
        await unsubscribePushForCurrentDevice();

        const remainingSubscriptions = await getUserSubscriptionsCount();
        if (remainingSubscriptions === 0) {
          await patchAccountPushEnabled(false);
        }
      }

      setSuccess(value ? 'Notifications push activées.' : 'Notifications push désactivées.');
    } catch (err) {
      setSettings(previous);
      setPushDeviceEnabled(previousDeviceEnabled);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSavingKey(null);
    }
  };

  const sendTestEmail = async (type: 'weekly' | 'daily' | 'push') => {
    setSuccess('');
    setError('');
    setTestingKey(type);

    try {
      const res = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur');
      }

      setSuccess(
        type === 'weekly'
          ? 'Email hebdomadaire de test envoyé.'
          : type === 'daily'
            ? 'Email quotidien IA de test envoyé.'
            : 'Notification push de test envoyée.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setTestingKey(null);
    }
  };

  const syncBillingStatus = async (sessionId: string | null = null) => {
    setBillingLoading(true);
    try {
      const res = await fetch('/api/stripe/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Impossible de synchroniser l’abonnement.');
      }

      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBillingLoading(false);
    }
  };

  const openBillingPortal = async () => {
    setBillingLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Impossible d’ouvrir la gestion d’abonnement.');
      }

      if (!data.url) {
        throw new Error('URL du portail Stripe manquante.');
      }

      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setBillingLoading(false);
    }
  };

  const pushEnabled = Boolean(settings?.dailyPushEnabled) && pushDeviceEnabled;
  const subscriptionPeriodEnd = settings?.subscriptionCurrentPeriodEnd
    ? new Date(settings.subscriptionCurrentPeriodEnd).toLocaleDateString('fr-CH')
    : null;
  const trialEnd = settings?.trialEndsAt
    ? new Date(settings.trialEndsAt).toLocaleDateString('fr-CH')
    : null;
  const hasManagedSubscription = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'INCOMPLETE', 'UNPAID'].includes(
    settings?.subscriptionStatus || 'FREE'
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <div className="page-header mb-4 w-full shrink-0">
        <div className="container">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Paramètres
          </h2>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto min-h-0 w-full px-3 sm:px-6 py-4">
        <div className="max-w-xl w-full mx-auto space-y-4 pb-24">
          {loading ? (
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-2 text-sm text-gray-600">
              <Loader2 size={16} className="animate-spin" /> Chargement...
            </div>
          ) : (
            <>
              {billingStatus === 'success' && (
                <div className="flex gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <p className="text-sm text-emerald-800">Paiement validé. Le statut d’abonnement est en cours de synchronisation.</p>
                </div>
              )}

              {billingStatus === 'portal_return' && (
                <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-2xl">
                  <CheckCircle2 size={18} className="text-blue-600" />
                  <p className="text-sm text-blue-800">Retour depuis Stripe. L’abonnement est en cours d’actualisation.</p>
                </div>
              )}

              {billingStatus === 'canceled' && (
                <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                  <AlertCircle size={18} className="text-amber-600" />
                  <p className="text-sm text-amber-800">Paiement annulé. Aucun changement d’abonnement n’a été appliqué.</p>
                </div>
              )}

              {error && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl">
                  <AlertCircle size={18} className="text-red-600" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {success && (
                <div className="flex gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <p className="text-sm text-emerald-800">{success}</p>
                </div>
              )}

              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                <p className="text-sm text-gray-500">Compte email</p>
                <p className="text-sm sm:text-base font-semibold text-gray-900 break-all">
                  {settings?.email || '-'}
                </p>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-2">
                <p className="text-sm text-gray-500">Abonnement</p>
                <p className="text-sm font-semibold text-gray-900">
                  {settings?.subscriptionStatus || 'FREE'}
                  {settings?.subscriptionInterval && settings.subscriptionInterval !== 'NONE'
                    ? ` • ${settings.subscriptionInterval}`
                    : ''}
                </p>
                {trialEnd && <p className="text-xs text-gray-600">Fin d’essai: {trialEnd}</p>}
                {subscriptionPeriodEnd && (
                  <p className="text-xs text-gray-600">Prochain renouvellement: {subscriptionPeriodEnd}</p>
                )}
                {settings?.subscriptionCancelAtPeriodEnd && (
                  <p className="text-xs text-amber-700">Résiliation planifiée en fin de période.</p>
                )}

                {billingLoading && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Loader2 size={14} className="animate-spin" /> Synchronisation abonnement...
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  {!hasManagedSubscription ? (
                    <Link
                      href="/pricing"
                      className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Voir les offres
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={openBillingPortal}
                      disabled={billingLoading}
                      className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Changer ou annuler l’abonnement
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => syncBillingStatus()}
                    disabled={billingLoading}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Actualiser le statut
                  </button>
                </div>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                <p className="text-sm font-semibold text-gray-700">Notifications</p>

                <button
                  type="button"
                  onClick={() => settings && updateToggle('weeklyEmailEnabled', !settings.weeklyEmailEnabled)}
                  disabled={savingKey === 'weekly' || !settings}
                  className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    settings?.weeklyEmailEnabled
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span>Emails hebdomadaires</span>
                  <span>{savingKey === 'weekly' ? '...' : settings?.weeklyEmailEnabled ? 'Activé' : 'Désactivé'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => settings && updateToggle('dailyEmailEnabled', !settings.dailyEmailEnabled)}
                  disabled={savingKey === 'daily' || !settings}
                  className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    settings?.dailyEmailEnabled
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span>Emails quotidiens IA</span>
                  <span>{savingKey === 'daily' ? '...' : settings?.dailyEmailEnabled ? 'Activé' : 'Désactivé'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => settings && updatePushToggle(!pushEnabled)}
                  disabled={savingKey === 'push' || !settings || !pushSupported}
                  className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    pushEnabled
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span>Notifications push</span>
                  <span>{savingKey === 'push' ? '...' : pushEnabled ? 'Activé' : 'Désactivé'}</span>
                </button>
              </div>

              {settings?.showEmailTestActions && (
                <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Tests d'envoi</p>

                  <button
                    type="button"
                    onClick={() => sendTestEmail('weekly')}
                    disabled={testingKey !== null || !settings}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingKey === 'weekly' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Envoyer email semaine (test)
                  </button>

                  <button
                    type="button"
                    onClick={() => sendTestEmail('daily')}
                    disabled={testingKey !== null || !settings}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingKey === 'daily' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Envoyer email du jour (test)
                  </button>

                  <button
                    type="button"
                    onClick={() => sendTestEmail('push')}
                    disabled={testingKey !== null || !settings || !pushEnabled}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingKey === 'push' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Envoyer notification push (test)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
