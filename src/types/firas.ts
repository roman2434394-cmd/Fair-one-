export enum WorkspaceView {
  Overview = 'overview',
  Tasks = 'tasks',
  Notes = 'notes',
  Rhythm = 'rhythm',
  Browser = 'browser',
  AiChat = 'aichat',
  Messenger = 'messenger',
  Cloud = 'cloud',
  Forbes = 'forbes',
  Admin = 'admin',
}

export enum TaskPriority {
  High = 'high',
  Medium = 'medium',
  Normal = 'normal',
}

export type TaskCategory = 'Работа' | 'Стратегия' | 'Обучение' | 'Личное';

export interface FirasTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string; // YYYY-MM-DD
  estimatedMinutes: number;
  focusSessionsCompleted: number;
  createdAt: string;
}

export type NoteCategory = 'Идеи' | 'Проекты' | 'Рефлексия' | 'Справочник';

export interface FirasNote {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  pinned: boolean;
  updatedAt: string;
}

export interface FirasHabit {
  id: string;
  name: string;
  targetDaysPerWeek: number;
  /** 7 booleans representing Mon..Sun of the active week */
  weekDays: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
}

export interface DailyFocusLog {
  dayLabel: string; // 'Пн', 'Вт', ...
  dateKey: string; // YYYY-MM-DD
  minutes: number;
  sessions: number;
}

export type SearchEngineId = 'firas' | 'google' | 'yandex' | 'duckduckgo' | 'mailru';
export type BuiltInAiProviderId =
  | 'fire_assistant'
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
export type AiProviderId = BuiltInAiProviderId | `custom:${string}`;

export type CustomAiSpecialty =
  | 'universal'
  | 'coding'
  | 'gamedev'
  | 'research'
  | 'creative'
  | 'business'
  | 'study';

export interface CustomAiModel {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  tagline: string;
  specialty: CustomAiSpecialty;
  systemPrompt: string;
  baseEngine:
    | 'auto'
    | 'ensemble'
    | 'google_studio_ai'
    | 'claude'
    | 'codex'
    | 'codeium'
    | 'studio_ai'
    | 'gemini'
    | 'chatgpt'
    | 'deepseek'
    | 'deepseek_coder';
  ensembleEngines?: BuiltInAiProviderId[];
  leadEngine?: BuiltInAiProviderId;
  isPublic: boolean;
  savedToCloud: boolean;
  createdAt: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  model?: string;
  routedTo?: string;
  routeReason?: string;
  createdAt: string;
}

export interface AiChatThread {
  id: string;
  title: string;
  provider: AiProviderId;
  messages: AiChatMessage[];
  updatedAt: string;
}

export interface BrowserBookmark {
  id: string;
  title: string;
  url: string;
  category: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface PageBlock {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'quote' | 'li';
  text: string;
}

export interface PageLinkItem {
  text: string;
  url: string;
}

export interface BrowsedPageData {
  url: string;
  finalUrl: string;
  domain: string;
  title: string;
  description: string;
  blocks: PageBlock[];
  links: PageLinkItem[];
  fetchedAt: string;
  error?: string;
}

export interface ForbesEntry {
  rank: number;
  name: string;
  nameRu: string;
  netWorthBillions: number;
  dailyChangeBillions: number;
  age: number | null;
  country: string;
  countryRu: string;
  regionGroup: 'global' | 'russia';
  source: string;
  industry: string;
  bio: string;
}

export interface ForbesResponse {
  source: 'live' | 'curated';
  updatedAt: string;
  items: ForbesEntry[];
}

export interface DailyNewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  category: string;
  publishedAt: string;
  timeLabel: string;
  summary: string;
}

export interface DailyNewsResponse {
  dateKey: string;
  dateLabel: string;
  updatedAt: string;
  source: 'live' | 'fallback';
  items: DailyNewsItem[];
}

export type UserRole =
  | 'client'
  | 'member'
  | 'sales'
  | 'manager'
  | 'manager_lead'
  | 'admin'
  | 'chief_admin'
  | 'admin_lead'
  | 'director'
  | 'developer'
  | 'owner';

export type AccountStatus = 'active' | 'blocked';

export const ROLE_LEVEL: Record<UserRole, number> = {
  client: 0,
  member: 1,
  sales: 2,
  manager: 3,
  manager_lead: 4,
  admin: 5,
  chief_admin: 6,
  admin_lead: 7,
  director: 8,
  developer: 9,
  owner: 10,
};

