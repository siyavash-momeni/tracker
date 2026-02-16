import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mon App avec Clerk",
  description: "Authentification gérée par Clerk",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Le Provider doit envelopper TOUT le HTML pour que l'auth fonctionne partout
    <ClerkProvider>
      <html lang="fr">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          
          {/* Ton Header : Il sera visible sur toutes les pages */}
          <header className="flex justify-end items-center p-4 gap-4 h-16 border-b">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm font-medium hover:underline">Se connecter</button>
              </SignInButton>
              
              <SignUpButton mode="modal">
                <button className="bg-[#6c47ff] text-white rounded-full font-medium text-sm h-10 px-4">
                  S'inscrire
                </button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </header>

          {/* Le contenu de tes pages spécifiques (page.tsx) s'affichera ici */}
          <main>
            {children}
          </main>

        </body>
      </html>
    </ClerkProvider>
  );
}