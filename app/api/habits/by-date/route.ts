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

    const dateParam = request.nextUrl.searchParams.get('date');
    if (!dateParam) {
      return NextResponse.json(
        { error: 'Le paramètre date est requis' },
        { status: 400 }
      );
    }

    // Récupérer les completions du jour
    const startOfDay = new Date(`${dateParam}T00:00:00Z`);
    const endOfDay = new Date(`${dateParam}T23:59:59Z`);

    const completions = await prisma.habitCompletion.findMany({
      where: {
        habit: {
          userId,
        },
        completedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        habit: true,
      },
    });

    return NextResponse.json({
      success: true,
      completedHabitIds: completions.map(c => c.habitId),
      completions,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des completions:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
