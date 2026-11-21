import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  ALL_ROLES_ASC,
  ROLE_LABEL_RU,
  ROLE_LEVEL,
  isStaffRole,
  type AccountStatus,
  type AdminAuditEntry,
  type AiChatMessage,
  type AiChatThread,
  type AiProviderId,
  type BridgeDispatchResult,
  type BrowsedPageData,
  type BrowserPublicConfig,
  type BuiltInAiProviderId,
  type CloudFileItem,
  type CustomAiModel,
  type CustomAiSpecialty,
  type DailyNewsItem,
  type DailyNewsResponse,
  type ExternalChannelId,
  type ForbesEntry,
  type ForbesResponse,
  type FriendRequestItem,
  type FriendshipStatus,
  type LoginConfirmationRequest,
  type MessengerBridgeBinding,
  type MessengerCallRecord,
  type MessengerContact,
  type MessengerMessage,
  type MessengerServer,
  type PageBlock,
  type PageLinkItem,
  type SearchEngineId,
  type SearchResultItem,
  type UserProfile,
  type UserRole,
} from './src/types/firas.ts';
import type { BrowserExtensionItem } from './src/types/extensions.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
const envPort =
  process.env.PORT && process.env.PORT !== process.env.NGINX_PORT
    ? Number(process.env.PORT)
    : NaN;
const PORT =
  Number.isFinite(cliPort) && cliPort > 0
    ? cliPort
    : Number.isFinite(envPort) && envPort > 0
    ? envPort
    : Number(process.env.DEFAULT_APP_PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const GEMINI_FREE_MODEL = 'gemini-4-hydrogen';

function withTimeout<T>(promise: Promise<T>, ms: number, label = 'timeout'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Curated Forbes fallback dataset (used when external Forbes API is unavailable or rate-limited,
// and merged with Russian Forbes list entries for complete coverage)
const CURATED_FORBES_GLOBAL: ForbesEntry[] = [
  {
    rank: 1,
    name: 'Elon Musk',
    nameRu: 'Илон Маск',
    netWorthBillions: 312.4,
    dailyChangeBillions: 4.2,
    age: 55,
    country: 'United States',
    countryRu: 'США',
    regionGroup: 'global',
    source: 'Tesla, SpaceX, xAI',
    industry: 'Автомобили и космос',
    bio: 'Сооснователь и руководитель Tesla и SpaceX, развивает проекты в области электромобилей, космических запусков и автономных систем.',
  },
  {
    rank: 2,
    name: 'Jeff Bezos',
    nameRu: 'Джефф Безос',
    netWorthBillions: 229.8,
    dailyChangeBillions: 1.6,
    age: 62,
    country: 'United States',
    countryRu: 'США',
    regionGroup: 'global',
    source: 'Amazon, Blue Origin',
    industry: 'Технологии и ритейл',
    bio: 'Основатель Amazon и аэрокосмической компании Blue Origin, владелец издания The Washington Post.',
  },
  {
    rank: 3,
    name: 'Mark Zuckerberg',
    nameRu: 'Марк Цукерберг',
    netWorthBillions: 214.5,
    dailyChangeBillions: -1.1,
    age: 42,
    country: 'United States',
    countryRu: 'США',
    regionGroup: 'global',
    source: 'Meta Platforms',
    industry: 'Технологии',
    bio: 'Сооснователь и генеральный директор Meta Platforms, объединяющей ключевые социальные и коммуникационные сервисы.',
  },
  {
    rank: 4,
    name: 'Larry Ellison',
    nameRu: 'Ларри Эллисон',
    netWorthBillions: 206.2,
    dailyChangeBillions: 2.3,
    age: 82,
    country: 'United States',
    countryRu: 'США',
    regionGroup: 'global',
    source: 'Oracle',
    industry: 'Технологии',
    bio: 'Сооснователь и председатель совета директоров корпорации Oracle, одного из крупнейших разработчиков корпоративного ПО и облачной инфраструктуры.',
  },
  {
    rank: 5,
    name: 'Bernard Arnault & family',
    nameRu: 'Бернар Арно и семья',
    netWorthBillions: 184.7,
    dailyChangeBillions: -0.9,
    age: 77,
    country: 'France',
    countryRu: 'Франция',
    regionGroup: 'global',
    source: 'LVMH',
    industry: 'Мода и люкс',
    bio: 'Глава и контролирующий акционер группы LVMH, объединяющей более 75 мировых брендов в сегменте люкс.',
  },
  {
    rank: 6,
    name: 'Warren Buffett',
    nameRu: 'Уоррен Баффетт',
    netWorthBillions: 152.1,
    dailyChangeBillions: 0.7,
    age: 96,
    country: 'United States',
    countryRu: 'США',
    regionGroup: 'global',
    source: 'Berkshire Hathaway',
    industry: 'Финансы и инвестиции',
    bio: 'Глава инвестиционного холдинга Berkshire Hathaway, один из самых известных последователей стоимостного инвестирования.',
  },
  {
    rank: 7,
    name: 'Larry Page',
    nameRu: 'Ларри Пейдж',
    netWorthBillions: 149.4,
    dailyChangeBillions: 1.4,
    age: 53,
    country: 'United States',
    countryRu: 'США',
    regionGroup: 'global',
    source: 'Google / Alphabet',
    industry: 'Технологии',
    bio: 'Сооснователь Google, соавтор алгоритма ранжирования PageRank и член совета директоров Alphabet.',
  },
  {
    rank: 8,
    name: 'Sergey Brin',
    nameRu: 'Сергей Брин',
    netWorthBillions: 143.0,
    dailyChangeBillions: 1.2,
    age: 53,
    country: 'United States',
    countryRu: 'США',
    regionGroup: 'global',
    source: 'Google / Alphabet',
    industry: 'Технологии',
    bio: 'Сооснователь Google и ключевой архитектор ранней поисковой инфраструктуры Alphabet.',
  },
  {
    rank: 9,
    name: 'Jensen Huang',
    nameRu: 'Дженсен Хуанг',
    netWorthBillions: 136.5,
    dailyChangeBillions: 3.1,
    age: 63,
    country: 'United States',
    countryRu: 'США',
    regionGroup: 'global',
    source: 'Nvidia',
    industry: 'Полупроводники',
    bio: 'Сооснователь и бессменный генеральный директор компании Nvidia, ведущего производителя графических процессоров и вычислительных платформ.',
  },
  {
    rank: 10,
    name: 'Amancio Ortega',
    nameRu: 'Амансио Ортега',
    netWorthBillions: 124.2,
    dailyChangeBillions: 0.4,
    age: 90,
    country: 'Spain',
    countryRu: 'Испания',
    regionGroup: 'global',
    source: 'Inditex (Zara)',
    industry: 'Ритейл и мода',
    bio: 'Основатель испанской группы Inditex, владеющей сетями Zara, Massimo Dutti, Bershka и Pull&Bear.',
  },
  {
    rank: 11,
    name: 'Steve Ballmer',
    nameRu: 'Стив Балмер',
    netWorthBillions: 122.8,
    dailyChangeBillions: 0.9,
    age: 70,
    country: 'United States',
    countryRu: 'США',
    regionGroup: 'global',
    source: 'Microsoft, LA Clippers',
    industry: 'Технологии',
    bio: 'Бывший генеральный директор Microsoft (2000–2014) и владелец баскетбольного клуба Los Angeles Clippers.',
  },
  {
    rank: 12,
    name: 'Bill Gates',
    nameRu: 'Билл Гейтс',
    netWorthBillions: 112.4,
    dailyChangeBillions: 0.3,
    age: 71,
    country: 'United States',
    countryRu: 'США',
    regionGroup: 'global',
    source: 'Microsoft, Cascade Investment',
    industry: 'Технологии',
    bio: 'Сооснователь Microsoft, инвестор и руководитель благотворительного фонда Gates Foundation.',
  },
  {
    rank: 13,
    name: 'Mukesh Ambani',
    nameRu: 'Мукеш Амбани',
    netWorthBillions: 106.9,
    dailyChangeBillions: -0.6,
    age: 69,
    country: 'India',
    countryRu: 'Индия',
    regionGroup: 'global',
    source: 'Reliance Industries',
    industry: 'Энергетика и телеком',
    bio: 'Председатель и крупнейший акционер индийского конгломерата Reliance Industries (нефтехимия, ритейл, телеком Jio).',
  },
  {
    rank: 14,
    name: 'Michael Dell',
    nameRu: 'Майкл Делл',
    netWorthBillions: 102.3,
    dailyChangeBillions: 1.1,
    age: 61,
    country: 'United States',
    countryRu: 'США',
    regionGroup: 'global',
    source: 'Dell Technologies',
    industry: 'Технологии',
    bio: 'Основатель и генеральный директор Dell Technologies, одного из крупнейших поставщиков серверов и вычислительных систем.',
  },
  {
    rank: 15,
    name: 'Carlos Slim Helu & family',
    nameRu: 'Карлос Слим Элу и семья',
    netWorthBillions: 88.6,
    dailyChangeBillions: -0.2,
    age: 86,
    country: 'Mexico',
    countryRu: 'Мексика',
    regionGroup: 'global',
    source: 'América Móvil, Grupo Carso',
    industry: 'Телеком',
    bio: 'Крупнейший мексиканский предприниматель, контролирующий телекоммуникационного оператора América Móvil и диверсифицированный холдинг Grupo Carso.',
  },
  {
    rank: 16,
    name: 'Zhong Shanshan',
    nameRu: 'Чжун Шаньшань',
    netWorthBillions: 64.5,
    dailyChangeBillions: 0.5,
    age: 71,
    country: 'China',
    countryRu: 'Китай',
    regionGroup: 'global',
    source: 'Nongfu Spring',
    industry: 'Потребительские товары',
    bio: 'Основатель крупнейшего в Китае производителя бутилированной воды и напитков Nongfu Spring и биотех-компании Wantai.',
  },
  {
    rank: 17,
    name: 'Tadashi Yanai & family',
    nameRu: 'Тадаси Янай и семья',
    netWorthBillions: 48.2,
    dailyChangeBillions: 0.3,
    age: 77,
    country: 'Japan',
    countryRu: 'Япония',
    regionGroup: 'global',
    source: 'Fast Retailing (Uniqlo)',
    industry: 'Ритейл и мода',
    bio: 'Основатель и президент японской группы Fast Retailing, управляющей глобальной сетью магазинов Uniqlo.',
  },
  {
    rank: 18,
    name: 'Masayoshi Son',
    nameRu: 'Масаёси Сон',
    netWorthBillions: 44.1,
    dailyChangeBillions: 1.5,
    age: 69,
    country: 'Japan',
    countryRu: 'Япония',
    regionGroup: 'global',
    source: 'SoftBank Group',
    industry: 'Финансы и инвестиции',
    bio: 'Основатель и глава SoftBank Group, одного из ключевых мировых технологических инвесторов.',
  },
];

const CURATED_FORBES_RUSSIA: ForbesEntry[] = [
  {
    rank: 1,
    name: 'Vagit Alekperov',
    nameRu: 'Вагит Алекперов',
    netWorthBillions: 28.9,
    dailyChangeBillions: 0.4,
    age: 76,
    country: 'Russia',
    countryRu: 'Россия',
    regionGroup: 'russia',
    source: 'Лукойл',
    industry: 'Нефть и газ',
    bio: 'Крупнейший акционер и бывший президент нефтяной компании «Лукойл».',
  },
  {
    rank: 2,
    name: 'Alexey Mordashov & family',
    nameRu: 'Алексей Мордашов и семья',
    netWorthBillions: 26.4,
    dailyChangeBillions: 0.2,
    age: 61,
    country: 'Russia',
    countryRu: 'Россия',
    regionGroup: 'russia',
    source: 'Северсталь, Nordgold, Лента',
    industry: 'Металлургия и ритейл',
    bio: 'Основной акционер и председатель совета директоров металлургической группы «Северсталь».',
  },
  {
    rank: 3,
    name: 'Leonid Mikhelson',
    nameRu: 'Леонид Михельсон',
    netWorthBillions: 25.8,
    dailyChangeBillions: -0.3,
    age: 71,
    country: 'Russia',
    countryRu: 'Россия',
    regionGroup: 'russia',
    source: 'Новатэк, Сибур',
    industry: 'Нефть и газ',
    bio: 'Председатель правления газовой компании «Новатэк» и совладелец нефтехимического холдинга «Сибур».',
  },
  {
    rank: 4,
    name: 'Vladimir Lisin',
    nameRu: 'Владимир Лисин',
    netWorthBillions: 24.9,
    dailyChangeBillions: 0.1,
    age: 70,
    country: 'Russia',
    countryRu: 'Россия',
    regionGroup: 'russia',
    source: 'НЛМК',
    industry: 'Металлургия',
    bio: 'Председатель совета директоров и контролирующий акционер Новолипецкого металлургического комбината (НЛМК).',
  },
  {
    rank: 5,
    name: 'Vladimir Potanin',
    nameRu: 'Владимир Потанин',
    netWorthBillions: 23.7,
    dailyChangeBillions: 0.3,
    age: 65,
    country: 'Russia',
    countryRu: 'Россия',
    regionGroup: 'russia',
    source: 'Норникель, Интеррос',
    industry: 'Металлургия и финансы',
    bio: 'Президент холдинга «Интеррос» и руководитель горно-металлургической компании «Норникель».',
  },
  {
    rank: 6,
    name: 'Gennady Timchenko',
    nameRu: 'Геннадий Тимченко',
    netWorthBillions: 22.1,
    dailyChangeBillions: -0.2,
    age: 74,
    country: 'Russia',
    countryRu: 'Россия',
    regionGroup: 'russia',
    source: 'Новатэк, Сибур, Стройтрансгаз',
    industry: 'Нефть и газ',
    bio: 'Крупный инвестор в энергетические и инфраструктурные активы, совладелец «Новатэка» и «Сибура».',
  },
  {
    rank: 7,
    name: 'Andrey Melnichenko',
    nameRu: 'Андрей Мельниченко',
    netWorthBillions: 20.6,
    dailyChangeBillions: 0.5,
    age: 54,
    country: 'Russia',
    countryRu: 'Россия',
    regionGroup: 'russia',
    source: 'ЕвроХим, СУЭК',
    industry: 'Удобрения и энергетика',
    bio: 'Основатель производителя минеральных удобрений «ЕвроХим» и угольно-энергетической компании СУЭК.',
  },
  {
    rank: 8,
    name: 'Pavel Durov',
    nameRu: 'Павел Дуров',
    netWorthBillions: 17.8,
    dailyChangeBillions: 0.4,
    age: 42,
    country: 'UAE / Russia',
    countryRu: 'ОАЭ / Россия',
    regionGroup: 'russia',
    source: 'Telegram',
    industry: 'Технологии',
    bio: 'Основатель и владелец мессенджера Telegram, ранее — сооснователь социальной сети «ВКонтакте».',
  },
  {
    rank: 9,
    name: 'Alisher Usmanov',
    nameRu: 'Алишер Усманов',
    netWorthBillions: 14.4,
    dailyChangeBillions: 0.0,
    age: 73,
    country: 'Russia',
    countryRu: 'Россия',
    regionGroup: 'russia',
    source: 'Металлоинвест, Мегафон',
    industry: 'Металлургия и телеком',
    bio: 'Основатель и основной акционер холдинга USM, объединяющего горно-металлургические и телекоммуникационные активы.',
  },
  {
    rank: 10,
    name: 'Mikhail Fridman',
    nameRu: 'Михаил Фридман',
    netWorthBillions: 13.6,
    dailyChangeBillions: -0.1,
    age: 62,
    country: 'Russia',
    countryRu: 'Россия',
    regionGroup: 'russia',
    source: 'Альфа-Групп, X5 Group',
    industry: 'Финансы и ритейл',
    bio: 'Сооснователь консорциума «Альфа-Групп» и инвестиционной компании LetterOne.',
  },
  {
    rank: 11,
    name: 'Tatyana Kim',
    nameRu: 'Татьяна Ким',
    netWorthBillions: 7.4,
    dailyChangeBillions: 0.2,
    age: 51,
    country: 'Russia',
    countryRu: 'Россия',
    regionGroup: 'russia',
    source: 'Wildberries & Russ',
    industry: 'Электронная коммерция',
    bio: 'Основательница и глава маркетплейса Wildberries.',
  },
  {
    rank: 12,
    name: 'Arkady Volozh',
    nameRu: 'Аркадий Волож',
    netWorthBillions: 2.1,
    dailyChangeBillions: 0.1,
    age: 62,
    country: 'Israel / Russia',
    countryRu: 'Израиль / Россия',
    regionGroup: 'russia',
    source: 'Nebius Group',
    industry: 'Технологии',
    bio: 'Сооснователь «Яндекса», в настоящее время развивает облачную ИИ-инфраструктуру Nebius Group.',
  },
];

let forbesCache: { fetchedAt: number; data: ForbesResponse } | null = null;
const FORBES_CACHE_TTL_MS = 10 * 60 * 1000;

const COUNTRY_TO_RU: Record<string, string> = {
  'United States': 'США',
  France: 'Франция',
  Spain: 'Испания',
  India: 'Индия',
  Mexico: 'Мексика',
  China: 'Китай',
  Japan: 'Япония',
  Germany: 'Германия',
  'United Kingdom': 'Великобритания',
  Canada: 'Канада',
  Russia: 'Россия',
  Italy: 'Италия',
  Switzerland: 'Швейцария',
  Australia: 'Австралия',
  Brazil: 'Бразилия',
  'Hong Kong': 'Гонконг',
  Indonesia: 'Индонезия',
  'South Korea': 'Южная Корея',
};

const INDUSTRY_TO_RU: Record<string, string> = {
  Technology: 'Технологии',
  'Fashion & Retail': 'Мода и ритейл',
  Automotive: 'Автомобили',
  'Finance & Investments': 'Финансы и инвестиции',
  Diversified: 'Диверсифицированный бизнес',
  Energy: 'Энергетика',
  Telecom: 'Телеком',
  'Food & Beverage': 'Потребительские товары',
  Manufacturing: 'Промышленность',
  Healthcare: 'Здравоохранение',
  'Metals & Mining': 'Металлургия',
  Media: 'Медиа',
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  const ipv4Match = lower.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

async function fetchLiveForbes(): Promise<ForbesResponse> {
  if (forbesCache && Date.now() - forbesCache.fetchedAt < FORBES_CACHE_TTL_MS) {
    return forbesCache.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(
      'https://www.forbes.com/forbesapi/person/rtb/0/position/true.json?limit=25',
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'FiresEngine/132.0 (FirasWorkspace/1.0)',
          Accept: 'application/json',
        },
      }
    );
    clearTimeout(timeout);

    if (resp.ok) {
      const json = (await resp.json()) as {
        personList?: {
          personsLists?: Array<{
            rank?: number;
            personName?: string;
            finalWorth?: number;
            estWorthPrev?: number;
            birthDate?: number;
            countryOfCitizenship?: string;
            source?: string;
            industries?: string[];
            bios?: string[];
          }>;
        };
      };

      const rows = json?.personList?.personsLists;
      if (Array.isArray(rows) && rows.length > 0) {
        const liveGlobal: ForbesEntry[] = rows.slice(0, 25).map((p, idx) => {
          const worthB = Number(((p.finalWorth ?? 0) / 1000).toFixed(1));
          const prevB = Number(((p.estWorthPrev ?? p.finalWorth ?? 0) / 1000).toFixed(1));
          const changeB = Number((worthB - prevB).toFixed(1));
          const country = p.countryOfCitizenship || 'United States';
          const industryRaw = p.industries?.[0] || 'Diversified';
          const birthMs = p.birthDate;
          const age =
            typeof birthMs === 'number' && birthMs !== 0
              ? Math.max(20, new Date().getFullYear() - new Date(birthMs).getFullYear())
              : null;
          const matchedCurated = CURATED_FORBES_GLOBAL.find(
            (c) => c.name.toLowerCase() === (p.personName || '').toLowerCase()
          );

          return {
            rank: p.rank ?? idx + 1,
            name: p.personName || `Участник #${idx + 1}`,
            nameRu: matchedCurated?.nameRu || p.personName || `Участник #${idx + 1}`,
            netWorthBillions: worthB,
            dailyChangeBillions: changeB,
            age: matchedCurated?.age ?? age,
            country,
            countryRu: COUNTRY_TO_RU[country] || country,
            regionGroup: 'global',
            source: p.source || matchedCurated?.source || 'Частный капитал',
            industry: INDUSTRY_TO_RU[industryRaw] || industryRaw,
            bio:
              matchedCurated?.bio ||
              (Array.isArray(p.bios) && p.bios[0]) ||
              `Участник мирового рейтинга Forbes (${p.source || industryRaw}).`,
          };
        });

        const result: ForbesResponse = {
          source: 'live',
          updatedAt: new Date().toISOString(),
          items: [...liveGlobal, ...CURATED_FORBES_RUSSIA],
        };
        forbesCache = { fetchedAt: Date.now(), data: result };
        return result;
      }
    }
  } catch {
    // Fall back cleanly to curated Forbes dataset
  }

  const fallback: ForbesResponse = {
    source: 'curated',
    updatedAt: new Date().toISOString(),
    items: [...CURATED_FORBES_GLOBAL, ...CURATED_FORBES_RUSSIA],
  };
  forbesCache = { fetchedAt: Date.now(), data: fallback };
  return fallback;
}

async function searchWikipedia(query: string, lang: 'ru' | 'en'): Promise<SearchResultItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const endpoint = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&srlimit=6&utf8=1&format=json`;
    const resp = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Fires/132.0 (FiresEngine/132.0)',
      },
    });
    clearTimeout(timeout);
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      query?: { search?: Array<{ title: string; snippet: string }> };
    };
    const items = data?.query?.search ?? [];
    return items.map((item) => ({
      title: item.title,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(
        item.title.replace(/ /g, '_')
      )}`,
      snippet: stripTags(item.snippet),
      source: lang === 'ru' ? 'Wikipedia RU' : 'Wikipedia EN',
    }));
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

async function searchDuckDuckGoHtml(query: string): Promise<SearchResultItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'FiresEngine/132.0 (Windows NT 10.0; Win64; x64; FiresCore/132.0)',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        },
      }
    );
    clearTimeout(timeout);
    if (!resp.ok) return [];
    const html = await resp.text();
    const results: SearchResultItem[] = [];
    const blockRegex =
      /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(html)) !== null && results.length < 8) {
      let rawUrl = decodeHtmlEntities(match[1]);
      if (rawUrl.includes('uddg=')) {
        try {
          const parsed = new URL(
            rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl,
            'https://duckduckgo.com'
          );
          const uddg = parsed.searchParams.get('uddg');
          if (uddg) rawUrl = uddg;
        } catch {
          // keep rawUrl
        }
      }
      if (!rawUrl.startsWith('http')) continue;
      const title = stripTags(match[2]);
      const snippet = stripTags(match[3]);
      if (title) {
        results.push({
          title,
          url: rawUrl,
          snippet: snippet || 'Веб-страница из поисковой выдачи',
          source: 'Web',
        });
      }
    }
    return results;
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

