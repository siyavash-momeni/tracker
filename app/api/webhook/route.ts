import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    // 1. Vérification du Secret
    const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    if (!secret) {
      return new Response('ERROR: 409_SECRET_MISSING', { status: 409 });
    }

    // 2. Récupération des Headers
    const svix_id = req.headers.get("svix-id");
    const svix_sig = req.headers.get("svix-signature");
    const svix_ts = req.headers.get("svix-timestamp");
    
    if (!svix_id || !svix_sig || !svix_ts) {
      return new Response('ERROR: 412_HEADERS_MISSING', { status: 412 });
    }

    // 3. Vérification de la signature Clerk
    let evt;
    try {
      evt = await verifyWebhook(req) as { type: string; data: any };
    } catch (verifyErr) {
      return new Response('ERROR: 401_SIGNATURE_INVALID', { status: 401 }); 
    }

    const { type, data } = evt;
    const email = data?.email_addresses?.[0]?.email_address || data?.primary_email_address || '';

    // 4. Logique Base de données (Neon via Prisma)
    try {
      switch (type) {
        case "user.created":
        case "user.updated":
          // On utilise upsert pour éviter l'erreur si l'ID n'existe pas encore (test Clerk)
          await prisma.user.upsert({
            where: { clerkId: data.id },
            update: { email },
            create: { clerkId: data.id, email },
          });
          break;

        case "user.deleted":
          // deleteMany ne renvoie pas d'erreur si l'utilisateur est déjà absent
          await prisma.user.deleteMany({ 
            where: { clerkId: data.id } 
          });
          break;
      }
    } catch (prismaErr) {
      // Erreur réelle de base de données (ex: connexion perdue)
      return new Response('ERROR: 418_DATABASE_ISSUE', { status: 418 });
    }

    return new Response('OK_PROCESSED', { status: 200 });

  } catch (err) {
    return new Response('ERROR: 500_UNKNOWN_CRASH', { status: 500 });
  }
}