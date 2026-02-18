import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)
    const { type, data } = evt as { type: string; data: any };

    const email =
      data?.email_addresses?.[0]?.email_address ||
      data?.primary_email_address ||
      '';

    switch (type) {
      case "user.created":
        await prisma.user.upsert({
          where: { clerkId: data.id },
          update: { email },
          create: { clerkId: data.id, email },
        });
        break;

      case "user.updated":
        await prisma.user.update({
          where: { clerkId: data.id },
          data: { email },
        });
        break;

      case "user.deleted":
        await prisma.user.delete({ where: { clerkId: data.id } });
        break;

      default:
        console.log("Unhandled event type:", type);
    }

    return new Response('Webhook received', { status: 200 })
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error verifying webhook', { status: 400 })
  }
}
