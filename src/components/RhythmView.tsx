import React, { useState } from 'react';
import { Check, Plus, Trash2, Download, RotateCcw } from 'lucide-react';
import { DailyFocusLog, FirasHabit } from '../types/firas';

interface RhythmViewProps {
  habits: FirasHabit[];
  focusLog: DailyFocusLog[];
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddHabit: (name: string, targetDaysPerWeek: number) => void;
  onDeleteHabit: (habitId: string) => void;
  onExportWorkspace: () => void;
  onResetWorkspace: () => void;
}

const WEEK_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const RhythmView: React.FC<RhythmViewProps> = ({
  habits,
  focusLog,
  onToggleHabitDay,
  onAddHabit,
  onDeleteHabit,
  onExportWorkspace,
  onResetWorkspace,
}) => {
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitTarget, setNewHabitTarget] = useState(5);
  const [confirmReset, setConfirmReset] = useState(false);

  const totalWeeklyMinutes = focusLog.reduce((sum, d) => sum + d.minutes, 0);
  const totalWeeklySessions = focusLog.reduce((sum, d) => sum + d.sessions, 0);
  const maxDayMinutes = Math.max(60, ...focusLog.map((d) => d.minutes));

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newHabitName.trim();
    if (!trimmed) return;
    onAddHabit(trimmed, newHabitTarget);
    setNewHabitName('');
    setNewHabitTarget(5);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Ритм и фокус
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Недельная динамика глубокой работы и регулярные привычки
        </p>
      </div>

      {/* Weekly focus bar chart */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Время в фокусе за неделю
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Обновляется автоматически после каждой завершённой сессии таймера
            </p>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Итого:{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
              {totalWeeklyMinutes} мин
            </span>{' '}
            <span className="text-slate-400">·</span>{' '}
            <span className="font-mono tabular-nums">{totalWeeklySessions} сессий</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-3 sm:gap-4 items-end h-44 pt-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          {focusLog.map((day) => {
            const heightPct = Math.round((day.minutes / maxDayMinutes) * 100);
            return (
              <div
                key={day.dateKey}
                className="flex flex-col items-center justify-end h-full gap-2"
              >
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {day.minutes > 0 ? `${day.minutes}м` : '—'}
                </span>
                <div className="w-full max-w-[44px] flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t-md transition-[height] duration-200 ${
                      day.minutes > 0
                        ? 'bg-slate-900 dark:bg-blue-500'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                    style={{ height: `${Math.max(day.minutes > 0 ? 10 : 4, heightPct)}%` }}
                    title={`${day.dayLabel} (${day.dateKey}): ${day.minutes} мин`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-7 gap-3 sm:gap-4 pt-2.5 text-center">
          {focusLog.map((day) => (
            <div key={day.dateKey} className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {day.dayLabel}
            </div>
          ))}
        </div>
      </section>

      {/* Weekly Habit Tracker */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Трекер привычек на неделю
          </h2>
        </div>

        <form
          onSubmit={handleAddHabit}
          className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40"
        >
          <input
            type="text"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            placeholder="Добавить регулярную привычку..."
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
              <span>Цель:</span>
              <select
                value={newHabitTarget}
                onChange={(e) => setNewHabitTarget(Number(e.target.value))}
                className="px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {[3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n} дн/нед
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={!newHabitName.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white disabled:opacity-40 hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить</span>
            </button>
          </div>
        </form>

        {habits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 pl-6 pr-3 min-w-[220px]">Привычка</th>
                  {WEEK_LABELS.map((day) => (
                    <th key={day} className="py-3 px-2 text-center w-12">
                      {day}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right whitespace-nowrap">Прогресс</th>
                  <th className="py-3 pl-2 pr-6 text-right w-12">
                    <span className="sr-only">Удалить</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {habits.map((habit) => {
                  const count = habit.weekDays.filter(Boolean).length;
                  const targetMet = count >= habit.targetDaysPerWeek;
                  return (
                    <tr
                      key={habit.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 pl-6 pr-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {habit.name}
                      </td>
                      {habit.weekDays.map((checked, idx) => (
                        <td key={idx} className="py-2.5 px-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => onToggleHabitDay(habit.id, idx)}
                            aria-label={`${habit.name} — ${WEEK_LABELS[idx]}`}
                            className={`mx-auto w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                              checked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-200 dark:border-slate-700 text-transparent hover:border-slate-400 dark:hover:border-slate-500'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </td>
                      ))}
                      <td
                        className={`py-3.5 px-4 text-right text-xs font-mono tabular-nums whitespace-nowrap ${
                          targetMet
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {count} / {habit.targetDaysPerWeek}
                      </td>
                      <td className="py-3.5 pl-2 pr-6 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteHabit(habit.id)}
                          aria-label={`Удалить привычку «${habit.name}»`}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Добавьте первую привычку выше, чтобы отслеживать недельный ритм.
          </div>
        )}
      </section>

      {/* Data controls */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Данные рабочего пространства
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Все изменения сохраняются локально в браузере. Можно выгрузить резервную копию в JSON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onExportWorkspace}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Экспорт JSON</span>
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сбросить к исходным</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetWorkspace();
                  setConfirmReset(false);
                }}
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
              >
                Подтвердить сброс
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
