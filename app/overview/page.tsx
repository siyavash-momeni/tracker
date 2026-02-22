'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Loader, Plus, Trash2 } from 'lucide-react';
import moment, { Moment } from 'moment';

interface Habit {
  id: string;
  title: string;
  emoji: string;
  createdAt: string;
}

interface HabitWithCompletion extends Habit {
  completedToday: boolean;
}

export default function OverviewPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedDate, setSelectedDate] = useState<Moment>(() => moment().startOf('day'));
  const [habitsForDate, setHabitsForDate] = useState<HabitWithCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Générer les 7 jours de la semaine
  const getWeekDays = () => {
    const days = [];
    const startOfWeek = moment().startOf('week');
    for (let i = 0; i < 7; i++) {
      days.push(startOfWeek.clone().add(i, 'day'));
    }
    return days;
  };

  const weekDays = getWeekDays();

  useEffect(() => {
    fetchHabits();
  }, []);

  useEffect(() => {
    // Charger les habits pour la date sélectionnée quand elle change
    if (habits.length > 0) {
      fetchHabitsForDate(selectedDate);
    }
  }, [selectedDate, habits]);

  const fetchHabits = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/habits');

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des habitudes');
      }

      const data = await response.json();
      setHabits(data.habits || []);
    } catch (err) {
      console.error(err);
      setHabits([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHabitsForDate = async (date: Moment) => {
    try {
      const dateStr = date.format('YYYY-MM-DD');
      const response = await fetch(`/api/habits/by-date?date=${dateStr}`);

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération');
      }

      const data = await response.json();
      
      // Créer les habits avec l'info de completion
      const habitsWithCompletion = habits.map(habit => ({
        ...habit,
        completedToday: data.completedHabitIds?.includes(habit.id) || false,
      }));

      setHabitsForDate(habitsWithCompletion);
    } catch (err) {
      console.error(err);
      setHabitsForDate(
        habits.map(habit => ({
          ...habit,
          completedToday: false,
        }))
      );
    }
  };

  const toggleHabitCompletion = async (habitId: string, currentStatus: boolean) => {
    setUpdatingIds(prev => new Set(prev).add(habitId));

    try {
      const response = await fetch('/api/habits/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          habitId,
          date: selectedDate.format('YYYY-MM-DD'),
          completed: !currentStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour');
      }

      setHabitsForDate(habitsForDate.map(h =>
        h.id === habitId ? { ...h, completedToday: !currentStatus } : h
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
    }
  };

  const deleteHabit = async (habitId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette habitude ?')) {
      return;
    }

    setUpdatingIds(prev => new Set(prev).add(habitId));

    try {
      const response = await fetch(`/api/habits/${habitId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      // Supprimer l'habitude de la liste
      setHabits(habits.filter(h => h.id !== habitId));
      setHabitsForDate(habitsForDate.filter(h => h.id !== habitId));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header avec navigation */}
      <div className="px-3 sm:px-4 py-4 sm:py-6 bg-white/60 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3 sm:mb-4">Suivi du jour</h2>

          {/* Calendrier de la semaine */}
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <button
              onClick={() => setSelectedDate(selectedDate.clone().subtract(1, 'week'))}
              className="p-2 hover:bg-gray-200 rounded-lg sm:rounded-xl transition-all duration-200 text-gray-600 hover:text-gray-900 flex-shrink-0"
            >
              <ChevronLeft size={18} className="sm:w-5 sm:h-5" />
            </button>

            <div className="flex gap-1 sm:gap-2 flex-1 justify-center overflow-x-auto">
              {weekDays.map(day => (
                <button
                  key={day.format('YYYY-MM-DD')}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center justify-center gap-1 px-2 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-2xl transition-all duration-300 flex-shrink-0 font-medium text-xs sm:text-sm ${
                    selectedDate.format('YYYY-MM-DD') === day.format('YYYY-MM-DD')
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg scale-100 sm:scale-105'
                      : 'bg-white/50 text-gray-700 hover:bg-white/80 border border-gray-200/50'
                  }`}
                >
                  <span className="text-[8px] sm:text-xs font-bold tracking-wider uppercase opacity-80">
                    {day.format('ddd')}
                  </span>
                  <span className="text-base sm:text-lg font-bold">{day.format('D')}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setSelectedDate(selectedDate.clone().add(1, 'week'))}
              className="p-2 hover:bg-gray-200 rounded-lg sm:rounded-xl transition-all duration-200 text-gray-600 hover:text-gray-900 flex-shrink-0"
            >
              <ChevronRight size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Date sélectionnée */}
          <div className="mt-2 sm:mt-4 text-center text-xs sm:text-sm font-semibold text-gray-600">
            {selectedDate.format('dddd D MMMM').charAt(0).toUpperCase() + selectedDate.format('dddd D MMMM').slice(1)}
          </div>
        </div>
      </div>

      {/* Content - Liste des habitudes */}
      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="mb-4 inline-flex items-center justify-center w-12 sm:w-16 h-12 sm:h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
                <Loader className="text-blue-600 animate-spin sm:w-8 sm:h-8" size={24} />
              </div>
              <p className="text-sm sm:text-base text-gray-600 font-medium">Chargement en cours...</p>
            </div>
          </div>
        ) : habits.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center justify-center text-center px-4">
              <div className="text-5xl sm:text-6xl mb-4 opacity-50">📝</div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                Aucune habitude créée
              </h3>
              <p className="text-sm sm:text-base text-gray-600">
                Créez votre première habitude pour commencer le suivi.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-3 sm:px-4 py-4 sm:py-6">
            <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
              {/* Section Non Accomplis */}
              {habitsForDate.filter(h => !h.completedToday).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">À accomplir aujourd'hui</h3>
                    <span className="ml-auto text-xs sm:text-sm font-semibold bg-blue-100 text-blue-700 px-2.5 sm:px-3 py-1 rounded-full">
                      {habitsForDate.filter(h => !h.completedToday).length}
                    </span>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    {habitsForDate.filter(h => !h.completedToday).map((habit, idx) => (
                      <HabitCard 
                        key={habit.id}
                        habit={habit} 
                        idx={idx}
                        updatingIds={updatingIds}
                        toggleHabitCompletion={toggleHabitCompletion}
                        deleteHabit={deleteHabit}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Section Accomplis */}
              {habitsForDate.filter(h => h.completedToday).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">Accomplis</h3>
                    <span className="ml-auto text-xs sm:text-sm font-semibold bg-emerald-100 text-emerald-700 px-2.5 sm:px-3 py-1 rounded-full">
                      {habitsForDate.filter(h => h.completedToday).length}
                    </span>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    {habitsForDate.filter(h => h.completedToday).map((habit, idx) => (
                      <HabitCard 
                        key={habit.id}
                        habit={habit} 
                        idx={idx}
                        updatingIds={updatingIds}
                        toggleHabitCompletion={toggleHabitCompletion}
                        deleteHabit={deleteHabit}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function HabitCard({
  habit,
  idx,
  updatingIds,
  toggleHabitCompletion,
  deleteHabit,
}: {
  habit: any;
  idx: number;
  updatingIds: Set<string>;
  toggleHabitCompletion: (habitId: string, isCompleted: boolean) => void;
  deleteHabit: (habitId: string) => void;
}) {
  return (
    <div
      className={`group flex items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-2xl transition-all duration-300 transform hover:scale-100 sm:hover:scale-102 ${
        habit.completedToday
          ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 opacity-50'
          : 'bg-white/70 backdrop-blur-sm border border-gray-200/50 hover:border-blue-300 hover:shadow-lg'
      }`}
      style={{
        animation: `slideIn 0.5s ease-out ${idx * 0.05}s both`,
      }}
    >
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Left: Emoji + Title */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <div className={`text-3xl sm:text-4xl transition-transform duration-300 flex-shrink-0 ${habit.completedToday ? 'scale-100 sm:scale-110' : 'group-hover:scale-100 sm:group-hover:scale-110'}`}>
          {habit.emoji}
        </div>
        <div className="min-w-0">
          <h3
            className={`font-semibold text-sm sm:text-base transition-all duration-300 ${
              habit.completedToday
                ? 'text-emerald-700 line-through opacity-70'
                : 'text-gray-900'
            }`}
          >
            {habit.title}
          </h3>
          <p className="text-xs text-gray-500">
            Créé le {moment(habit.createdAt).format('D MMM YYYY')}
          </p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Checkbox pour marquer comme complété */}
        <button
          onClick={() => toggleHabitCompletion(habit.id, habit.completedToday)}
          disabled={updatingIds.has(habit.id)}
          className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl border-2 transition-all duration-300 ${
            habit.completedToday
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-500'
              : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
          } disabled:opacity-50 disabled:cursor-not-allowed group-hover:border-blue-400`}
          title={habit.completedToday ? 'Marquer comme non complété' : 'Marquer comme complété'}
        >
          {updatingIds.has(habit.id) ? (
            <Loader size={14} className={`animate-spin sm:w-4 sm:h-4 ${habit.completedToday ? 'text-white' : 'text-gray-600'}`} />
          ) : habit.completedToday ? (
            <Check size={14} className="text-white sm:w-4 sm:h-4" />
          ) : null}
        </button>

        {/* Bouton de suppression */}
        <button
          onClick={() => deleteHabit(habit.id)}
          disabled={updatingIds.has(habit.id)}
          className="p-1.5 sm:p-2.5 bg-red-50 text-red-600 rounded-lg sm:rounded-xl hover:bg-red-100 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group-hover:opacity-100 opacity-0"
          title="Supprimer l'habitude"
        >
          <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
        </button>
      </div>
    </div>
  );
}

