import { FirasState, TaskPriority } from '../types/firas';

const today = new Date();
const toDateKey = (offsetDays: number): string => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const getWeekLogs = () => {
  const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const currentDayIndex = (today.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const sampleMinutes = [75, 100, 50, 125, 90, 45, 50];

  return labels.map((dayLabel, idx) => {
    const offset = idx - currentDayIndex;
    const minutes = idx <= currentDayIndex ? sampleMinutes[idx] : 0;
    return {
      dayLabel,
      dateKey: toDateKey(offset),
      minutes,
      sessions: Math.round(minutes / 25),
    };
  });
};

export const INITIAL_FIRAS_STATE: FirasState = {
  theme: 'light',
  tasks: [
    {
      id: 't-1',
      title: 'Сформулировать архитектуру второго квартала',
      description: 'Собрать ключевые гипотезы, определить три измеримых ориентира и согласовать план с командой.',
      completed: false,
      priority: TaskPriority.High,
      category: 'Стратегия',
      dueDate: toDateKey(0),
      estimatedMinutes: 50,
      focusSessionsCompleted: 1,
      createdAt: toDateKey(-2),
    },
    {
      id: 't-2',
      title: 'Разобрать заметки после клиентского интервью',
      description: 'Выделить повторяющиеся сценарии использования и перенести конкретные формулировки в бэклог.',
      completed: false,
      priority: TaskPriority.High,
      category: 'Работа',
      dueDate: toDateKey(0),
      estimatedMinutes: 25,
      focusSessionsCompleted: 0,
      createdAt: toDateKey(-1),
    },
    {
      id: 't-3',
      title: 'Подготовить конспект главы по системному мышлению',
      description: 'Зафиксировать принципы обратной связи и привести два практических примера из текущих проектов.',
      completed: false,
      priority: TaskPriority.Medium,
      category: 'Обучение',
      dueDate: toDateKey(1),
      estimatedMinutes: 45,
      focusSessionsCompleted: 0,
      createdAt: toDateKey(-1),
    },
    {
      id: 't-4',
      title: 'Проверить недельный бюджет и регулярные подписки',
      description: 'Отменить неиспользуемые сервисы и обновить прогноз на следующий месяц.',
      completed: true,
      priority: TaskPriority.Normal,
      category: 'Личное',
      dueDate: toDateKey(0),
      estimatedMinutes: 25,
      focusSessionsCompleted: 1,
      createdAt: toDateKey(-3),
    },
    {
      id: 't-5',
      title: 'Провести ревизию дизайна карточки отчёта',
      description: 'Выровнять отступы, проверить выравнивание чисел в таблице и убрать лишние визуальные рамки.',
      completed: false,
      priority: TaskPriority.Medium,
      category: 'Работа',
      dueDate: toDateKey(2),
      estimatedMinutes: 45,
      focusSessionsCompleted: 0,
      createdAt: toDateKey(0),
    },
  ],
  notes: [
    {
      id: 'n-1',
      title: 'Принцип ясного отбора',
      category: 'Проекты',
      pinned: true,
      updatedAt: toDateKey(0),
      content: `Главный враг глубокой работы — не отсутствие времени, а размытое внимание между десятком второстепенных решений.

Правило на каждую неделю в Firas:
1. Выбрать не более двух задач, которые действительно меняют картину недели.
2. Первые 50 минут утра отдавать созиданию, а не входящим сообщениям.
3. Фиксировать итог дня одной короткой строкой до закрытия рабочего стола.`,
    },
    {
      id: 'n-2',
      title: 'Конспект: обратная связь в продуктовых циклах',
      category: 'Идеи',
      pinned: true,
      updatedAt: toDateKey(-1),
      content: `Быстрая обратная связь ценнее идеальной спецификации. Когда цикл проверки занимает дни вместо недель, стоимость ошибки падает в разы.

Что проверить в текущем релизе:
- Насколько быстро новый человек понимает главное действие на экране.
- Есть ли лишние шаги между мыслью и фиксацией результата.
- Все ли числовые показатели читаются с первого взгляда.`,
    },
    {
      id: 'n-3',
      title: 'Вечерний чек-лист завершения дня',
      category: 'Рефлексия',
      pinned: false,
      updatedAt: toDateKey(-2),
      content: `- Закрыть все открытые вкладки, кроме одной опорной на завтра.
- Отметить выполненные шаги в списке задач и перенести незавершённое осознанно.
- Выписать одну мысль или наблюдение, которое стоит сохранить.`,
    },
  ],
  habits: [
    {
      id: 'h-1',
      name: 'Утренний блок глубокой работы (50 мин)',
      targetDaysPerWeek: 5,
      weekDays: [true, true, true, true, false, false, false],
    },
    {
      id: 'h-2',
      name: 'Чтение профессиональной литературы (30 мин)',
      targetDaysPerWeek: 6,
      weekDays: [true, false, true, true, true, false, false],
    },
    {
      id: 'h-3',
      name: 'Вечерний разбор заметок и плана',
      targetDaysPerWeek: 5,
      weekDays: [true, true, false, true, true, false, false],
    },
    {
      id: 'h-4',
      name: 'Прогулка без экрана (40 мин)',
      targetDaysPerWeek: 7,
      weekDays: [true, true, true, false, true, true, false],
    },
  ],
  bookmarks: [
    {
      id: 'bm-1',
      title: 'Википедия',
      url: 'https://ru.wikipedia.org/wiki/Заглавная_страница',
      category: 'Справочники',
    },
    {
      id: 'bm-2',
      title: 'Habr',
      url: 'https://habr.com/ru/articles/',
      category: 'Технологии',
    },
    {
      id: 'bm-3',
      title: 'Forbes',
      url: 'https://www.forbes.com/real-time-billionaires/',
      category: 'Бизнес',
    },
    {
      id: 'bm-4',
      title: 'Google Play',
      url: 'https://play.google.com/store',
      category: 'Приложения',
    },
    {
      id: 'bm-5',
      title: 'GitHub',
      url: 'https://github.com/explore',
      category: 'Разработка',
    },
    {
      id: 'bm-6',
      title: 'Mail.ru',
      url: 'https://mail.ru/',
      category: 'Портал',
    },
    {
      id: 'bm-7',
      title: 'Яндекс',
      url: 'https://ya.ru',
      category: 'Поиск',
    },
    {
      id: 'bm-8',
      title: 'Google',
      url: 'https://www.google.com',
      category: 'Поиск',
    },
  ],
  focusLog: getWeekLogs(),
};
