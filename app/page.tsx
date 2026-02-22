'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, Target, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import moment from 'moment';

interface Habit {
  id: string;
  title: string;
  emoji: string;
  createdAt: string;
}

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHabits = async () => {
      try {
        const response = await fetch('/api/habits');
        const data = await response.json();
        setHabits(data.habits || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHabits();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Bonne matin';
    if (hour < 18) return '☀️ Bon après-midi';
    return '🌙 Bonne soirée';
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-6 sm:py-0">
        <div className="text-center max-w-2xl mx-auto w-full">
          {/* Greeting */}
          <div className="mb-6 sm:mb-8 animate-in fade-in slide-in-from-top-4">
            <p className="text-2xl sm:text-4xl font-bold mb-2">{getGreeting()}</p>
            <p className="text-xs sm:text-lg text-gray-600">
              {moment().format('dddd D MMMM YYYY').charAt(0).toUpperCase() + moment().format('dddd D MMMM YYYY').slice(1)}
            </p>
          </div>

          {/* Main Title */}
          <div className="mb-6 sm:mb-8 animate-in fade-in slide-in-from-top-4 delay-100">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-3 sm:mb-4">
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Construis tes habitudes
              </span>
            </h1>
            <p className="text-sm sm:text-xl text-gray-600 mb-2">
              Transforme ta vie un jour à la fois
            </p>
          </div>

          {/* Stats ou Welcome */}
          <div className="mb-8 sm:mb-12 animate-in fade-in slide-in-from-bottom-4">
            {loading ? (
              <div className="inline-block px-4 sm:px-6 py-2 sm:py-3 bg-white/50 backdrop-blur-sm border border-gray-200 rounded-xl sm:rounded-2xl">
                <p className="text-sm sm:text-base text-gray-600">Chargement...</p>
              </div>
            ) : habits.length === 0 ? (
              <div className="inline-block px-4 sm:px-6 py-3 sm:py-4 bg-white/50 backdrop-blur-sm border border-gray-200 rounded-xl sm:rounded-2xl">
                <p className="text-sm sm:text-base text-gray-700 font-medium">
                  Tu n'as pas encore d'habitudes 🌱
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {/* Habits Count */}
                <div className="p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg sm:rounded-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-left">
                      <p className="text-gray-600 text-xs sm:text-sm font-medium">Habitudes</p>
                      <p className="text-2xl sm:text-3xl font-bold text-blue-600">{habits.length}</p>
                    </div>
                    <Target size={24} className="sm:w-8 sm:h-8 text-blue-500 opacity-50 flex-shrink-0" />
                  </div>
                </div>

                {/* Streak */}
                <div className="p-4 sm:p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg sm:rounded-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-left">
                      <p className="text-gray-600 text-xs sm:text-sm font-medium">J'ai en cours</p>
                      <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{habits.length}</p>
                    </div>
                    <TrendingUp size={24} className="sm:w-8 sm:h-8 text-emerald-500 opacity-50 flex-shrink-0" />
                  </div>
                </div>

                {/* Recent Habit */}
                <div className="p-4 sm:p-6 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg sm:rounded-2xl">
                  <div>
                    <p className="text-gray-600 text-xs sm:text-sm font-medium mb-2">Dernière créée</p>
                    <div className="text-3xl sm:text-4xl mb-2">
                      {habits[0]?.emoji || '🎯'}
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-purple-700 truncate">
                      {habits[0]?.title || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 sm:gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-4 delay-200">
            {habits.length === 0 ? (
              <>
                <Link href="/add_habit" className="group w-full sm:w-auto">
                  <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-sm sm:text-base rounded-lg sm:rounded-2xl hover:shadow-lg transform hover:scale-105 transition-all duration-300">
                    <Sparkles size={18} className="sm:w-5 sm:h-5" />
                    Créer ma première habitude
                    <ArrowRight size={18} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/overview" className="group w-full sm:w-auto">
                  <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-sm sm:text-base rounded-lg sm:rounded-2xl hover:shadow-lg transform hover:scale-105 transition-all duration-300">
                    <Target size={18} className="sm:w-5 sm:h-5" />
                    Suivi du jour
                    <ArrowRight size={18} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
                <Link href="/add_habit" className="group w-full sm:w-auto">
                  <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white/70 backdrop-blur-sm text-gray-900 font-bold text-sm sm:text-base border border-gray-200 rounded-lg sm:rounded-2xl hover:bg-white hover:shadow-lg transform hover:scale-105 transition-all duration-300">
                    <Sparkles size={18} className="sm:w-5 sm:h-5" />
                    Ajouter une habitude
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* Motivational Quote */}
          <div className="mt-8 sm:mt-12 text-gray-500 text-xs sm:text-sm max-w-md mx-auto px-4">
            <p className="italic">
              "Le secret du changement c'est de concentrer toute ton énergie non pas à combattre l'ancien, mais à construire du nouveau." 
              <span className="block mt-2 font-semibold">— Socrate</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
