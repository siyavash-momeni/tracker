import { clerkMiddleware } from '@clerk/nextjs/server'

const PUBLIC_PATH_PREFIXES = [
  '/api/webhook',
  '/api/cron/',
]

export default clerkMiddleware(async (auth, request) => {
  try {
    const url = new URL(request.url)
    const pathname = url.pathname
    const isPublic = PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))

    // Log pour debug
    console.log('[PROXY CHECK]', new Date().toISOString())
    console.log('  Request URL:', request.url)
    console.log('  Pathname:', pathname)
    console.log('  Is public route:', isPublic)

    if (!isPublic) {
      console.log('  -> Protected route, auth required')
      await auth.protect()
    } else {
      console.log('  -> Public route, skipping auth')
    }
  } catch (err) {
    console.error('[PROXY ERROR]', err)
    // En cas d'erreur, on protège quand même
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}