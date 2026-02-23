import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextResponse } from 'next/server';

// app/api/stats/route.ts
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    // Récupérer la date depuis l'URL (ex: ?range=7d)
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range'); 
    
    let dateFilter = {};
    if (range === '7d') {
      dateFilter = { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
    }
    // ... ajoute tes autres conditions (mois, etc.)

    const [totalHabits, totalCompletions] = await Promise.all([
      prisma.habit.count({ where: { userId } }),
      prisma.habitCompletion.count({
        where: {
          habit: { userId },
          ...(range ? { completedAt: dateFilter } : {}) // Filtre optionnel
        },
      }),
    ]);

    return NextResponse.json({ totalHabits, totalCompletions });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}