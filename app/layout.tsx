'use client';

import { ClerkProvider, SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/nextjs';
import "./globals.css";
import { Home, BarChart2, PlusCircle, Settings } from "lucide-react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <AppShell>{children}</AppShell>
    </ClerkProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  
  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="antialiased app-background">
          
          {/* Container principal */}
          <div className="app-root flex flex-col min-h-dvh">

            {/* HEADER FIXE */}
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 h-14 sm:h-16 flex items-center justify-between px-3 sm:px-4 shrink-0 shadow-sm">
              <div className="w-8 sm:w-10" />
              
              <div className="flex flex-col items-center">
                <h1 className="text-lg sm:text-xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-blue-700 to-indigo-700 bg-clip-text text-transparent">
                  Habit Tracker
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-500 italic">
                  Tracez vos habitudes
                </p>
              </div>

              <div className="w-8 sm:w-10 flex justify-end">
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="text-[10px] sm:text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                      Login
                    </button>
                  </SignInButton>
                </SignedOut>
              </div>
            </header>

            {/* CONTENU PRINCIPAL (SCROLL DU BODY) */}
            <main className="flex-1 px-3 sm:px-6 py-4 pb-32 sm:pb-36">
              {children}
            </main>

            {/* NAV FIXE */}
            <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white/80 backdrop-blur-md border-t border-gray-200/50 h-24 sm:h-28 flex items-center justify-around px-1 sm:px-2 shadow-lg">
              <NavItem icon={<Home size={22} className="sm:w-7 sm:h-7" />} label="Accueil" href="/" active={isActive('/')} />
              <NavItem icon={<PlusCircle size={22} className="sm:w-7 sm:h-7" />} label="Ajouter" href="/add_habit" active={isActive('/add_habit')} />
              <NavItem icon={<BarChart2 size={22} className="sm:w-7 sm:h-7" />} label="Stats" href="/stats" active={isActive('/stats')} />
              <NavItem icon={<Settings size={22} className="sm:w-7 sm:h-7" />} label="Paramètres" href="/settings" active={isActive('/settings')} />
            </nav>

            

          </div>

      </body>
    </html>
  );
}

function NavItem({ icon, label, href, active = false }: {
  icon: React.ReactNode
  label: string
  href: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-1 w-full py-3.5 sm:py-4 px-2 sm:px-3 rounded-lg sm:rounded-xl transition-all duration-300 group ${
        active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <div className={`p-2 sm:p-2.5 rounded-lg transition-all duration-300 ${
        active ? 'bg-blue-100 text-blue-600' : 'group-hover:bg-gray-100'
      }`}>
        {icon}
      </div>
      <span className="text-[9px] sm:text-[10px] font-semibold tracking-tight">
        {label}
      </span>
    </Link>
  );
}