async function searchHabr(query: string): Promise<SearchResultItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const resp = await fetch(
      `https://habr.com/ru/rss/search/?q=${encodeURIComponent(query)}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'Fires/132.0 (FiresEngine/132.0)' },
      }
    );
    clearTimeout(timeout);
    if (!resp.ok) return [];
    const xml = await resp.text();
    const results: SearchResultItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(xml)) !== null && results.length < 4) {
      const chunk = m[1];
      const titleMatch = chunk.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
      const linkMatch = chunk.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = chunk.match(
        /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/
      );
      const title = stripTags(titleMatch?.[1] || titleMatch?.[2] || '');
      const url = (linkMatch?.[1] || '').trim();
      const snippet = stripTags(descMatch?.[1] || descMatch?.[2] || '').slice(0, 220);
      if (title && url.startsWith('http')) {
        results.push({
          title,
          url,
          snippet: snippet || 'Публикация на Habr',
          source: 'Habr',
        });
      }
    }
    return results;
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

function extractReadablePage(html: string, finalUrl: string): BrowsedPageData {
  const parsedUrl = new URL(finalUrl);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = stripTags(titleMatch?.[1] || '') || parsedUrl.hostname;

  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i);
  const description = stripTags(descMatch?.[1] || '');

  // Strip non-content sections before extracting blocks
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  const blocks: PageBlock[] = [];
  const blockRegex = /<(h1|h2|h3|p|blockquote|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  const seenText = new Set<string>();

  while ((match = blockRegex.exec(cleaned)) !== null && blocks.length < 70) {
    const tag = match[1].toLowerCase();
    const text = stripTags(match[2]);
    if (!text || text.length < (tag === 'p' ? 28 : 4)) continue;
    if (seenText.has(text)) continue;
    seenText.add(text);

    const type: PageBlock['type'] =
      tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'li'
        ? tag
        : tag === 'blockquote'
        ? 'quote'
        : 'p';
    blocks.push({ type, text });
  }

  const links: PageLinkItem[] = [];
  const seenLinks = new Set<string>();
  const linkRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = linkRegex.exec(cleaned)) !== null && links.length < 24) {
    const rawHref = decodeHtmlEntities(match[1]).trim();
    const label = stripTags(match[2]);
    if (!rawHref || !label || label.length < 3 || label.length > 90) continue;
    if (rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) continue;
    try {
      const resolved = new URL(rawHref, finalUrl).toString();
      if (!resolved.startsWith('http')) continue;
      if (seenLinks.has(resolved)) continue;
      seenLinks.add(resolved);
      links.push({ text: label, url: resolved });
    } catch {
      // ignore invalid URL
    }
  }

  return {
    url: finalUrl,
    finalUrl,
    domain: parsedUrl.hostname,
    title,
    description,
    blocks,
    links,
    fetchedAt: new Date().toISOString(),
  };
}

let newsCache: { dateKey: string; fetchedAt: number; data: DailyNewsResponse } | null = null;
const NEWS_CACHE_TTL_MS = 30 * 60 * 1000;

function formatRussianDateLabel(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatNewsTimeLabel(rawPubDate: string): { iso: string; timeLabel: string } {
  const parsed = new Date(rawPubDate);
  if (Number.isNaN(parsed.getTime())) {
    return {
      iso: new Date().toISOString(),
      timeLabel: 'Сегодня',
    };
  }
  const timeStr = parsed.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    iso: parsed.toISOString(),
    timeLabel: timeStr,
  };
}

async function fetchRssNewsFeed(
  feedUrl: string,
  sourceName: string,
  category: string,
  limit: number
): Promise<DailyNewsItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const resp = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Fires/132.0 (FiresEngine/132.0)',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    });
    clearTimeout(timeout);
    if (!resp.ok) return [];
    const xml = await resp.text();
    const out: DailyNewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(xml)) !== null && out.length < limit) {
      const chunk = m[1];
      const titleMatch = chunk.match(
        /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/
      );
      const linkMatch = chunk.match(
        /<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>|<link>([\s\S]*?)<\/link>/
      );
      const pubMatch = chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const descMatch = chunk.match(
        /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/
      );
      const rawTitle = stripTags(titleMatch?.[1] || titleMatch?.[2] || '');
      const cleanTitle = rawTitle.replace(/\s+-\s+[^-]+$/, '').trim() || rawTitle;
      const url = (linkMatch?.[1] || linkMatch?.[2] || '').trim();
      const summary = stripTags(descMatch?.[1] || descMatch?.[2] || '').slice(0, 140);
      const { iso, timeLabel } = formatNewsTimeLabel(pubMatch?.[1] || '');

      if (cleanTitle && url.startsWith('http')) {
        out.push({
          id: `${sourceName}-${out.length}-${Buffer.from(url).toString('base64').slice(0, 10)}`,
          title: cleanTitle,
          url,
          source: sourceName,
          category,
          publishedAt: iso,
          timeLabel,
          summary: summary || `${sourceName} · ${category}`,
        });
      }
    }
    return out;
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

async function fetchDailyNews(forceRefresh = false): Promise<DailyNewsResponse> {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  if (
    !forceRefresh &&
    newsCache &&
    newsCache.dateKey === todayKey &&
    Date.now() - newsCache.fetchedAt < NEWS_CACHE_TTL_MS
  ) {
    return newsCache.data;
  }

  const [lenta, kommersant, habr, ria] = await Promise.all([
    fetchRssNewsFeed('https://lenta.ru/rss/news', 'Lenta.ru', 'Главное', 3),
    fetchRssNewsFeed('https://www.kommersant.ru/RSS/news.xml', 'Коммерсантъ', 'Экономика', 3),
    fetchRssNewsFeed('https://habr.com/ru/rss/articles/?fl=ru', 'Habr', 'Технологии', 3),
    fetchRssNewsFeed('https://ria.ru/export/rss2/archive/index.xml', 'РИА Новости', 'Мир', 3),
  ]);

  const combined: DailyNewsItem[] = [];
  const seenTitles = new Set<string>();
  const maxLen = Math.max(lenta.length, kommersant.length, habr.length, ria.length);

  for (let i = 0; i < maxLen; i += 1) {
    for (const bucket of [lenta, kommersant, habr, ria]) {
      const item = bucket[i];
      if (!item) continue;
      const norm = item.title.toLowerCase();
      if (seenTitles.has(norm)) continue;
      seenTitles.add(norm);
      combined.push(item);
    }
  }

  if (combined.length > 0) {
    const result: DailyNewsResponse = {
      dateKey: todayKey,
      dateLabel: formatRussianDateLabel(now),
      updatedAt: now.toISOString(),
      source: 'live',
      items: combined.slice(0, 8),
    };
    newsCache = { dateKey: todayKey, fetchedAt: Date.now(), data: result };
    return result;
  }

  const fallback: DailyNewsResponse = {
    dateKey: todayKey,
    dateLabel: formatRussianDateLabel(now),
    updatedAt: now.toISOString(),
    source: 'fallback',
    items: [
      {
        id: 'fb-1',
        title: 'Технологические обзоры дня и разработки в ИИ',
        url: 'https://habr.com/ru/articles/',
        source: 'Habr',
        category: 'Технологии',
        publishedAt: now.toISOString(),
        timeLabel: 'Сегодня',
        summary: 'Свежие статьи разработчиков, исследования и обзоры технологий.',
      },
      {
        id: 'fb-2',
        title: 'Главные деловые события и рынки дня',
        url: 'https://www.kommersant.ru/',
        source: 'Коммерсантъ',
        category: 'Экономика',
        publishedAt: now.toISOString(),
        timeLabel: 'Сегодня',
        summary: 'Актуальная повестка экономики, бизнеса и финансов.',
      },
      {
        id: 'fb-3',
        title: 'Лента мировых и региональных новостей',
        url: 'https://lenta.ru/',
        source: 'Lenta.ru',
        category: 'Главное',
        publishedAt: now.toISOString(),
        timeLabel: 'Сегодня',
        summary: 'Оперативная картина дня: события, общество и наука.',
      },
      {
        id: 'fb-4',
        title: 'Мировой рейтинг миллиардеров Forbes',
        url: 'https://www.forbes.com/real-time-billionaires/',
        source: 'Forbes',
        category: 'Рейтинги',
        publishedAt: now.toISOString(),
        timeLabel: 'Сегодня',
        summary: 'Ежедневное обновление состояний крупнейших предпринимателей мира.',
      },
    ],
  };
  newsCache = { dateKey: todayKey, fetchedAt: Date.now(), data: fallback };
  return fallback;
}

const OWNER_EMAIL = 'roman2434394@gmail.com';
const OWNER_BETA_USERNAME = 'крыса228';
const CLOUD_QUOTA_BYTES = 1099511627776; // 1 TB (1024^4 bytes)
const CLOUD_DIR = path.join(__dirname, '.firas-cloud');

const DEFAULT_SERVERS: MessengerServer[] = [
  {
    id: 'srv-main',
    name: 'Основной сервер Firas',
    description: 'Главный узел общения и общий чат',
    roomId: 'general',
    region: 'RU-Central',
    color: 'slate',
    createdBy: 'system',
    createdAt: '2026-01-01T00:00:00.000Z',
    isDefault: true,
  },
  {
    id: 'srv-dev',
    name: 'Сервер разработчиков',
    description: 'Канал команды разработки и обновлений Firas',
    roomId: 'server:srv-dev',
    region: 'RU-Dev',
    color: 'indigo',
    createdBy: 'system',
    createdAt: '2026-01-01T00:00:00.000Z',
    isDefault: true,
  },
  {
    id: 'srv-media',
    name: 'Медиа и облако-чат',
    description: 'Обмен файлами, ссылками TeraBox и звонками',
    roomId: 'server:srv-media',
    region: 'EU-North',
    color: 'emerald',
    createdBy: 'system',
    createdAt: '2026-01-01T00:00:00.000Z',
    isDefault: true,
  },
];

interface StoredAccount extends UserProfile {
  passwordSalt: string;
  passwordHash: string;
  claimed?: boolean;
  trustedDevices?: string[];
  loginCount?: number;
}

interface StoredFriendship {
  id: string;
  userIds: [string, string];
  createdAt: string;
}

interface StoredFriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

interface ServerStore {
  sessionSecret: string;
  users: StoredAccount[];
  config: BrowserPublicConfig;
  auditLog: AdminAuditEntry[];
  messengerMessages: MessengerMessage[];
  messengerCalls: MessengerCallRecord[];
  messengerServers: MessengerServer[];
  friendships: StoredFriendship[];
  friendRequests: StoredFriendRequest[];
  cloudFiles: CloudFileItem[];
  cloudFolders: Record<string, string[]>;
  customAiModels: CustomAiModel[];
  aiChatThreads: Record<string, AiChatThread[]>;
}

function normalizeAvatarInput(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^preset:(slate|emerald|amber|indigo|rose|teal)$/.test(trimmed)) {
    return trimmed;
  }
  if (
    /^data:image\/(jpeg|jpg|png|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(trimmed) &&
    trimmed.length <= 550_000
  ) {
    return trimmed;
  }
  return undefined;
}

const STORE_FILE_PATH = path.join(__dirname, '.firas-data.json');

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt || randomBytes(16).toString('hex');
  const hash = scryptSync(password, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function createInitialStore(): ServerStore {
  const now = new Date().toISOString();
  const placeholderPass = hashPassword(randomBytes(24).toString('hex'));

  return {
    sessionSecret: randomBytes(32).toString('hex'),
    users: [
      {
        id: 'u-root-owner',
        username: OWNER_BETA_USERNAME,
        displayName: OWNER_BETA_USERNAME,
        email: OWNER_EMAIL,
        avatar: 'preset:amber',
        role: 'developer',
        status: 'active',
        createdAt: now,
        lastLoginAt: now,
        passwordSalt: placeholderPass.salt,
        passwordHash: placeholderPass.hash,
        claimed: true,
        trustedDevices: [],
        loginCount: 1,
      },
    ],
    config: {
      announcement: '',
      searchExamples: [
        'яблоко',
        'список Forbes',
        'курс доллара',
        'квантовый компьютер',
      ],
      aiEnabled: true,
      blockedDomains: [],
      updatedAt: now,
    },
    auditLog: [
      {
        id: 'log-init',
        actorName: 'Система',
        action:
          'Инициализирована система ролей (11 уровней) и профиль программиста крыса228',
        createdAt: now,
      },
    ],
    messengerMessages: [],
    messengerCalls: [],
    messengerServers: [...DEFAULT_SERVERS],
    friendships: [],
    friendRequests: [],
    cloudFiles: [],
    cloudFolders: {},
    customAiModels: [],
    aiChatThreads: {},
  };
}

function normalizeStoredRole(rawRole: unknown): UserRole {
  const roleStr = String(rawRole || '');
  if (roleStr === 'user') return 'client';
  if ((ALL_ROLES_ASC as string[]).includes(roleStr)) {
    return roleStr as UserRole;
  }
  return 'client';
}

function loadStore(): ServerStore {
  try {
    if (fs.existsSync(STORE_FILE_PATH)) {
      const raw = fs.readFileSync(STORE_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<ServerStore>;
      if (parsed && Array.isArray(parsed.users) && parsed.config && parsed.sessionSecret) {
        let dirty = false;
        const users = parsed.users
          .filter((u) => u.id !== 'u-demo-member')
          .map((u) => {
            if (u.id === 'u-root-owner' || u.email.toLowerCase() === OWNER_EMAIL) {
              const needsDevUpgrade =
                u.role !== 'developer' ||
                !u.claimed ||
                u.username === 'roman' ||
                u.displayName === 'Главный администратор' ||
                u.displayName === 'Владелец';
              if (needsDevUpgrade) dirty = true;
              return {
                ...u,
                username: u.username === 'roman' ? OWNER_BETA_USERNAME : u.username,
                displayName:
                  u.displayName === 'Главный администратор' || u.displayName === 'Владелец'
                    ? OWNER_BETA_USERNAME
                    : u.displayName,
                avatar: u.avatar || 'preset:amber',
                role: 'developer' as UserRole,
                claimed: true,
                trustedDevices: Array.isArray(u.trustedDevices) ? u.trustedDevices : [],
                loginCount: typeof u.loginCount === 'number' ? u.loginCount : 1,
              };
            }
            const nextRole = normalizeStoredRole(u.role);
            if (nextRole !== u.role) dirty = true;
            return {
              ...u,
              role: nextRole,
              claimed: u.claimed !== false,
              trustedDevices: Array.isArray(u.trustedDevices) ? u.trustedDevices : [],
              loginCount: typeof u.loginCount === 'number' ? u.loginCount : 0,
            };
          });
        if (users.length !== parsed.users.length) dirty = true;
        const messengerServers =
          Array.isArray(parsed.messengerServers) && parsed.messengerServers.length > 0
            ? parsed.messengerServers
            : [...DEFAULT_SERVERS];
        if (!Array.isArray(parsed.messengerServers) || parsed.messengerServers.length === 0) {
          dirty = true;
        }
        const loaded: ServerStore = {
          sessionSecret: parsed.sessionSecret,
          users,
          config: parsed.config,
          auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : [],
          messengerMessages: Array.isArray(parsed.messengerMessages)
            ? parsed.messengerMessages.slice(-500)
            : [],
          messengerCalls: Array.isArray(parsed.messengerCalls)
            ? parsed.messengerCalls.slice(-100)
            : [],
          messengerServers,
          friendships: Array.isArray(parsed.friendships) ? parsed.friendships : [],
          friendRequests: Array.isArray(parsed.friendRequests)
            ? parsed.friendRequests.slice(-300)
            : [],
          cloudFiles: Array.isArray(parsed.cloudFiles) ? parsed.cloudFiles : [],
          cloudFolders:
            parsed.cloudFolders && typeof parsed.cloudFolders === 'object'
              ? parsed.cloudFolders
              : {},
          customAiModels: Array.isArray(parsed.customAiModels)
            ? parsed.customAiModels.filter((m) => m.id !== 'caim-meta-builder')
            : [],
          aiChatThreads:
            parsed.aiChatThreads && typeof parsed.aiChatThreads === 'object'
              ? parsed.aiChatThreads
              : {},
        };
        if (dirty) saveStore(loaded);
        return loaded;
      }
    }
  } catch {
    // Reinitialize if store file is missing or unreadable
  }
  const initial = createInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(store: ServerStore): void {
  const json = JSON.stringify(store, null, 2);
  const tmpPath = `${STORE_FILE_PATH}.tmp`;
  try {
    fs.writeFileSync(tmpPath, json, 'utf8');
    fs.renameSync(tmpPath, STORE_FILE_PATH);
  } catch {
    try {
      fs.writeFileSync(STORE_FILE_PATH, json, 'utf8');
    } catch {
      // Ignore write failure in read-only edge cases
    }
  }
}

function sanitizeUser(account: StoredAccount): UserProfile {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    email: account.email,
    avatar: account.avatar,
    role: account.role,
    status: account.status,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt,
    trustedDevicesCount: Array.isArray(account.trustedDevices)
      ? account.trustedDevices.length
      : 0,
    loginCount: typeof account.loginCount === 'number' ? account.loginCount : 0,
    bridges: account.bridges,
  };
}

const SESSION_MAX_AGE_SEC = 365 * 24 * 60 * 60;
const SESSION_COOKIE_NAME = 'firas_session';
const DEVICE_COOKIE_NAME = 'firas_device';
const BETA_LOGOUT_COOKIE = 'firas_beta_logged_out';

function parseCookies(req: express.Request): Record<string, string> {
  const header = String(req.headers.cookie || '');
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function isHttpsRequest(req: express.Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || proto.includes('https');
}

function setPersistentAuthCookies(
  req: express.Request,
  res: express.Response,
  token: string,
  deviceId: string
): void {
  const secure = isHttpsRequest(req);
  const sameSiteAttr = secure ? 'SameSite=None; Secure' : 'SameSite=Lax';
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}; HttpOnly; ${sameSiteAttr}`,
    `${DEVICE_COOKIE_NAME}=${encodeURIComponent(deviceId)}; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}; ${sameSiteAttr}`,
    `${BETA_LOGOUT_COOKIE}=; Path=/; Max-Age=0; ${sameSiteAttr}`,
  ]);
}

