import { clerkMiddleware } from '@clerk/nextjs/server'

const PUBLIC_PATH_PREFIXES = [
  '/api/webhook',
  '/api/cron/',
]

export default clerkMiddleware(async (auth, request) => {
  try {
    const pathname = new URL(request.url).pathname
    const isPublic = PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))

    if (!isPublic) {
      await auth.protect()
    }
  } catch (err) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}