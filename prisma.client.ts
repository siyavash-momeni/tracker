import { PrismaClient } from "@prisma/client";

// On définit un objet global pour stocker Prisma (pour éviter les erreurs TS)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// On utilise l'instance existante ou on en crée une nouvelle
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"], // Optionnel : affiche les requêtes SQL dans ton terminal
  });

// Si on est pas en production, on stocke l'instance dans le global
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;