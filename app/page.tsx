"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Loader, Trash2, Plus } from "lucide-react";
import Link from "next/link";
import moment, { Moment } from "moment";

interface Habit {
  id: string;
  title: string;
  emoji: string;
  createdAt: string;
}

interface HabitWithCompletion extends Habit {
  completedToday: boolean;
}

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedDate, setSelectedDate] = useState<Moment>(() => moment().startOf('day'));
  const [displayedWeekBase, setDisplayedWeekBase] = useState<Moment>(() => moment().startOf('day'));
  const [habitsForDate, setHabitsForDate] = useState<HabitWithCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const getWeekDays = (base: Moment) => {
    const days: Moment[] = [];
    const startOfWeek = base.clone().startOf('isoWeek'); // Monday
    for (let i = 0; i < 7; i++) days.push(startOfWeek.clone().add(i, 'day'));
    return days;
  };

  const today = moment().startOf('day');
  const isTodaySelected = selectedDate.isSame(today, 'day');
  const displayedDays = getWeekDays(displayedWeekBase);
  const isTodayVisible = displayedDays.some((day) => day.isSame(today, 'day'));

  const periodLabel = (() => {
    const start = displayedDays[0];
    const end = displayedDays[displayedDays.length - 1];
    if (!start || !end) return '';
    if (start.isSame(end, 'month')) return start.format('MMMM YYYY');
    if (start.isSame(end, 'year')) return `${start.format('MMMM')} - ${end.format('MMMM YYYY')}`;
    return `${start.format('MMMM YYYY')} - ${end.format('MMMM YYYY')}`;
  })();

  useEffect(() => { fetchHabits(); }, []);
  useEffect(() => { if (habits.length) fetchHabitsForDate(selectedDate); }, [selectedDate, habits]);

  const fetchHabits = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error('Erreur');
      const data = await res.json();
      setHabits(data.habits || []);
    } catch (e) {
      console.error(e);
      setHabits([]);
    } finally { setLoading(false); }
  };

  const fetchHabitsForDate = async (date: Moment) => {
    try {
      const dateStr = date.format('YYYY-MM-DD');
      const res = await fetch(`/api/habits/by-date?date=${dateStr}`);
      if (!res.ok) throw new Error('Erreur');
      const data = await res.json();
      setHabitsForDate(habits.map(h => ({ ...h, completedToday: data.completedHabitIds?.includes(h.id) || false })));
    } catch (e) {
      console.error(e);
      setHabitsForDate(habits.map(h => ({ ...h, completedToday: false })));
    }
  };

  const toggleHabitCompletion = async (habitId: string, current: boolean) => {
    setUpdatingIds(prev => new Set(prev).add(habitId));
    try {
      const res = await fetch('/api/habits/completion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ habitId, date: selectedDate.format('YYYY-MM-DD'), completed: !current }) });
      if (!res.ok) throw new Error('Erreur');
      setHabitsForDate(habitsForDate.map(h => h.id === habitId ? { ...h, completedToday: !current } : h));
    } catch (e) { console.error(e); }
    setUpdatingIds(prev => { const next = new Set(prev); next.delete(habitId); return next; });
  };

  const deleteHabit = async (id: string) => {
    if (!confirm("Êtes-vous sûr ?")) return;
    setUpdatingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/habits/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur');
      setHabits(habits.filter(h => h.id !== id));
      setHabitsForDate(habitsForDate.filter(h => h.id !== id));
    } catch (e) { console.error(e); }
    setUpdatingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="page-header mb-4">
        <div className="container relative">
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Suivi du jour</h2>

              {habits.length > 0 && (
                <Link href="/add_habit">
                  <button className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-sm">
                    <Plus size={16} /> Ajouter
                  </button>
                </Link>
              )}
            </div>

            <div className="flex items-center justify-between gap-1 sm:gap-3 -mx-4 sm:mx-0">
              <button
                onClick={() =>
                  setDisplayedWeekBase(
                    displayedWeekBase
                      .clone()
                      .subtract(1, 'week')
                  )
                }
                className="p-0.5 sm:p-2 hover:bg-gray-200 rounded-lg sm:rounded-xl transition-all duration-200 text-gray-600"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1 justify-center px-2 sm:px-2">
                {displayedDays.map(day => {
                  const isSelected = selectedDate.isSame(day, 'day');
                  const isFuture = day.isAfter(moment(), 'day');
                  return (
                    <button key={day.format('YYYY-MM-DD')} onClick={() => !isFuture && setSelectedDate(day)} disabled={isFuture} className={`flex flex-col items-center justify-center gap-1 px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-2xl transition-all duration-300 font-medium text-xs sm:text-sm ${isSelected ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg' : isFuture ? 'bg-white/40 text-gray-400 opacity-60 cursor-not-allowed' : 'bg-white/50 text-gray-700 hover:bg-white/80 border border-gray-200/50'}`}>
                      <span className="text-[8px] sm:text-xs font-bold tracking-wider uppercase opacity-80">{day.format('ddd')}</span>
                      <span className="text-base sm:text-lg font-bold">{day.format('D')}</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  setDisplayedWeekBase(
                    displayedWeekBase
                      .clone()
                      .add(1, 'week')
                  )
                }
                className="p-0.5 sm:p-2 hover:bg-gray-200 rounded-lg sm:rounded-xl transition-all duration-200 text-gray-600"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex items-center justify-between mt-2 sm:mt-3 gap-2">
              <p className="text-xs sm:text-sm font-semibold text-gray-600 capitalize">{periodLabel}</p>
              <button
                type="button"
                onClick={() => {
                  const now = moment().startOf('day');
                  setSelectedDate(now);
                  setDisplayedWeekBase(now);
                }}
                disabled={isTodaySelected && isTodayVisible}
                className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border border-gray-200 bg-white/70 text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aujourd’hui
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="mb-4 inline-flex items-center justify-center w-12 sm:w-16 h-12 sm:h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
                <Loader className="text-blue-600 animate-spin" size={24} />
              </div>
              <p className="text-sm sm:text-base text-gray-600 font-medium">Chargement en cours...</p>
            </div>
          </div>
        ) : habits.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center justify-center text-center px-4">
              <div className="text-5xl sm:text-6xl mb-6 opacity-50">📝</div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Aucune habitude créée</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6">Commencez par créer votre premier objectif.</p>
              <Link href="/add_habit"><button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-2xl shadow-lg">Créer mon premier objectif</button></Link>
            </div>
          </div>
        ) : (
          <div className="px-3 sm:px-4 py-4 sm:py-6">
            <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
              {habitsForDate.filter(h => !h.completedToday).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">À accomplir</h3>
                    <span className="ml-auto text-xs sm:text-sm font-semibold bg-blue-100 text-blue-700 px-2.5 sm:px-3 py-1 rounded-full">{habitsForDate.filter(h => !h.completedToday).length}</span>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    {habitsForDate.filter(h => !h.completedToday).map((habit, idx) => (
                      <HabitCard key={habit.id} habit={habit} idx={idx} updatingIds={updatingIds} toggleHabitCompletion={toggleHabitCompletion} deleteHabit={deleteHabit} />
                    ))}
                  </div>
                </div>
              )}

              {habitsForDate.filter(h => h.completedToday).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">Accomplis</h3>
                    <span className="ml-auto text-xs sm:text-sm font-semibold bg-emerald-100 text-emerald-700 px-2.5 sm:px-3 py-1 rounded-full">{habitsForDate.filter(h => h.completedToday).length}</span>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    {habitsForDate.filter(h => h.completedToday).map((habit, idx) => (
                      <HabitCard key={habit.id} habit={habit} idx={idx} updatingIds={updatingIds} toggleHabitCompletion={toggleHabitCompletion} deleteHabit={deleteHabit} />
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

function HabitCard({ habit, idx, updatingIds, toggleHabitCompletion, deleteHabit }: { habit: any; idx: number; updatingIds: Set<string>; toggleHabitCompletion: (habitId: string, isCompleted: boolean) => void; deleteHabit: (habitId: string) => void; }) {
  return (
    <div className={`group flex items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-2xl transition-all duration-300 transform ${habit.completedToday ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 opacity-50' : 'bg-white/70 backdrop-blur-sm border border-gray-200/50 hover:border-blue-300 hover:shadow-lg'}`}>
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <div className={`text-3xl sm:text-4xl flex-shrink-0 ${habit.completedToday ? 'scale-100 sm:scale-110' : 'group-hover:scale-110'}`}>{habit.emoji}</div>
        <div className="min-w-0">
          <h3 className={`font-semibold text-sm sm:text-base ${habit.completedToday ? 'text-emerald-700 line-through opacity-70' : 'text-gray-900'}`}>{habit.title}</h3>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <button onClick={() => toggleHabitCompletion(habit.id, habit.completedToday)} disabled={updatingIds.has(habit.id)} className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl border-2 ${habit.completedToday ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-500' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'} disabled:opacity-50 disabled:cursor-not-allowed`} title={habit.completedToday ? 'Marquer comme non complété' : 'Marquer comme complété'}>
          {updatingIds.has(habit.id) ? <Loader size={14} className="animate-spin" /> : habit.completedToday ? <Check size={14} className="text-white" /> : null}
        </button>

        <button onClick={() => deleteHabit(habit.id)} disabled={updatingIds.has(habit.id)} className="p-1.5 sm:p-2.5 bg-red-50 text-red-600 rounded-lg sm:rounded-xl hover:bg-red-100 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100" title="Supprimer l'habitude">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
