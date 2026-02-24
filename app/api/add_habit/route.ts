import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Récupérer l'utilisateur actuel
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Parser le body
    const body = await request.json();
    const { title, emoji = '🎯' } = body;

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le titre de l\'habitude est requis' },
        { status: 400 }
      );
    }

    if (title.length > 100) {
      return NextResponse.json(
        { error: 'Le titre ne doit pas dépasser 100 caractères' },
        { status: 400 }
      );
    }

    // Créer l'habitude
    const habit = await prisma.habit.create({
      data: {
        title: title.trim(),
        emoji: emoji || '🎯',
        userId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        habit,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erreur lors de la création de l\'habitude:', error);
    return NextResponse.json(
      { error: 'Erreur serveur lors de la création de l\'habitude' },
      { status: 500 }
    );
  }
}
