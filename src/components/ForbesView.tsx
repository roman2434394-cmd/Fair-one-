import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Globe,
  FilePlus,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  X,
} from 'lucide-react';
import { ForbesEntry, ForbesResponse } from '../types/firas';

interface ForbesViewProps {
  onOpenInBrowser: (query: string) => void;
  onSaveToNotes: (entry: ForbesEntry) => void;
}

type RegionFilter = 'global' | 'russia';

export const ForbesView: React.FC<ForbesViewProps> = ({
  onOpenInBrowser,
  onSaveToNotes,
}) => {
  const [region, setRegion] = useState<RegionFilter>('global');
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('Все');
  const [data, setData] = useState<ForbesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ForbesEntry | null>(null);

  const loadForbes = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/forbes');
      if (!resp.ok) throw new Error('Не удалось загрузить рейтинг Forbes.');
      const json = (await resp.json()) as ForbesResponse;
      setData(json);
    } catch {
      setError('Ошибка при получении рейтинга Forbes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForbes();
  }, []);

  const regionItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter((item) => item.regionGroup === region);
  }, [data, region]);

  const industries = useMemo(() => {
    const set = new Set<string>();
    regionItems.forEach((item) => set.add(item.industry));
    return ['Все', ...Array.from(set)];
  }, [regionItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regionItems.filter((item) => {
      if (industryFilter !== 'Все' && item.industry !== industryFilter) return false;
      if (
        q &&
        !item.nameRu.toLowerCase().includes(q) &&
        !item.name.toLowerCase().includes(q) &&
        !item.source.toLowerCase().includes(q) &&
        !item.countryRu.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [regionItems, search, industryFilter]);

  const totalWorth = useMemo(
    () =>
      filteredItems.reduce((sum, item) => sum + item.netWorthBillions, 0),
    [filteredItems]
  );

  const leader = filteredItems[0] || regionItems[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Список Forbes
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Мировой и российский рейтинг крупнейших состояний{' '}
            {data && (
              <>
                <span aria-hidden="true">·</span>{' '}
                <span>
                  {data.source === 'live'
                    ? 'Актуальная сводка Forbes'
                    : 'Редакционный срез Forbes'}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setRegion('global');
                setIndustryFilter('Все');
                setSelected(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                region === 'global'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Мир
            </button>
            <button
              type="button"
              onClick={() => {
                setRegion('russia');
                setIndustryFilter('Все');
                setSelected(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                region === 'russia'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Россия
            </button>
          </div>

          <button
            type="button"
            onClick={loadForbes}
            disabled={loading}
            aria-label="Обновить список Forbes"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {/* Metric strip */}
      <section
        aria-label="Сводка по рейтингу Forbes"
        className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Участников в выборке
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {filteredItems.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Список: {region === 'global' ? 'Forbes Global' : 'Forbes Россия'}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Совокупный капитал
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            ${(totalWorth / 1000).toFixed(2)} трлн
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            ${totalWorth.toFixed(1)} млрд
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Лидер выборки
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
            {leader ? leader.nameRu : '—'}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {leader ? `$${leader.netWorthBillions.toFixed(1)} млрд` : 'Нет данных'}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Среднее состояние
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            $
            {filteredItems.length > 0
              ? (totalWorth / filteredItems.length).toFixed(1)
              : '0.0'}{' '}
            млрд
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            На одного участника
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, компании или стране..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <select
          aria-label="Фильтр по отрасли"
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind === 'Все' ? 'Все отрасли' : ind}
            </option>
          ))}
        </select>
      </div>

      {/* Main grid: Table + Optional Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div
          className={`${
            selected ? 'xl:col-span-8' : 'xl:col-span-12'
          } bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden`}
        >
          {loading ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="h-4 w-48 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 px-6 text-center">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                type="button"
                onClick={loadForbes}
                className="mt-3 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white"
              >
                Повторить загрузку
              </button>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/40">
                    <th className="py-3 pl-5 pr-3 w-14 font-mono">#</th>
                    <th className="py-3 px-3">Участник</th>
                    <th className="py-3 px-3 whitespace-nowrap">Источник капитала</th>
                    <th className="py-3 px-3 whitespace-nowrap">Страна</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Состояние</th>
                    <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">За день</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredItems.map((entry) => {
                    const isSelected =
                      selected?.name === entry.name &&
                      selected?.regionGroup === entry.regionGroup;
                    const positive = entry.dailyChangeBillions > 0;
                    const negative = entry.dailyChangeBillions < 0;
                    return (
                      <tr
                        key={`${entry.regionGroup}-${entry.rank}-${entry.name}`}
                        onClick={() => setSelected(entry)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3.5 pl-5 pr-3 font-mono tabular-nums text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {entry.rank}
                        </td>
                        <td className="py-3.5 px-3 min-w-[200px]">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {entry.nameRu}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {entry.industry}
                            {entry.age ? ` · ${entry.age} лет` : ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-600 dark:text-slate-300">
                          {entry.source}
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {entry.countryRu}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          ${entry.netWorthBillions.toFixed(1)} млрд
                        </td>
                        <td className="py-3.5 pl-3 pr-5 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-end gap-0.5 ${
                              positive
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : negative
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {positive && <ArrowUpRight className="w-3.5 h-3.5" />}
                            {negative && <ArrowDownRight className="w-3.5 h-3.5" />}
                            {positive ? '+' : ''}
                            {entry.dailyChangeBillions.toFixed(1)} млрд
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 px-6 text-center text-sm text-slate-500 dark:text-slate-400">
              По вашему запросу участники не найдены.
            </div>
          )}
        </div>

        {selected && (
          <aside className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Позиция #{selected.rank} · {selected.regionGroup === 'global' ? 'Forbes Global' : 'Forbes Россия'}
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selected.nameRu}
                </h2>
                {selected.name !== selected.nameRu && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {selected.name}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Закрыть карточку участника"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Состояние</div>
                <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  ${selected.netWorthBillions.toFixed(1)} млрд
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Страна</div>
                <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {selected.countryRu}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Активы</div>
                <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {selected.source}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Отрасль</div>
                <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {selected.industry}
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {selected.bio}
            </p>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => onOpenInBrowser(selected.nameRu)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>Найти в браузере Fires</span>
              </button>

              <button
                type="button"
                onClick={() => onSaveToNotes(selected)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <FilePlus className="w-4 h-4" />
                <span>Сохранить досье в Заметки</span>
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
