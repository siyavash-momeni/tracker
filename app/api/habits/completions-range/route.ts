import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const startParam = request.nextUrl.searchParams.get('start');
    const endParam = request.nextUrl.searchParams.get('end');

    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: 'Les paramètres start et end (YYYY-MM-DD) sont requis' },
        { status: 400 }
      );
    }

    const startOfRange = new Date(`${startParam}T00:00:00Z`);
    const endOfRange = new Date(`${endParam}T23:59:59Z`);

    const completions = await prisma.habitCompletion.findMany({
      where: {
        habit: { userId },
        completedDate: {
          gte: startOfRange,
          lte: endOfRange,
        },
      },
      select: { completedDate: true },
    });

    const byDate: Record<string, number> = {};
    for (const c of completions) {
      const key = c.completedDate.toISOString().slice(0, 10);
      byDate[key] = (byDate[key] || 0) + 1;
    }

    const days: Array<{ date: string; completions: number }> = [];
    const current = new Date(startOfRange);
    while (current <= endOfRange) {
      const key = current.toISOString().slice(0, 10);
      days.push({ date: key, completions: byDate[key] || 0 });
      current.setDate(current.getDate() + 1);
    }

    return NextResponse.json({
      success: true,
      days,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des completions par plage:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