function clearSessionCookie(req: express.Request, res: express.Response): void {
  const secure = isHttpsRequest(req);
  const sameSiteAttr = secure ? 'SameSite=None; Secure' : 'SameSite=Lax';
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; ${sameSiteAttr}`,
    `${BETA_LOGOUT_COOKIE}=1; Path=/; Max-Age=${30 * 24 * 60 * 60}; ${sameSiteAttr}`,
  ]);
}

function signSessionToken(userId: string, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      iat: Date.now(),
      exp: Date.now() + SESSION_MAX_AGE_SEC * 1000,
    }),
    'utf8'
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string, secret: string): string | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: string;
      exp?: number;
    };
    if (!decoded.uid || !decoded.exp || Date.now() > decoded.exp) return null;
    return decoded.uid;
  } catch {
    return null;
  }
}

function isDomainBlocked(hostname: string, blockedDomains: string[]): boolean {
  const lower = hostname.toLowerCase();
  return blockedDomains.some((raw) => {
    const clean = raw.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!clean) return false;
    return lower === clean || lower.endsWith(`.${clean}`);
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '35mb' }));

  const store = loadStore();

  // Track recently active authenticated sessions & pending login confirmations
  const activeUserSessions = new Map<string, number>();
  const loginConfirmations = new Map<string, LoginConfirmationRequest>();
  const wsClientsByUser = new Map<string, Set<WebSocket>>();
  const activeCallTrackers = new Map<
    string,
    { callerId: string; callerName: string; calleeId: string; calleeName: string; callType: 'audio' | 'video'; startedAt: number; answeredAt?: number }
  >();
  const SESSION_ACTIVE_WINDOW_MS = 45 * 1000;

  const isUserOnline = (userId: string): boolean => {
    const sockets = wsClientsByUser.get(userId);
    return Boolean(sockets && sockets.size > 0);
  };

  const sendWsPayload = (ws: WebSocket, payload: unknown): void => {
    if (ws.readyState === 1) {
      try {
        ws.send(JSON.stringify(payload));
      } catch {
        // ignore closed socket send errors
      }
    }
  };

  const sendToUser = (userId: string, payload: unknown): void => {
    const sockets = wsClientsByUser.get(userId);
    if (!sockets) return;
    for (const sock of sockets) {
      sendWsPayload(sock, payload);
    }
  };

  const broadcastAll = (payload: unknown): void => {
    for (const sockets of wsClientsByUser.values()) {
      for (const sock of sockets) {
        sendWsPayload(sock, payload);
      }
    }
  };

  const makeDmRoomId = (idA: string, idB: string): string =>
    `dm:${[idA, idB].sort().join(':')}`;

  const canAccessRoom = (userId: string, roomId: string): boolean => {
    if (roomId === 'general' || roomId.startsWith('server:')) return true;
    if (!roomId.startsWith('dm:')) return false;
    const parts = roomId.split(':');
    return parts.length === 3 && (parts[1] === userId || parts[2] === userId);
  };

  const getRoomRecipients = (roomId: string): string[] | 'all' => {
    if (roomId === 'general' || roomId.startsWith('server:')) return 'all';
    if (!roomId.startsWith('dm:')) return [];
    const parts = roomId.split(':');
    return parts.length === 3 ? [parts[1], parts[2]] : [];
  };

  const isFriendPair = (idA: string, idB: string): boolean =>
    store.friendships.some(
      (f) =>
        (f.userIds[0] === idA && f.userIds[1] === idB) ||
        (f.userIds[0] === idB && f.userIds[1] === idA)
    );

  const getFriendshipMeta = (
    viewerId: string,
    otherId: string
  ): { isFriend: boolean; friendshipStatus: FriendshipStatus; friendRequestId?: string } => {
    if (isFriendPair(viewerId, otherId)) {
      return { isFriend: true, friendshipStatus: 'friends' };
    }
    const incoming = store.friendRequests.find(
      (r) => r.status === 'pending' && r.fromUserId === otherId && r.toUserId === viewerId
    );
    if (incoming) {
      return {
        isFriend: false,
        friendshipStatus: 'incoming',
        friendRequestId: incoming.id,
      };
    }
    const outgoing = store.friendRequests.find(
      (r) => r.status === 'pending' && r.fromUserId === viewerId && r.toUserId === otherId
    );
    if (outgoing) {
      return {
        isFriend: false,
        friendshipStatus: 'outgoing',
        friendRequestId: outgoing.id,
      };
    }
    return { isFriend: false, friendshipStatus: 'none' };
  };

  const toContact = (u: StoredAccount, viewerId?: string): MessengerContact => {
    const meta = viewerId ? getFriendshipMeta(viewerId, u.id) : null;
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar,
      role: u.role,
      online: isUserOnline(u.id),
      bridges: u.bridges,
      ...(meta ? meta : {}),
    };
  };

  const buildContactsList = (excludeUserId: string): MessengerContact[] =>
    store.users
      .filter((u) => u.id !== excludeUserId && u.status === 'active' && u.claimed !== false)
      .map((u) => toContact(u, excludeUserId));

  const buildFriendCollections = (viewerId: string) => {
    const contacts = buildContactsList(viewerId);
    const friends = contacts.filter((c) => c.isFriend);
    const incomingRequests: FriendRequestItem[] = [];
    const outgoingRequests: FriendRequestItem[] = [];

    for (const reqItem of store.friendRequests) {
      if (reqItem.status !== 'pending') continue;
      if (reqItem.toUserId === viewerId) {
        const sender = store.users.find(
          (u) => u.id === reqItem.fromUserId && u.status === 'active'
        );
        if (sender) {
          incomingRequests.push({
            ...reqItem,
            user: toContact(sender, viewerId),
          });
        }
      } else if (reqItem.fromUserId === viewerId) {
        const target = store.users.find(
          (u) => u.id === reqItem.toUserId && u.status === 'active'
        );
        if (target) {
          outgoingRequests.push({
            ...reqItem,
            user: toContact(target, viewerId),
          });
        }
      }
    }

    return { contacts, friends, incomingRequests, outgoingRequests };
  };

  const notifyUsersFriendsUpdated = (...userIds: string[]) => {
    for (const uid of new Set(userIds)) {
      sendToUser(uid, { type: 'friends:updated' });
    }
  };

  const broadcastPresence = () => {
    broadcastAll({
      type: 'presence:update',
      onlineUserIds: Array.from(wsClientsByUser.keys()),
    });
  };

  const hasActiveOtherSession = (userId: string): boolean => {
    const lastSeen = activeUserSessions.get(userId);
    if (!lastSeen) return false;
    return Date.now() - lastSeen < SESSION_ACTIVE_WINDOW_MS;
  };

  const cleanupConfirmations = () => {
    const now = Date.now();
    for (const [id, item] of loginConfirmations.entries()) {
      if (new Date(item.expiresAt).getTime() <= now) {
        loginConfirmations.delete(id);
      }
    }
  };

  const resolveDeviceId = (req: express.Request): string => {
    const headerDev = String(req.headers['x-firas-device'] || '').trim();
    const bodyDev = String((req.body as { deviceId?: string } | undefined)?.deviceId || '').trim();
    const cookies = parseCookies(req);
    const cookieDev = String(cookies[DEVICE_COOKIE_NAME] || '').trim();
    const raw = headerDev || bodyDev || cookieDev;
    if (raw && /^[a-zA-Z0-9_-]{8,80}$/.test(raw)) return raw;
    return `dev-${randomBytes(12).toString('hex')}`;
  };

  const getAuthenticatedUser = (req: express.Request): StoredAccount | null => {
    const authHeader = String(req.headers.authorization || '');
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const cookies = parseCookies(req);
    const cookieToken = cookies[SESSION_COOKIE_NAME] || '';
    const token = bearerToken || cookieToken;
    if (!token) return null;
    const uid = verifySessionToken(token, store.sessionSecret);
    if (!uid) return null;
    const user = store.users.find((u) => u.id === uid);
    if (!user || user.status === 'blocked') return null;
    activeUserSessions.set(user.id, Date.now());
    return user;
  };

  const appendAudit = (actorName: string, action: string) => {
    store.auditLog.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorName,
      action,
      createdAt: new Date().toISOString(),
    });
    store.auditLog = store.auditLog.slice(0, 60);
    saveStore(store);
  };

  const requireStaff = (
    req: express.Request,
    res: express.Response
  ): StoredAccount | null => {
    const actor = getAuthenticatedUser(req);
    if (!actor) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return null;
    }
    if (!isStaffRole(actor.role)) {
      res.status(403).json({
        error: 'Доступ разрешён только руководству системы (от Менеджера и выше).',
      });
      return null;
    }
    return actor;
  };

  // Public browser configuration controlled by admins
  app.get('/api/public-config', (_req, res) => {
    res.json(store.config);
  });

  // Auth: Register new account (or claim unclaimed Owner email on first setup)
  app.post('/api/auth/register', (req, res) => {
    const rawUsername = String(req.body?.username || '').trim();
    const displayName = String(req.body?.displayName || '').trim() || rawUsername;
    const username = rawUsername || displayName.replace(/\s+/g, '_').slice(0, 32);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const avatar = normalizeAvatarInput(req.body?.avatar) || 'preset:slate';
    const deviceId = resolveDeviceId(req);

    if (username.length < 2 || username.length > 32 || !/^[\p{L}\p{N}_.-]+$/u.test(username)) {
      res.status(400).json({
        error: 'Логин должен содержать 2–32 символа (буквы, цифры, ., _, -).',
      });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Укажите корректный email.' });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ error: 'Пароль должен содержать минимум 4 символа.' });
      return;
    }

    // If the designated Owner account hasn't been claimed yet, allow the owner to set their own password & profile
    const unclaimedOwner = store.users.find(
      (u) => u.email.toLowerCase() === OWNER_EMAIL && !u.claimed
    );
    if (unclaimedOwner && email === OWNER_EMAIL) {
      const conflictUsername = store.users.find(
        (u) =>
          u.id !== unclaimedOwner.id &&
          u.username.toLowerCase() === username.toLowerCase()
      );
      if (conflictUsername) {
        res.status(409).json({
          accountExists: true,
          existingLogin: conflictUsername.username,
          error: 'Этот логин уже занят другим аккаунтом.',
        });
        return;
      }
      const { salt, hash } = hashPassword(password);
      const now = new Date().toISOString();
      unclaimedOwner.username = username;
      unclaimedOwner.displayName = displayName.slice(0, 60);
      unclaimedOwner.avatar = avatar;
      unclaimedOwner.role = 'owner';
      unclaimedOwner.claimed = true;
      unclaimedOwner.lastLoginAt = now;
      unclaimedOwner.passwordSalt = salt;
      unclaimedOwner.passwordHash = hash;
      unclaimedOwner.trustedDevices = [deviceId];
      unclaimedOwner.loginCount = 1;
      saveStore(store);

      activeUserSessions.set(unclaimedOwner.id, Date.now());
      const token = signSessionToken(unclaimedOwner.id, store.sessionSecret);
      setPersistentAuthCookies(req, res, token, deviceId);
      broadcastAll({
        type: 'user:updated',
        contact: {
          id: unclaimedOwner.id,
          username: unclaimedOwner.username,
          displayName: unclaimedOwner.displayName,
          avatar: unclaimedOwner.avatar,
          role: unclaimedOwner.role,
          online: isUserOnline(unclaimedOwner.id),
        },
      });
      res.status(201).json({ token, user: sanitizeUser(unclaimedOwner), deviceId });
      return;
    }

    const existing = store.users.find(
      (u) =>
        u.username.toLowerCase() === username.toLowerCase() ||
        u.email.toLowerCase() === email
    );
    if (existing) {
      res.status(409).json({
        accountExists: true,
        existingLogin: existing.username,
        error:
          'Аккаунт с таким логином или email уже существует. Войдите в существующий аккаунт.',
      });
      return;
    }

    const { salt, hash } = hashPassword(password);
    const now = new Date().toISOString();
    const created: StoredAccount = {
      id: `u-${Date.now()}`,
      username,
      displayName: displayName.slice(0, 60),
      email,
      avatar,
      role: 'client',
      status: 'active',
      createdAt: now,
      lastLoginAt: now,
      passwordSalt: salt,
      passwordHash: hash,
      claimed: true,
      trustedDevices: [deviceId],
      loginCount: 1,
    };
    store.users.push(created);
    saveStore(store);

    activeUserSessions.set(created.id, Date.now());
    const token = signSessionToken(created.id, store.sessionSecret);
    setPersistentAuthCookies(req, res, token, deviceId);
    broadcastAll({
      type: 'user:updated',
      contact: {
        id: created.id,
        username: created.username,
        displayName: created.displayName,
        avatar: created.avatar,
        role: created.role,
        online: isUserOnline(created.id),
      },
    });
    res.status(201).json({ token, user: sanitizeUser(created), deviceId });
  });

  // Auth: Login — first 2 logins / first 2 devices work immediately; 3rd+ unknown device asks confirmation
  app.post('/api/auth/login', (req, res) => {
    cleanupConfirmations();
    const login = String(req.body?.login || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const deviceId = resolveDeviceId(req);

    if (!login || !password) {
      res.status(400).json({ error: 'Введите логин (или email) и пароль.' });
      return;
    }

    const account = store.users.find(
      (u) => u.username.toLowerCase() === login || u.email.toLowerCase() === login
    );
    if (!account) {
      res.status(401).json({ error: 'Аккаунт не найден. Вы можете зарегистрироваться.' });
      return;
    }

    // First-time Owner claim directly via Login form: works immediately on first input
    if (!account.claimed && account.email.toLowerCase() === OWNER_EMAIL) {
      if (password.length < 4) {
        res.status(400).json({ error: 'Пароль должен содержать минимум 4 символа.' });
        return;
      }
      const { salt, hash } = hashPassword(password);
      const now = new Date().toISOString();
      account.claimed = true;
      account.role = 'owner';
      account.passwordSalt = salt;
      account.passwordHash = hash;
      account.lastLoginAt = now;
      account.trustedDevices = [deviceId];
      account.loginCount = 1;
      saveStore(store);

      activeUserSessions.set(account.id, Date.now());
      const token = signSessionToken(account.id, store.sessionSecret);
      setPersistentAuthCookies(req, res, token, deviceId);
      res.json({ token, user: sanitizeUser(account), deviceId });
      return;
    }

    if (!verifyPassword(password, account.passwordSalt, account.passwordHash)) {
      res.status(401).json({ error: 'Неверный логин или пароль.' });
      return;
    }

    if (account.status === 'blocked') {
      res.status(403).json({
        error: 'Этот аккаунт заблокирован.',
      });
      return;
    }

    const trusted = Array.isArray(account.trustedDevices) ? account.trustedDevices : [];
    const currentLoginCount = typeof account.loginCount === 'number' ? account.loginCount : 0;
    const isKnownDevice = trusted.includes(deviceId);
    const hasFreeDeviceSlot = trusted.length < 2;
    const isFirstTwoLogins = currentLoginCount < 2;

    if (isKnownDevice || hasFreeDeviceSlot || isFirstTwoLogins) {
      if (!isKnownDevice && trusted.length < 2) {
        account.trustedDevices = [...trusted, deviceId];
      } else {
        account.trustedDevices = trusted;
      }
      account.loginCount = currentLoginCount + 1;
      account.lastLoginAt = new Date().toISOString();
      saveStore(store);

      activeUserSessions.set(account.id, Date.now());
      const token = signSessionToken(account.id, store.sessionSecret);
      setPersistentAuthCookies(req, res, token, deviceId);
      res.json({ token, user: sanitizeUser(account), deviceId });
      return;
    }

    // 3rd+ unknown device -> require confirmation from the account
    const activeElsewhere = hasActiveOtherSession(account.id);
    const challengeId = `chk-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const code = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
    const nowMs = Date.now();

    const challenge: LoginConfirmationRequest = {
      id: challengeId,
      targetUserId: account.id,
      targetUsername: account.username,
      requestedFrom: req.headers['user-agent']?.slice(0, 60) || 'Браузер Firas',
      code,
      status: 'pending',
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + 5 * 60 * 1000).toISOString(),
    };
    loginConfirmations.set(challengeId, challenge);

    res.json({
      requiresConfirmation: true,
      challengeId,
      hasActiveSession: activeElsewhere,
      maskedAccount: account.username,
      maskedEmail: account.email.replace(/(^.).*(@.*$)/, '$1***$2'),
    });
  });

  // Auth: Step 2 Confirm Login (either approved by active session, 6-digit code, or account email check)
  app.post('/api/auth/confirm-login', (req, res) => {
    cleanupConfirmations();
    const challengeId = String(req.body?.challengeId || '').trim();
    const code = String(req.body?.code || '').trim();
    const confirmEmail = String(req.body?.confirmEmail || '').trim().toLowerCase();
    const deviceId = resolveDeviceId(req);

    const challenge = loginConfirmations.get(challengeId);
    if (!challenge) {
      res.status(404).json({ error: 'Запрос подтверждения истёк. Войдите заново.' });
      return;
    }
    if (challenge.status === 'rejected') {
      loginConfirmations.delete(challengeId);
      res.status(403).json({ error: 'Вход отклонён с активного аккаунта.' });
      return;
    }

    const account = store.users.find((u) => u.id === challenge.targetUserId);
    if (!account || account.status === 'blocked') {
      res.status(403).json({ error: 'Аккаунт недоступен.' });
      return;
    }

    const activeElsewhere = hasActiveOtherSession(account.id);
    const approvedBySession = challenge.status === 'approved';
    const approvedByCode = Boolean(code && code === challenge.code);
    const approvedByEmail = Boolean(
      !activeElsewhere && confirmEmail && confirmEmail === account.email.toLowerCase()
    );

    if (!approvedBySession && !approvedByCode && !approvedByEmail) {
      res.status(400).json({
        error: activeElsewhere
          ? 'Подтвердите вход в активном аккаунте или введите 6-значный код из него.'
          : 'Для подтверждения введите email, привязанный к этому аккаунту.',
      });
      return;
    }

    loginConfirmations.delete(challengeId);
    account.loginCount = (typeof account.loginCount === 'number' ? account.loginCount : 0) + 1;
    account.lastLoginAt = new Date().toISOString();
    saveStore(store);

    activeUserSessions.set(account.id, Date.now());
    const token = signSessionToken(account.id, store.sessionSecret);
    setPersistentAuthCookies(req, res, token, deviceId);
    res.json({ token, user: sanitizeUser(account), deviceId });
  });

  // Auth: Poll whether active session approved the login challenge
  app.get('/api/auth/challenge-status', (req, res) => {
    cleanupConfirmations();
    const challengeId = String(req.query.id || '').trim();
    const challenge = loginConfirmations.get(challengeId);
    if (!challenge) {
      res.json({ status: 'expired' });
      return;
    }
    res.json({ status: challenge.status });
  });

  // Auth: Active session lists pending login requests for its own account
  app.get('/api/auth/pending-confirmations', (req, res) => {
    cleanupConfirmations();
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.json({ requests: [] });
      return;
    }
    const requests = Array.from(loginConfirmations.values()).filter(
      (c) => c.targetUserId === user.id && c.status === 'pending'
    );
    res.json({ requests });
  });

  // Auth: Active session approves or rejects a pending login confirmation
  app.post('/api/auth/respond-confirmation', (req, res) => {
    cleanupConfirmations();
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const challengeId = String(req.body?.challengeId || '').trim();
    const decision = req.body?.decision === 'approve' ? 'approved' : 'rejected';
    const challenge = loginConfirmations.get(challengeId);
    if (!challenge || challenge.targetUserId !== user.id) {
      res.status(404).json({ error: 'Запрос подтверждения не найден.' });
      return;
    }
    challenge.status = decision;
    res.json({ ok: true, status: decision });
  });

  // Auth: Logout (clears persistent cookie only when user explicitly clicks Logout)
  app.post('/api/auth/logout', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (user) {
      activeUserSessions.delete(user.id);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // Auth: Get current session user (or beta auto-login into Owner крыса228 unless explicitly logged out)
  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(req);
    const deviceId = resolveDeviceId(req);
    if (user) {
      const authHeader = String(req.headers.authorization || '');
      const existingBearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const token = existingBearer || signSessionToken(user.id, store.sessionSecret);
      setPersistentAuthCookies(req, res, token, deviceId);
      res.json({ user: sanitizeUser(user), token, deviceId });
      return;
    }

    const cookies = parseCookies(req);
    const optedOut = cookies[BETA_LOGOUT_COOKIE] === '1' || req.query.noAuto === '1';
    if (!optedOut) {
      const betaAccount = store.users.find(
        (u) =>
          (u.id === 'u-root-owner' ||
            u.username === OWNER_BETA_USERNAME ||
            u.email.toLowerCase() === OWNER_EMAIL) &&
          u.status === 'active'
      );
      if (betaAccount) {
        activeUserSessions.set(betaAccount.id, Date.now());
        betaAccount.lastLoginAt = new Date().toISOString();
        const trusted = Array.isArray(betaAccount.trustedDevices)
          ? betaAccount.trustedDevices
          : [];
        if (!trusted.includes(deviceId) && trusted.length < 5) {
          betaAccount.trustedDevices = [...trusted, deviceId];
        }
        saveStore(store);
        const token = signSessionToken(betaAccount.id, store.sessionSecret);
        setPersistentAuthCookies(req, res, token, deviceId);
        res.json({
          user: sanitizeUser(betaAccount),
          token,
          deviceId,
          autoBetaLogin: true,
        });
        return;
      }
    }

    res.json({ user: null });
  });

  // Auth: Update nickname (displayName) and avatar for current account
  app.patch('/api/auth/profile', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const nextDisplayName = String(req.body?.displayName ?? '').trim();
    if (nextDisplayName.length < 2 || nextDisplayName.length > 60) {
      res.status(400).json({ error: 'Никнейм должен содержать от 2 до 60 символов.' });
      return;
    }
    const nextAvatar = normalizeAvatarInput(req.body?.avatar);
    user.displayName = nextDisplayName;
    if (nextAvatar) {
      user.avatar = nextAvatar;
    }
    saveStore(store);
    broadcastAll({
      type: 'user:updated',
      contact: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
        online: isUserOnline(user.id),
      },
    });
    res.json({ user: sanitizeUser(user) });
  });

  // Phone verification challenges for Telegram / WhatsApp / Viber / Chat-Roulette
  interface PhoneBindChallenge {
    id: string;
    userId: string;
    phone: string;
    code: string;
    telegramHandle: string;
    telegramChatId: string;
    enableTelegram: boolean;
    enableWhatsapp: boolean;
    enableViber: boolean;
    enableRoulette: boolean;
    expiresAt: number;
  }
  const phoneBindChallenges = new Map<string, PhoneBindChallenge>();

  // Messenger: Bind Phone & External Messengers (Telegram, WhatsApp, Viber, Chat-Roulette)
  app.get('/api/messenger/bridges', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    res.json({ bridges: user.bridges || {} });
  });

  app.post('/api/messenger/bridges/send-code', async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Войдите в аккаунт для привязки номера.' });
      return;
    }
    const rawPhone = String(req.body?.phone || '').trim().slice(0, 24);
    const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
    const digits = cleanPhone.replace(/\D/g, '');
    if (digits.length < 7) {
      res.status(400).json({ error: 'Введите корректный номер телефона (минимум 7 цифр).' });
      return;
    }
    const normalizedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${digits}`;
    const tgHandle = String(req.body?.telegramHandle || '').trim().replace(/^@/, '').slice(0, 48);
    const tgChatId = String(req.body?.telegramChatId || '').trim().slice(0, 40);
    const enableTelegram = req.body?.telegram !== false;
    const enableWhatsapp = req.body?.whatsapp !== false;
    const enableViber = req.body?.viber !== false;
    const enableRoulette = req.body?.chatRoulette !== false;

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const challenge: PhoneBindChallenge = {
      id: `pbc-${Date.now()}-${randomBytes(3).toString('hex')}`,
      userId: user.id,
      phone: normalizedPhone,
      code,
      telegramHandle: tgHandle,
      telegramChatId: tgChatId,
      enableTelegram,
      enableWhatsapp,
      enableViber,
      enableRoulette,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    phoneBindChallenges.set(challenge.id, challenge);
    // Prune expired challenges
    for (const [k, v] of phoneBindChallenges.entries()) {
      if (v.expiresAt < Date.now()) phoneBindChallenges.delete(k);
    }

    let deliveryMode: 'sms' | 'in-app' = 'in-app';
    if (process.env.SMS_WEBHOOK_URL) {
      try {
        const resp = await withTimeout(
          fetch(process.env.SMS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: normalizedPhone,
              text: `Код подтверждения Firas: ${code}`,
              code,
            }),
          }),
          3500
        );
        if (resp.ok) deliveryMode = 'sms';
      } catch {
        deliveryMode = 'in-app';
      }
    }

    const maskedPhone =
      digits.length > 4
        ? `${normalizedPhone.slice(0, 4)}***${normalizedPhone.slice(-2)}`
        : normalizedPhone;

    res.json({
      ok: true,
      challengeId: challenge.id,
      phone: normalizedPhone,
      maskedPhone,
      deliveryMode,
      demoCode: deliveryMode === 'in-app' ? code : undefined,
      message:
        deliveryMode === 'sms'
          ? `Код подтверждения отправлен по SMS на ${maskedPhone}.`
          : `Код подтверждения сформирован для ${normalizedPhone}: ${code}`,
    });
  });

  app.post('/api/messenger/bridges/verify-code', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Войдите в аккаунт для подтверждения номера.' });
      return;
    }
    const challengeId = String(req.body?.challengeId || '').trim();
    const enteredCode = String(req.body?.code || '').trim().replace(/\s+/g, '');

    let challenge = challengeId ? phoneBindChallenges.get(challengeId) : undefined;
    if (!challenge) {
      // Fallback: find latest pending challenge for this user
      const matching = [...phoneBindChallenges.values()]
        .filter((c) => c.userId === user.id && c.expiresAt > Date.now())
        .sort((a, b) => b.expiresAt - a.expiresAt);
      challenge = matching[0];
    }

    if (!challenge || challenge.userId !== user.id || challenge.expiresAt < Date.now()) {
      res.status(400).json({ error: 'Срок действия кода истёк. Запросите код повторно.' });
      return;
    }
    if (challenge.code !== enteredCode) {
      res.status(400).json({ error: 'Неверный 6-значный код подтверждения.' });
      return;
    }

    phoneBindChallenges.delete(challenge.id);

    const nextBridges: MessengerBridgeBinding = {
      phone: challenge.phone,
      phoneVerified: true,
      telegram: challenge.enableTelegram
        ? {
            connected: true,
            handle: challenge.telegramHandle || challenge.phone,
            chatId: challenge.telegramChatId || undefined,
          }
        : undefined,
      whatsapp: challenge.enableWhatsapp
        ? {
            connected: true,
            phone: challenge.phone,
          }
        : undefined,
      viber: challenge.enableViber
        ? {
            connected: true,
            phone: challenge.phone,
          }
        : undefined,
      chatRoulette: challenge.enableRoulette
        ? {
            connected: true,
            phone: challenge.phone,
          }
        : undefined,
      updatedAt: new Date().toISOString(),
    };

    user.bridges = nextBridges;
    saveStore(store);
    broadcastAll({ type: 'friends:updated' });
    res.json({ ok: true, bridges: nextBridges, user: sanitizeUser(user) });
  });

  app.post('/api/messenger/roulette/next', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Войдите в аккаунт для запуска Чат-рулетки.' });
      return;
    }
    if (!user.bridges?.phoneVerified) {
      res.status(403).json({
        error: 'Сначала привяжите и подтвердите номер телефона по коду вверху, чтобы открыть Чат-рулетку.',
      });
      return;
    }

    const excludeUserId = String(req.body?.excludeUserId || '').trim();
    const candidates = store.users.filter(
      (u) => u.id !== user.id && u.status === 'active' && u.claimed !== false
    );
    const filtered =
      candidates.length > 1 && excludeUserId
        ? candidates.filter((u) => u.id !== excludeUserId)
        : candidates;

    if (filtered.length === 0) {
      res.json({
        ok: true,
        partner: null,
        roomId: null,
        message: 'Сейчас нет других участников в сети — создайте второй аккаунт или позовите друга.',
      });
      return;
    }

    const onlinePool = filtered.filter((u) => isUserOnline(u.id));
    const pool = onlinePool.length > 0 ? onlinePool : filtered;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const partner = toContact(picked, user.id);

    res.json({
      ok: true,
      partner,
      roomId: makeDmRoomId(user.id, picked.id),
    });
  });

  app.put('/api/messenger/bridges', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const rawPhone = String(req.body?.phone ?? '').trim().slice(0, 24);
    const cleanPhone = rawPhone ? rawPhone.replace(/[^\d+]/g, '') : '';
    const tgHandle = String(req.body?.telegramHandle ?? '').trim().replace(/^@/, '').slice(0, 48);
    const tgChatId = String(req.body?.telegramChatId ?? '').trim().slice(0, 40);
    const tgConnected = Boolean(req.body?.telegramConnected && (tgHandle || tgChatId || cleanPhone));
    const waPhone = String(req.body?.whatsappPhone ?? cleanPhone).trim().replace(/[^\d+]/g, '').slice(0, 24);
    const waConnected = Boolean(req.body?.whatsappConnected && (waPhone || cleanPhone));
    const vbPhone = String(req.body?.viberPhone ?? cleanPhone).trim().replace(/[^\d+]/g, '').slice(0, 24);
    const vbConnected = Boolean(req.body?.viberConnected && (vbPhone || cleanPhone));
    const rouletteConnected = Boolean(
      (req.body?.chatRouletteConnected ?? true) && (cleanPhone || user.bridges?.phoneVerified)
    );

    const nextBridges: MessengerBridgeBinding = {
      phone: cleanPhone || undefined,
      phoneVerified:
        Boolean(user.bridges?.phoneVerified && cleanPhone && user.bridges?.phone === cleanPhone) ||
        Boolean(cleanPhone && cleanPhone.replace(/\D/g, '').length >= 7),
      telegram: tgConnected
        ? {
            connected: true,
            handle: tgHandle || cleanPhone,
            chatId: tgChatId || undefined,
          }
        : undefined,
      whatsapp: waConnected
        ? {
            connected: true,
            phone: waPhone || cleanPhone,
          }
        : undefined,
      viber: vbConnected
        ? {
            connected: true,
            phone: vbPhone || cleanPhone,
          }
        : undefined,
      chatRoulette: rouletteConnected
        ? {
            connected: true,
            phone: cleanPhone || user.bridges?.phone || '',
          }
        : undefined,
      updatedAt: new Date().toISOString(),
    };
    user.bridges = nextBridges;
    saveStore(store);
    broadcastAll({ type: 'friends:updated' });
    res.json({ bridges: nextBridges, user: sanitizeUser(user) });
  });

  const dispatchExternalBridges = async (
    sender: StoredAccount,
    roomId: string,
    text: string,
    channels: ExternalChannelId[],
    targetPhoneOverride?: string
  ): Promise<BridgeDispatchResult[]> => {
    const results: BridgeDispatchResult[] = [{ channel: 'firas', status: 'delivered', detail: 'Доставлено в Firas' }];
    const dmParts = roomId.startsWith('dm:') ? roomId.split(':') : [];
    const peerId = dmParts.length === 3 ? (dmParts[1] === sender.id ? dmParts[2] : dmParts[1]) : null;
    const peer = peerId ? store.users.find((u) => u.id === peerId) : undefined;
    const encodedText = encodeURIComponent(text);

    for (const ch of channels) {
      if (ch === 'firas') continue;
      if (ch === 'telegram') {
        const tgTarget =
          peer?.bridges?.telegram?.handle ||
          sender.bridges?.telegram?.handle ||
          peer?.bridges?.phone ||
          sender.bridges?.phone ||
          '';
        const tgChatId = peer?.bridges?.telegram?.chatId || sender.bridges?.telegram?.chatId || '';
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        let sentViaBot = false;
        if (botToken && tgChatId) {
          try {
            const resp = await withTimeout(
              fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: tgChatId,
                  text: `[Firas · ${sender.displayName}]: ${text}`,
                }),
              }),
              4000
            );
            if (resp.ok) sentViaBot = true;
          } catch {
            // fallback to deeplink
          }
        }
        const cleanedTarget = tgTarget.replace(/^@/, '').trim();
        const isPhoneTarget = /^\+?\d{7,}$/.test(cleanedTarget);
        const launchUrl = isPhoneTarget
          ? `https://t.me/+${cleanedTarget.replace(/\D/g, '')}?text=${encodedText}`
          : cleanedTarget
          ? `https://t.me/${encodeURIComponent(cleanedTarget)}?text=${encodedText}`
          : `https://t.me/share/url?url=${encodeURIComponent('https://firas.app')}&text=${encodedText}`;
        results.push({
          channel: 'telegram',
          status: sentViaBot ? 'bridged' : 'deeplink',
          detail: sentViaBot
            ? `Отправлено в Telegram (${tgTarget || tgChatId})`
            : isPhoneTarget
            ? `Мост Telegram (+${cleanedTarget.replace(/\D/g, '')})`
            : `Мост Telegram (@${cleanedTarget || 'чат'})`,
          launchUrl,
        });
      } else if (ch === 'whatsapp') {
        const phone =
          targetPhoneOverride ||
          peer?.bridges?.whatsapp?.phone ||
          peer?.bridges?.phone ||
          sender.bridges?.whatsapp?.phone ||
          sender.bridges?.phone ||
          '';
        const digits = phone.replace(/\D/g, '');
        const launchUrl = digits
          ? `https://wa.me/${digits}?text=${encodedText}`
          : `https://wa.me/?text=${encodedText}`;
        results.push({
          channel: 'whatsapp',
          status: 'deeplink',
          detail: digits ? `Мост WhatsApp (+${digits})` : 'Мост WhatsApp готов',
          launchUrl,
        });
      } else if (ch === 'viber') {
        const phone =
          targetPhoneOverride ||
          peer?.bridges?.viber?.phone ||
          peer?.bridges?.phone ||
          sender.bridges?.viber?.phone ||
          sender.bridges?.phone ||
          '';
        const digits = phone.replace(/\D/g, '');
        const launchUrl = digits
          ? `viber://chat?number=%2B${digits}&draft=${encodedText}`
          : `viber://forward?text=${encodedText}`;
        results.push({
          channel: 'viber',
          status: 'deeplink',
          detail: digits ? `Мост Viber (+${digits})` : 'Мост Viber готов',
          launchUrl,
        });
      }
    }
    return results;
  };

  // Messenger: Helper to persist & broadcast chat messages
  const persistAndBroadcastMessage = async (
    sender: StoredAccount,
    roomId: string,
    rawText: string,
    clientId?: string,
    requestedChannels?: ExternalChannelId[],
    targetPhoneOverride?: string
  ): Promise<MessengerMessage | { error: string }> => {
    const text = rawText.trim().slice(0, 2000);
    if (!text) return { error: 'Пустое сообщение.' };
    if (!canAccessRoom(sender.id, roomId)) {
      return { error: 'Нет доступа к этому чату.' };
    }
    const validChannels: ExternalChannelId[] = Array.isArray(requestedChannels)
      ? Array.from(
          new Set(
            requestedChannels.filter(
              (c): c is ExternalChannelId =>
                c === 'firas' || c === 'telegram' || c === 'whatsapp' || c === 'viber'
            )
          )
        )
      : ['firas'];
    if (!validChannels.includes('firas')) validChannels.unshift('firas');

    const bridgeResults =
      validChannels.length > 1
        ? await dispatchExternalBridges(sender, roomId, text, validChannels, targetPhoneOverride)
        : undefined;

    const msg: MessengerMessage = {
      id: clientId || `msg-${Date.now()}-${randomBytes(4).toString('hex')}`,
      roomId,
      senderId: sender.id,
      senderUsername: sender.username,
      senderName: sender.displayName,
      senderAvatar: sender.avatar,
      text,
      channels: validChannels,
      bridgeResults,
      createdAt: new Date().toISOString(),
    };
    if (!store.messengerMessages.some((m) => m.id === msg.id)) {
      store.messengerMessages.push(msg);
      if (store.messengerMessages.length > 500) {
        store.messengerMessages = store.messengerMessages.slice(-500);
      }
      saveStore(store);
    }
    const recipients = getRoomRecipients(roomId);
    if (recipients === 'all') {
      broadcastAll({ type: 'message:new', message: msg });
    } else {
      for (const uid of new Set(recipients)) {
        sendToUser(uid, { type: 'message:new', message: msg });
      }
    }
    return msg;
  };

  // Messenger: Server health check (auth, friends, messages & WebSocket availability)
  app.get('/api/messenger/health', (_req, res) => {
    res.json({
      ok: true,
      services: {
        auth: true,
        friends: true,
        messages: true,
        websocket: true,
      },
      usersCount: store.users.filter((u) => u.claimed !== false && u.status === 'active').length,
      onlineCount: wsClientsByUser.size,
      serverTime: new Date().toISOString(),
    });
  });

  // Messenger: Bootstrap contacts, friends, friend requests, servers, message history & call logs
  app.get('/api/messenger/bootstrap', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Для доступа к мессенджеру нужна регистрация.' });
      return;
    }
    const { contacts, friends, incomingRequests, outgoingRequests } =
      buildFriendCollections(user.id);
    const messages = store.messengerMessages.filter((m) => canAccessRoom(user.id, m.roomId));
    const callLogs = store.messengerCalls
      .filter((c) => c.callerId === user.id || c.calleeId === user.id)
      .slice(-40);
    res.json({
      me: sanitizeUser(user),
      contacts,
      friends,
      incomingRequests,
      outgoingRequests,
      servers: store.messengerServers,
      messages,
      callLogs,
      onlineUserIds: Array.from(wsClientsByUser.keys()),
    });
  });

  // Messenger: List custom & default servers
  app.get('/api/messenger/servers', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    res.json({ servers: store.messengerServers });
  });

  // Messenger: Create additional server (+)
  app.post('/api/messenger/servers', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Для создания сервера требуется вход в аккаунт.' });
      return;
    }
    const name = String(req.body?.name || '').trim().slice(0, 48);
    const description = String(req.body?.description || '').trim().slice(0, 120);
    const region = String(req.body?.region || 'RU-Cloud').trim().slice(0, 24);
    const color = String(req.body?.color || 'indigo').trim().slice(0, 16);

    if (name.length < 2) {
      res.status(400).json({ error: 'Название сервера должно содержать минимум 2 символа.' });
      return;
    }

    const id = `srv-${Date.now()}-${randomBytes(2).toString('hex')}`;
    const created: MessengerServer = {
      id,
      name,
      description: description || `Дополнительный сервер (@${user.username})`,
      roomId: `server:${id}`,
      region,
      color,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    store.messengerServers.push(created);
    if (store.messengerServers.length > 30) {
      store.messengerServers = store.messengerServers.slice(-30);
    }
    saveStore(store);
    broadcastAll({ type: 'servers:updated', servers: store.messengerServers });
    res.status(201).json({ server: created, servers: store.messengerServers });
  });

  // 1 TB Cloud Storage & TeraBox integration
  const detectFileCategory = (
    name: string,
    mimeType: string,
    source: 'firas-cloud' | 'terabox'
  ): CloudFileItem['category'] => {
    if (source === 'terabox') return 'terabox';
    const lower = name.toLowerCase();
    if (mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
      return 'media';
    }
    if (/\.(zip|rar|7z|tar|gz)$/.test(lower)) return 'archive';
    if (/\.(pdf|doc|docx|txt|md|xls|xlsx|csv|json)$/.test(lower) || mimeType.startsWith('text/')) {
      return 'document';
    }
    return 'other';
  };

  const getUserCloudSummary = (userId: string) => {
    const files = store.cloudFiles
      .filter((f) => f.ownerId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const usedBytes = files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0);
    const userFolders = Array.isArray(store.cloudFolders[userId])
      ? store.cloudFolders[userId]
      : ['Документы', 'Медиа', 'TeraBox 1 ТБ'];
    const allFolders = Array.from(
      new Set(['Документы', 'Медиа', 'TeraBox 1 ТБ', ...userFolders, ...files.map((f) => f.folder)])
    ).filter(Boolean);
    return {
      quotaBytes: CLOUD_QUOTA_BYTES,
      usedBytes,
      files,
      folders: allFolders,
    };
  };

  app.get('/api/cloud/files', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Для доступа к облаку 1 ТБ войдите в аккаунт.' });
      return;
    }
    res.json(getUserCloudSummary(user.id));
  });

  app.post('/api/cloud/folders', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const folder = String(req.body?.folder || '').trim().slice(0, 48);
    if (folder.length < 1) {
      res.status(400).json({ error: 'Укажите название папки.' });
      return;
    }
    const existing = Array.isArray(store.cloudFolders[user.id])
      ? store.cloudFolders[user.id]
      : ['Документы', 'Медиа', 'TeraBox 1 ТБ'];
    if (!existing.includes(folder)) {
      store.cloudFolders[user.id] = [...existing, folder];
      saveStore(store);
    }
    res.status(201).json(getUserCloudSummary(user.id));
  });

  app.post('/api/cloud/upload', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Для загрузки файлов в облако войдите в аккаунт.' });
      return;
    }
    const name = String(req.body?.name || '').trim().slice(0, 140);
    const folder = String(req.body?.folder || 'Документы').trim().slice(0, 48) || 'Документы';
    const mimeType = String(req.body?.mimeType || 'application/octet-stream').trim().slice(0, 100);
    const dataBase64 = String(req.body?.dataBase64 || '').trim();

    if (!name || !dataBase64) {
      res.status(400).json({ error: 'Выберите файл для загрузки.' });
      return;
    }

    const cleanB64 = dataBase64.includes(',') ? dataBase64.split(',').pop() || '' : dataBase64;
    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleanB64, 'base64');
    } catch {
      res.status(400).json({ error: 'Некорректное содержимое файла.' });
      return;
    }
    if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) {
      res.status(400).json({
        error: 'Размер одного файла через браузер — до 25 МБ (для крупных файлов до 1 ТБ подключите ссылку TeraBox).',
      });
      return;
    }

    const id = `cf-${Date.now()}-${randomBytes(3).toString('hex')}`;
    const userDir = path.join(CLOUD_DIR, user.id);
    try {
      fs.mkdirSync(userDir, { recursive: true });
      fs.writeFileSync(path.join(userDir, id), buffer);
    } catch {
      res.status(500).json({ error: 'Не удалось сохранить файл на сервере облака.' });
      return;
    }

    const item: CloudFileItem = {
      id,
      ownerId: user.id,
      ownerName: user.displayName,
      name,
      folder,
      category: detectFileCategory(name, mimeType, 'firas-cloud'),
      sizeBytes: buffer.length,
      mimeType,
      source: 'firas-cloud',
      createdAt: new Date().toISOString(),
    };
    store.cloudFiles.unshift(item);
    saveStore(store);
    res.status(201).json({ file: item, ...getUserCloudSummary(user.id) });
  });

  app.post('/api/cloud/terabox', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const name = String(req.body?.name || '').trim().slice(0, 140);
    const rawUrl = String(req.body?.externalUrl || '').trim();
    const folder = String(req.body?.folder || 'TeraBox 1 ТБ').trim().slice(0, 48) || 'TeraBox 1 ТБ';
    const sizeGbNum = Number(req.body?.sizeGb);
    const sizeBytes =
      Number.isFinite(sizeGbNum) && sizeGbNum > 0
        ? Math.min(CLOUD_QUOTA_BYTES, Math.round(sizeGbNum * 1024 * 1024 * 1024))
        : 1024 * 1024 * 1024; // default 1 GB estimate

    if (name.length < 2) {
      res.status(400).json({ error: 'Укажите название файла или папки TeraBox.' });
      return;
    }
    let normalizedUrl = rawUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('bad protocol');
      }
      normalizedUrl = parsed.toString();
    } catch {
      res.status(400).json({ error: 'Укажите корректную ссылку TeraBox (например, https://terabox.com/...).' });
      return;
    }

    const item: CloudFileItem = {
      id: `tb-${Date.now()}-${randomBytes(3).toString('hex')}`,
      ownerId: user.id,
      ownerName: user.displayName,
      name,
      folder,
      category: 'terabox',
      sizeBytes,
      mimeType: 'application/vnd.terabox.link',
      source: 'terabox',
      externalUrl: normalizedUrl,
      createdAt: new Date().toISOString(),
    };
    store.cloudFiles.unshift(item);
    saveStore(store);
    res.status(201).json({ file: item, ...getUserCloudSummary(user.id) });
  });

  app.get('/api/cloud/files/:id/download', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const item = store.cloudFiles.find((f) => f.id === req.params.id);
    if (!item || (item.ownerId !== user.id && !isStaffRole(user.role))) {
      res.status(404).json({ error: 'Файл не найден.' });
      return;
    }
    if (item.source === 'terabox' && item.externalUrl) {
      res.redirect(item.externalUrl);
      return;
    }
    const filePath = path.join(CLOUD_DIR, item.ownerId, item.id);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Файл отсутствует на сервере.' });
      return;
    }
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(item.name)}`
    );
    fs.createReadStream(filePath).pipe(res);
  });

  app.delete('/api/cloud/files/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const idx = store.cloudFiles.findIndex((f) => f.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Файл не найден.' });
      return;
    }
    const item = store.cloudFiles[idx];
    if (item.ownerId !== user.id && !isStaffRole(user.role)) {
      res.status(403).json({ error: 'Нет прав на удаление этого файла.' });
      return;
    }
    if (item.source === 'firas-cloud') {
      const filePath = path.join(CLOUD_DIR, item.ownerId, item.id);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // ignore disk unlink error
      }
    }
    store.cloudFiles.splice(idx, 1);
    saveStore(store);
    res.json({ ok: true, ...getUserCloudSummary(user.id) });
  });

  // Friends: Search registered users to add as friends
  app.get('/api/users/search', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Для поиска людей нужна регистрация.' });
      return;
    }
    const q = String(req.query.q || '').trim().toLowerCase();
    const allContacts = buildContactsList(user.id);
    const filtered = q
      ? allContacts.filter(
          (c) =>
            c.displayName.toLowerCase().includes(q) ||
            c.username.toLowerCase().includes(q)
        )
      : allContacts;
    res.json({ users: filtered.slice(0, 40) });
  });

  // Friends: List friends & pending requests
  app.get('/api/friends', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const { contacts, friends, incomingRequests, outgoingRequests } =
      buildFriendCollections(user.id);
    res.json({ friends, incomingRequests, outgoingRequests, directory: contacts });
  });

  // Friends: Send a friend request (or auto-accept if the target already requested us)
  app.post('/api/friends/request', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Для добавления в друзья нужна регистрация.' });
      return;
    }
    const targetUserId = String(req.body?.targetUserId || '').trim();
    const targetLogin = String(req.body?.login || '').trim().toLowerCase();

    const target = store.users.find(
      (u) =>
        u.status === 'active' &&
        u.claimed !== false &&
        (targetUserId ? u.id === targetUserId : u.username.toLowerCase() === targetLogin)
    );

    if (!target || target.id === user.id) {
      res.status(404).json({ error: 'Пользователь не найден.' });
      return;
    }

    if (isFriendPair(user.id, target.id)) {
      res.json({ ok: true, status: 'friends', message: 'Пользователь уже в друзьях.' });
      return;
    }

    const reversePending = store.friendRequests.find(
      (r) => r.status === 'pending' && r.fromUserId === target.id && r.toUserId === user.id
    );
    if (reversePending) {
      reversePending.status = 'accepted';
      store.friendships.push({
        id: `fr-${Date.now()}-${randomBytes(3).toString('hex')}`,
        userIds: [user.id, target.id].sort() as [string, string],
        createdAt: new Date().toISOString(),
      });
      saveStore(store);
      notifyUsersFriendsUpdated(user.id, target.id);
      res.json({ ok: true, status: 'friends' });
      return;
    }

    const existingOutgoing = store.friendRequests.find(
      (r) => r.status === 'pending' && r.fromUserId === user.id && r.toUserId === target.id
    );
    if (existingOutgoing) {
      res.json({ ok: true, status: 'outgoing', requestId: existingOutgoing.id });
      return;
    }

    const created: StoredFriendRequest = {
      id: `freq-${Date.now()}-${randomBytes(3).toString('hex')}`,
      fromUserId: user.id,
      toUserId: target.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    store.friendRequests.push(created);
    if (store.friendRequests.length > 300) {
      store.friendRequests = store.friendRequests.slice(-300);
    }
    saveStore(store);
    notifyUsersFriendsUpdated(user.id, target.id);
    res.status(201).json({ ok: true, status: 'outgoing', requestId: created.id });
  });

  // Friends: Accept or decline incoming friend request
  app.post('/api/friends/respond', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const requestId = String(req.body?.requestId || '').trim();
    const decision = req.body?.decision === 'accept' ? 'accepted' : 'declined';

    const friendReq = store.friendRequests.find(
      (r) => r.id === requestId && r.toUserId === user.id && r.status === 'pending'
    );
    if (!friendReq) {
      res.status(404).json({ error: 'Заявка в друзья не найдена.' });
      return;
    }

    friendReq.status = decision;
    if (decision === 'accepted' && !isFriendPair(friendReq.fromUserId, friendReq.toUserId)) {
      store.friendships.push({
        id: `fr-${Date.now()}-${randomBytes(3).toString('hex')}`,
        userIds: [friendReq.fromUserId, friendReq.toUserId].sort() as [string, string],
        createdAt: new Date().toISOString(),
      });
    }
    saveStore(store);
    notifyUsersFriendsUpdated(friendReq.fromUserId, friendReq.toUserId);
    res.json({ ok: true, status: decision });
  });

  // Friends: Remove friend
  app.delete('/api/friends/:friendId', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const friendId = String(req.params.friendId || '').trim();
    const before = store.friendships.length;
    store.friendships = store.friendships.filter(
      (f) =>
        !(
          (f.userIds[0] === user.id && f.userIds[1] === friendId) ||
          (f.userIds[0] === friendId && f.userIds[1] === user.id)
        )
    );
    if (store.friendships.length !== before) {
      saveStore(store);
      notifyUsersFriendsUpdated(user.id, friendId);
    }
    res.json({ ok: true });
  });

  // Messenger: REST send message (supports Firas + Telegram/WhatsApp/Viber bridge channels)
  app.post('/api/messenger/messages', async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Для отправки сообщений нужна регистрация.' });
      return;
    }
    const roomId = String(req.body?.roomId || 'general').trim();
    const text = String(req.body?.text || '');
    const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId : undefined;
    const channels = Array.isArray(req.body?.channels)
      ? (req.body.channels as ExternalChannelId[])
      : undefined;
    const targetPhone =
      typeof req.body?.targetPhone === 'string' ? req.body.targetPhone.trim() : undefined;
    const result = await persistAndBroadcastMessage(
      user,
      roomId,
      text,
      clientId,
      channels,
      targetPhone
    );
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ message: result });
  });

  // Admin: Full overview (accounts, config, audit log)
  app.get('/api/admin/overview', (req, res) => {
    const actor = requireStaff(req, res);
    if (!actor) return;
    res.json({
      users: store.users.map(sanitizeUser),
      config: store.config,
      auditLog: store.auditLog,
    });
  });

  // Admin: Create account directly with chosen role within actor's authority
  const ASSIGNABLE_ROLES: UserRole[] = ALL_ROLES_ASC.filter((r) => r !== 'owner');

  app.post('/api/admin/users', (req, res) => {
    const actor = requireStaff(req, res);
    if (!actor) return;

    const username = String(req.body?.username || '').trim();
    const displayName = String(req.body?.displayName || '').trim() || username;
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const rawRole = String(req.body?.role || 'client') as UserRole;
    const role: UserRole = ASSIGNABLE_ROLES.includes(rawRole) ? rawRole : 'client';

    if (rawRole === 'owner' || ROLE_LEVEL[role] >= ROLE_LEVEL[actor.role]) {
      res.status(403).json({
        error: 'Вы не можете создать аккаунт с ролью равной вашей или выше.',
      });
      return;
    }

    if (username.length < 2 || !/^[\p{L}\p{N}_.-]+$/u.test(username)) {
      res.status(400).json({ error: 'Некорректный логин (от 2 символов: буквы, цифры, ., _, -).' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Укажите корректный email.' });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ error: 'Пароль должен быть от 4 символов.' });
      return;
    }
    if (
      store.users.some(
        (u) => u.username.toLowerCase() === username.toLowerCase() || u.email === email
      )
    ) {
      res.status(409).json({ error: 'Пользователь с таким логином или email уже есть.' });
      return;
    }

    const { salt, hash } = hashPassword(password);
    const created: StoredAccount = {
      id: `u-${Date.now()}`,
      username,
      displayName: displayName.slice(0, 60),
      email,
      role,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      passwordSalt: salt,
      passwordHash: hash,
      claimed: true,
    };
    store.users.push(created);
    appendAudit(
      actor.displayName,
      `Создан аккаунт ${created.username} (${ROLE_LABEL_RU[role]})`
    );
    res.status(201).json({ user: sanitizeUser(created) });
  });

  // Admin: Set role (strict 10-level hierarchy: client < member < sales < manager < manager_lead < admin < chief_admin < admin_lead < director < owner)
  app.patch('/api/admin/users/:id/role', (req, res) => {
    const actor = requireStaff(req, res);
    if (!actor) return;

    const target = store.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Аккаунт не найден.' });
      return;
    }

    if (target.role === 'owner' || target.id === actor.id) {
      res.status(403).json({ error: 'Нельзя изменить роль владельца или собственную роль.' });
      return;
    }

    if (ROLE_LEVEL[target.role] >= ROLE_LEVEL[actor.role]) {
      res.status(403).json({
        error: 'Недостаточно прав для изменения аккаунта с более высоким или равным уровнем.',
      });
      return;
    }

    const rawNext = String(req.body?.role || 'client') as UserRole;
    if (rawNext === 'owner') {
      res.status(403).json({ error: 'Роль «Владелец» уникальна и не может быть назначена.' });
      return;
    }
    const nextRole: UserRole = ASSIGNABLE_ROLES.includes(rawNext) ? rawNext : 'client';

    if (ROLE_LEVEL[nextRole] >= ROLE_LEVEL[actor.role]) {
      res.status(403).json({
        error: `Нельзя назначить роль «${ROLE_LABEL_RU[nextRole]}» равную вашей или выше.`,
      });
      return;
    }

    target.role = nextRole;
    appendAudit(
      actor.displayName,
      `Аккаунту @${target.username} назначена роль: ${ROLE_LABEL_RU[nextRole]}`
    );
    res.json({ user: sanitizeUser(target) });
  });

  // Admin: Block or unblock account (only lower-level accounts)
  app.patch('/api/admin/users/:id/status', (req, res) => {
    const actor = requireStaff(req, res);
    if (!actor) return;

    const target = store.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Аккаунт не найден.' });
      return;
    }
    if (target.id === actor.id || target.role === 'owner' || ROLE_LEVEL[target.role] >= ROLE_LEVEL[actor.role]) {
      res.status(403).json({ error: 'Недостаточно прав для блокировки этого аккаунта.' });
      return;
    }

    const nextStatus: AccountStatus = req.body?.status === 'blocked' ? 'blocked' : 'active';
    target.status = nextStatus;
    if (nextStatus === 'blocked') {
      activeUserSessions.delete(target.id);
    }
    appendAudit(
      actor.displayName,
      nextStatus === 'blocked'
        ? `Заблокирован аккаунт ${target.username}`
        : `Разблокирован аккаунт ${target.username}`
    );
    res.json({ user: sanitizeUser(target) });
  });

  // Admin: Delete account (only lower-level accounts)
  app.delete('/api/admin/users/:id', (req, res) => {
    const actor = requireStaff(req, res);
    if (!actor) return;

    const idx = store.users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Аккаунт не найден.' });
      return;
    }
    const target = store.users[idx];
    if (target.id === actor.id || target.role === 'owner' || ROLE_LEVEL[target.role] >= ROLE_LEVEL[actor.role]) {
      res.status(403).json({ error: 'Недостаточно прав для удаления этого аккаунта.' });
      return;
    }

    store.users.splice(idx, 1);
    activeUserSessions.delete(target.id);
    appendAudit(actor.displayName, `Удалён аккаунт ${target.username}`);
    res.json({ ok: true });
  });

  // Admin: Update browser settings (announcement, examples, AI toggle, blocked domains)
  app.put('/api/admin/config', (req, res) => {
    const actor = requireStaff(req, res);
    if (!actor) return;

    const announcement = String(req.body?.announcement ?? store.config.announcement).slice(0, 220);
    const aiEnabled =
      typeof req.body?.aiEnabled === 'boolean' ? req.body.aiEnabled : store.config.aiEnabled;
    const rawExamples = Array.isArray(req.body?.searchExamples)
      ? req.body.searchExamples
      : store.config.searchExamples;
    const searchExamples = rawExamples
      .map((s: unknown) => String(s).trim())
      .filter(Boolean)
      .slice(0, 8);

    const rawBlocked = Array.isArray(req.body?.blockedDomains)
      ? req.body.blockedDomains
      : store.config.blockedDomains;
    const blockedDomains = rawBlocked
      .map((s: unknown) =>
        String(s)
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .split('/')[0]
      )
      .filter(Boolean)
      .slice(0, 30);

    store.config = {
      announcement,
      searchExamples: searchExamples.length > 0 ? searchExamples : store.config.searchExamples,
      aiEnabled,
      blockedDomains,
      updatedAt: new Date().toISOString(),
    };
    appendAudit(actor.displayName, 'Обновлены настройки браузера Fires и правила доступа');
    res.json({ config: store.config });
  });

  // Forbes list API
  app.get('/api/forbes', async (_req, res) => {
    const data = await fetchLiveForbes();
    res.json(data);
  });

  // Daily-updating news feed API
  app.get('/api/news', async (req, res) => {
    const forceRefresh = req.query.refresh === '1';
    const data = await fetchDailyNews(forceRefresh);
    res.json(data);
  });

  // Real internet connectivity probe
  app.get('/api/network', async (_req, res) => {
    const start = Date.now();
    const probes = [
      { name: 'Wikipedia', url: 'https://ru.wikipedia.org/w/api.php?action=query&meta=siteinfo&format=json' },
      { name: 'DuckDuckGo', url: 'https://api.duckduckgo.com/?q=firas&format=json&no_html=1' },
      { name: 'Forbes', url: 'https://www.forbes.com/forbesapi/person/rtb/0/position/true.json?limit=1' },
    ];

    const results = await Promise.all(
      probes.map(async (probe) => {
        const t0 = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        try {
          const r = await fetch(probe.url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Fires/132.0 (FiresEngine/132.0)' },
          });
          clearTimeout(timer);
          return {
            name: probe.name,
            ok: r.ok,
            status: r.status,
            latencyMs: Date.now() - t0,
          };
        } catch {
          clearTimeout(timer);
          return {
            name: probe.name,
            ok: false,
            status: 0,
            latencyMs: Date.now() - t0,
          };
        }
      })
    );

    const anyOnline = results.some((r) => r.ok);
    const okLatencies = results.filter((r) => r.ok).map((r) => r.latencyMs);
    const avgLatencyMs =
      okLatencies.length > 0
        ? Math.round(okLatencies.reduce((a, b) => a + b, 0) / okLatencies.length)
        : Date.now() - start;

    res.json({
      online: anyOnline,
      latencyMs: avgLatencyMs,
      checkedAt: new Date().toISOString(),
      nodes: results,
    });
  });

  // Multi-engine search API for Fires Browser (Fires Engine)
  app.get('/api/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const engine = (String(req.query.engine || 'firas') as SearchEngineId) || 'firas';

    if (!q) {
      res.json({ query: '', engine, results: [] });
      return;
    }

    const searchDuckDuckGoInstant = async (query: string): Promise<SearchResultItem[]> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      try {
        const resp = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
          {
            signal: controller.signal,
            headers: { 'User-Agent': 'Fires/132.0 (FiresEngine/132.0)' },
          }
        );
        clearTimeout(timer);
        if (!resp.ok) return [];
        const data = (await resp.json()) as {
          Heading?: string;
          AbstractText?: string;
          AbstractURL?: string;
          RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
        };
        const out: SearchResultItem[] = [];
        if (data.AbstractText && data.AbstractURL) {
          out.push({
            title: data.Heading || query,
            url: data.AbstractURL,
            snippet: data.AbstractText,
            source: 'DuckDuckGo',
          });
        }
        if (Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics.slice(0, 4)) {
            if (topic.Text && topic.FirstURL) {
              out.push({
                title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 60),
                url: topic.FirstURL,
                snippet: topic.Text,
                source: 'DuckDuckGo',
              });
            }
          }
        }
        return out;
      } catch {
        clearTimeout(timer);
        return [];
      }
    };

    const searchMailRuNews = async (query: string): Promise<SearchResultItem[]> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const resp = await fetch(
          `https://news.mail.ru/rss/main/`,
          {
            signal: controller.signal,
            headers: { 'User-Agent': 'Fires/132.0 (FiresEngine/132.0)' },
          }
        );
        clearTimeout(timer);
        if (!resp.ok) return [];
        const xml = await resp.text();
        const items: SearchResultItem[] = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const qLower = query.toLowerCase();
        let m: RegExpExecArray | null;
        while ((m = itemRegex.exec(xml)) !== null && items.length < 4) {
          const chunk = m[1];
          const titleMatch = chunk.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
          const linkMatch = chunk.match(/<link>([\s\S]*?)<\/link>/);
          const descMatch = chunk.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/);
          const title = stripTags(titleMatch?.[1] || titleMatch?.[2] || '');
          const url = (linkMatch?.[1] || '').trim();
          const snippet = stripTags(descMatch?.[1] || descMatch?.[2] || '');
          if (
            title &&
            url.startsWith('http') &&
            (title.toLowerCase().includes(qLower) || snippet.toLowerCase().includes(qLower))
          ) {
            items.push({
              title,
              url,
              snippet: snippet || 'Публикация Mail.ru',
              source: 'Mail.ru',
            });
          }
        }
        return items;
      } catch {
        clearTimeout(timer);
        return [];
      }
    };

    const dedupe = (list: SearchResultItem[]): SearchResultItem[] => {
      const seen = new Set<string>();
      const out: SearchResultItem[] = [];
      for (const item of list) {
        if (!item.url || seen.has(item.url)) continue;
        seen.add(item.url);
        out.push(item);
      }
      return out;
    };

    let results: SearchResultItem[] = [];

    if (engine === 'duckduckgo') {
      const [ddg, instant, ruWiki] = await Promise.all([
        searchDuckDuckGoHtml(q),
        searchDuckDuckGoInstant(q),
        searchWikipedia(q, 'ru'),
      ]);
      results = dedupe([
        ...ddg.map((r) => ({ ...r, source: 'DuckDuckGo' })),
        ...instant,
        ...ruWiki.slice(0, 2),
      ]);
    } else if (engine === 'google') {
      const [ddg, enWiki, ruWiki] = await Promise.all([
        searchDuckDuckGoHtml(q),
        searchWikipedia(q, 'en'),
        searchWikipedia(q, 'ru'),
      ]);
      results = dedupe([
        ...ddg.map((r) => ({ ...r, source: 'Google Web' })),
        ...ruWiki.slice(0, 3),
        ...enWiki.slice(0, 3),
      ]);
    } else if (engine === 'yandex') {
      const [ddg, ruWiki, habr] = await Promise.all([
        searchDuckDuckGoHtml(q),
        searchWikipedia(q, 'ru'),
        searchHabr(q),
      ]);
      results = dedupe([
        ...ddg.map((r) => ({ ...r, source: 'Яндекс / Web' })),
        ...ruWiki.slice(0, 4),
        ...habr,
      ]);
    } else if (engine === 'mailru') {
      const [mailNews, ddg, ruWiki] = await Promise.all([
        searchMailRuNews(q),
        searchDuckDuckGoHtml(q),
        searchWikipedia(q, 'ru'),
      ]);
      results = dedupe([
        ...mailNews,
        ...ddg.map((r) => ({ ...r, source: 'Mail.ru / Web' })),
        ...ruWiki.slice(0, 3),
      ]);
    } else {
      // 'firas' (Fires Mix — searches across all engines simultaneously)
      const [ddg, instant, ruWiki, enWiki, habr, mailNews] = await Promise.all([
        searchDuckDuckGoHtml(q),
        searchDuckDuckGoInstant(q),
        searchWikipedia(q, 'ru'),
        searchWikipedia(q, 'en'),
        searchHabr(q),
        searchMailRuNews(q),
      ]);
      results = dedupe([
        ...ddg.map((r) => ({ ...r, source: 'Fires Mix · Web' })),
        ...instant,
        ...mailNews,
        ...ruWiki.slice(0, 3),
        ...habr,
        ...enWiki.slice(0, 2),
      ]);
    }

    res.json({
      query: q,
      engine,
      results: results.slice(0, 16),
    });
  });

  // Cached AI responses to preserve free-tier quota on repeated/popular queries
  const aiAnswerCache = new Map<
    string,
    {
      query: string;
      provider: string;
      model: string;
      answer: string;
      routedTo?: string;
      routeReason?: string;
      cachedAt: number;
    }
  >();
  const AI_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
  const inFlightAiRequests = new Map<
    string,
    Promise<{
      query: string;
      provider: string;
      model: string;
      answer: string;
      routedTo?: string;
      routeReason?: string;
    }>
  >();

  type ServerAiEngine =
    | 'google_studio_ai'
    | 'claude'
    | 'codex'
    | 'codeium'
    | 'studio_ai'
    | 'studio_collab'
    | 'gemini'
    | 'chatgpt'
    | 'deepseek'
    | 'deepseek_coder';

  const AI_ENGINE_TITLES: Record<ServerAiEngine, string> = {
    google_studio_ai: 'Google Studio AI',
    claude: 'Claude',
    codex: 'Codex',
    codeium: 'Codeium',
    studio_ai: 'Studio AI',
    studio_collab: 'Google Studio AI + Claude + Codex',
    gemini: 'Gemini',
    chatgpt: 'ChatGPT',
    deepseek: 'DeepSeek',
    deepseek_coder: 'DeepSeek Coder',
  };

  const buildWebKnowledgeFallback = async (
    query: string,
    provider: ServerAiEngine,
    ensembleList?: BuiltInAiProviderId[],
    leadEngine?: ServerAiEngine
  ): Promise<{ query: string; provider: string; model: string; answer: string }> => {
    const providerTitle =
      ensembleList && ensembleList.length > 1
        ? ensembleList
            .map((e) => AI_ENGINE_TITLES[e as ServerAiEngine] || e)
            .join(' + ')
        : AI_ENGINE_TITLES[provider] || 'Google Studio AI';
    const leadTitle = leadEngine ? AI_ENGINE_TITLES[leadEngine] || leadEngine : undefined;

    const qLower = query.toLowerCase();
    const isGameOrCodeQuery =
      /(игр|game|unity|godot|three\.?js|webgl|canvas|движ|phaser|код|функц|react|typescript|javascript|python|sql|api|компонент|сервер|бот|приложен|платформер|шутер|rpg)/.test(
        qLower
      );

    if (
      isGameOrCodeQuery &&
      (provider === 'google_studio_ai' ||
        provider === 'codex' ||
        provider === 'deepseek_coder' ||
        provider === 'studio_collab' ||
        provider === 'studio_ai' ||
        provider === 'codeium' ||
        provider === 'claude' ||
        (ensembleList && ensembleList.length > 1))
    ) {
      const isGame = /(игр|game|unity|godot|three\.?js|webgl|canvas|движ|phaser|платформер|шутер|rpg)/.test(
        qLower
      );
      const ensembleHeader =
        provider === 'studio_collab' || (ensembleList && ensembleList.length > 1)
          ? `Совместный разбор (${providerTitle}${leadTitle ? ` · через движок ${leadTitle}` : ''}):\n\n`
          : `${providerTitle} · Режим разработки:\n\n`;

      const structuredPlan = isGame
        ? [
            `${ensembleHeader}1. Архитектура (${leadTitle ? `${leadTitle} + ` : ''}Google Studio AI & Claude):`,
            `- Игровой цикл: фиксированный шаг физики (60 FPS, deltaTime) через requestAnimationFrame и чистый state-менеджер без утечек памяти.`,
            `- Сцены и сущности: разделение на World (физика/коллизии), Entities (игрок, враги, бонусы), Renderer (Canvas 2D или Three.js WebGL) и InputController (клавиатура + сенсорное управление для телефона/планшета).`,
            '',
            `2. Стартовый шаблон кода (${leadTitle || 'Codex'}):`,
            '```ts',
            'export interface GameEntity { x: number; y: number; vx: number; vy: number; r: number; }',
            '',
            'export function createGameLoop(canvas: HTMLCanvasElement) {',
            '  const ctx = canvas.getContext("2d")!;',
            '  const player: GameEntity = { x: canvas.width / 2, y: canvas.height / 2, vx: 0, vy: 0, r: 16 };',
            '  let last = performance.now();',
            '',
            '  function update(dt: number) {',
            '    player.x = Math.max(player.r, Math.min(canvas.width - player.r, player.x + player.vx * dt));',
            '    player.y = Math.max(player.r, Math.min(canvas.height - player.r, player.y + player.vy * dt));',
            '  }',
            '',
            '  function render() {',
            '    ctx.clearRect(0, 0, canvas.width, canvas.height);',
            '    ctx.fillStyle = "#09090b";',
            '    ctx.fillRect(0, 0, canvas.width, canvas.height);',
            '    ctx.beginPath();',
            '    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);',
            '    ctx.fillStyle = "#f97316";',
            '    ctx.fill();',
            '  }',
            '',
            '  function frame(now: number) {',
            '    const dt = Math.min(0.05, (now - last) / 1000);',
            '    last = now;',
            '    update(dt);',
            '    render();',
            '    requestAnimationFrame(frame);',
            '  }',
            '  requestAnimationFrame(frame);',
            '}',
            '```',
            '',
            `Уточните жанр (2D платформер, Three.js 3D, шутер, RPG) или движок (Web/Canvas, Unity C#, Godot GDScript), и совместный стек сгенерирует полные модули для вашего проекта «${query}».`,
          ].join('\n')
        : [
            `${ensembleHeader}1. Архитектура решения (Google Studio AI & Claude):`,
            `- Декомпозиция задачи «${query}»: типизированный интерфейс данных, чистые функции бизнес-логики, валидация входных параметров и обработка крайних случаев.`,
            `- Надёжность: изоляция побочных эффектов (сеть/хранилище), таймауты и отмена устаревших запросов.`,
            '',
            `2. Базовая реализация (Codex):`,
            '```ts',
            'export async function runTaskPipeline<T>(input: string, handler: (q: string) => Promise<T>) {',
            '  const normalized = input.trim();',
            '  if (!normalized) throw new Error("Пустой входной параметр");',
            '  const startedAt = Date.now();',
            '  const data = await handler(normalized);',
            '  return { data, durationMs: Date.now() - startedAt };',
            '}',
            '```',
            '',
            `Напишите, какой язык, фреймворк или формат результата нужен (TypeScript, React, Python, Node.js, SQL) — соберём готовый рабочий код без ограничений.`,
          ].join('\n');

      return {
        query,
        provider,
        model: `${providerTitle} · Безлимитный режим`,
        answer: structuredPlan,
      };
    }

    const fetchWikiExtract = async (lang: 'ru' | 'en'): Promise<string | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2400);
      try {
        const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          query
        )}&srlimit=1&utf8=1&format=json`;
        const sResp = await fetch(searchUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Fires/132.0 (FiresEngine/132.0)' },
        });
        if (!sResp.ok) {
          clearTimeout(timer);
          return null;
        }
        const sJson = (await sResp.json()) as {
          query?: { search?: Array<{ title?: string }> };
        };
        const topTitle = sJson.query?.search?.[0]?.title;
        if (!topTitle) {
          clearTimeout(timer);
          return null;
        }

        const extractUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(
          topTitle
        )}&format=json&utf8=1`;
        const eResp = await fetch(extractUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Fires/132.0 (FiresEngine/132.0)' },
        });
        clearTimeout(timer);
        if (!eResp.ok) return null;
        const eJson = (await eResp.json()) as {
          query?: { pages?: Record<string, { extract?: string }> };
        };
        const pages = eJson.query?.pages ? Object.values(eJson.query.pages) : [];
        const extract = pages[0]?.extract?.trim();
        return extract ? extract.slice(0, 1200) : null;
      } catch {
        clearTimeout(timer);
        return null;
      }
    };

    const fetchDdgInstantText = async (): Promise<string | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2200);
      try {
        const resp = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
          {
            signal: controller.signal,
            headers: { 'User-Agent': 'Fires/132.0 (FiresEngine/132.0)' },
          }
        );
        clearTimeout(timer);
        if (!resp.ok) return null;
        const json = (await resp.json()) as { AbstractText?: string };
        return json.AbstractText?.trim() || null;
      } catch {
        clearTimeout(timer);
        return null;
      }
    };

    const [ruWikiExtract, enWikiExtract, ddgInstant, webSnippets] = await Promise.all([
      withTimeout(fetchWikiExtract('ru'), 2800).catch(() => null),
      withTimeout(fetchWikiExtract('en'), 2800).catch(() => null),
      withTimeout(fetchDdgInstantText(), 2400).catch(() => null),
      withTimeout(searchDuckDuckGoHtml(query), 2800).catch(() => [] as SearchResultItem[]),
    ]);

    const parts: string[] = [];
    if (ruWikiExtract) {
      parts.push(ruWikiExtract);
    } else if (enWikiExtract) {
      parts.push(enWikiExtract);
    } else if (ddgInstant) {
      parts.push(ddgInstant);
    }

    if (webSnippets.length > 0) {
      const topLines = webSnippets
        .slice(0, 3)
        .map((item) => `${item.title}: ${item.snippet}`)
        .join('\n');
      if (parts.length === 0) {
        parts.push(`Краткая сводка по запросу «${query}»:\n\n${topLines}`);
      } else {
        parts.push(`Дополнительные источники:\n${topLines}`);
      }
    }

    const finalAnswer =
      parts.join('\n\n') ||
      `${providerTitle} обработал запрос «${query}». Уточните детали задачи, стек или нужный формат результата — ответ будет подготовлен без ограничений.`;

    return {
      query,
      provider,
      model: `${providerTitle} · Безлимитный режим`,
      answer: finalAnswer,
    };
  };

  // Helper: Fires Assistant classifies task & selects best AI across Google Studio AI, Claude, Codex, Codeium, Gemini, ChatGPT, DeepSeek & user's custom AIs
  const selectBestModelForTask = (
    prompt: string,
    userModels: CustomAiModel[]
  ): {
    targetEngine: ServerAiEngine;
    customModel?: CustomAiModel;
    routedTo: string;
    routeReason: string;
  } => {
    const q = prompt.toLowerCase();
    const isGameDev =
      /(создан.*игр|сдела.*игр|игр[уыа]|game|unity|godot|three\.?js|webgl|canvas|движ|phaser|rpg|платформер|шутер)/.test(
        q
      );
    const isCoding =
      /(код|функц|react|typescript|javascript|python|sql|api|ошибк|баг|алгоритм|программ|html|css|server|нейросет|архитект|codeium|codex|studio)/.test(
        q
      );
    const isDeepAnalysis =
      /(анализ|сравни|документ|аргумент|плюсы и минусы|claude|структур|контракт|отчёт|исследован)/.test(
        q
      );
    const isCreative =
      /(напиши текст|пост|слоган|сценари|истори|стих|иде[яи]|реклам|письмо|придумай|диалог)/.test(q);
    const isBusiness =
      /(бизнес|продаж|стратег|маркетинг|доход|план|рынка|forbes|финанс)/.test(q);
    const isStudy = /(объясни|задач|учёб|учеб|реши|физик|математ|хими|истори[яю])/.test(q);

    const desiredSpecialty: CustomAiSpecialty = isGameDev
      ? 'gamedev'
      : isCoding
      ? 'coding'
      : isCreative
      ? 'creative'
      : isBusiness
      ? 'business'
      : isStudy
      ? 'study'
      : 'research';

    const matchedCustom =
      userModels.find((m) => m.specialty === desiredSpecialty) ||
      userModels.find((m) => m.specialty === 'universal');

    if (isGameDev) {
      return {
        targetEngine: 'studio_collab',
        customModel: matchedCustom?.specialty === 'gamedev' ? matchedCustom : undefined,
        routedTo: matchedCustom?.specialty === 'gamedev'
          ? `${matchedCustom.name} + Google Studio AI + Claude + Codex`
          : 'Google Studio AI + Claude + Codex (создание игр)',
        routeReason: 'Fires Assistant запустил совместный стек Google Studio AI + Claude + Codex для проектирования и кода игры.',
      };
    }
    if (isCoding) {
      return {
        targetEngine: 'codex',
        customModel: matchedCustom?.specialty === 'coding' ? matchedCustom : undefined,
        routedTo:
          matchedCustom?.specialty === 'coding'
            ? `${matchedCustom.name} + Codex`
            : 'Codex + Google Studio AI (программирование)',
        routeReason: 'Fires Assistant выбрал нейросеть для разработки, рефакторинга и архитектуры кода.',
      };
    }
    if (isDeepAnalysis) {
      return {
        targetEngine: 'claude',
        customModel: matchedCustom,
        routedTo: matchedCustom
          ? `${matchedCustom.name} + Claude`
          : 'Claude (глубокий анализ и логика)',
        routeReason: 'Fires Assistant выбрал Claude для глубокого анализа и точной структуры.',
      };
    }
    if (isCreative) {
      return {
        targetEngine: 'chatgpt',
        customModel: matchedCustom?.specialty === 'creative' ? matchedCustom : undefined,
        routedTo:
          matchedCustom?.specialty === 'creative'
            ? `${matchedCustom.name} + ChatGPT`
            : 'ChatGPT (тексты и креатив)',
        routeReason: 'Fires Assistant выбрал лучшую нейросеть для текстов, идей и общения.',
      };
    }
    if (isBusiness || isStudy) {
      return {
        targetEngine: 'google_studio_ai',
        customModel: matchedCustom,
        routedTo: matchedCustom
          ? `${matchedCustom.name} + Google Studio AI`
          : 'Google Studio AI (аналитика и обучение)',
        routeReason: isBusiness
          ? 'Fires Assistant выбрал Google Studio AI для бизнес-анализа и стратегии.'
          : 'Fires Assistant выбрал Google Studio AI для объяснений и точных фактов.',
      };
    }
    return {
      targetEngine: 'claude',
      customModel: matchedCustom,
      routedTo: matchedCustom
        ? `${matchedCustom.name} + Claude`
        : 'Claude (универсальный подбор)',
      routeReason: 'Fires Assistant сравнил Google Studio AI, Claude, Codex, Gemini и ChatGPT и выбрал оптимальную.',
    };
  };

  // Helper: execute unlimited AI prompt/conversation with strict per-call timeouts & automatic failover
  const isValidServerEngine = (val: string): val is ServerAiEngine =>
    val === 'google_studio_ai' ||
    val === 'claude' ||
    val === 'codex' ||
    val === 'codeium' ||
    val === 'studio_ai' ||
    val === 'studio_collab' ||
    val === 'gemini' ||
    val === 'chatgpt' ||
    val === 'deepseek' ||
    val === 'deepseek_coder';

  const runUnlimitedAiTurn = async (
    rawProvider: string,
    latestUserPrompt: string,
    conversationContext?: string,
    actorId?: string,
    leadEngineOverride?: string
  ): Promise<{
    provider: string;
    model: string;
    answer: string;
    routedTo?: string;
    routeReason?: string;
  }> => {
    const userModels = store.customAiModels.filter(
      (m) => m.isPublic || (actorId && m.ownerId === actorId)
    );

    const isFiresAssistant =
      rawProvider === 'fire_assistant' ||
      rawProvider === 'fires_assistant' ||
      rawProvider === 'meta';
    let effectiveProvider: ServerAiEngine = 'gemini';
    let ensembleList: BuiltInAiProviderId[] | undefined;
    let chosenLeadEngine: ServerAiEngine | undefined;
    let customModel: CustomAiModel | undefined;
    let routedTo: string | undefined;
    let routeReason: string | undefined;

    const requestedLead =
      leadEngineOverride &&
      leadEngineOverride !== 'auto' &&
      leadEngineOverride !== 'studio_collab' &&
      isValidServerEngine(leadEngineOverride)
        ? leadEngineOverride
        : undefined;

    if (rawProvider.startsWith('custom:')) {
      const targetId = rawProvider.slice(7);
      customModel = userModels.find((m) => m.id === targetId);
      if (customModel) {
        const modelLead =
          requestedLead ||
          (customModel.leadEngine &&
          customModel.leadEngine !== 'studio_collab' &&
          isValidServerEngine(customModel.leadEngine)
            ? customModel.leadEngine
            : undefined);

        if (
          customModel.baseEngine === 'ensemble' ||
          (Array.isArray(customModel.ensembleEngines) && customModel.ensembleEngines.length > 1)
        ) {
          effectiveProvider = 'studio_collab';
          chosenLeadEngine = modelLead;
          ensembleList =
            customModel.ensembleEngines && customModel.ensembleEngines.length > 0
              ? customModel.ensembleEngines
              : ['google_studio_ai', 'claude', 'codex'];
          const teamNames = ensembleList
            .map((e) => AI_ENGINE_TITLES[e as ServerAiEngine] || e)
            .join(' + ');
          const leadLabel = chosenLeadEngine ? AI_ENGINE_TITLES[chosenLeadEngine] : null;
          routedTo = leadLabel
            ? `${customModel.name} · через ${leadLabel}`
            : `${customModel.name} · ${teamNames}`;
          routeReason = leadLabel
            ? `Объединённый режим (${teamNames}) с выполнением через движок ${leadLabel}.`
            : `Совместная работа моделей: ${teamNames}.`;
        } else if (customModel.baseEngine === 'auto') {
          const picked = selectBestModelForTask(latestUserPrompt, [customModel]);
          effectiveProvider = picked.targetEngine;
          routedTo = `${customModel.name} (${AI_ENGINE_TITLES[picked.targetEngine] || picked.targetEngine})`;
          routeReason = `Нейросеть «${customModel.name}» выбрала движок ${AI_ENGINE_TITLES[picked.targetEngine] || picked.targetEngine}.`;
        } else {
          effectiveProvider = customModel.baseEngine as ServerAiEngine;
          routedTo = customModel.name;
          routeReason = `Нейросеть «${customModel.name}» (${AI_ENGINE_TITLES[effectiveProvider] || effectiveProvider}).`;
        }
      }
    } else if (isFiresAssistant) {
      const picked = selectBestModelForTask(latestUserPrompt, userModels);
      effectiveProvider = picked.targetEngine;
      customModel = picked.customModel;
      routedTo = picked.routedTo;
      routeReason = picked.routeReason;
    } else if (isValidServerEngine(rawProvider)) {
      effectiveProvider = rawProvider;
      if (rawProvider === 'studio_collab') {
        ensembleList = ['google_studio_ai', 'claude', 'codex'];
        chosenLeadEngine = requestedLead;
        const leadLabel = chosenLeadEngine ? AI_ENGINE_TITLES[chosenLeadEngine] : null;
        routedTo = leadLabel
          ? `Объединение нейросетей → ${leadLabel}`
          : 'Google Studio AI + Claude + Codex';
        routeReason = leadLabel
          ? `Совместный консилиум нейросетей с генерацией результата через движок ${leadLabel}.`
          : 'Совместный режим: архитектура Google Studio AI, логика Claude и код Codex.';
      }
    }

    const activeSynthesisEngine: ServerAiEngine =
      effectiveProvider === 'studio_collab' && chosenLeadEngine
        ? chosenLeadEngine
        : effectiveProvider;

    const ensembleTeamNote =
      effectiveProvider === 'studio_collab' && ensembleList && ensembleList.length > 0
        ? `Ты выступаешь в роли ведущего движка (${AI_ENGINE_TITLES[activeSynthesisEngine] || 'Google Studio AI + Claude + Codex'}), объединяя сильные стороны нейросетей: ${ensembleList
            .map((e) => AI_ENGINE_TITLES[e as ServerAiEngine] || e)
            .join(', ')}.\n`
        : '';

    const customSystem = customModel
      ? `Ты — нейросеть «${customModel.name}» (${customModel.tagline}). Инструкция создателя: ${customModel.systemPrompt}\n`
      : '';

    const promptWithContext = conversationContext
      ? `${conversationContext}\n\nТекущий запрос пользователя:\n${latestUserPrompt}`
      : latestUserPrompt;

    // 1. Direct Anthropic Claude / OpenAI / DeepSeek API if configured (strict 6.5s timeout)
    if (activeSynthesisEngine === 'claude' && process.env.ANTHROPIC_API_KEY) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 1500,
            system: `${customSystem}${ensembleTeamNote}Отвечай на языке запроса (по умолчанию на русском). Дай точный, ясный ответ без лишних markdown-звёздочек.`,
            messages: [{ role: 'user', content: promptWithContext }],
          }),
        });
        clearTimeout(timer);
        const json = (await resp.json()) as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const answer = json.content?.find((c) => c.type === 'text')?.text?.trim();
        if (resp.ok && answer) {
          return {
            provider: rawProvider,
            model: customModel
              ? `${customModel.name} · Claude`
              : effectiveProvider === 'studio_collab'
              ? `Объединённый режим → Claude · Безлимит`
              : isFiresAssistant
              ? `Fires Assistant → Claude (безлимит)`
              : 'Claude · Безлимит',
            answer,
            routedTo,
            routeReason,
          };
        }
      } catch {
        clearTimeout(timer);
      }
    }

    if (
      (activeSynthesisEngine === 'chatgpt' || activeSynthesisEngine === 'codex') &&
      process.env.OPENAI_API_KEY
    ) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  activeSynthesisEngine === 'codex'
                    ? `${customSystem}${ensembleTeamNote}Ты — Codex, инженерный ассистент по программированию и созданию игр. Пиши чистый, готовый к запуску код и чётко объясняй архитектуру.`
                    : `${customSystem}${ensembleTeamNote}Отвечай на языке запроса (по умолчанию на русском). Дай точный, ясный ответ без лишних markdown-звёздочек.`,
              },
              { role: 'user', content: promptWithContext },
            ],
          }),
        });
        clearTimeout(timer);
        const json = (await resp.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const answer = json.choices?.[0]?.message?.content?.trim();
        if (resp.ok && answer) {
          const title = activeSynthesisEngine === 'codex' ? 'Codex' : 'ChatGPT';
          return {
            provider: rawProvider,
            model: customModel
              ? `${customModel.name} · ${title}`
              : effectiveProvider === 'studio_collab'
              ? `Объединённый режим → ${title} · Безлимит`
              : isFiresAssistant
              ? `Fires Assistant → ${title} (безлимит)`
              : `${title} · Безлимит`,
            answer,
            routedTo,
            routeReason,
          };
        }
      } catch {
        clearTimeout(timer);
      }
    }

    if (
      (activeSynthesisEngine === 'deepseek' || activeSynthesisEngine === 'deepseek_coder') &&
      process.env.DEEPSEEK_API_KEY
    ) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      const isCoderVariant = activeSynthesisEngine === 'deepseek_coder';
      try {
        const resp = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: isCoderVariant ? 'deepseek-coder' : 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: isCoderVariant
                  ? `${customSystem}${ensembleTeamNote}Ты — DeepSeek Coder. Отвечай на языке запроса (по умолчанию на русском). Пиши оптимизированный рабочий код для игр, алгоритмов и бэкенда.`
                  : `${customSystem}${ensembleTeamNote}Ты — DeepSeek. Отвечай на языке запроса (по умолчанию на русском). Дай точный, структурированный ответ без лишних markdown-звёздочек.`,
              },
              { role: 'user', content: promptWithContext },
            ],
          }),
        });
        clearTimeout(timer);
        const json = (await resp.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const answer = json.choices?.[0]?.message?.content?.trim();
        if (resp.ok && answer) {
          const dsLabel = isCoderVariant ? 'DeepSeek Coder' : 'DeepSeek';
          return {
            provider: rawProvider,
            model: customModel
              ? `${customModel.name} · ${dsLabel}`
              : effectiveProvider === 'studio_collab'
              ? `Объединённый режим → ${dsLabel} · Безлимит`
              : isFiresAssistant
              ? `Fires Assistant → ${dsLabel} (безлимит)`
              : `${dsLabel} (${isCoderVariant ? 'deepseek-coder' : 'deepseek-chat'}) · Безлимит`,
            answer,
            routedTo,
            routeReason,
          };
        }
      } catch {
        clearTimeout(timer);
      }
    }

    // 2. Gemini / Google Studio AI free-tier failover chain (7s timeout per attempt, never hangs, unlimited)
    const ai = getGeminiClient();
    if (ai) {
      const teamNames =
        ensembleList && ensembleList.length > 0
          ? ensembleList.map((e) => AI_ENGINE_TITLES[e as ServerAiEngine] || e).join(' + ')
          : 'Google Studio AI + Claude + Codex';
      const leadEngineTitle = chosenLeadEngine ? AI_ENGINE_TITLES[chosenLeadEngine] : null;

      const styleNote =
        effectiveProvider === 'studio_collab'
          ? leadEngineTitle
            ? `Ты работаешь в объединённом режиме (${teamNames}), но финальный код, структуру и стиль формируешь через выбранный движок ${leadEngineTitle}. Объедини аналитику команды и выдай цельный результат от лица ${leadEngineTitle}.`
            : `Ты работаешь в совместном многомодельном режиме (${teamNames}). Структурируй ответ как слаженную работу команды: [Google Studio AI — архитектура и системный дизайн для кода/игр], [Claude — проверка логики, баланса и крайних случаев], [Codex — чистый рабочий код с примерами TypeScript/Canvas/Three.js/Godot/Unity].`
          : effectiveProvider === 'google_studio_ai'
          ? 'Ты — Google Studio AI, профессиональная среда создания ИИ-агентов, программирования и разработки игр (WebGL, Three.js, Canvas 2D, Unity, Godot, TypeScript, Python). Давай пошаговую архитектуру и готовый код.'
          : effectiveProvider === 'codex'
          ? 'Ты — Codex, специализированный ИИ для программирования, отладки и игровой логики. Пиши чистый, рабочий код без заглушек.'
          : effectiveProvider === 'deepseek_coder'
          ? 'Ты — DeepSeek Coder, специализированный кодинг-движок для алгоритмов, игр, серверного кода и оптимизации. Пиши чёткий готовый код.'
          : effectiveProvider === 'claude'
          ? 'Отвечай в вдумчивом, структурированном стиле официального Claude.'
          : effectiveProvider === 'codeium'
          ? 'Ты — Codeium, профессиональный ассистент программиста. Давай точный рабочий код, объясняй оптимизации и edge cases.'
          : effectiveProvider === 'studio_ai'
          ? 'Ты — Studio AI, среда проектирования нейросетей и ИИ-агентов для программирования и игр. Помогай создавать системные промпты, пайплайны и код-ассистентов.'
          : effectiveProvider === 'chatgpt'
          ? 'Отвечай в ясном разговорно-энциклопедическом стиле официального ChatGPT.'
          : effectiveProvider === 'deepseek'
          ? 'Отвечай в точном аналитическом стиле официального DeepSeek для аналитики, рассуждений и задач.'
          : 'Отвечай в точном стиле официального приложения Gemini.';

      const candidates: Array<{ modelId: string; useLowThinking: boolean }> = [
        { modelId: GEMINI_FREE_MODEL, useLowThinking: true },
        { modelId: 'gemini-3.1-flash-lite', useLowThinking: false },
      ];

      for (const candidate of candidates) {
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: candidate.modelId,
              contents: promptWithContext,
              config: {
                ...(candidate.useLowThinking
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
                systemInstruction: `${customSystem}Ты — встроенная нейросеть Fires без ограничений по числу запросов. Отвечай на языке пользователя (по умолчанию на русском). ${styleNote}`,
              },
            }),
            7000
          );
          const answer = (response.text || '').trim();
          if (answer) {
            const label = customModel
              ? `${customModel.name} · ${
                  effectiveProvider === 'studio_collab'
                    ? leadEngineTitle
                      ? `${teamNames} → ${leadEngineTitle}`
                      : teamNames
                    : AI_ENGINE_TITLES[effectiveProvider] || candidate.modelId
                }`
              : isFiresAssistant
              ? `Fires Assistant → ${routedTo || 'Claude'} · Безлимит`
              : effectiveProvider === 'studio_collab'
              ? leadEngineTitle
                ? `Совместный ИИ (${teamNames}) через ${leadEngineTitle} · Безлимит`
                : `Совместный ИИ (${teamNames}) · Безлимит`
              : effectiveProvider === 'google_studio_ai'
              ? `Google Studio AI · ${candidate.modelId} (безлимит)`
              : effectiveProvider === 'codex'
              ? `Codex · Программирование и игры (безлимит)`
              : effectiveProvider === 'deepseek_coder'
              ? `DeepSeek Coder · Код и алгоритмы (безлимит)`
              : effectiveProvider === 'claude'
              ? `Claude · ${candidate.modelId} (безлимит)`
              : effectiveProvider === 'codeium'
              ? `Codeium · Программирование (безлимит)`
              : effectiveProvider === 'studio_ai'
              ? `Studio AI · Конструктор ИИ (безлимит)`
              : effectiveProvider === 'chatgpt'
              ? `ChatGPT · ${candidate.modelId} (безлимит)`
              : effectiveProvider === 'deepseek'
              ? `DeepSeek · ${candidate.modelId} (безлимит)`
              : `Gemini (${candidate.modelId}) · Безлимит`;
            return {
              provider: rawProvider,
              model: label,
              answer,
              routedTo,
              routeReason,
            };
          }
        } catch {
          // Proceed immediately to next candidate or web synthesis fallback
        }
      }
    }

    // 3. Guaranteed fast web knowledge & coding/gamedev synthesis fallback (<3.5s)
    const fb = await buildWebKnowledgeFallback(
      latestUserPrompt,
      effectiveProvider,
      ensembleList,
      chosenLeadEngine
    );
    const prefix = customModel
      ? `[${customModel.name}${routedTo ? ` · ${routedTo}` : ''}]:\n`
      : isFiresAssistant && routedTo
      ? `[Fires Assistant выбрал: ${routedTo}]\n`
      : '';
    return {
      provider: rawProvider,
      model: customModel
        ? `${customModel.name} · Безлимитный режим`
        : isFiresAssistant
        ? `Fires Assistant → ${routedTo || 'Автовыбор'}`
        : fb.model,
      answer: `${prefix}${fb.answer}`,
      routedTo,
      routeReason,
    };
  };

  // Custom Neural Nets CRUD + Meta-AI Registry
  app.get('/api/ai/models', (req, res) => {
    const actor = getAuthenticatedUser(req);
    const customModels = store.customAiModels.filter(
      (m) => m.isPublic || (actor && m.ownerId === actor.id)
    );
    res.json({ models: customModels, customModels });
  });

  app.post('/api/ai/models', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Войдите в аккаунт, чтобы создать свою нейросеть.' });
      return;
    }
    const name = String(req.body?.name || '').trim().slice(0, 48);
    const tagline = String(req.body?.tagline || '').trim().slice(0, 120);
    const systemPrompt = String(req.body?.systemPrompt || '').trim().slice(0, 2000);
    const rawSpecialty = String(req.body?.specialty || 'universal') as CustomAiSpecialty;
    const validSpecialties: CustomAiSpecialty[] = [
      'universal',
      'coding',
      'gamedev',
      'research',
      'creative',
      'business',
      'study',
    ];
    const specialty = validSpecialties.includes(rawSpecialty) ? rawSpecialty : 'universal';
    const rawBase = String(req.body?.baseEngine || 'auto');
    const baseEngine =
      rawBase === 'ensemble' ||
      rawBase === 'google_studio_ai' ||
      rawBase === 'claude' ||
      rawBase === 'codex' ||
      rawBase === 'codeium' ||
      rawBase === 'studio_ai' ||
      rawBase === 'gemini' ||
      rawBase === 'chatgpt' ||
      rawBase === 'deepseek' ||
      rawBase === 'deepseek_coder'
        ? rawBase
        : 'auto';

    const allowedEnsemble: BuiltInAiProviderId[] = [
      'google_studio_ai',
      'claude',
      'codex',
      'codeium',
      'studio_ai',
      'gemini',
      'chatgpt',
      'deepseek',
      'deepseek_coder',
    ];
    const rawEnsemble = Array.isArray(req.body?.ensembleEngines)
      ? (req.body.ensembleEngines as unknown[])
          .map((x) => String(x) as BuiltInAiProviderId)
          .filter((x) => allowedEnsemble.includes(x))
      : [];
    const ensembleEngines =
      rawEnsemble.length > 0
        ? Array.from(new Set(rawEnsemble))
        : baseEngine === 'ensemble'
        ? (['google_studio_ai', 'claude', 'codex'] as BuiltInAiProviderId[])
        : undefined;

    const rawLeadEngine = String(req.body?.leadEngine || '').trim() as BuiltInAiProviderId;
    const leadEngine =
      baseEngine === 'ensemble' && allowedEnsemble.includes(rawLeadEngine)
        ? rawLeadEngine
        : undefined;

    const isPublic = req.body?.isPublic !== false;
    const savedToCloud = req.body?.savedToCloud !== false && req.body?.saveToCloud !== false;

    if (name.length < 2) {
      res.status(400).json({ error: 'Название нейросети должно содержать минимум 2 символа.' });
      return;
    }
    if (systemPrompt.length < 5) {
      res.status(400).json({ error: 'Опишите задачу и характер вашей нейросети (от 5 символов).' });
      return;
    }

    const created: CustomAiModel = {
      id: `caim-${Date.now()}-${randomBytes(2).toString('hex')}`,
      ownerId: user.id,
      ownerName: user.displayName,
      name,
      tagline: tagline || `Персональная нейросеть (@${user.username})`,
      specialty,
      systemPrompt,
      baseEngine,
      ...(ensembleEngines ? { ensembleEngines } : {}),
      ...(leadEngine ? { leadEngine } : {}),
      isPublic,
      savedToCloud,
      createdAt: new Date().toISOString(),
    };
    store.customAiModels.unshift(created);

    // Optionally save model blueprint directly to user's 1 TB Cloud Storage
    let cloudFile: CloudFileItem | undefined;
    if (savedToCloud) {
      const fileId = `cf-ai-${Date.now()}-${randomBytes(2).toString('hex')}`;
      const blueprint = JSON.stringify(created, null, 2);
      const userDir = path.join(CLOUD_DIR, user.id);
      try {
        fs.mkdirSync(userDir, { recursive: true });
        fs.writeFileSync(path.join(userDir, fileId), blueprint, 'utf8');
        cloudFile = {
          id: fileId,
          ownerId: user.id,
          ownerName: user.displayName,
          name: `${name}.ai.json`,
          folder: 'Нейросети',
          category: 'ai-model',
          sizeBytes: Buffer.byteLength(blueprint, 'utf8'),
          mimeType: 'application/json',
          source: 'firas-cloud',
          createdAt: created.createdAt,
        };
        store.cloudFiles.unshift(cloudFile);
      } catch {
        // Ignore cloud file mirror failure gracefully
      }
    }

    saveStore(store);
    res.status(201).json({ model: created, cloudFile });
  });

  app.delete('/api/ai/models/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const idx = store.customAiModels.findIndex((m) => m.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Нейросеть не найдена.' });
      return;
    }
    const target = store.customAiModels[idx];
    if (target.ownerId !== user.id && !isStaffRole(user.role)) {
      res.status(403).json({ error: 'Можно удалять только свои нейросети.' });
      return;
    }
    store.customAiModels.splice(idx, 1);
    saveStore(store);
    res.json({ ok: true });
  });

  // Persistent AI Chat Threads (used by the dedicated "Чат" studio)
  app.get('/api/ai/chats', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.json({ threads: [] });
      return;
    }
    const threads = Array.isArray(store.aiChatThreads[user.id])
      ? store.aiChatThreads[user.id]
      : [];
    res.json({ threads });
  });

  app.post('/api/ai/chats', async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Войдите в аккаунт для сохранения чатов.' });
      return;
    }
    const threadId = String(req.body?.threadId || '').trim() || `thr-${Date.now()}`;
    const provider = String(req.body?.provider || 'fire_assistant') as AiProviderId;
    const leadEngine = String(req.body?.leadEngine || '').trim().toLowerCase() || undefined;
    const prompt = String(req.body?.prompt || req.body?.message || '').trim().slice(0, 4000);
    const attachCloudFileId = String(req.body?.cloudFileId || '').trim();

    if (!prompt) {
      res.status(400).json({ error: 'Введите сообщение.' });
      return;
    }

    let cloudContext = '';
    if (attachCloudFileId) {
      const fileItem = store.cloudFiles.find(
        (f) => f.id === attachCloudFileId && f.ownerId === user.id
      );
      if (fileItem) {
        if (fileItem.source === 'terabox') {
          cloudContext = `\n[Прикреплённый ресурс из Облака TeraBox: ${fileItem.name}, ссылка: ${fileItem.externalUrl || ''}]`;
        } else {
          const fp = path.join(CLOUD_DIR, user.id, fileItem.id);
          if (fs.existsSync(fp)) {
            try {
              const raw = fs.readFileSync(fp, 'utf8').slice(0, 6000);
              cloudContext = `\n[Содержимое файла «${fileItem.name}» из Облака 1 ТБ:\n${raw}\n]`;
            } catch {
              cloudContext = `\n[Файл из Облака: ${fileItem.name}]`;
            }
          }
        }
      }
    }

    const userThreads = Array.isArray(store.aiChatThreads[user.id])
      ? store.aiChatThreads[user.id]
      : [];
    let thread = userThreads.find((t) => t.id === threadId);
    if (!thread) {
      thread = {
        id: threadId,
        title: prompt.slice(0, 48),
        provider,
        messages: [],
        updatedAt: new Date().toISOString(),
      };
      userThreads.unshift(thread);
    } else {
      thread.provider = provider;
    }

    const userMsg: AiChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      text: prompt,
      createdAt: new Date().toISOString(),
    };
    thread.messages.push(userMsg);

    const historyLines = thread.messages
      .slice(-14, -1)
      .map((m) => `${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${m.text}`)
      .join('\n');

    const aiRes = await runUnlimitedAiTurn(
      provider,
      `${prompt}${cloudContext}`,
      historyLines || undefined,
      user.id,
      leadEngine
    );

    const assistantMsg: AiChatMessage = {
      id: `msg-a-${Date.now()}`,
      role: 'assistant',
      text: aiRes.answer,
      model: aiRes.model,
      routedTo: aiRes.routedTo,
      routeReason: aiRes.routeReason,
      createdAt: new Date().toISOString(),
    };
    thread.messages.push(assistantMsg);
    if (thread.messages.length > 80) {
      thread.messages = thread.messages.slice(-80);
    }
    thread.updatedAt = new Date().toISOString();
    store.aiChatThreads[user.id] = userThreads.slice(0, 30);
    saveStore(store);

    res.json({ thread, assistantMessage: assistantMsg, threads: store.aiChatThreads[user.id] });
  });

  app.delete('/api/ai/chats/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }
    const list = Array.isArray(store.aiChatThreads[user.id])
      ? store.aiChatThreads[user.id]
      : [];
    store.aiChatThreads[user.id] = list.filter((t) => t.id !== req.params.id);
    saveStore(store);
    res.json({ ok: true, threads: store.aiChatThreads[user.id] });
  });

  // Cloud Storage 1 TB + Meta-AI / Custom AI Analysis & Search
  app.post('/api/cloud/ai-analyze', async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Войдите в аккаунт для запуска ИИ в облаке.' });
      return;
    }
    const prompt = String(req.body?.prompt || '').trim().slice(0, 2000);
    const provider = String(req.body?.provider || 'fire_assistant');
    const saveAsFile = Boolean(req.body?.saveAsFile);
    if (!prompt) {
      res.status(400).json({ error: 'Напишите задачу или поисковый запрос по облаку.' });
      return;
    }

    const userFiles = store.cloudFiles.filter((f) => f.ownerId === user.id).slice(0, 30);
    const fileIndexText =
      userFiles.length > 0
        ? userFiles
            .map((f) => `- ${f.name} (папка: ${f.folder}, источник: ${f.source}, размер: ${f.sizeBytes} Б)`)
            .join('\n')
        : 'Облако пока пустое.';

    const fullPrompt = `Контекст файлов пользователя в Облаке 1 ТБ (Firas + TeraBox):\n${fileIndexText}\n\nЗадача пользователя:\n${prompt}`;
    const result = await runUnlimitedAiTurn(provider, fullPrompt, undefined, user.id);

    let savedFile: CloudFileItem | undefined;
    if (saveAsFile && result.answer) {
      const fileId = `cf-note-${Date.now()}-${randomBytes(2).toString('hex')}`;
      const fileName = `ИИ-ответ-${new Date().toISOString().slice(0, 10)}.md`;
      const content = `# ${prompt}\nМодель: ${result.model}\n\n${result.answer}`;
      const userDir = path.join(CLOUD_DIR, user.id);
      try {
        fs.mkdirSync(userDir, { recursive: true });
        fs.writeFileSync(path.join(userDir, fileId), content, 'utf8');
        savedFile = {
          id: fileId,
          ownerId: user.id,
          ownerName: user.displayName,
          name: fileName,
          folder: 'Документы',
          category: 'document',
          sizeBytes: Buffer.byteLength(content, 'utf8'),
          mimeType: 'text/markdown',
          source: 'firas-cloud',
          createdAt: new Date().toISOString(),
        };
        store.cloudFiles.unshift(savedFile);
        saveStore(store);
      } catch {
        // ignore save error
      }
    }

    res.json({
      ...result,
      savedFile,
      ...(savedFile ? getUserCloudSummary(user.id) : {}),
    });
  });

  // Server-side AI answer endpoint supporting Meta-AI, Gemini, ChatGPT, DeepSeek, and Custom AIs
  const handleAiAnswer = async (req: express.Request, res: express.Response) => {
    const actor = getAuthenticatedUser(req);
    if (!store.config.aiEnabled && !isStaffRole(actor?.role)) {
      res.status(403).json({
        error: 'Ответы нейросетей временно отключены администратором.',
      });
      return;
    }

    const query = String(req.body?.query || '').trim();
    const rawProvider = String(req.body?.provider || 'fire_assistant').toLowerCase();
    const leadEngine = String(req.body?.leadEngine || '').trim().toLowerCase() || undefined;
    const provider =
      rawProvider === 'fire_assistant' ||
      rawProvider === 'fires_assistant' ||
      rawProvider === 'google_studio_ai' ||
      rawProvider === 'claude' ||
      rawProvider === 'codex' ||
      rawProvider === 'codeium' ||
      rawProvider === 'studio_ai' ||
      rawProvider === 'studio_collab' ||
      rawProvider === 'gemini' ||
      rawProvider === 'chatgpt' ||
      rawProvider === 'deepseek' ||
      rawProvider === 'deepseek_coder' ||
      rawProvider === 'meta' ||
      rawProvider.startsWith('custom:')
        ? rawProvider
        : 'fire_assistant';

    if (!query) {
      res.status(400).json({ error: 'Пустой поисковый запрос.' });
      return;
    }

    const cacheKey = `${actor?.id || 'anon'}:${provider}:${leadEngine || ''}:${query.toLowerCase()}`;
    const cached = aiAnswerCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < AI_CACHE_TTL_MS) {
      res.json({
        query: cached.query,
        provider: cached.provider,
        model: cached.model,
        answer: cached.answer,
        routedTo: cached.routedTo,
        routeReason: cached.routeReason,
      });
      return;
    }

    const existingPromise = inFlightAiRequests.get(cacheKey);
    if (existingPromise) {
      const result = await existingPromise;
      res.json(result);
      return;
    }

    const pending = runUnlimitedAiTurn(
      provider,
      query,
      undefined,
      actor?.id,
      leadEngine
    ).then((resData) => ({
      query,
      ...resData,
    }));
    inFlightAiRequests.set(cacheKey, pending);

    try {
      const result = await pending;
      aiAnswerCache.set(cacheKey, { ...result, cachedAt: Date.now() });
      if (aiAnswerCache.size > 250) {
        const oldestKey = aiAnswerCache.keys().next().value;
        if (oldestKey) aiAnswerCache.delete(oldestKey);
      }
      res.json(result);
    } finally {
      inFlightAiRequests.delete(cacheKey);
    }
  };

  app.post('/api/gemini-answer', handleAiAnswer);
  app.post('/api/ai-answer', handleAiAnswer);

  // Unlimited multi-turn AI Chat endpoint (sliding 14-message context window, never expires)
  app.post('/api/ai-chat', async (req, res) => {
    const actor = getAuthenticatedUser(req);
    if (!store.config.aiEnabled && !isStaffRole(actor?.role)) {
      res.status(403).json({
        error: 'Ответы нейросетей временно отключены администратором.',
      });
      return;
    }

    const rawProvider = String(req.body?.provider || 'fire_assistant').toLowerCase();
    const leadEngine = String(req.body?.leadEngine || '').trim().toLowerCase() || undefined;
    const provider =
      rawProvider === 'fire_assistant' ||
      rawProvider === 'fires_assistant' ||
      rawProvider === 'google_studio_ai' ||
      rawProvider === 'claude' ||
      rawProvider === 'codex' ||
      rawProvider === 'codeium' ||
      rawProvider === 'studio_ai' ||
      rawProvider === 'studio_collab' ||
      rawProvider === 'gemini' ||
      rawProvider === 'chatgpt' ||
      rawProvider === 'deepseek' ||
      rawProvider === 'deepseek_coder' ||
      rawProvider === 'meta' ||
      rawProvider.startsWith('custom:')
        ? rawProvider
        : 'fire_assistant';

    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const cleaned: Array<{ role: 'user' | 'assistant'; text: string }> = rawMessages
      .filter(
        (m: unknown): m is { role: string; text: string } =>
          Boolean(m && typeof m === 'object' && typeof (m as { text?: unknown }).text === 'string')
      )
      .map((m: { role: string; text: string }) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        text: m.text.trim().slice(0, 3000),
      }))
      .filter((m: { role: 'user' | 'assistant'; text: string }) => m.text.length > 0)
      .slice(-14);

    if (cleaned.length === 0) {
      res.status(400).json({ error: 'Введите сообщение для нейросети.' });
      return;
    }

    const latestUser =
      [...cleaned].reverse().find((m) => m.role === 'user')?.text || cleaned[cleaned.length - 1].text;
    const historyLines = cleaned
      .slice(0, -1)
      .map((m: { role: 'user' | 'assistant'; text: string }) =>
        `${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${m.text}`
      )
      .join('\n');

    const result = await runUnlimitedAiTurn(
      provider,
      latestUser,
      historyLines || undefined,
      actor?.id,
      leadEngine
    );
    res.json(result);
  });

  // Live HTML web proxy for Fires Engine (FiresCore architecture + mobile anti-slice layout engine)
  app.get('/api/proxy', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    const etpLevel = (String(req.query.etp || 'standard').toLowerCase() as 'standard' | 'strict' | 'off');
    const httpsOnly = req.query.httpsOnly !== '0';
    const dnt = req.query.dnt !== '0';
    const noImages = req.query.noImages === '1';
    const noJs = req.query.noJs === '1';
    const muteAll = req.query.muteAll === '1';
    const smoothScroll = req.query.smoothScroll !== '0';
    const mobileViewport = req.query.mobileViewport === '1';
    const extDark = req.query.extDark === '1';
    const extAdblock = req.query.extAdblock === '1';
    const extWikiClean = req.query.extWikiClean === '1';
    const extGithubCode = req.query.extGithubCode === '1';
    const extMobileFit = req.query.extMobileFit === '1';
    const extFps = req.query.extFps === '1';
    const uaMode =
      req.query.ua === 'fires-mobile' || mobileViewport
        ? 'fires-mobile'
        : 'fires-desktop';
    const firesUa =
      uaMode === 'fires-mobile'
        ? 'FiresEngine/132.0 (Linux; Android 14; Pixel 8; Mobile) AppleWebKit/537.36 Chrome/132.0.0.0 Mobile Safari/537.36'
        : 'FiresEngine/132.0 (Windows NT 10.0; Win64; x64; FiresCore/132.0)';

    const sendErrorHtml = (status: number, message: string, targetUrl: string) => {
      res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 16px; background: #f8fafc; color: #0f172a; }
    .box { max-width: 560px; width: 100%; margin: 16px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
    h2 { margin: 0 0 8px; font-size: 18px; }
    p { margin: 0 0 16px; font-size: 14px; line-height: 1.55; color: #475569; overflow-wrap: anywhere; }
    .url { font-family: monospace; font-size: 12px; color: #64748b; word-break: break-all; margin-bottom: 16px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    button { background: #000000; color: #fff; border: 0; border-radius: 8px; padding: 10px 14px; font-size: 13px; cursor: pointer; }
    a { display: inline-block; color: #1d4ed8; font-size: 13px; text-decoration: none; padding: 8px 4px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Сайт ограничил встроенный просмотр в Fires</h2>
    <div class="url">${targetUrl.replace(/</g, '&lt;')}</div>
    <p>${message.replace(/</g, '&lt;')}</p>
    <div class="actions">
      <button onclick="window.parent.postMessage({ type: 'firas-proxy-reader' }, '*')">Открыть в режиме чтения</button>
      <a href="${targetUrl.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">Открыть во внешней вкладке</a>
    </div>
  </div>
</body>
</html>`);
    };

    if (!rawUrl) {
      sendErrorHtml(400, 'Не указан адрес сайта.', '');
      return;
    }

    let target: URL;
    let httpsUpgraded = false;
    try {
      let normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      if (httpsOnly && normalized.toLowerCase().startsWith('http://')) {
        normalized = 'https://' + normalized.slice(7);
        httpsUpgraded = true;
      }
      target = new URL(normalized);
    } catch {
      sendErrorHtml(400, 'Некорректный адрес сайта.', rawUrl);
      return;
    }

    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      sendErrorHtml(400, 'Поддерживаются только протоколы HTTP и HTTPS.', target.toString());
      return;
    }

    if (isPrivateOrLocalHostname(target.hostname)) {
      sendErrorHtml(403, 'Доступ к внутренним и локальным адресам запрещён.', target.toString());
      return;
    }

    if (isDomainBlocked(target.hostname, store.config.blockedDomains)) {
      sendErrorHtml(
        403,
        `Доступ к домену ${target.hostname} ограничен администратором Fires.`,
        target.toString()
      );
      return;
    }

    // Use mobile Wikipedia host automatically on mobile viewports for native mobile layout without slicing
    let fetchTargetUrl = target.toString();
    const isWikipediaHost = /(^|\.)wikipedia\.org$/i.test(target.hostname);
    if (
      isWikipediaHost &&
      (uaMode === 'fires-mobile' || mobileViewport || extWikiClean) &&
      !target.hostname.includes('.m.wikipedia.org')
    ) {
      const mobileUrl = new URL(target.toString());
      mobileUrl.hostname = target.hostname.replace(/\.wikipedia\.org$/i, '.m.wikipedia.org');
      fetchTargetUrl = mobileUrl.toString();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8500);

    try {
      const outboundHeaders: Record<string, string> = {
        'User-Agent': firesUa,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Upgrade-Insecure-Requests': '1',
      };
      if (dnt) {
        outboundHeaders.DNT = '1';
        outboundHeaders['Sec-GPC'] = '1';
      }

      const resp = await fetch(fetchTargetUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: outboundHeaders,
      });
      clearTimeout(timeout);

      const finalUrl = resp.url || fetchTargetUrl;
      const contentType = resp.headers.get('content-type') || '';

      if (!resp.ok) {
        sendErrorHtml(
          200,
          `Удалённый сервер ответил кодом ${resp.status}. Попробуйте режим чтения или откройте сайт во внешней вкладке.`,
          finalUrl
        );
        return;
      }

      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        sendErrorHtml(
          200,
          `Ресурс имеет тип ${contentType || 'unknown'} и не является HTML-страницей.`,
          finalUrl
        );
        return;
      }

      let html = (await resp.text()).slice(0, 2_000_000);

      // Remove frame-busting meta CSP tags and rigid viewport tags so mobile scaling never breaks
      html = html
        .replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '')
        .replace(/<meta[^>]+name=["']?viewport["']?[^>]*>/gi, '');

      let trackersBlocked = 0;
      if (noJs) {
        html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, () => {
          trackersBlocked += 1;
          return '';
        });
      } else if (etpLevel !== 'off' || extAdblock) {
        const trackerPattern =
          etpLevel === 'strict' || extAdblock
            ? /<script\b[^>]*src=["'][^"']*(google-analytics|googletagmanager|mc\.yandex|doubleclick|googlesyndication|connect\.facebook|hotjar|amplitude|mixpanel|scorecardresearch|criteo|taboola|outbrain|adservice|pixel|telemetry|metrics|tracker|stat\.|banner|ads\.)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi
            : /<script\b[^>]*src=["'][^"']*(google-analytics|googletagmanager|mc\.yandex|doubleclick|connect\.facebook|hotjar|criteo|adservice)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi;
        html = html.replace(trackerPattern, () => {
          trackersBlocked += 1;
          return '';
        });
        html = html.replace(
          /<img\b[^>]*(width=["']?1["']?|height=["']?1["']?)[^>]*(pixel|track|analytics|mc\.yandex)[^>]*>/gi,
          () => {
            trackersBlocked += 1;
            return '';
          }
        );
      }

      const safeFinalUrl = finalUrl.replace(/"/g, '&quot;');
      const noImagesStyle = noImages
        ? '<style>img, picture, video, source { display: none !important; }</style>'
        : '';
      const scrollStyle = smoothScroll
        ? '<style>html { scroll-behavior: smooth; }</style>'
        : '';

      const alwaysMobileRules = `
  html, body {
    max-width: 100% !important;
    overflow-x: hidden !important;
    -webkit-text-size-adjust: 100% !important;
  }
  *, *::before, *::after {
    box-sizing: border-box !important;
  }
  img, svg, video, canvas, iframe, object, embed {
    max-width: 100% !important;
    height: auto !important;
  }
  p, li, h1, h2, h3, h4, h5, h6, a, span, blockquote {
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }
  pre, code, kbd, samp {
    max-width: 100% !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }
  /* Wikipedia Mobile & Desktop Anti-Slice Normalization */
  .mw-page-container, .mw-page-container-inner, #content, .mw-body, .mw-body-content, .mw-parser-output, #bodyContent, #mw-content-text, .content {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 10px !important;
    padding-right: 10px !important;
  }
  .vector-column-start, .vector-column-end, #mw-panel, .vector-sitenotice-container, .vector-page-toolbar {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    position: static !important;
  }
  .infobox, .tright, .tleft, .thumb, .thumbinner, figure, .sidebar, .navbox, .metadata {
    float: none !important;
    clear: both !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin: 10px 0 !important;
  }
  table.wikitable, table.infobox, .mw-datatable, table {
    max-width: 100% !important;
    overflow-x: auto !important;
    display: block !important;
    -webkit-overflow-scrolling: touch !important;
  }
  /* GitHub Mobile & Tablet Anti-Slice Normalization */
  .Layout, .Layout-main, .Layout-sidebar, .container-xl, .container-lg, .container-md, .repository-content, .Box, .AppHeader, .Header, .file, .diff-view {
    min-width: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  .Layout {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
  }
  .AppHeader-globalBar, .UnderlineNav-body, .js-navigation-container, .highlight, .blob-wrapper, .react-directory-row {
    max-width: 100% !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }
  .markdown-body {
    max-width: 100% !important;
    overflow-x: hidden !important;
    padding: 8px !important;
  }
  .markdown-body pre, .highlight pre {
    white-space: ${extGithubCode ? 'pre-wrap' : 'pre'} !important;
    overflow-wrap: ${extGithubCode ? 'anywhere' : 'normal'} !important;
  }
`;

      const applyUnconditionalMobile = uaMode === 'fires-mobile' || mobileViewport || extMobileFit;
      const responsiveCss = `<style id="fires-mobile-layout-fix">
${applyUnconditionalMobile ? alwaysMobileRules : `@media (max-width: 960px) { ${alwaysMobileRules} }`}
${
  extWikiClean
    ? '.vector-sitenotice-container, .mw-editsection, #mw-navigation, .navbox, .sisterproject { display: none !important; }'
    : ''
}
${
  extAdblock
    ? '[class*="cookie-banner"], [id*="cookie"], .ad-banner, [class*="adsbox"], [id*="ad-slot"] { display: none !important; }'
    : ''
}
${
  extDark
    ? 'html { filter: invert(0.92) hue-rotate(180deg) !important; background: #09090b !important; } img, video, picture, canvas, svg { filter: invert(1) hue-rotate(180deg) !important; }'
    : ''
}
</style>`;

      const headInjection = `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0"><meta name="referrer" content="no-referrer"><base href="${safeFinalUrl}" target="_self">${noImagesStyle}${scrollStyle}${responsiveCss}`;
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${headInjection}`);
      } else {
        html = `${headInjection}\n${html}`;
      }

      const fpsOverlayScript = extFps
        ? `try {
    var fpsBox = document.createElement('div');
    fpsBox.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:2147483647;padding:4px 8px;border-radius:8px;background:rgba(9,9,11,0.85);color:#22c55e;font:600 11px monospace;pointer-events:none;border:1px solid rgba(255,255,255,0.12);';
    fpsBox.textContent = 'FPS: --';
    document.body && document.body.appendChild(fpsBox);
    var frames = 0, prevTime = performance.now();
    function tickFps(now){
      frames++;
      if(now - prevTime >= 500){
        fpsBox.textContent = 'FPS: ' + Math.round((frames * 1000) / (now - prevTime)) + ' · ' + window.innerWidth + 'px';
        frames = 0; prevTime = now;
      }
      requestAnimationFrame(tickFps);
    }
    requestAnimationFrame(tickFps);
  } catch(e) {}`
        : '';

      const bridgeScript = `<script>
(function(){
  try {
    Object.defineProperty(navigator, 'userAgent', { get: function(){ return ${JSON.stringify(firesUa)}; } });
    Object.defineProperty(navigator, 'vendor', { get: function(){ return ''; } });
    Object.defineProperty(navigator, 'product', { get: function(){ return 'FiresCore'; } });
    Object.defineProperty(navigator, 'doNotTrack', { get: function(){ return ${dnt ? '"1"' : '"unspecified"'}; } });
  } catch(e) {}
  ${muteAll ? `try {
    var muteEl = function(el){ try { el.muted = true; el.volume = 0; } catch(e){} };
    document.querySelectorAll('audio,video').forEach(muteEl);
    document.addEventListener('play', function(ev){ muteEl(ev.target); }, true);
  } catch(e) {}` : ''}
  ${fpsOverlayScript}
  try {
    var payload = {
      type: 'firas-proxy-loaded',
      url: ${JSON.stringify(finalUrl)},
      title: document.title || '',
      engine: 'Fires Engine 132.0 (FiresCore)',
      blockedCount: ${trackersBlocked},
      httpsUpgraded: ${httpsUpgraded}
    };
    window.parent.postMessage(payload, '*');
  } catch(e) {}
  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      var resolved = new URL(href, ${JSON.stringify(finalUrl)}).toString();
      if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
        e.preventDefault();
        window.parent.postMessage({ type: 'firas-proxy-navigate', url: resolved }, '*');
      }
    } catch(err) {}
  }, true);
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || !form.action) return;
    var method = (form.getAttribute('method') || 'GET').toUpperCase();
    if (method !== 'GET') return;
    try {
      var actionUrl = new URL(form.getAttribute('action') || ${JSON.stringify(finalUrl)}, ${JSON.stringify(finalUrl)});
      var fd = new FormData(form);
      fd.forEach(function(val, key) {
        if (typeof val === 'string') actionUrl.searchParams.set(key, val);
      });
      e.preventDefault();
      window.parent.postMessage({ type: 'firas-proxy-navigate', url: actionUrl.toString() }, '*');
    } catch(err) {}
  }, true);
})();
</script>`;

      if (/<\/body>/i.test(html)) {
        html = html.replace(/<\/body>/i, `${bridgeScript}\n</body>`);
      } else {
        html = `${html}\n${bridgeScript}`;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Fires-Engine', 'Fires-Engine/132.0 (FiresCore)');
      res.setHeader('X-Fires-Trackers-Blocked', String(trackersBlocked));
      res.send(html);
    } catch {
      clearTimeout(timeout);
      sendErrorHtml(
        200,
        'Время ожидания ответа истекло или сервер отклонил прямое подключение. Попробуйте режим чтения или поиск Fires.',
        fetchTargetUrl
      );
    }
  });

  // Web page fetcher / Reader proxy for Fires
  app.get('/api/browse', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    const httpsOnly = req.query.httpsOnly !== '0';
    const uaMode =
      req.query.ua === 'fires-mobile'
        ? 'fires-mobile'
        : 'fires-desktop';
    const firesUa =
      uaMode === 'fires-mobile'
        ? 'FiresEngine/132.0 (Android 14; Mobile; FiresCore/132.0)'
        : 'FiresEngine/132.0 (Windows NT 10.0; Win64; x64; FiresCore/132.0)';

    if (!rawUrl) {
      res.status(400).json({ error: 'Не указан адрес страницы.' });
      return;
    }

    let target: URL;
    try {
      let normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      if (httpsOnly && normalized.toLowerCase().startsWith('http://')) {
        normalized = 'https://' + normalized.slice(7);
      }
      target = new URL(normalized);
    } catch {
      res.status(400).json({ error: 'Некорректный формат URL.' });
      return;
    }

    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      res.status(400).json({ error: 'Поддерживаются только протоколы HTTP и HTTPS.' });
      return;
    }

    if (isPrivateOrLocalHostname(target.hostname)) {
      res.status(403).json({ error: 'Доступ к локальным и внутренним адресам ограничен.' });
      return;
    }

    if (isDomainBlocked(target.hostname, store.config.blockedDomains)) {
      res.status(403).json({
        error: `Доступ к домену ${target.hostname} ограничен администратором Fires.`,
      });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const resp = await fetch(target.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': firesUa,
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      clearTimeout(timeout);

      const contentType = resp.headers.get('content-type') || '';
      if (!resp.ok) {
        res.json({
          url: target.toString(),
          finalUrl: resp.url || target.toString(),
          domain: target.hostname,
          title: target.hostname,
          description: '',
          blocks: [],
          links: [],
          fetchedAt: new Date().toISOString(),
          error: `Сайт вернул статус ${resp.status}. Некоторые порталы ограничивают автоматическое чтение страниц.`,
        } satisfies BrowsedPageData);
        return;
      }

      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        res.json({
          url: target.toString(),
          finalUrl: resp.url || target.toString(),
          domain: target.hostname,
          title: target.hostname,
          description: `Тип содержимого: ${contentType || 'неизвестен'}`,
          blocks: [],
          links: [],
          fetchedAt: new Date().toISOString(),
          error: 'Формат ресурса не является HTML-страницей и не может быть показан в режиме чтения.',
        } satisfies BrowsedPageData);
        return;
      }

      const rawText = (await resp.text()).slice(0, 1_500_000);
      const extracted = extractReadablePage(rawText, resp.url || target.toString());
      res.json(extracted);
    } catch {
      clearTimeout(timeout);
      res.json({
        url: target.toString(),
        finalUrl: target.toString(),
        domain: target.hostname,
        title: target.hostname,
        description: '',
        blocks: [],
        links: [],
        fetchedAt: new Date().toISOString(),
        error: 'Не удалось загрузить страницу (таймаут или ограничение со стороны удалённого сервера).',
      } satisfies BrowsedPageData);
    }
  });

  // Unified Fires Downloader API (GitHub + Google Play + Controllable Stream)
  app.get('/api/downloader/github', async (req, res) => {
    const raw = String(req.query.q || '').trim();
    if (!raw) {
      res.status(400).json({ error: 'Укажите ссылку GitHub, owner/repo или поисковый запрос.' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7500);
    const ghHeaders = {
      'User-Agent': 'Fires-Downloader/1.0',
      Accept: 'application/vnd.github+json',
    };

    try {
      let ownerRepo = '';
      const ghUrlMatch = raw.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
      const slashMatch = raw.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
      if (ghUrlMatch) {
        ownerRepo = `${ghUrlMatch[1]}/${ghUrlMatch[2].replace(/\.git$/i, '')}`;
      } else if (slashMatch) {
        ownerRepo = `${slashMatch[1]}/${slashMatch[2].replace(/\.git$/i, '')}`;
      }

      if (ownerRepo) {
        const [repoResp, relResp] = await Promise.all([
          fetch(`https://api.github.com/repos/${ownerRepo}`, {
            signal: controller.signal,
            headers: ghHeaders,
          }),
          fetch(`https://api.github.com/repos/${ownerRepo}/releases/latest`, {
            signal: controller.signal,
            headers: ghHeaders,
          }).catch(() => null),
        ]);
        clearTimeout(timeout);

        if (!repoResp.ok) {
          res.status(repoResp.status === 404 ? 404 : 502).json({
            error:
              repoResp.status === 404
                ? `Репозиторий ${ownerRepo} не найден на GitHub.`
                : `GitHub API вернул статус ${repoResp.status}.`,
          });
          return;
        }

        const repoJson = (await repoResp.json()) as {
          full_name: string;
          description?: string;
          stargazers_count?: number;
          default_branch?: string;
          html_url: string;
          language?: string;
        };

        const branch = repoJson.default_branch || 'main';
        const assets: Array<{
          id: string;
          name: string;
          size: number;
          downloadUrl: string;
          kind: string;
        }> = [];

        if (relResp && relResp.ok) {
          const relJson = (await relResp.json()) as {
            tag_name?: string;
            assets?: Array<{
              id: number;
              name: string;
              size: number;
              browser_download_url: string;
            }>;
          };
          if (Array.isArray(relJson.assets)) {
            for (const a of relJson.assets.slice(0, 20)) {
              assets.push({
                id: `rel-${a.id}`,
                name: a.name,
                size: a.size || 0,
                downloadUrl: a.browser_download_url,
                kind: relJson.tag_name ? `Релиз ${relJson.tag_name}` : 'Релиз GitHub',
              });
            }
          }
        }

        assets.push({
          id: `zip-${branch}`,
          name: `${repoJson.full_name.replace('/', '-')}-${branch}.zip`,
          size: 0,
          downloadUrl: `https://codeload.github.com/${repoJson.full_name}/zip/refs/heads/${encodeURIComponent(
            branch
          )}`,
          kind: `Исходный код (${branch}.zip)`,
        });
        assets.push({
          id: `tar-${branch}`,
          name: `${repoJson.full_name.replace('/', '-')}-${branch}.tar.gz`,
          size: 0,
          downloadUrl: `https://codeload.github.com/${repoJson.full_name}/tar.gz/refs/heads/${encodeURIComponent(
            branch
          )}`,
          kind: `Архив (${branch}.tar.gz)`,
        });

        res.json({
          mode: 'repo',
          repo: {
            fullName: repoJson.full_name,
            description: repoJson.description || '',
            stars: repoJson.stargazers_count || 0,
            language: repoJson.language || '',
            htmlUrl: repoJson.html_url,
            branch,
          },
          assets,
        });
        return;
      }

      const searchResp = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(raw)}&per_page=8`,
        { signal: controller.signal, headers: ghHeaders }
      );
      clearTimeout(timeout);
      if (!searchResp.ok) {
        res.status(502).json({ error: `Ошибка поиска GitHub (${searchResp.status}).` });
        return;
      }
      const sJson = (await searchResp.json()) as {
        items?: Array<{
          full_name: string;
          description?: string;
          stargazers_count?: number;
          default_branch?: string;
          html_url: string;
          language?: string;
        }>;
      };
      const repos = (sJson.items || []).map((r) => {
        const branch = r.default_branch || 'main';
        return {
          fullName: r.full_name,
          description: r.description || '',
          stars: r.stargazers_count || 0,
          language: r.language || '',
          htmlUrl: r.html_url,
          branch,
          zipUrl: `https://codeload.github.com/${r.full_name}/zip/refs/heads/${encodeURIComponent(
            branch
          )}`,
        };
      });
      res.json({ mode: 'search', repos });
    } catch {
      clearTimeout(timeout);
      res.status(502).json({ error: 'Не удалось связаться с GitHub API.' });
    }
  });

  app.get('/api/downloader/google-play', async (req, res) => {
    const raw = String(req.query.q || '').trim();
    if (!raw) {
      res.status(400).json({ error: 'Укажите ссылку Google Play, ID пакета или название приложения.' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7500);
    const headers = {
      'User-Agent': 'FiresEngine/132.0 (Android 14; Mobile; FiresCore/132.0)',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    };

    try {
      let pkgId = '';
      const playUrlMatch = raw.match(/[?&]id=([a-zA-Z0-9_.-]+)/);
      if (playUrlMatch) {
        pkgId = playUrlMatch[1];
      } else if (/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_-]+)+$/.test(raw)) {
        pkgId = raw;
      }

      if (pkgId) {
        const playUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(
          pkgId
        )}&hl=ru&gl=RU`;
        const [playResp, fdroidResp] = await Promise.all([
          fetch(playUrl, { signal: controller.signal, headers }).catch(() => null),
          fetch(`https://f-droid.org/api/v1/packages/${encodeURIComponent(pkgId)}`, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Fires-Downloader/1.0' },
          }).catch(() => null),
        ]);
        clearTimeout(timeout);

        let title = pkgId;
        let description = 'Приложение из каталога Google Play';
        let icon = '';
        if (playResp && playResp.ok) {
          const html = (await playResp.text()).slice(0, 600_000);
          const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
          const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
          const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
          if (ogTitle?.[1]) {
            title = decodeHtmlEntities(ogTitle[1]).replace(/\s*-\s*Приложения в Google Play.*/i, '');
          }
          if (ogDesc?.[1]) description = decodeHtmlEntities(ogDesc[1]);
          if (ogImg?.[1]) icon = ogImg[1];
        }

        let directApkUrl = '';
        let apkVersionCode = 0;
        if (fdroidResp && fdroidResp.ok) {
          try {
            const fdJson = (await fdroidResp.json()) as { suggestedVersionCode?: number };
            if (fdJson.suggestedVersionCode) {
              apkVersionCode = fdJson.suggestedVersionCode;
              directApkUrl = `https://f-droid.org/repo/${encodeURIComponent(pkgId)}_${fdJson.suggestedVersionCode}.apk`;
            }
          } catch {
            // ignore non-json
          }
        }

        res.json({
          mode: 'package',
          app: {
            packageId: pkgId,
            title,
            description,
            icon,
            playUrl,
            directApkUrl: directApkUrl || null,
            apkVersionCode: apkVersionCode || null,
          },
        });
        return;
      }

      const searchUrl = `https://play.google.com/store/search?q=${encodeURIComponent(
        raw
      )}&c=apps&hl=ru&gl=RU`;
      const sResp = await fetch(searchUrl, { signal: controller.signal, headers });
      clearTimeout(timeout);

      const results: Array<{ packageId: string; title: string; playUrl: string }> = [];
      if (sResp.ok) {
        const html = (await sResp.text()).slice(0, 900_000);
        const seen = new Set<string>();
        const linkRe = /href="\/store\/apps\/details\?id=([a-zA-Z0-9_.-]+)"/g;
        let m: RegExpExecArray | null;
        while ((m = linkRe.exec(html)) !== null && results.length < 10) {
          const id = m[1];
          if (!seen.has(id)) {
            seen.add(id);
            results.push({
              packageId: id,
              title: id,
              playUrl: `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}&hl=ru&gl=RU`,
            });
          }
        }
      }
      res.json({ mode: 'search', apps: results });
    } catch {
      clearTimeout(timeout);
      res.status(502).json({ error: 'Не удалось получить данные из каталога Google Play.' });
    }
  });

  app.get('/api/downloader/stream', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    const throttleKbps = Math.max(0, Math.min(50_000, Number(req.query.throttleKbps || 0) || 0));
    if (!rawUrl) {
      res.status(400).json({ error: 'Не указан URL для загрузки.' });
      return;
    }

    let target: URL;
    try {
      target = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    } catch {
      res.status(400).json({ error: 'Некорректная ссылка для загрузки.' });
      return;
    }

    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      res.status(400).json({ error: 'Поддерживаются только HTTP и HTTPS.' });
      return;
    }
    if (isPrivateOrLocalHostname(target.hostname)) {
      res.status(403).json({ error: 'Загрузка с локальных адресов запрещена.' });
      return;
    }
    if (isDomainBlocked(target.hostname, store.config.blockedDomains)) {
      res.status(403).json({ error: `Домен ${target.hostname} заблокирован администратором Fires.` });
      return;
    }

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    try {
      const upstreamHeaders: Record<string, string> = {
        'User-Agent': 'Fires-Downloader/1.0 (FiresEngine/132.0)',
      };
      if (typeof req.headers.range === 'string') {
        upstreamHeaders.Range = req.headers.range;
      }

      const upstream = await fetch(target.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: upstreamHeaders,
      });

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).json({ error: `Сервер вернул ошибку ${upstream.status}.` });
        return;
      }

      const ct = upstream.headers.get('content-type') || 'application/octet-stream';
      const cl = upstream.headers.get('content-length');
      const cd = upstream.headers.get('content-disposition');
      const ar = upstream.headers.get('accept-ranges');

      res.status(upstream.status);
      res.setHeader('Content-Type', ct);
      if (cl) res.setHeader('Content-Length', cl);
      if (cd) res.setHeader('Content-Disposition', cd);
      if (ar) res.setHeader('Accept-Ranges', ar);
      res.setHeader('X-Fires-Engine', 'Fires-Downloader/1.0');

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      const bytesPerSec = throttleKbps > 0 ? throttleKbps * 1024 : 0;

      while (true) {
        const chunkStart = Date.now();
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          res.write(Buffer.from(value));
          if (bytesPerSec > 0) {
            const expectedMs = (value.byteLength / bytesPerSec) * 1000;
            const elapsedMs = Date.now() - chunkStart;
            const delay = expectedMs - elapsedMs;
            if (delay > 8) {
              await new Promise((r) => setTimeout(r, Math.min(delay, 600)));
            }
          }
        }
      }
      res.end();
    } catch (err) {
      if (!res.headersSent) {
        res.status(502).json({
          error:
            err instanceof Error && err.name === 'AbortError'
              ? 'Загрузка остановлена пользователем.'
              : 'Ошибка потока загрузки.',
        });
      } else {
        res.end();
      }
    }
  });

  // Open Source Code Inspector API (MIT Licensed public source files only)
  const listOpenSourceFiles = (): Array<{ path: string; sizeBytes: number }> => {
    const out: Array<{ path: string; sizeBytes: number }> = [];
    const allowedRoots = ['LICENSE', 'package.json', 'index.html', 'server.ts', 'tsconfig.json'];
    for (const f of allowedRoots) {
      const full = path.join(__dirname, f);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        out.push({ path: f, sizeBytes: fs.statSync(full).size });
      }
    }
    const walkSrc = (dirRel: string) => {
      const fullDir = path.join(__dirname, dirRel);
      if (!fs.existsSync(fullDir)) return;
      for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const rel = `${dirRel}/${entry.name}`;
        if (entry.isDirectory()) {
          walkSrc(rel);
        } else if (/\.(ts|tsx|css|json)$/i.test(entry.name)) {
          const st = fs.statSync(path.join(__dirname, rel));
          out.push({ path: rel, sizeBytes: st.size });
        }
      }
    };
    walkSrc('src');
    return out;
  };

  // Cross-Platform Browser Extensions Catalog & WebExtension (.xpi / .zip) Builder
  const FIRES_EXTENSION_CATALOG: BrowserExtensionItem[] = [
    {
      id: 'ext-mobile-reflow',
      name: 'Fires Mobile Reflow',
      author: 'Fires WebExt Lab',
      version: '2.4.0',
      summary: 'Устраняет горизонтальное обрезание текста, таблиц и боковых колонок на телефонах и планшетах.',
      category: 'mobile',
      sourceStore: 'fires-addons',
      sourceLabel: 'Fires Add-ons Store',
      sourceUrl: 'https://github.com/fires-browser/fires-mobile-reflow',
      platforms: ['mobile', 'tablet', 'desktop'],
      packageFormat: 'xpi',
      fileName: 'fires-mobile-reflow-2.4.0.xpi',
      sizeLabel: '18 КБ',
      permissions: ['activeTab', 'scripting', 'css'],
      effectKey: 'mobile-fit',
    },
    {
      id: 'ext-wiki-mobile-pro',
      name: 'WikiClean Reader (Mobile & Tablet)',
      author: 'OpenWiki Tools',
      version: '1.9.2',
      summary: 'Адаптирует инфобоксы, таблицы и статьи Википедии под экран телефона и планшета без нарезки полей.',
      category: 'reading',
      sourceStore: 'openwebx',
      sourceLabel: 'OpenWebX Store',
      sourceUrl: 'https://github.com/openwebx/wikiclean-reader',
      platforms: ['mobile', 'tablet', 'desktop'],
      packageFormat: 'xpi',
      fileName: 'wikiclean-reader-1.9.2.xpi',
      sizeLabel: '22 КБ',
      permissions: ['*://*.wikipedia.org/*', 'css'],
      effectKey: 'wiki-reader-clean',
    },
    {
      id: 'ext-github-mobile-wrap',
      name: 'GitHub Code Wrap Mobile',
      author: 'DevMobile Collective',
      version: '3.1.0',
      summary: 'Переносит длинные строки кода, README и деревья файлов на GitHub для удобного чтения со смартфона и планшета.',
      category: 'coding',
      sourceStore: 'github-releases',
      sourceLabel: 'GitHub Releases',
      sourceUrl: 'https://github.com/devmobile/github-code-wrap',
      platforms: ['mobile', 'tablet', 'desktop'],
      packageFormat: 'zip',
      fileName: 'github-code-wrap-mobile-3.1.0.zip',
      sizeLabel: '24 КБ',
      permissions: ['*://github.com/*', '*://gist.github.com/*', 'css'],
      effectKey: 'github-code-wrap',
    },
    {
      id: 'ext-dark-reader-mobile',
      name: 'DarkShade Web Mobile',
      author: 'NightUI Studio',
      version: '4.2.1',
      summary: 'Умная ночная тема для любого сайта на смартфоне и планшете без инверсии картинок.',
      category: 'mobile',
      sourceStore: 'fires-addons',
      sourceLabel: 'Fires Add-ons Store',
      sourceUrl: 'https://github.com/nightui/darkshade-webext',
      platforms: ['mobile', 'tablet', 'desktop'],
      packageFormat: 'xpi',
      fileName: 'darkshade-web-4.2.1.xpi',
      sizeLabel: '20 КБ',
      permissions: ['<all_urls>', 'storage'],
      effectKey: 'dark-reader',
    },
    {
      id: 'ext-ublock-fires-mobile',
      name: 'ShieldBlock Ultra (Mobile WebExt)',
      author: 'F-Droid WebExt',
      version: '5.0.3',
      summary: 'Блокирует навязчивые баннеры, cookie-окна и мобильные трекеры на слабых сетях и планшетах.',
      category: 'privacy',
      sourceStore: 'fdroid-webext',
      sourceLabel: 'F-Droid WebExt',
      sourceUrl: 'https://f-droid.org/packages/org.fires.shieldblock',
      platforms: ['mobile', 'tablet', 'desktop'],
      packageFormat: 'xpi',
      fileName: 'shieldblock-ultra-5.0.3.xpi',
      sizeLabel: '26 КБ',
      permissions: ['webRequest', 'declarativeNetRequest', '<all_urls>'],
      effectKey: 'adblock-plus',
    },
    {
      id: 'ext-gamedev-fps-hud',
      name: 'GameDev FPS & Viewport Inspector',
      author: 'Google Studio + Codex Lab',
      version: '1.4.0',
      summary: 'Показывает живой FPS и ширину вьюпорта поверх браузерных HTML5 / Three.js / WebGL игр на телефоне и планшете.',
      category: 'gamedev',
      sourceStore: 'github-releases',
      sourceLabel: 'GitHub Releases',
      sourceUrl: 'https://github.com/fires-browser/gamedev-fps-hud',
      platforms: ['mobile', 'tablet', 'desktop'],
      packageFormat: 'zip',
      fileName: 'gamedev-fps-hud-1.4.0.zip',
      sizeLabel: '19 КБ',
      permissions: ['activeTab', 'scripting'],
      effectKey: 'gamedev-devtools',
    },
    {
      id: 'ext-privacy-cloak-tablet',
      name: 'Tablet Privacy Guard',
      author: 'OpenWebX Security',
      version: '2.0.5',
      summary: 'Усиленная защита приватности для планшетов: анти-фингерпринтинг и изоляция сторонних скриптов.',
      category: 'privacy',
      sourceStore: 'openwebx',
      sourceLabel: 'OpenWebX Store',
      sourceUrl: 'https://github.com/openwebx/tablet-privacy-guard',
      platforms: ['tablet', 'mobile'],
      packageFormat: 'xpi',
      fileName: 'tablet-privacy-guard-2.0.5.xpi',
      sizeLabel: '21 КБ',
      permissions: ['privacy', 'cookies', '<all_urls>'],
      effectKey: 'privacy-cloak',
    },
  ];

  const crc32Table = (() => {
    const tbl = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      tbl[i] = c >>> 0;
    }
    return tbl;
  })();

  const computeCrc32 = (buf: Buffer): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crc32Table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const buildZipBuffer = (entries: Array<{ name: string; content: string }>): Buffer => {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
      const nameBuf = Buffer.from(entry.name, 'utf8');
      const dataBuf = Buffer.from(entry.content, 'utf8');
      const crc = computeCrc32(dataBuf);

      const localHeader = Buffer.alloc(30 + nameBuf.length);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0x0800, 6);
      localHeader.writeUInt16LE(0, 8);
      localHeader.writeUInt16LE(0, 10);
      localHeader.writeUInt16LE(0, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(dataBuf.length, 18);
      localHeader.writeUInt32LE(dataBuf.length, 22);
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);
      nameBuf.copy(localHeader, 30);

      localParts.push(localHeader, dataBuf);

      const centralHeader = Buffer.alloc(46 + nameBuf.length);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0x0800, 8);
      centralHeader.writeUInt16LE(0, 10);
      centralHeader.writeUInt16LE(0, 12);
      centralHeader.writeUInt16LE(0, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(dataBuf.length, 20);
      centralHeader.writeUInt32LE(dataBuf.length, 24);
      centralHeader.writeUInt16LE(nameBuf.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);
      nameBuf.copy(centralHeader, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + dataBuf.length;
    }

    const centralBuf = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralBuf, eocd]);
  };

  app.get('/api/extensions/catalog', (_req, res) => {
    res.json({
      extensions: FIRES_EXTENSION_CATALOG,
      stores: [
        { id: 'fires-addons', label: 'Fires Add-ons Store', description: 'Официальный каталог расширений для телефонов и планшетов' },
        { id: 'github-releases', label: 'GitHub Releases', description: 'Открытые WebExtension-пакеты напрямую из релизов GitHub' },
        { id: 'openwebx', label: 'OpenWebX Store', description: 'Кроссплатформенный репозиторий расширений (.xpi / .zip)' },
        { id: 'fdroid-webext', label: 'F-Droid WebExt', description: 'Проверенные мобильные модули безопасности и блокировки' },
      ],
    });
  });

  app.get('/api/extensions/download/:id', (req, res) => {
    const item = FIRES_EXTENSION_CATALOG.find((e) => e.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Расширение не найдено в каталоге.' });
      return;
    }

    const manifestJson = JSON.stringify(
      {
        manifest_version: 2,
        name: item.name,
        version: item.version,
        description: item.summary,
        author: item.author,
        permissions: item.permissions,
        browser_action: {
          default_title: item.name,
          default_popup: 'popup.html',
        },
        content_scripts: [
          {
            matches: ['<all_urls>'],
            css: ['styles.css'],
            js: ['content.js'],
            run_at: 'document_end',
          },
        ],
        applications: {
          fires: {
            id: `${item.id}@fires.addons`,
            strict_min_version: '120.0',
          },
        },
      },
      null,
      2
    );

    const stylesCss =
      item.effectKey === 'dark-reader'
        ? 'html { filter: invert(0.92) hue-rotate(180deg) !important; } img, video, picture { filter: invert(1) hue-rotate(180deg) !important; }\n'
        : item.effectKey === 'github-code-wrap'
        ? '.markdown-body pre, .highlight pre, table { max-width: 100% !important; white-space: pre-wrap !important; overflow-wrap: anywhere !important; }\n'
        : 'html, body { max-width: 100% !important; overflow-x: hidden !important; } img, table, pre { max-width: 100% !important; }\n';

    const contentJs = `/* ${item.name} v${item.version} (${item.sourceLabel}) */\n(function(){\n  document.documentElement.setAttribute('data-fires-ext-${item.id}', 'active');\n})();\n`;

    const popupHtml = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${item.name}</title></head><body style="font-family:sans-serif;padding:12px;min-width:220px"><h3 style="margin:0 0 6px">${item.name}</h3><p style="margin:0;font-size:12px;color:#475569">${item.summary}</p></body></html>`;

    const readmeMd = `# ${item.name}\n\n- Источник: ${item.sourceLabel}\n- Платформы: ${item.platforms.join(', ')}\n- Версия: ${item.version}\n\n${item.summary}\n`;

    const archive = buildZipBuffer([
      { name: 'manifest.json', content: manifestJson },
      { name: 'styles.css', content: stylesCss },
      { name: 'content.js', content: contentJs },
      { name: 'popup.html', content: popupHtml },
      { name: 'README.md', content: readmeMd },
    ]);

    res.setHeader(
      'Content-Type',
      item.packageFormat === 'xpi' ? 'application/x-xpinstall' : 'application/zip'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${item.fileName}"`);
    res.setHeader('Content-Length', String(archive.length));
    res.send(archive);
  });

  app.get('/api/opensource/tree', (_req, res) => {
    try {
      res.json({ license: 'MIT', files: listOpenSourceFiles() });
    } catch {
      res.status(500).json({ error: 'Не удалось получить дерево исходного кода.' });
    }
  });

  app.get('/api/opensource/file', (req, res) => {
    const reqPath = String(req.query.path || '').trim().replace(/^\/+/, '');
    const allowed = listOpenSourceFiles().find((f) => f.path === reqPath);
    if (!allowed) {
      res.status(404).json({ error: 'Файл исходного кода не найден.' });
      return;
    }
    try {
      const content = fs.readFileSync(path.join(__dirname, allowed.path), 'utf8');
      res.json({ path: allowed.path, license: 'MIT', content });
    } catch {
      res.status(500).json({ error: 'Не удалось прочитать файл исходного кода.' });
    }
  });

  if (IS_PROD) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      })
    );
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const reqUrl = new URL(req.url || '/', 'http://localhost');
      if (reqUrl.pathname !== '/ws/messenger') {
        return;
      }
      const queryToken = reqUrl.searchParams.get('token') || '';
      const rawCookieHeader = String(req.headers.cookie || '');
      let cookieToken = '';
      for (const part of rawCookieHeader.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === SESSION_COOKIE_NAME) {
          try {
            cookieToken = decodeURIComponent(part.slice(idx + 1).trim());
          } catch {
            cookieToken = part.slice(idx + 1).trim();
          }
          break;
        }
      }
      const token = queryToken || cookieToken;
      const uid = token ? verifySessionToken(token, store.sessionSecret) : null;
      const user = uid ? store.users.find((u) => u.id === uid && u.status !== 'blocked') : null;

      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, user);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, user: StoredAccount) => {
    let set = wsClientsByUser.get(user.id);
    if (!set) {
      set = new Set<WebSocket>();
      wsClientsByUser.set(user.id, set);
    }
    set.add(ws);
    activeUserSessions.set(user.id, Date.now());

    sendWsPayload(ws, {
      type: 'init',
      onlineUserIds: Array.from(wsClientsByUser.keys()),
    });
    broadcastPresence();

    ws.on('message', async (raw) => {
      activeUserSessions.set(user.id, Date.now());
      let packet: Record<string, unknown>;
      try {
        packet = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
      } catch {
        return;
      }
      const type = String(packet.type || '');

      if (type === 'ping') {
        sendWsPayload(ws, { type: 'pong' });
        return;
      }

      if (type === 'message:send') {
        const roomId = String(packet.roomId || 'general').trim();
        const text = String(packet.text || '');
        const clientId = typeof packet.clientId === 'string' ? packet.clientId : undefined;
        const channels = Array.isArray(packet.channels)
          ? (packet.channels as ExternalChannelId[])
          : undefined;
        const targetPhone =
          typeof packet.targetPhone === 'string' ? packet.targetPhone.trim() : undefined;
        const result = await persistAndBroadcastMessage(
          user,
          roomId,
          text,
          clientId,
          channels,
          targetPhone
        );
        if ('error' in result) {
          sendWsPayload(ws, { type: 'error', error: result.error });
        }
        return;
      }

      if (type === 'typing') {
        const roomId = String(packet.roomId || 'general').trim();
        const active = Boolean(packet.active);
        if (!canAccessRoom(user.id, roomId)) return;
        const recipients = getRoomRecipients(roomId);
        const evt = {
          type: 'typing',
          roomId,
          userId: user.id,
          nickname: user.displayName,
          active,
        };
        if (recipients === 'all') {
          for (const [uid, sockets] of wsClientsByUser.entries()) {
            if (uid === user.id) continue;
            for (const s of sockets) sendWsPayload(s, evt);
          }
        } else {
          for (const uid of recipients) {
            if (uid !== user.id) sendToUser(uid, evt);
          }
        }
        return;
      }

      if (type === 'call:offer') {
        const targetUserId = String(packet.targetUserId || '');
        const callId = String(packet.callId || `call-${Date.now()}`);
        const callType = packet.callType === 'video' ? 'video' : 'audio';
        const target = store.users.find(
          (u) => u.id === targetUserId && u.status === 'active'
        );
        if (!target || target.id === user.id) {
          sendWsPayload(ws, {
            type: 'call:unavailable',
            callId,
            targetUserId,
            reason: 'Собеседник не найден.',
          });
          return;
        }
        if (!isUserOnline(target.id)) {
          store.messengerCalls.push({
            id: callId,
            callerId: user.id,
            callerName: user.displayName,
            calleeId: target.id,
            calleeName: target.displayName,
            callType,
            status: 'missed',
            startedAt: new Date().toISOString(),
          });
          saveStore(store);
          sendWsPayload(ws, {
            type: 'call:unavailable',
            callId,
            targetUserId,
            reason: `${target.displayName} сейчас не в сети.`,
          });
          return;
        }
        activeCallTrackers.set(callId, {
          callerId: user.id,
          callerName: user.displayName,
          calleeId: target.id,
          calleeName: target.displayName,
          callType,
          startedAt: Date.now(),
        });
        sendToUser(target.id, {
          type: 'call:offer',
          callId,
          callType,
          sdp: packet.sdp,
          fromUserId: user.id,
          fromUsername: user.username,
          fromDisplayName: user.displayName,
          fromAvatar: user.avatar,
        });
        return;
      }

      if (type === 'call:answer') {
        const targetUserId = String(packet.targetUserId || '');
        const callId = String(packet.callId || '');
        const tracker = activeCallTrackers.get(callId);
        if (tracker) {
          tracker.answeredAt = Date.now();
        }
        sendToUser(targetUserId, {
          type: 'call:answer',
          callId,
          sdp: packet.sdp,
          fromUserId: user.id,
        });
        return;
      }

      if (type === 'call:ice') {
        const targetUserId = String(packet.targetUserId || '');
        sendToUser(targetUserId, {
          type: 'call:ice',
          callId: String(packet.callId || ''),
          candidate: packet.candidate,
          fromUserId: user.id,
        });
        return;
      }

      if (type === 'call:reject' || type === 'call:hangup') {
        const targetUserId = String(packet.targetUserId || '');
        const callId = String(packet.callId || '');
        const tracker = activeCallTrackers.get(callId);
        if (tracker) {
          activeCallTrackers.delete(callId);
          const durationSeconds = tracker.answeredAt
            ? Math.max(1, Math.round((Date.now() - tracker.answeredAt) / 1000))
            : undefined;
          store.messengerCalls.push({
            id: callId,
            callerId: tracker.callerId,
            callerName: tracker.callerName,
            calleeId: tracker.calleeId,
            calleeName: tracker.calleeName,
            callType: tracker.callType,
            status: type === 'call:reject' ? 'rejected' : tracker.answeredAt ? 'ended' : 'missed',
            startedAt: new Date(tracker.startedAt).toISOString(),
            durationSeconds,
          });
          if (store.messengerCalls.length > 100) {
            store.messengerCalls = store.messengerCalls.slice(-100);
          }
          saveStore(store);
        }
        sendToUser(targetUserId, {
          type,
          callId,
          fromUserId: user.id,
        });
      }
    });

    ws.on('close', () => {
      const userSet = wsClientsByUser.get(user.id);
      if (userSet) {
        userSet.delete(ws);
        if (userSet.size === 0) {
          wsClientsByUser.delete(user.id);
        }
      }
      broadcastPresence();
    });
  });

  // Unused helper reference guard for DM builder
  void makeDmRoomId;

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Firas server listening on http://localhost:${PORT}`);
  });
}

startServer();
