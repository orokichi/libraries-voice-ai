export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** 表示だけ切り替えるエラー行（API エラーや中断） */
  error?: boolean;
}

export type RingType = 'ring' | 'mono';

/** アプリ全体の進行状態。VoiceRing / ThinkingOrb / VoiceBeam の見た目はこれから導出する。 */
export type Phase = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'writing' | 'speaking';

export type Theme = 'dark' | 'light';

export interface Settings {
  /** Groq の chat completions に渡すモデル ID */
  model: string;
  systemPrompt: string;
  /** AI の返答を Web Speech API で読み上げるか */
  ttsEnabled: boolean;
  /** 読み上げ速度（0.6–1.4） */
  speechRate: number;
  /** VoiceRing の見た目 */
  ringType: RingType;
}

export const DEFAULT_SETTINGS: Settings = {
  model: 'openai/gpt-oss-120b',
  systemPrompt:
    'あなたは日本語で話す、落ち着いた口調の音声アシスタントです。' +
    '返答は声に出して読み上げる前提なので、短く自然な話し言葉で答えてください。' +
    '箇条書きは多くても3つまで、記号やMarkdownの装飾は最小限にしてください。' +
    'わからないことは推測で断定せず、わからないと伝えてください。',
  ttsEnabled: true,
  speechRate: 1,
  ringType: 'ring',
};

/**
 * Groq の現行モデル（2026-11 時点で console.groq.com/docs/models に掲載）。
 * llama-3.3-70b-versatile / llama-3.1-8b-instant は 2026-08-16 に、
 * qwen/qwen3-32b と meta-llama/llama-4-scout-17b-16e-instruct は 2026-07-17 に提供終了。
 */
export interface ModelOption {
  id: string;
  label: string;
  note: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', note: '本番向け・高品質（約500 tok/s）' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', note: '本番向け・高速（約1000 tok/s）' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen3.8 27B', note: 'プレビュー・長文と推論に強い' },
  {
    id: 'openai/gpt-oss-safeguard-20b',
    label: 'GPT-OSS Safeguard 20B',
    note: 'プレビュー・安全性重視',
  },
];

/** 読み上げ音声の言語 */
export const SPEECH_LANG = 'ja-JP';

/** 音声認識（Whisper）の言語指定 */
export const TRANSCRIBE_LANG = 'ja';
