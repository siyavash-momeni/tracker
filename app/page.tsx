"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader, Plus, Check, MoreVertical } from "lucide-react";
import Link from "next/link";
import moment, { Moment } from "moment";

interface Habit {
  id: string;
  title: string;
  emoji: string;
  createdAt: string;
  targetValue: number;
  frequency: "DAILY" | "WEEKLY";
  activeDays: number[];
}

interface HabitWithProgress extends Habit {
  valueForDate: number;
  currentProgress: number;
  isCompleted: boolean;
}

type HabitProgressPayload = {
  habitId: string;
  valueForDate: number;
  currentProgress: number;
  isCompleted: boolean;
};

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedDate, setSelectedDate] = useState<Moment>(() => moment().startOf('day'));
  const [displayedWeekBase, setDisplayedWeekBase] = useState<Moment>(() => moment().startOf('day'));
  const [habitsForDate, setHabitsForDate] = useState<HabitWithProgress[]>([]);
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

      const progressMap = new Map<string, HabitProgressPayload>(
        ((data.progressByHabit || []) as HabitProgressPayload[]).map((item) => [item.habitId, item])
      );

      const habitsWithProgress = habits
        .filter((habit) => progressMap.has(habit.id))
        .map((habit) => {
          const progress = progressMap.get(habit.id);
          return {
            ...habit,
            valueForDate: progress?.valueForDate || 0,
            currentProgress: progress?.currentProgress || 0,
            isCompleted: progress?.isCompleted || false,
          };
        });

      setHabitsForDate(habitsWithProgress);
    } catch (e) {
      console.error(e);
      setHabitsForDate([]);
    }
  };

  const updateHabitValue = async (habit: HabitWithProgress, nextValue: number) => {
    const maxValueForDate = Math.max(0, habit.targetValue - (habit.currentProgress - habit.valueForDate));
    const normalizedNextValue = Math.max(0, Math.min(maxValueForDate, nextValue));

    setUpdatingIds(prev => new Set(prev).add(habit.id));
    try {
      const res = await fetch('/api/habits/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habitId: habit.id,
          date: selectedDate.format('YYYY-MM-DD'),
          value: normalizedNextValue,
        }),
      });
      if (!res.ok) throw new Error('Erreur');

      setHabitsForDate((prev) =>
        prev.map((item) => {
          if (item.id !== habit.id) return item;

          const currentProgress =
            item.frequency === 'DAILY'
              ? normalizedNextValue
              : item.currentProgress - item.valueForDate + normalizedNextValue;

          return {
            ...item,
            valueForDate: normalizedNextValue,
            currentProgress,
            isCompleted: currentProgress >= item.targetValue,
          };
        })
      );
    } catch (e) { console.error(e); }
    setUpdatingIds(prev => { const next = new Set(prev); next.delete(habit.id); return next; });
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
              {habitsForDate.filter(h => !h.isCompleted).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">À accomplir</h3>
                    <span className="ml-auto text-xs sm:text-sm font-semibold bg-blue-100 text-blue-700 px-2.5 sm:px-3 py-1 rounded-full">{habitsForDate.filter(h => !h.isCompleted).length}</span>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    {habitsForDate.filter(h => !h.isCompleted).map((habit) => (
                      <HabitCard key={habit.id} habit={habit} updatingIds={updatingIds} updateHabitValue={updateHabitValue} deleteHabit={deleteHabit} />
                    ))}
                  </div>
                </div>
              )}

              {habitsForDate.filter(h => h.isCompleted).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">Accomplis</h3>
                    <span className="ml-auto text-xs sm:text-sm font-semibold bg-emerald-100 text-emerald-700 px-2.5 sm:px-3 py-1 rounded-full">{habitsForDate.filter(h => h.isCompleted).length}</span>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    {habitsForDate.filter(h => h.isCompleted).map((habit) => (
                      <HabitCard key={habit.id} habit={habit} updatingIds={updatingIds} updateHabitValue={updateHabitValue} deleteHabit={deleteHabit} />
                    ))}
                  </div>
                </div>
              )}

              {habitsForDate.length === 0 && habits.length > 0 && (
                <div className="text-center text-sm text-gray-500 bg-white/70 border border-gray-200 rounded-2xl p-4">
                  Aucune habitude active pour ce jour.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function HabitCard({ habit, updatingIds, updateHabitValue, deleteHabit }: { habit: HabitWithProgress; updatingIds: Set<string>; updateHabitValue: (habit: HabitWithProgress, nextValue: number) => void; deleteHabit: (habitId: string) => void; }) {
  const isSingleDailyCheckbox = habit.frequency === 'DAILY' && habit.targetValue === 1;
  const shouldShowSegmentedBar = !isSingleDailyCheckbox && habit.targetValue > 1;
  const frequencyLabel = habit.frequency === 'DAILY' ? 'par jour' : 'par semaine';
  const [showMenu, setShowMenu] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editValueInput, setEditValueInput] = useState(String(habit.valueForDate));
  const isUpdating = updatingIds.has(habit.id);
  const maxValueForDate = Math.max(0, habit.targetValue - (habit.currentProgress - habit.valueForDate));
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const editDialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showMenu && !showEditDialog) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (showEditDialog) {
        if (editDialogRef.current && !editDialogRef.current.contains(target)) {
          setShowEditDialog(false);
        }
        return;
      }

      if (showMenu) {
        const clickedMenu = menuRef.current?.contains(target);
        const clickedMenuButton = menuButtonRef.current?.contains(target);
        if (!clickedMenu && !clickedMenuButton) {
          setShowMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showMenu, showEditDialog]);

  useEffect(() => {
    if (!showEditDialog) return;

    setEditValueInput((previous) => {
      const digitsOnly = previous.replace(/\D/g, '');
      if (digitsOnly === '') return '0';
      const clamped = Math.max(0, Math.min(maxValueForDate, Number(digitsOnly)));
      return String(clamped);
    });
  }, [maxValueForDate, showEditDialog]);

  const openEditDialog = () => {
    setEditValueInput(String(habit.valueForDate));
    setShowMenu(false);
    setShowEditDialog(true);
  };

  const submitEditValue = () => {
    const digitsOnly = editValueInput.replace(/\D/g, '');
    const nextValue = digitsOnly === '' ? 0 : Math.max(0, Math.min(maxValueForDate, Number(digitsOnly)));
    updateHabitValue(habit, nextValue);
    setShowEditDialog(false);
  };

  return (
    <div className={`group relative p-3 sm:p-4 rounded-lg sm:rounded-2xl transition-all duration-300 ${(showMenu || showEditDialog) ? 'z-[120]' : ''} ${habit.isCompleted ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 opacity-70' : 'bg-white/70 backdrop-blur-sm border border-gray-200/50 hover:border-blue-300 hover:shadow-lg'}`}>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`text-3xl sm:text-4xl ${habit.isCompleted ? 'scale-100 sm:scale-110' : 'group-hover:scale-110'} shrink-0`}>{habit.emoji}</div>
            <div className="min-w-0">
              <h3 className={`font-semibold text-sm sm:text-base truncate ${habit.isCompleted ? 'text-emerald-700 line-through opacity-80' : 'text-gray-900'}`}>{habit.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {isSingleDailyCheckbox
                  ? `${frequencyLabel} · ${habit.isCompleted ? 'Validé' : 'À valider'}`
                  : `${frequencyLabel} · ${habit.currentProgress}/${habit.targetValue}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            disabled={isUpdating}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Plus d'actions"
          >
            <MoreVertical size={16} />
          </button>

          {isSingleDailyCheckbox ? (
            <button
              onClick={() => updateHabitValue(habit, habit.isCompleted ? 0 : 1)}
              disabled={isUpdating}
              className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl border-2 transition ${
                habit.isCompleted
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-500 text-white'
                  : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={habit.isCompleted ? 'Décocher' : 'Cocher'}
            >
              {isUpdating ? <Loader size={14} className="animate-spin" /> : habit.isCompleted ? <Check size={14} /> : null}
            </button>
          ) : (
            <button
              onClick={() => updateHabitValue(habit, habit.valueForDate + 1)}
              disabled={isUpdating || habit.valueForDate >= maxValueForDate}
              className="flex items-center justify-center px-2.5 sm:px-3 h-8 sm:h-9 rounded-lg sm:rounded-xl border-2 border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
              title="Ajouter une complétion"
            >
              {isUpdating ? <Loader size={14} className="animate-spin" /> : '+1'}
            </button>
          )}
        </div>

      </div>

      {shouldShowSegmentedBar && (
        <SegmentedCompletionBar current={habit.currentProgress} target={habit.targetValue} />
      )}

      {showMenu && (
        <>
          <div className="fixed inset-0 z-[140]" />
          <div ref={menuRef} className="absolute right-3 sm:right-4 top-11 z-[150] w-52 rounded-xl border border-gray-200 bg-white shadow-lg p-1.5">
            <button
              type="button"
              onClick={openEditDialog}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Modifier les complétions
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMenu(false);
                deleteHabit(habit.id);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Supprimer l'habitude
            </button>
          </div>
        </>
      )}

      {showEditDialog && (
        <>
          <div className="fixed inset-0 z-[160] bg-black/40" />
          <div className="fixed inset-0 z-[170] flex items-center justify-center px-4">
            <div ref={editDialogRef} className="w-full max-w-sm rounded-2xl bg-white p-4 border border-gray-100 shadow-xl space-y-3">
              <p className="text-sm font-semibold text-gray-700">Modifier le nombre de complétions</p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editValueInput}
                onChange={(e) => setEditValueInput(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 text-center bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base font-semibold"
              />
              <p className="text-xs text-gray-500 text-center">Max: {maxValueForDate}</p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowEditDialog(false)}
                  className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submitEditValue}
                  className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SegmentedCompletionBar({ current, target }: { current: number; target: number }) {
  const safeTarget = Math.max(2, target);
  const filledCount = Math.max(0, Math.min(current, safeTarget));

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1">
        {Array.from({ length: safeTarget }, (_, index) => {
          const isFilled = index < filledCount;
          return (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                isFilled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
