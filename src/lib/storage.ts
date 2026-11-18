import {
  DEFAULT_SETTINGS,
  type ChatMessage,
  type Settings,
  type Theme,
} from '../types';

const KEY_PREFIX = 'libraries-voice-ai:';
export const STORAGE_KEYS = {
  apiKey: `${KEY_PREFIX}apiKey`,
  settings: `${KEY_PREFIX}settings`,
  messages: `${KEY_PREFIX}messages`,
  theme: `${KEY_PREFIX}theme`,
} as const;

/** localStorage は Safari のプライベートモードなどで例外を投げるので、必ず包む。 */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* 保存できなくてもその場の動作は続ける */
  }
}

export function loadApiKey(): string {
  return read(STORAGE_KEYS.apiKey)?.trim() ?? '';
}

export function saveApiKey(key: string): void {
  write(STORAGE_KEYS.apiKey, key.trim() || null);
}

export function loadTheme(fallback: Theme): Theme {
  const stored = read(STORAGE_KEYS.theme);
  return stored === 'dark' || stored === 'light' ? stored : fallback;
}

export function saveTheme(theme: Theme): void {
  write(STORAGE_KEYS.theme, theme);
}

export function loadSettings(): Settings {
  const raw = read(STORAGE_KEYS.settings);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      model:
        typeof parsed.model === 'string' && parsed.model.trim()
          ? parsed.model
          : DEFAULT_SETTINGS.model,
      systemPrompt:
        typeof parsed.systemPrompt === 'string'
          ? parsed.systemPrompt
          : DEFAULT_SETTINGS.systemPrompt,
      ttsEnabled:
        typeof parsed.ttsEnabled === 'boolean'
          ? parsed.ttsEnabled
          : DEFAULT_SETTINGS.ttsEnabled,
      speechRate:
        typeof parsed.speechRate === 'number' && Number.isFinite(parsed.speechRate)
          ? Math.min(1.4, Math.max(0.6, parsed.speechRate))
          : DEFAULT_SETTINGS.speechRate,
      ringType: parsed.ringType === 'mono' ? 'mono' : 'ring',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  write(STORAGE_KEYS.settings, JSON.stringify(settings));
}

export function loadMessages(): ChatMessage[] {
  const raw = read(STORAGE_KEYS.messages);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ChatMessage => {
        if (typeof item !== 'object' || item === null) return false;
        const candidate = item as Partial<ChatMessage>;
        return (
          typeof candidate.id === 'string' &&
          (candidate.role === 'user' || candidate.role === 'assistant') &&
          typeof candidate.content === 'string' &&
          typeof candidate.createdAt === 'number'
        );
      })
      .slice(-60);
  } catch {
    return [];
  }
}

export function saveMessages(messages: ChatMessage[]): void {
  // 直近60件だけ残す（localStorage の容量と表示速度のため）
  write(STORAGE_KEYS.messages, JSON.stringify(messages.slice(-60)));
}