export const ALL_ROLES_ASC: UserRole[] = [
  'client',
  'member',
  'sales',
  'manager',
  'manager_lead',
  'admin',
  'chief_admin',
  'admin_lead',
  'director',
  'developer',
  'owner',
];

export const ROLE_LABEL_RU: Record<UserRole, string> = {
  client: 'Клиент',
  member: 'Участник',
  sales: 'Продажник',
  manager: 'Менеджер',
  manager_lead: 'Руководитель по менеджерам',
  admin: 'Администратор',
  chief_admin: 'Главный администратор',
  admin_lead: 'Руководитель по администраторам',
  director: 'Директор',
  developer: 'Программист',
  owner: 'Владелец',
};

export const ROLE_DESCRIPTION_RU: Record<UserRole, string> = {
  client: 'Пользователь браузера и мессенджера',
  member: 'Входит в группу разработчиков',
  sales: 'Отдел продаж и партнёрств',
  manager: 'Ведёт задачи и процессы группы',
  manager_lead: 'Руководит менеджерами и отделами',
  admin: 'Модерирует сервисы и участников',
  chief_admin: 'Старший администратор системы',
  admin_lead: 'Руководит всеми администраторами',
  director: 'Управляет всеми направлениями компании',
  developer: 'Создатель новых функций, нейросетей и архитектуры',
  owner: 'Высший уровень (владелец системы)',
};

export const isStaffRole = (role?: UserRole | null): boolean =>
  Boolean(role && ROLE_LEVEL[role] >= ROLE_LEVEL.manager);

export const isTeamRole = (role?: UserRole | null): boolean =>
  Boolean(role && ROLE_LEVEL[role] >= ROLE_LEVEL.member);

export type ExternalChannelId = 'firas' | 'telegram' | 'whatsapp' | 'viber';

export interface MessengerBridgeBinding {
  phone?: string;
  phoneVerified?: boolean;
  telegram?: {
    connected: boolean;
    handle: string;
    chatId?: string;
  };
  whatsapp?: {
    connected: boolean;
    phone: string;
  };
  viber?: {
    connected: boolean;
    phone: string;
  };
  chatRoulette?: {
    connected: boolean;
    phone: string;
  };
  updatedAt?: string;
}

export interface BridgeDispatchResult {
  channel: ExternalChannelId;
  status: 'delivered' | 'bridged' | 'deeplink';
  detail: string;
  launchUrl?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
  trustedDevicesCount?: number;
  loginCount?: number;
  bridges?: MessengerBridgeBinding;
}

export type FriendshipStatus = 'none' | 'friends' | 'outgoing' | 'incoming';

export interface MessengerContact {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  online: boolean;
  isFriend?: boolean;
  friendshipStatus?: FriendshipStatus;
  friendRequestId?: string;
  bridges?: MessengerBridgeBinding;
}

export interface FriendRequestItem {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  user: MessengerContact;
}

export interface MessengerMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  channels?: ExternalChannelId[];
  bridgeResults?: BridgeDispatchResult[];
  createdAt: string;
}

export interface MessengerCallRecord {
  id: string;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  callType: 'audio' | 'video';
  status: 'answered' | 'rejected' | 'missed' | 'ended';
  startedAt: string;
  durationSeconds?: number;
}

export interface LoginConfirmationRequest {
  id: string;
  targetUserId: string;
  targetUsername: string;
  requestedFrom: string;
  code: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  expiresAt: string;
}

export interface BrowserPublicConfig {
  announcement: string;
  searchExamples: string[];
  aiEnabled: boolean;
  blockedDomains: string[];
  updatedAt: string;
}

export interface AdminAuditEntry {
  id: string;
  actorName: string;
  action: string;
  createdAt: string;
}

export interface MessengerServer {
  id: string;
  name: string;
  description: string;
  roomId: string;
  region: string;
  color: string;
  createdBy: string;
  createdAt: string;
  isDefault?: boolean;
}

export interface CloudFileItem {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  folder: string;
  category: 'document' | 'media' | 'archive' | 'terabox' | 'ai-model' | 'other';
  sizeBytes: number;
  mimeType: string;
  source: 'firas-cloud' | 'terabox';
  externalUrl?: string;
  createdAt: string;
}

export interface CloudStorageSummary {
  quotaBytes: number;
  usedBytes: number;
  files: CloudFileItem[];
  folders: string[];
}

export interface FirasState {
  tasks: FirasTask[];
  notes: FirasNote[];
  habits: FirasHabit[];
  focusLog: DailyFocusLog[];
  bookmarks: BrowserBookmark[];
  theme: 'light' | 'dark';
}
