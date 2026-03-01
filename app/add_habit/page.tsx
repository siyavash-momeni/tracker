'use client';

import { useRef, useState } from 'react';
import { Plus, AlertCircle, SmilePlus, Minus } from 'lucide-react';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';

export default function AddHabitPage() {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [targetValue, setTargetValue] = useState(1);
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [targetValueInput, setTargetValueInput] = useState('1');
  const targetInputRef = useRef<HTMLInputElement | null>(null);

  const weekDays = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mer' },
    { value: 4, label: 'Jeu' },
    { value: 5, label: 'Ven' },
    { value: 6, label: 'Sam' },
    { value: 7, label: 'Dim' },
  ];

  const extractFirstEmoji = (value: string) => {
    const emojiRegex = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;
    const match = value.match(emojiRegex);
    return match?.[0] ?? '';
  };

  const popularEmojis = ['🎯', '💪', '🏃', '🧘', '💧', '📚', '🎨', '🎵', '🥗', '😴', '📝', '🚴'];

  const clampTargetValue = (value: number) => Math.max(1, Math.min(1000, value));

  const toggleActiveDay = (day: number) => {
    setActiveDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const updateTargetValueFromInput = (rawValue: string, commit = false) => {
    const digitsOnly = rawValue.replace(/\D/g, '');

    if (digitsOnly === '') {
      if (commit) {
        setTargetValue(1);
        setTargetValueInput('1');
      } else {
        setTargetValueInput('');
      }
      return;
    }

    const normalized = String(clampTargetValue(Number(digitsOnly)));
    setTargetValueInput(normalized);
    setTargetValue(Number(normalized));
  };

  const adjustTargetValue = (delta: number) => {
    const nextValue = clampTargetValue(targetValue + delta);
    setTargetValue(nextValue);
    setTargetValueInput(String(nextValue));
  };

  const handleFrequencySelect = (value: 'DAILY' | 'WEEKLY') => {
    setFrequency(value);
    if (window.matchMedia('(max-width: 639px)').matches) {
      setTimeout(() => targetInputRef.current?.focus(), 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError("Le titre de l'habitude est requis");
    if (activeDays.length === 0) return setError('Sélectionnez au moins un jour actif');

    setLoading(true);
    try {
      const res = await fetch('/api/add_habit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          emoji,
          targetValue,
          frequency,
          activeDays,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur');
      }
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">

      {/* Header */}
      <div className="page-header mb-4 w-full shrink-0">
        <div className="container">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Créer une habitude
          </h2>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto min-h-0 w-full px-3 sm:px-6 py-4">
        <div className="max-w-xl w-full mx-auto">
        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4 pb-24">

        {/* Erreur */}
        {error && (
          <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl">
            <AlertCircle size={18} className="text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Titre */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
          <input
            type="text"
            placeholder="Ex: Méditation du matin"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base font-medium"
          />
        </div>

        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Fréquence</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleFrequencySelect('DAILY')}
              className={`px-3 py-2 rounded-xl border text-sm font-semibold transition ${
                frequency === 'DAILY'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Par jour
            </button>
            <button
              type="button"
              onClick={() => handleFrequencySelect('WEEKLY')}
              className={`px-3 py-2 rounded-xl border text-sm font-semibold transition ${
                frequency === 'WEEKLY'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Par semaine
            </button>
          </div>

          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Fréquence {frequency === 'DAILY' ? 'par jour' : 'par semaine'}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustTargetValue(-1)}
              disabled={targetValue <= 1}
              className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              title="Diminuer"
            >
              <Minus size={16} />
            </button>

            <input
              ref={targetInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={targetValueInput}
              onChange={(e) => updateTargetValueFromInput(e.target.value)}
              onBlur={() => updateTargetValueFromInput(targetValueInput, true)}
              className="flex-1 px-3 py-2 text-center bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base font-semibold"
            />

            <button
              type="button"
              onClick={() => adjustTargetValue(1)}
              disabled={targetValue >= 1000}
              className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              title="Augmenter"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTargetValue(value);
                  setTargetValueInput(String(value));
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                  targetValue === value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <label className="block text-sm font-semibold text-gray-700 mb-3">Jours actifs</label>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const selected = activeDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleActiveDay(day.value)}
                  className={`px-1 py-2 rounded-lg text-xs font-semibold border transition ${
                    selected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Emoji */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-2 relative">
          <div
            className="relative p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl text-center cursor-pointer hover:border-blue-400 transition-all"
            onClick={() => {
              if (window.matchMedia('(min-width: 640px)').matches) {
                setShowPicker(!showPicker);
              }
            }}
          >
            <div className="text-5xl sm:text-6xl mb-1">{emoji}</div>
            {!emoji && (
              <div className="flex justify-center items-center gap-1 text-blue-600 text-sm font-semibold">
                <SmilePlus size={16} /> Choisissez votre propre emoji
              </div>
            )}

            <input
              type="text"
              inputMode="text"
              value={emoji}
              onChange={(e) => setEmoji(extractFirstEmoji(e.target.value))}
              className="sm:hidden absolute inset-0 opacity-0 cursor-text text-center"
              aria-label="Emoji"
              placeholder="Entrez votre emoji"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          {showPicker && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowPicker(false)} />
              <div className="hidden sm:block fixed z-30 right-6 top-1/2 -translate-y-1/2 shadow-2xl">
                <EmojiPicker
                  onEmojiClick={(e) => { setEmoji(e.emoji); setShowPicker(false); }}
                  theme={Theme.LIGHT}
                  emojiStyle={EmojiStyle.NATIVE}
                  lazyLoadEmojis
                />
              </div>
            </>
          )}

          {/* Emoji rapides */}
          <div className="grid grid-cols-6 gap-1">
            {popularEmojis.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`p-2 text-xl rounded-xl transition ${
                  emoji === e ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? 'Création...' : <><Plus size={18} /> Créer</>}
          </button>

        </form>
        </div>
      </main>
      </div>
  );
}