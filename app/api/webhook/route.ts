import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  // Ce log DOIT apparaître dans Vercel Logs si le middleware est OK
  console.log(">>> [WEBHOOK] Requête reçue sur /api/webhook");

  try {
    const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    if (!secret) {
      return new Response('ERROR: 409_SECRET_MISSING', { status: 409 });
    }

    const svix_id = req.headers.get("svix-id");
    const svix_sig = req.headers.get("svix-signature");
    const svix_ts = req.headers.get("svix-timestamp");
    
    if (!svix_id || !svix_sig || !svix_ts) {
      return new Response('ERROR: 412_HEADERS_MISSING', { status: 412 });
    }

    let evt;
    try {
      // On utilise le "req" directement
      evt = await verifyWebhook(req) as { type: string; data: any };
    } catch (verifyErr) {
      console.error(">>> [WEBHOOK] Erreur de signature");
      return new Response('ERROR: 401_SIGNATURE_INVALID', { status: 401 }); 
    }

    const { type, data } = evt;
    const email = data?.email_addresses?.[0]?.email_address || data?.primary_email_address || '';

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
      console.error(">>> [WEBHOOK] Erreur Prisma:", prismaErr);
      return new Response('ERROR: 418_PRISMA_ERROR', { status: 418 });
    }

    return new Response('OK_PROCESSED', { status: 200 });

  } catch (err) {
    return new Response('ERROR: 500_CRASH', { status: 500 });
  }
}