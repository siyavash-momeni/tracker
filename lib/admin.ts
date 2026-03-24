// Documentation FR: Module utilitaire partagé (helpers métier et intégrations).

import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * Vérifie si l'utilisateur connecté a le rôle admin
 * Le rôle admin est défini dans les metadata publiques de Clerk
 */
export async function isAdminUser(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  const user = await currentUser();
  if (!user) return false;

  // Vérifie si l'utilisateur a le rôle admin dans ses metadata publiques
  const role = user.publicMetadata?.role as string | undefined;
  return role === 'admin';
}

/**
 * Middleware pour protéger les routes admin
 * À utiliser dans les route handlers et les pages
 */
export async function requireAdminAccess(): Promise<void> {
  const isAdmin = await isAdminUser();
  if (!isAdmin) {
    throw new Error('Admin access required');
  }
}
