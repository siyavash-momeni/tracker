'use client';

// Documentation FR: Élément de navigation admin affiché uniquement pour les utilisateurs autorisés.
import { useUser } from '@clerk/nextjs';
import { Shield } from 'lucide-react';
import Link from 'next/link';

export function AdminNavItem({ isActive }: { isActive: boolean }) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return null;

  const userRole = user?.publicMetadata?.role as string | undefined;
  if (userRole !== 'admin') return null;

  return (
    <Link
      href="/admin"
      className={`flex flex-col items-center justify-center gap-1 w-full py-3.5 sm:py-4 px-2 sm:px-3 rounded-lg sm:rounded-xl transition-all duration-300 group ${
        isActive ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <div className={`p-2 sm:p-2.5 rounded-lg transition-all duration-300 ${
        isActive ? 'bg-purple-100 text-purple-600' : 'group-hover:bg-gray-100'
      }`}>
        <Shield size={22} className="sm:w-7 sm:h-7" />
      </div>

      <span className="text-[9px] sm:text-[10px] font-semibold tracking-tight">
        Admin
      </span>
    </Link>
  );
}
