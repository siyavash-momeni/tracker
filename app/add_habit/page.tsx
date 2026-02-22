'use client';

import { useState } from 'react';
import { ChevronLeft, Plus, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AddHabitPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const popularEmojis = ['🎯', '💪', '🏃', '🧘', '💧', '📚', '🎨', '🎵', '🥗', '😴', '📝', '🚴'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Le titre de l\'habitude est requis');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/add_habit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          emoji,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la création de l\'habitude');
      }

      setTitle('');
      setEmoji('🎯');
      router.push('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-200/50 bg-white/60 backdrop-blur-sm">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 text-gray-600"
        >
          <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
        </button>
        <div>
          <h2 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Créer une habitude</h2>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Lancez une nouvelle habitude positive</p>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="max-w-md mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Error Message */}
            {error && (
              <div className="flex gap-2 sm:gap-3 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-xl sm:rounded-2xl animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={18} className="sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-red-800 font-medium">{error}</p>
              </div>
            )}

            {/* Title Input */}
            <div className="space-y-2 sm:space-y-3">
              <label htmlFor="title" className="block text-sm sm:text-base font-bold text-gray-900">
                Titre de l'habitude
              </label>
              <div className="relative">
                <input
                  id="title"
                  type="text"
                  placeholder="Ex: Faire du sport, Lire..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3.5 bg-white border border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder:text-gray-400 text-black text-sm sm:text-base font-medium"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Description courte et motivante</span>
                <span className="font-medium">{title.length}/50</span>
              </div>
            </div>

            {/* Emoji Selector */}
            <div className="space-y-3 sm:space-y-4">
              <label className="block text-sm sm:text-base font-bold text-gray-900">
                Choisir un emoji
              </label>

              {/* Selected Emoji Display */}
              <div className="p-4 sm:p-6 bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-lg sm:rounded-2xl text-center hover:shadow-lg transition-all duration-300">
                <div className="text-5xl sm:text-7xl mb-2 hover:scale-110 transition-transform duration-300">{emoji}</div>
                <p className="text-xs text-gray-500">Emoji sélectionné</p>
              </div>

              {/* Emoji Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {popularEmojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`p-2 sm:p-4 text-2xl sm:text-3xl rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-110 ${
                      emoji === e
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg scale-110 ring-2 ring-blue-300'
                        : 'bg-white border border-gray-200 hover:border-blue-400 hover:shadow-md'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 sm:py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-sm sm:text-base rounded-lg sm:rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
            >
              <Plus size={18} className="sm:w-5 sm:h-5" />
              {loading ? 'Création en cours...' : 'Créer l\'habitude'}
            </button>
          </form>

          {/* Info Box */}
          <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg sm:rounded-2xl">
            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2 text-sm sm:text-base">
              💡 Conseil
            </h3>
            <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
              Commencez par des habitudes simples et réalistes. Les meilleures habitudes prennent en moyenne 66 jours à se former.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
