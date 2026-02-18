import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()

export const config = {
  matcher: [
    // toutes les pages et routes sauf fichiers statiques   
    '/((?!_next|favicon.ico).*)',
    // toutes les API
    '/api/(.*)',
    '/trpc/(.*)',
  ],
}
