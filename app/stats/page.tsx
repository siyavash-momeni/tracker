"use client";

import { useEffect, useState, useCallback } from "react";
import moment from "moment";
import "moment/locale/fr";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader, Trophy, Target, Repeat2 } from "lucide-react";

moment.locale("fr");

type DayStat = {
  date: string;
  completions: number | null;
  label: string;
  isToday?: boolean;
  isFuture?: boolean;
};

export default function StatsPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [totalHabits, setTotalHabits] = useState<number | null>(null);
  const [totalCompletions, setTotalCompletions] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [todayKey, setTodayKey] = useState(moment().format("YYYY-MM-DD"));

  const [chosenWeekDate, setChosenWeekDate] = useState(
    moment().format("YYYY-MM-DD")
  );
  const [weekStats, setWeekStats] = useState<DayStat[]>([]);

  const [chosenMonth, setChosenMonth] = useState(
    moment().format("YYYY-MM")
  );
  const [monthStats, setMonthStats] = useState<DayStat[]>([]);

  const buildMonthWeeklyAverages = useCallback(
    (
      days: Array<{ date: string; completions: number }>,
      monthValue: string
    ): DayStat[] => {
      const monthStart = moment(monthValue + "-01").startOf("month");
      const monthEnd = monthStart.clone().endOf("month");
      const today = moment(todayKey).startOf("day");

      const result: DayStat[] = [];
      let cursor = monthStart.clone().startOf("isoWeek");
      let index = 1;

      while (cursor.isSameOrBefore(monthEnd, "day")) {
        const weekStart = cursor.clone();
        const weekEnd = cursor.clone().endOf("isoWeek");
        const inMonthStart = moment.max(weekStart, monthStart);
        const inMonthEnd = moment.min(weekEnd, monthEnd);

        const inRangeDays = days.filter((d) => {
          const current = moment(d.date).startOf("day");
          return current.isSameOrAfter(inMonthStart, "day") && current.isSameOrBefore(inMonthEnd, "day");
        });

        const pastOrTodayDays = inRangeDays.filter((d) => !moment(d.date).isAfter(today, "day"));
        const avg = pastOrTodayDays.length
          ? pastOrTodayDays.reduce((sum, d) => sum + d.completions, 0) / pastOrTodayDays.length
          : null;

        if (avg == null) {
          cursor.add(1, "week");
          index += 1;
          continue;
        }

        result.push({
          date: inMonthStart.format("YYYY-MM-DD"),
          completions: Number(avg.toFixed(1)),
          label: `S${index}`,
          isToday: today.isSameOrAfter(inMonthStart, "day") && today.isSameOrBefore(inMonthEnd, "day"),
          isFuture: inMonthStart.isAfter(today, "day"),
        });

        cursor.add(1, "week");
        index += 1;
      }

      return result;
    },
    [todayKey]
  );

  const toChartData = useCallback(
    (
      days: Array<{ date: string; completions: number }>,
      labelFormat: string
    ): DayStat[] => {
      const today = moment().startOf("day");
      return days.map((d) => {
        const currentDay = moment(d.date).startOf("day");
        const isFuture = currentDay.isAfter(today, "day");

        return {
          date: d.date,
          completions: isFuture ? null : d.completions,
          label: moment(d.date).format(labelFormat),
          isToday: currentDay.isSame(today, "day"),
          isFuture,
        };
      });
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
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleMidnightRefresh = () => {
      const now = moment();
      const nextMidnight = now.clone().add(1, "day").startOf("day");
      const delay = Math.max(nextMidnight.diff(now), 1000);

      timeoutId = setTimeout(() => {
        setTodayKey(moment().format("YYYY-MM-DD"));
        scheduleMidnightRefresh();
      }, delay);
    };

    scheduleMidnightRefresh();

    return () => clearTimeout(timeoutId);
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
  }, [chosenWeekDate, toChartData, todayKey]);

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
        .then((d) => setMonthStats(buildMonthWeeklyAverages(d.days || [], chosenMonth)));
  }, [chosenMonth, buildMonthWeeklyAverages, todayKey]);

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

          <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-gray-900">
                  {viewMode === "week" ? "Par semaine" : "Par mois"}
                </h3>
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "week" ? "month" : "week")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100"
                  aria-label={viewMode === "week" ? "Passer à la vue mois" : "Passer à la vue semaine"}
                >
                  <Repeat2 size={14} />
                  {viewMode === "week" ? "Voir le mois" : "Voir la semaine"}
                </button>
              </div>

              {viewMode === "week" ? (
                <input
                  type="date"
                  value={chosenWeekDate}
                  onChange={(e) => setChosenWeekDate(e.target.value)}
                  className="text-xs bg-gray-50 rounded-lg px-2 py-1"
                />
              ) : (
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
              )}
            </div>

            {viewMode === "week" ? (
              <div className="h-48 sm:h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weekStats}>
                    <XAxis
                      dataKey="label"
                      tick={(props: any) => {
                        const isFuture = weekStats[props.index]?.isFuture;
                        return (
                          <text
                            x={props.x}
                            y={props.y + 10}
                            textAnchor="middle"
                            fontSize={9}
                            fill={isFuture ? "#9ca3af" : "#6b7280"}
                          >
                            {props.payload.value}
                          </text>
                        );
                      }}
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
                      connectNulls={false}
                      dot={(props) => {
                        const isFuture = weekStats[props.index]?.isFuture;
                        const isToday = weekStats[props.index]?.isToday;
                        if (isFuture) return null;
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
                    <Tooltip formatter={(value) => (value == null ? "À venir" : value)} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 sm:h-52 w-full">
                <div style={{ height: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthStats}>
                      <XAxis
                        dataKey="label"
                        tick={(props: any) => {
                          const isFuture = monthStats[props.index]?.isFuture;
                          return (
                            <text
                              x={props.x}
                              y={props.y + 10}
                              textAnchor="middle"
                              fontSize={9}
                              fill={isFuture ? "#9ca3af" : "#6b7280"}
                            >
                              {props.payload.value}
                            </text>
                          );
                        }}
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
                        connectNulls={false}
                        dot={(props) => {
                          const isFuture = monthStats[props.index]?.isFuture;
                          const isToday = monthStats[props.index]?.isToday;
                          if (isFuture) return null;
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
                      <Tooltip cursor={false} formatter={(value) => (value == null ? "À venir" : value)} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}