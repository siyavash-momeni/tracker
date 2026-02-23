'use client';

import { useState } from 'react';
import { ChevronLeft, Plus, AlertCircle, SmilePlus } from 'lucide-react'; // Ajout de SmilePlus
import { useRouter } from 'next/navigation';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react'; // Import du picker

export default function AddHabitPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false); // État pour afficher le picker

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), emoji }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la création');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-gray-200/50 bg-white/60 backdrop-blur-sm sticky top-0 z-20">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-600">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Créer une habitude</h2>
      </div>

      <main className="flex-1 px-4 py-6 max-w-md mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          )}

          {/* Title Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">Titre de l'habitude</label>
            <input
              type="text"
              maxLength={50}
              placeholder="Ex: Méditation du matin"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black font-medium"
            />
          </div>

          {/* Emoji Selection Section */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-gray-900">Choisir un emoji</label>
            
            <div className="relative group">
              <div 
                className="p-6 bg-white border-2 border-dashed border-gray-200 rounded-2xl text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                onClick={() => setShowPicker(!showPicker)}
              >
                <div className="text-6xl mb-2 group-hover:scale-110 transition-transform duration-300">{emoji}</div>
                <div className="flex items-center justify-center gap-2 text-blue-600 font-semibold text-sm">
                  <SmilePlus size={18} />
                  Personnaliser
                </div>
              </div>

              {/* Emoji Picker Popover */}
              {showPicker && (
                <div className="absolute z-30 mt-2 left-0 right-0 flex justify-center shadow-2xl animate-in zoom-in-95">
                    <div className="fixed inset-0" onClick={() => setShowPicker(false)} />
                    <div className="relative">
                        <EmojiPicker
                            onEmojiClick={(emojiData) => {
                                setEmoji(emojiData.emoji);
                                setShowPicker(false);
                            }}
                            theme={Theme.LIGHT}
                            emojiStyle={EmojiStyle.NATIVE}
                            lazyLoadEmojis={true}
                        />
                    </div>
                </div>
              )}
            </div>

            {/* Quick Select Grid */}
            <div className="grid grid-cols-6 gap-2">
              {popularEmojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setEmoji(e);
                    setShowPicker(false);
                  }}
                  className={`p-3 text-2xl rounded-xl transition-all ${
                    emoji === e 
                    ? 'bg-blue-600 text-white scale-105 shadow-md' 
                    : 'bg-white border border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Création...' : <><Plus size={20} /> Créer l'habitude</>}
          </button>
        </form>
      </main>
    </div>
  );
}