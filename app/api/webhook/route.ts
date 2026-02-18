import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  console.log('--- START WEBHOOK DEBUG ---');
  
  try {
    // 1. Vérification du Secret
    const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    console.log('1. Secret présent ?:', !!secret);
    console.log('1.5 Debut du secret (Vercel):', secret?.slice(0, 5));

    // 2. Vérification des Headers Svix (Crucial pour la prod)
    const svix_id = req.headers.get("svix-id");
    const svix_sig = req.headers.get("svix-signature");
    const svix_ts = req.headers.get("svix-timestamp");
    
    console.log('2. Headers Svix présents ?:', { 
      id: !!svix_id, 
      sig: !!svix_sig, 
      ts: !!svix_ts 
    });

    // 3. Tentative de vérification
    console.log('3. Tentative de verifyWebhook...');
    let evt;
    try {
      evt = await verifyWebhook(req) as { type: string; data: any };
      console.log('4. Vérification réussie ! Type event:', evt.type);
    } catch (verifyErr) {
      console.error('4. ÉCHEC verifyWebhook:', verifyErr);
      return new Response('Verification Error', { status: 400 });
    }

    const { type, data } = evt;
    const email = data?.email_addresses?.[0]?.email_address || data?.primary_email_address || '';
    console.log('5. Data extraite:', { id: data.id, email });

    // 4. Opérations Prisma
    console.log('6. Tentative Prisma pour type:', type);
    switch (type) {
      case "user.created":
        const created = await prisma.user.upsert({
          where: { clerkId: data.id },
          update: { email },
          create: { clerkId: data.id, email },
        });
        console.log('7. Prisma success (created/upsert):', created.id);
        break;

      case "user.updated":
        await prisma.user.update({
          where: { clerkId: data.id },
          data: { email },
        });
        console.log('7. Prisma success (updated)');
        break;

      case "user.deleted":
        await prisma.user.delete({ where: { clerkId: data.id } });
        console.log('7. Prisma success (deleted)');
        break;

      default:
        console.log("6b. Unhandled event type:", type);
    }

    console.log('--- END WEBHOOK SUCCESS ---');
    return new Response('Webhook received', { status: 200 })

  } catch (err: any) {
    console.error('--- WEBHOOK CRASH ---');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    return new Response(`Error: ${err.message}`, { status: 400 })
  }
}