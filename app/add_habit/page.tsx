'use client';

import { useState } from 'react';
import { Plus, AlertCircle, SmilePlus } from 'lucide-react';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';

export default function AddHabitPage() {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const popularEmojis = ['🎯', '💪', '🏃', '🧘', '💧', '📚', '🎨', '🎵', '🥗', '😴', '📝', '🚴'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError("Le titre de l'habitude est requis");

    setLoading(true);
    try {
      const res = await fetch('/api/add_habit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), emoji }),
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
    <div className="flex flex-1 min-h-full w-full">
      <div className="flex flex-col flex-1 min-h-full w-full px-3 sm:px-6 py-4 items-center">

        {/* Header */}
        <div className="page-header mb-4 w-full">
          <div className="container">
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Créer une habitude
            </h2>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between min-h-full max-w-xl w-full space-y-4">

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

        {/* Emoji */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-2 relative">
          <div
            className="p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl text-center cursor-pointer hover:border-blue-400 transition-all"
            onClick={() => setShowPicker(!showPicker)}
          >
            <div className="text-5xl sm:text-6xl mb-1">{emoji}</div>
            <div className="flex justify-center items-center gap-1 text-blue-600 text-sm font-semibold">
              <SmilePlus size={16} /> Personnaliser
            </div>
          </div>

          {/* Mobile: use native emoji keyboard */}
          <input
            type="text"
            inputMode="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
            className="sm:hidden w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base font-medium text-center"
            aria-label="Emoji"
            placeholder="Entrez votre emoji"
          />

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
    </div>
  );
}