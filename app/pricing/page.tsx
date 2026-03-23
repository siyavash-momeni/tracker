'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

type SubscriptionStatus =
  | 'FREE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
  | 'UNPAID';

type SubscriptionInterval = 'NONE' | 'MONTHLY' | 'YEARLY';

type SettingsPayload = {
  subscriptionStatus: SubscriptionStatus;
  subscriptionInterval: SubscriptionInterval;
  subscriptionCurrentPeriodEnd: string | null;
  trialEndsAt: string | null;
  subscriptionCancelAtPeriodEnd: boolean;
};

export default function PricingPage() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<'monthly' | 'yearly' | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');

  const urlState = useMemo(() => {
    if (typeof window === 'undefined') return { success: false, canceled: false };
    const params = new URLSearchParams(window.location.search);
    return {
      success: params.get('success') === '1',
      canceled: params.get('canceled') === '1',
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Impossible de charger le statut abonnement.');
        }
        setSettings({
          subscriptionStatus: data.settings.subscriptionStatus,
          subscriptionInterval: data.settings.subscriptionInterval,
          subscriptionCurrentPeriodEnd: data.settings.subscriptionCurrentPeriodEnd,
          trialEndsAt: data.settings.trialEndsAt,
          subscriptionCancelAtPeriodEnd: data.settings.subscriptionCancelAtPeriodEnd,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const startCheckout = async (plan: 'monthly' | 'yearly') => {
    setCheckoutPlan(plan);
    setError('');

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'SUBSCRIPTION_ALREADY_EXISTS') {
          throw new Error('Un abonnement existe déjà. Utilisez la gestion d’abonnement pour le modifier ou l’annuler.');
        }
        throw new Error(data.error || 'Impossible de démarrer le paiement.');
      }

      if (!data.url) {
        throw new Error('URL Stripe Checkout manquante.');
      }

      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setCheckoutPlan(null);
    }
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Impossible d’ouvrir la gestion d’abonnement.');
      }

      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setPortalLoading(false);
    }
  };

  const periodEndText = settings?.subscriptionCurrentPeriodEnd
    ? new Date(settings.subscriptionCurrentPeriodEnd).toLocaleDateString('fr-CH')
    : null;

  const trialEndText = settings?.trialEndsAt
    ? new Date(settings.trialEndsAt).toLocaleDateString('fr-CH')
    : null;
  const hasManagedSubscription = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'INCOMPLETE', 'UNPAID'].includes(
    settings?.subscriptionStatus || 'FREE'
  );

  return (
    <div className="max-w-3xl mx-auto w-full space-y-4">
      <div className="page-header mb-2">
        <div className="container">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Abonnement
          </h2>
        </div>
      </div>

      {urlState.success && (
        <div className="flex gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <p className="text-sm text-emerald-800">Paiement validé. Le statut sera synchronisé automatiquement.</p>
        </div>
      )}

      {urlState.canceled && (
        <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertCircle size={18} className="text-amber-600" />
          <p className="text-sm text-amber-800">Paiement annulé. Aucun changement appliqué.</p>
        </div>
      )}

      {error && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl">
          <AlertCircle size={18} className="text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-2">
        <p className="text-sm text-gray-500">Statut actuel</p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 size={16} className="animate-spin" /> Chargement...
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-900">
              {settings?.subscriptionStatus || 'FREE'}
              {settings?.subscriptionInterval && settings.subscriptionInterval !== 'NONE' ? ` • ${settings.subscriptionInterval}` : ''}
            </p>
            {trialEndText && <p className="text-xs text-gray-600">Fin d’essai: {trialEndText}</p>}
            {periodEndText && <p className="text-xs text-gray-600">Prochain renouvellement: {periodEndText}</p>}
            {settings?.subscriptionCancelAtPeriodEnd && (
              <p className="text-xs text-amber-700">Résiliation planifiée en fin de période.</p>
            )}
          </>
        )}

        {hasManagedSubscription && (
          <div className="pt-2 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="rounded-xl bg-blue-600 text-white font-semibold py-2.5 px-4 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {portalLoading ? 'Redirection...' : 'Changer ou annuler'}
            </button>

            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Voir dans paramètres
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <p className="text-sm text-gray-500">Mensuel</p>
          <p className="text-2xl font-bold text-gray-900">2 CHF/mois</p>
          <p className="text-sm text-gray-600">14 jours gratuits, puis facturation mensuelle.</p>
          <button
            type="button"
            onClick={() => startCheckout('monthly')}
            disabled={checkoutPlan !== null || hasManagedSubscription}
            className="w-full rounded-xl bg-blue-600 text-white font-semibold py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {hasManagedSubscription ? 'Déjà abonné' : checkoutPlan === 'monthly' ? 'Redirection...' : 'Choisir mensuel'}
          </button>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <p className="text-sm text-gray-500">Annuel</p>
          <p className="text-2xl font-bold text-gray-900">19 CHF/an</p>
          <p className="text-sm text-gray-600">Économisez vs le plan mensuel.</p>
          <button
            type="button"
            onClick={() => startCheckout('yearly')}
            disabled={checkoutPlan !== null || hasManagedSubscription}
            className="w-full rounded-xl bg-indigo-600 text-white font-semibold py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {hasManagedSubscription ? 'Déjà abonné' : checkoutPlan === 'yearly' ? 'Redirection...' : 'Choisir annuel'}
          </button>
        </div>
      </div>
    </div>
  );
}
