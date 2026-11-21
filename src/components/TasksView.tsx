import React, { useMemo, useState } from 'react';
import {
  Check,
  Pencil,
  Trash2,
  Search,
  Plus,
  Play,
} from 'lucide-react';
import { FirasTask, TaskCategory, TaskPriority } from '../types/firas';

interface TasksViewProps {
  tasks: FirasTask[];
  activeFocusTaskId: string | null;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (task: FirasTask) => void;
  onStartFocusForTask: (taskId: string) => void;
}

type StatusFilter = 'all' | 'active' | 'completed';

const PRIORITY_TEXT: Record<TaskPriority, string> = {
  [TaskPriority.High]: 'Высокий',
  [TaskPriority.Medium]: 'Средний',
  [TaskPriority.Normal]: 'Обычный',
};

const CATEGORIES: Array<'Все' | TaskCategory> = [
  'Все',
  'Работа',
  'Стратегия',
  'Обучение',
  'Личное',
];

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  activeFocusTaskId,
  onToggleTask,
  onDeleteTask,
  onOpenCreateModal,
  onOpenEditModal,
  onStartFocusForTask,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<'Все' | TaskCategory>('Все');

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (statusFilter === 'active' && task.completed) return false;
        if (statusFilter === 'completed' && !task.completed) return false;
        if (categoryFilter !== 'Все' && task.category !== categoryFilter) return false;
        if (
          q &&
          !task.title.toLowerCase().includes(q) &&
          !task.description.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const priorityOrder = { high: 0, medium: 1, normal: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }, [tasks, search, statusFilter, categoryFilter]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('Все');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Задачи
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Всего{' '}
            <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
              {tasks.length}
            </span>{' '}
            · Активных{' '}
            <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
              {tasks.filter((t) => !t.completed).length}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Новая задача</span>
        </button>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или описанию..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'all', label: 'Все' },
                { id: 'active', label: 'Активные' },
                { id: 'completed', label: 'Выполненные' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Фильтр по направлению"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'Все' | TaskCategory)}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'Все' ? 'Все направления' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task table/list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filteredTasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/40">
                  <th className="py-3 pl-5 pr-3 w-10">
                    <span className="sr-only">Статус</span>
                  </th>
                  <th className="py-3 px-3">Задача</th>
                  <th className="py-3 px-3 whitespace-nowrap">Направление</th>
                  <th className="py-3 px-3 whitespace-nowrap">Приоритет</th>
                  <th className="py-3 px-3 whitespace-nowrap">Срок</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Оценка</th>
                  <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredTasks.map((task) => {
                  const isFocused = activeFocusTaskId === task.id;
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3 align-top">
                        <button
                          type="button"
                          onClick={() => onToggleTask(task.id)}
                          aria-label={`Переключить статус задачи «${task.title}»`}
                          className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            task.completed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 hover:border-blue-600'
                          }`}
                        >
                          {task.completed && <Check className="w-3.5 h-3.5" />}
                        </button>
                      </td>

                      <td className="py-3.5 px-3 min-w-[240px]">
                        <div
                          className={`text-sm font-medium ${
                            task.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {task.description}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {task.category}
                      </td>

                      <td className="py-3.5 px-3 text-xs whitespace-nowrap">
                        <span
                          className={
                            task.priority === TaskPriority.High
                              ? 'text-amber-700 dark:text-amber-400 font-medium'
                              : task.priority === TaskPriority.Medium
                              ? 'text-slate-700 dark:text-slate-300'
                              : 'text-slate-500 dark:text-slate-400'
                          }
                        >
                          {PRIORITY_TEXT[task.priority]}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {task.dueDate}
                      </td>

                      <td className="py-3.5 px-3 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 text-right whitespace-nowrap">
                        {task.estimatedMinutes} мин
                      </td>

                      <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {!task.completed && (
                            <button
                              type="button"
                              onClick={() => onStartFocusForTask(task.id)}
                              title="Запустить фокус-сессию для этой задачи"
                              aria-label={`Запустить фокус для «${task.title}»`}
                              className={`p-2 rounded-lg transition-colors ${
                                isFocused
                                  ? 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60'
                                  : 'text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(task)}
                            title="Редактировать"
                            aria-label={`Редактировать «${task.title}»`}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            title="Удалить"
                            aria-label={`Удалить «${task.title}»`}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-14 px-6 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Задачи по выбранным условиям не найдены
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Измените фильтры или создайте новую задачу.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {(search || statusFilter !== 'all' || categoryFilter !== 'Все') && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Сбросить фильтры
                </button>
              )}
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors"
              >
                Создать задачу
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
