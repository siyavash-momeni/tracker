"use client"; // Obligatoire pour les hooks useState/useEffect

import { useAuth } from "@clerk/nextjs"; // Version client de auth()
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface Note {
  id: string;
  title: string;
  content: string;
}

export default function NotesPage() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();

  // États pour les notes
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  
  // États pour l'édition (Update)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Gestion de la redirection si non connecté
  useEffect(() => {
    if (isLoaded && !userId) {
      router.push("/");
    }
  }, [isLoaded, userId, router]);

  const fetchNotes = async () => {
    try {
      const res = await fetch("/api/notes");
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch (error) {
      console.error("Erreur fetch:", error);
    }
  };

  useEffect(() => {
    if (userId) fetchNotes();
  }, [userId]);

  // Si Clerk n'a pas encore fini de charger, on affiche rien (ou un loader)
  if (!isLoaded || !userId) return <p className="p-8 text-center">Chargement...</p>;

  // CREATE
  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    setLoading(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      body: JSON.stringify({ title, content }),
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      setTitle(""); 
      setContent("");
      fetchNotes();
    }
    setLoading(false);
  };

  // UPDATE
  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const saveEdit = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title: editTitle, content: editContent }),
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      setEditingId(null);
      fetchNotes();
    }
  };

  // DELETE
  const deleteNote = async (id: string) => {
    if (!confirm("Supprimer définitivement ?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    fetchNotes();
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased">
      <div className="max-w-2xl mx-auto py-16 px-6">
        
        <header className="mb-12 border-b border-gray-100 pb-8">
          <h1 className="text-2xl font-medium tracking-tight">Archives</h1>
          <p className="text-gray-400 text-sm mt-1">Connecté en tant que : {userId}</p>
        </header>

        {/* CREATE FORM */}
        {!editingId && (
          <form onSubmit={addNote} className="mb-20 space-y-4">
            <input 
              className="w-full text-lg font-medium placeholder-gray-300 outline-none border-none focus:ring-0" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="Nouveau titre..." 
            />
            <textarea 
              className="w-full h-20 text-gray-600 placeholder-gray-300 outline-none border-none focus:ring-0 resize-none" 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              placeholder="Contenu de la note..." 
            />
            <div className="flex justify-end">
              <button disabled={loading} className="px-5 py-2 bg-black text-white text-xs rounded-full hover:bg-gray-800 transition-all">
                {loading ? "Chargement..." : "Publier"}
              </button>
            </div>
          </form>
        )}

        {/* READ & UPDATE/DELETE LIST */}
        <div className="space-y-16">
          {notes.map(note => (
            <div key={note.id} className="group">
              {editingId === note.id ? (
                /* EDIT MODE */
                <div className="space-y-4 bg-gray-50 p-6 rounded-2xl">
                  <input 
                    className="w-full bg-transparent text-lg font-medium outline-none border-none focus:ring-0" 
                    value={editTitle} 
                    onChange={e => setEditTitle(e.target.value)} 
                  />
                  <textarea 
                    className="w-full bg-transparent text-gray-600 outline-none border-none focus:ring-0 resize-none" 
                    value={editContent} 
                    onChange={e => setEditContent(e.target.value)} 
                  />
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Annuler</button>
                    <button onClick={() => saveEdit(note.id)} className="text-xs font-bold text-black">Sauvegarder</button>
                  </div>
                </div>
              ) : (
                /* VIEW MODE */
                <div className="relative">
                  <div className="flex justify-between items-baseline mb-2">
                    <h2 className="text-lg font-semibold text-gray-800">{note.title}</h2>
                    <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => startEdit(note)} className="text-xs text-gray-400 hover:text-black">Modifier</button>
                      <button onClick={() => deleteNote(note.id)} className="text-xs text-gray-400 hover:text-red-500">Supprimer</button>
                    </div>
                  </div>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}