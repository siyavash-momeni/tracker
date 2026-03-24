'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { AlertCircle, Loader2 } from 'lucide-react';

type UserInfo = {
  id: string;
  clerkId: string;
  email: string;
  createdAt: string;
  subscriptionStatus: string;
  subscriptionInterval: string;
  subscriptionCurrentPeriodEnd: string | null;
  premiumGranted: boolean;
  trialEndsAt: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingPremium, setUpdatingPremium] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    // Vérifie si l'utilisateur est admin
    const userRole = user?.publicMetadata?.role as string | undefined;
    if (userRole !== 'admin') {
      router.push('/');
      return;
    }

    // Récupère la liste des utilisateurs
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/users');

        if (!res.ok) {
          if (res.status === 403) {
            router.push('/');
            return;
          }
          const data = await res.json();
          throw new Error(data.error || 'Erreur lors du chargement');
        }

        const data = await res.json();
        setUsers(data.users);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isLoaded, user, router]);

    const togglePremium = async (userId: string, currentValue: boolean) => {
      try {
        setUpdatingPremium(userId);

        const res = await fetch(`/api/admin/users/${userId}/premium`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ premiumGranted: !currentValue }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Erreur lors de la mise à jour');
          return;
        }

        // Mets à jour la liste locale
        setUsers(users.map(u =>
          u.clerkId === userId ? { ...u, premiumGranted: !currentValue } : u
        ));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setUpdatingPremium(null);
      }
    };

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Panneau d'Administration</h1>
          <p className="text-gray-600 mt-2">Gestion des utilisateurs et abonnements</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-gray-600 text-sm">Total utilisateurs</p>
            <p className="text-3xl font-bold mt-2">{users.length}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-gray-600 text-sm">Utilisateurs actifs</p>
            <p className="text-3xl font-bold mt-2">
              {users.filter(u => u.subscriptionStatus === 'ACTIVE' || u.subscriptionStatus === 'TRIALING').length}
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-gray-600 text-sm">Accès premium</p>
            <p className="text-3xl font-bold mt-2">
              {users.filter(u => u.premiumGranted || u.subscriptionStatus === 'ACTIVE').length}
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-gray-600 text-sm">Utilisateurs gratuits</p>
            <p className="text-3xl font-bold mt-2">
              {users.filter(u => u.subscriptionStatus === 'FREE').length}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Inscription</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Statut</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Plan</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Fin période</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Premium</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Premium accordé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={user.subscriptionStatus} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.subscriptionInterval === 'NONE' ? (
                        <span className="text-gray-500">—</span>
                      ) : (
                        user.subscriptionInterval === 'MONTHLY' ? 'Mensuel' : 'Annuel'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.subscriptionCurrentPeriodEnd ? (
                        new Date(user.subscriptionCurrentPeriodEnd).toLocaleDateString('fr-FR')
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {user.premiumGranted ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Accordé
                        </span>
                      ) : user.subscriptionStatus === 'ACTIVE' || user.subscriptionStatus === 'TRIALING' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Non
                        </span>
                      )}
                    </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => togglePremium(user.clerkId, user.premiumGranted)}
                          disabled={updatingPremium === user.clerkId}
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            user.premiumGranted
                              ? 'bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50'
                          }`}
                        >
                          {updatingPremium === user.clerkId ? (
                            <>
                              <Loader2 size={14} className="animate-spin mr-1" />
                              Mise à jour...
                            </>
                          ) : user.premiumGranted ? (
                            'Activé'
                          ) : (
                            'Désactivé'
                          )}
                        </button>
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">Aucun utilisateur trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; color: string }> = {
    FREE: { label: 'Gratuit', color: 'bg-gray-100 text-gray-800' },
    TRIALING: { label: 'Essai', color: 'bg-blue-100 text-blue-800' },
    ACTIVE: { label: 'Actif', color: 'bg-green-100 text-green-800' },
    PAST_DUE: { label: 'Retard', color: 'bg-orange-100 text-orange-800' },
    CANCELED: { label: 'Annulé', color: 'bg-red-100 text-red-800' },
    INCOMPLETE: { label: 'Incomplet', color: 'bg-orange-100 text-orange-800' },
    INCOMPLETE_EXPIRED: { label: 'Expiré', color: 'bg-red-100 text-red-800' },
    UNPAID: { label: 'Impayé', color: 'bg-red-100 text-red-800' },
  };

  const info = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
      {info.label}
    </span>
  );
}
