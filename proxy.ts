import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// 1. On crée un "matcher" pour les routes qui doivent être publiques
// Remplace bien '/api/webhook' par le chemin exact de ton fichier
const isPublicRoute = createRouteMatcher(['/api/webhook(.*)'])

export default clerkMiddleware(async (auth, request) => {
  // 2. Si la route n'est PAS publique, on demande une authentification
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Ignore les fichiers internes Next.js et les fichiers statiques
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Toujours exécuter pour les routes API (mais le code ci-dessus gérera l'exception)
    '/(api|trpc)(.*)',
  ],
}