import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    // --- ÉTAPE 1 : Vérification du Secret ---
    const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    if (!secret) {
      return new Response('SECRET_MISSING', { status: 409 }); // 409 = Secret absent dans Vercel
    }

    // --- ÉTAPE 2 : Vérification des Headers ---
    const svix_id = req.headers.get("svix-id");
    const svix_sig = req.headers.get("svix-signature");
    const svix_ts = req.headers.get("svix-timestamp");
    
    if (!svix_id || !svix_sig || !svix_ts) {
      return new Response('HEADERS_MISSING', { status: 412 }); // 412 = Headers Clerk absents
    }

    // --- ÉTAPE 3 : La vérification Clerk/Svix ---
    let evt;
    try {
      evt = await verifyWebhook(req) as { type: string; data: any };
    } catch (verifyErr) {
      // Si tu vois 401 ici, c'est que la signature est invalide (Secret incorrect)
      return new Response('SIGNATURE_INVALID', { status: 401 }); 
    }

    const { type, data } = evt;
    const email = data?.email_addresses?.[0]?.email_address || data?.primary_email_address || '';

    // --- ÉTAPE 4 : Prisma ---
    try {
      switch (type) {
        case "user.created":
          await prisma.user.upsert({
            where: { clerkId: data.id },
            update: { email },
            create: { clerkId: data.id, email },
          });
          break;
        case "user.updated":
          await prisma.user.update({ where: { clerkId: data.id }, data: { email } });
          break;
        case "user.deleted":
          await prisma.user.delete({ where: { clerkId: data.id } });
          break;
      }
    } catch (prismaErr) {
      return new Response('PRISMA_ERROR', { status: 418 }); // 418 = Problème de Base de données
    }

    return new Response('OK', { status: 200 });

  } catch (err) {
    return new Response('UNKNOWN_CRASH', { status: 500 });
  }
}