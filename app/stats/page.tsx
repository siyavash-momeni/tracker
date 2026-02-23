"use client";

import { useEffect, useState } from "react";
import moment from "moment";

export default function StatsPage() {
  const [habitsCount, setHabitsCount] = useState<number | null>(null);
  const [last7, setLast7] = useState<Array<{ date: string; completions: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/habits');
        const data = await res.json();
        setHabitsCount((data.habits || []).length);

        const days = [];
        for (let i = 6; i >= 0; i--) {
          days.push(moment().clone().subtract(i, 'day'));
        }

        const stats: Array<{ date: string; completions: number }> = [];

        for (const d of days) {
          const dateStr = d.format('YYYY-MM-DD');
          const r = await fetch(`/api/habits/by-date?date=${dateStr}`);
          if (!r.ok) {
            stats.push({ date: dateStr, completions: 0 });
            continue;
          }
          const dd = await r.json();
          stats.push({ date: dateStr, completions: (dd.completedHabitIds || []).length });
        }

        setLast7(stats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="px-3 sm:px-4 py-4 sm:py-6 bg-white/60 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold">Statistiques</h2>
          <p className="text-xs text-gray-600 mt-1">Aperçu des 7 derniers jours</p>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {loading ? (
            <p className="text-center text-gray-600">Chargement...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-500">Habitudes totales</p>
                  <p className="text-2xl font-bold text-blue-600">{habitsCount ?? '—'}</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-500">Moyenne quotidienne (7j)</p>
                  <p className="text-2xl font-bold text-indigo-600">{last7.length ? Math.round(last7.reduce((s, x) => s + x.completions, 0) / last7.length) : '—'}</p>
                </div>
              </div>

              <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg">
                <h3 className="font-semibold mb-2">Completions (7 jours)</h3>
                <div className="grid grid-cols-7 gap-2 text-center text-xs">
                  {last7.map(d => (
                    <div key={d.date} className="p-2 bg-gray-50 border border-gray-100 rounded">
                      <div className="font-semibold">{moment(d.date).format('dd')}</div>
                      <div className="text-sm text-gray-700">{d.completions}</div>
                      <div className="text-[10px] text-gray-400 mt-1">{moment(d.date).format('D')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
