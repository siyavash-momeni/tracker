"use client";

import { useEffect, useState, useCallback } from "react";
import moment from "moment";
import "moment/locale/fr";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Loader, Trophy, Target } from "lucide-react";

moment.locale("fr");

type DayStat = {
  date: string;
  completions: number;
  label: string;
  isToday?: boolean;
};

export default function StatsPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [totalHabits, setTotalHabits] = useState<number | null>(null);
  const [totalCompletions, setTotalCompletions] = useState<number | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  const [chosenDay, setChosenDay] = useState(moment().format("YYYY-MM-DD"));
  const [chosenDayStat, setChosenDayStat] = useState<number>(0);

  const [chosenWeekDate, setChosenWeekDate] = useState(
    moment().format("YYYY-MM-DD")
  );
  const [weekStats, setWeekStats] = useState<DayStat[]>([]);

  const [chosenMonth, setChosenMonth] = useState(
    moment().format("YYYY-MM")
  );
  const [monthStats, setMonthStats] = useState<DayStat[]>([]);

  const toChartData = useCallback(
    (
      days: Array<{ date: string; completions: number }>,
      labelFormat: string
    ): DayStat[] => {
      const todayStr = moment().format("YYYY-MM-DD");
      return days.map((d) => ({
        ...d,
        label: moment(d.date).format(labelFormat),
        isToday: d.date === todayStr,
      }));
    },
    []
  );

  const monthOptions = (() => {
    const options: Array<{ value: string; label: string }> = [];
    const start = moment("2000-01-01").startOf("month");
    const end = moment().endOf("month");
    const cursor = start.clone();

    while (cursor.isSameOrBefore(end, "month")) {
      options.push({
        value: cursor.format("YYYY-MM"),
        label: cursor.format("MMMM YYYY"),
      });
      cursor.add(1, "month");
    }

    return options.reverse();
  })();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsSmallScreen(media.matches);

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const loadBasics = async () => {
      try {
        const [statsRes, habitsRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/habits"),
        ]);

        const statsData = await statsRes.json();
        setTotalCompletions(statsData.totalCompletions ?? 0);

        const habitsData = await habitsRes.json();
        setTotalHabits((habitsData.habits || []).length);
      } finally {
        setInitialLoading(false);
      }
    };

    loadBasics();
  }, []);

  useEffect(() => {
    fetch(`/api/habits/by-date?date=${chosenDay}`)
      .then((res) => res.json())
      .then((d) =>
        setChosenDayStat((d.completedHabitIds || []).length)
      );
  }, [chosenDay]);

  useEffect(() => {
    const start = moment(chosenWeekDate)
      .startOf("isoWeek")
      .format("YYYY-MM-DD");

    const end = moment(start)
      .add(6, "days")
      .format("YYYY-MM-DD");

    fetch(
      `/api/habits/completions-range?start=${start}&end=${end}`
    )
        .then((res) => res.json())
        .then((d) => setWeekStats(toChartData(d.days || [], "dd D")));
  }, [chosenWeekDate, toChartData]);

  useEffect(() => {
    const start = moment(chosenMonth + "-01")
      .startOf("month")
      .format("YYYY-MM-DD");

    const end = moment(start)
      .endOf("month")
      .format("YYYY-MM-DD");

    fetch(
      `/api/habits/completions-range?start=${start}&end=${end}`
    )
        .then((res) => res.json())
        .then((d) => setMonthStats(toChartData(d.days || [], "D")));
  }, [chosenMonth, toChartData]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-50">
        <Loader className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* HEADER */}
      <header className="shrink-0 mb-4">
        <div className="page-header">
          <div className="container">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Statistiques
              </h2>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-32">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* TOP GRID */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-2xl border shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Target size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Habitudes actives</p>
                <p className="text-xl font-bold">{totalHabits}</p>
              </div>
            </div>
            <div className="p-4 bg-white rounded-2xl border shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Trophy size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Habitudes complétées</p>
                <p className="text-xl font-bold">{totalCompletions ?? 0}</p>
              </div>
            </div>
          </section>

          {/* JOUR */}
          <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Par jour</h3>
              <input
                type="date"
                value={chosenDay}
                onChange={(e) => setChosenDay(e.target.value)}
                className="text-xs bg-gray-50 rounded-lg px-2 py-1"
              />
            </div>

            <div className="py-6 text-center">
              <p className="text-4xl sm:text-5xl font-black text-indigo-600">
                {chosenDayStat}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Habitudes terminées
              </p>
            </div>
          </div>

          {/* SEMAINE */}
          <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Par semaine</h3>
              <input
                type="date"
                value={chosenWeekDate}
                onChange={(e) => setChosenWeekDate(e.target.value)}
                className="text-xs bg-gray-50 rounded-lg px-2 py-1"
              />
            </div>

            <div className="h-48 sm:h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weekStats}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9 }}
                    width={22}
                  />
                  <Area
                    type="monotone"
                    dataKey="completions"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="rgba(59, 130, 246, 0.2)"
                    dot={(props) => {
                      const isToday = weekStats[props.index]?.isToday;
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={isToday ? 4 : 2}
                          fill={isToday ? "#6366f1" : "#3b82f6"}
                        />
                      );
                    }}
                  />
                  <Tooltip />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* MOIS */}
          <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Par mois</h3>
              <select
                value={chosenMonth}
                onChange={(e) => setChosenMonth(e.target.value)}
                className="text-xs bg-gray-50 rounded-lg px-2 py-1"
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-44 sm:h-52 w-full overflow-x-auto">
              <div
                style={{
                  minWidth: monthStats.length * 18,
                  height: "100%",
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthStats}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9 }}
                      width={22}
                    />
                    <Area
                      type="monotone"
                      dataKey="completions"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="rgba(16, 185, 129, 0.2)"
                      dot={(props) => {
                        const isToday = monthStats[props.index]?.isToday;
                        return (
                          <circle
                            cx={props.cx}
                            cy={props.cy}
                            r={isToday ? 4 : 2}
                            fill={isToday ? "#6366f1" : "#10b981"}
                          />
                        );
                      }}
                    />
                    <Tooltip cursor={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}