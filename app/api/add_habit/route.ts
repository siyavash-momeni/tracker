// Documentation FR: Route API serveur de Tracker (validation, accès auth et logique métier).

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextRequest, NextResponse } from 'next/server';
import { isPremiumUser } from '@/lib/stripe-billing';

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
    const {
      title,
      emoji = '🎯',
      targetValue = 1,
      frequency = 'DAILY',
      activeDays = [1, 2, 3, 4, 5, 6, 7],
    } = body;

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

    const normalizedTarget = Number(targetValue);
    if (!Number.isInteger(normalizedTarget) || normalizedTarget < 1 || normalizedTarget > 1000) {
      return NextResponse.json(
        { error: 'La valeur cible doit être un entier entre 1 et 1000' },
        { status: 400 }
      );
    }

    if (frequency !== 'DAILY' && frequency !== 'WEEKLY') {
      return NextResponse.json(
        { error: 'La fréquence doit être par jour ou par semaine' },
        { status: 400 }
      );
    }

    if (!Array.isArray(activeDays) || activeDays.length === 0) {
      return NextResponse.json(
        { error: 'Veuillez sélectionner au moins un jour actif' },
        { status: 400 }
      );
    }

    const normalizedActiveDays = [...new Set(activeDays.map((day) => Number(day)))]
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
      .sort((a, b) => a - b);

    if (normalizedActiveDays.length === 0) {
      return NextResponse.json(
        { error: 'Les jours actifs doivent être entre 1 et 7' },
        { status: 400 }
      );
    }

    // Vérifier la limite d'habitudes pour les utilisateurs gratuits
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        subscriptionStatus: true,
        premiumGranted: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const isPremium = isPremiumUser(user);

    if (!isPremium) {
      // Compter les habitudes existantes de l'utilisateur
      const habitCount = await prisma.habit.count({
        where: { userId },
      });

      if (habitCount >= 2) {
        return NextResponse.json(
          {
            error: 'Limite d\'habitudes atteinte',
            limitReached: true,
            currentLimit: 2,
          },
          { status: 403 }
        );
      }
    }

    // Créer l'habitude
    const habit = await prisma.habit.create({
      data: {
        title: title.trim(),
        emoji: emoji || '🎯',
        targetValue: normalizedTarget,
        frequency,
        activeDays: normalizedActiveDays,
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
