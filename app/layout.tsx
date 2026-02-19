import { ClerkProvider, SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/nextjs';
import "./globals.css";
import { Home, BarChart2, PlusCircle, Settings } from "lucide-react"; // Utilisation de Lucide pour les icônes

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="fr">
        <body className="antialiased bg-gray-50 flex flex-col h-screen overflow-hidden">
          
          {/* HEADER : Titre centré + Profil à droite */}
          <header className="safe-top bg-white border-b h-16 flex items-center justify-between px-4 shrink-0">
            <div className="w-10" /> {/* Spacer pour équilibrer le titre centré */}
            <h1 className="text-lg font-semibold text-gray-900">Habit Tracker</h1>
            <div className="w-10 flex justify-end">
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                   <button className="text-xs font-medium text-blue-600">Login</button>
                </SignInButton>
              </SignedOut>
            </div>
          </header>

          {/* BODY : Zone de contenu vide et scrollable si nécessaire */}
          <main className="flex-1 overflow-hidden">
            {children}
          </main>

          {/* BOTTOM NAVIGATION : 4 Onglets */}
          <nav className="safe-bottom bg-white border-t h-20 flex items-center justify-around px-2 shrink-0">
            <NavItem icon={<Home size={24} />} label="Habits" active />
            <NavItem icon={<BarChart2 size={24} />} label="Overview" />
            <NavItem icon={<PlusCircle size={24} />} label="Add Habit" />
            <NavItem icon={<Settings size={24} />} label="Settings" />
          </nav>

        </body>
      </html>
    </ClerkProvider>
  );
}

// Composant utilitaire pour les items de navigation
function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`flex flex-col items-center justify-center gap-1 w-full ${active ? 'text-blue-600' : 'text-gray-400'}`}>
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}