/**
 * Groq Console API のクライアント。
 * ブラウザから直接叩けることを CORS プリフライト（access-control-allow-origin: *）で確認済み。
 * API キーはユーザーの localStorage にだけ置き、こちらのサーバーには一切送らない。
 */

export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';
export const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/** 文字起こしに使うモデル（2026-11 時点で production） */
export const TRANSCRIBE_MODEL = 'whisper-large-v3-turbo';

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class GroqError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GroqError';
    this.status = status;
  }
}

function japaneseStatusMessage(status: number, detail: string): string {
  switch (status) {
    case 0:
      return detail || 'ネットワークに接続できませんでした。';
    case 400:
      return `リクエストが受け付けられませんでした。${detail}`.trim();
    case 401:
      return 'APIキーが正しくありません。Groq Console でキーを確認してください。';
    case 403:
      return 'このキーではこのモデルを利用できません。設定から別のモデルを選んでください。';
    case 404:
      return '指定したモデルが見つかりません。設定からモデルを選び直してください。';
    case 413:
      return '音声ファイルが大きすぎます。短く区切って話してください。';
    case 429:
      return 'リクエストが集中しています。少し待ってからもう一度お試しください。';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Groq 側で一時的な問題が起きています。少し待ってから再試行してください。';
    default:
      return detail || `通信に失敗しました（HTTP ${status}）。`;
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return '';
    try {
      const parsed = JSON.parse(text) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof parsed.error === 'string') return parsed.error;
      if (parsed.error && typeof parsed.error.message === 'string') return parsed.error.message;
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {
      /* JSON でない本文はそのまま短く使う */
    }
    return text.slice(0, 180);
  } catch {
    return '';
  }
}

function networkError(err: unknown): GroqError {
  if (err instanceof GroqError) return err;
  if (err instanceof DOMException && err.name === 'AbortError') throw err;
  const message =
    err instanceof Error && err.message ? `通信できませんでした（${err.message}）` : '通信できませんでした。';
  return new GroqError(message, 0);
}

export interface VerifyResult {
  ok: boolean;
  message: string;
  modelIds: string[];
}

/** API キーの疎通確認。GET /models を叩いて、使えるモデル一覧も一緒に返す。 */
export async function verifyApiKey(apiKey: string, signal?: AbortSignal): Promise<VerifyResult> {
  try {
    const res = await fetch(GROQ_MODELS_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal,
    });
    if (!res.ok) {
      const detail = await readError(res);
      return { ok: false, message: japaneseStatusMessage(res.status, detail), modelIds: [] };
    }
    const data = (await res.json()) as { data?: Array<{ id?: string; active?: boolean }> };
    const modelIds = (data.data ?? [])
      .filter((m) => m.active !== false && typeof m.id === 'string')
      .map((m) => m.id as string);
    return {
      ok: true,
      message: `接続できました（利用可能なモデル ${modelIds.length} 件）`,
      modelIds,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    const wrapped = networkError(err);
    return { ok: false, message: wrapped.message, modelIds: [] };
  }
}

export interface StreamChatOptions {
  apiKey: string;
  model: string;
  messages: ChatTurn[];
  signal?: AbortSignal;
  /** 差分テキストが届くたびに呼ばれる */
  onDelta: (delta: string) => void;
}

/**
 * SSE で chat completions をストリーミングし、最後に全文を返す。
 * 呼び出し側は onDelta で画面を更新し、戻り値で読み上げや保存を行う。
 */
export async function streamChat(options: StreamChatOptions): Promise<string> {
  const { apiKey, model, messages, signal, onDelta } = options;

  let res: Response;
  try {
    res = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.6,
        max_completion_tokens: 2048,
      }),
      signal,
    });
  } catch (err) {
    throw networkError(err);
  }

  if (!res.ok) {
    const detail = await readError(res);
    throw new GroqError(japaneseStatusMessage(res.status, detail), res.status);
  }

  if (!res.body) {
    // ストリーミング非対応の環境では一度だけ全文を取りに行く
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const full = data.choices?.[0]?.message?.content ?? '';
    if (full) onDelta(full);
    return full;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let finished = false;

  try {
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const rawLine = buffer.slice(0, newlineIndex).replace(/\r$/, '');
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');

        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') {
          finished = true;
          break;
        }
        try {
          const chunk = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string | null } }>;
            error?: { message?: string };
          };
          if (chunk.error?.message) {
            throw new GroqError(chunk.error.message, 500);
          }
          const delta = chunk.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            full += delta;
            onDelta(delta);
          }
        } catch (err) {
          if (err instanceof GroqError) throw err;
          /* 壊れた行（keep-alive など）は読み飛ばす */
        }
      }
    }
  } finally {
    // 途中で abort された場合もストリームを閉じる
    try {
      await reader.cancel();
    } catch {
      /* すでに閉じている */
    }
  }

  // 最後に改行なしで残った行を処理
  const tail = buffer.trim();
  if (!finished && tail.startsWith('data:')) {
    const payload = tail.slice(5).trim();
    if (payload && payload !== '[DONE]') {
      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string | null } }>;
        };
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        /* noop */
      }
    }
  }

  return full;
}

function extensionFor(mimeType: string): string {
  const type = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  switch (type) {
    case 'audio/webm':
      return 'webm';
    case 'audio/mp4':
    case 'audio/aac':
      return 'm4a';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/flac':
      return 'flac';
    default:
      return 'webm';
  }
}

export interface TranscribeOptions {
  apiKey: string;
  blob: Blob;
  signal?: AbortSignal;
  /** 既定は 'ja' */
  language?: string;
  /** 固有名詞などを誘導するヒント */
  prompt?: string;
}

/** MediaRecorder の Blob を Whisper に投げて文字起こしする。 */
export async function transcribeAudio(options: TranscribeOptions): Promise<string> {
  const { apiKey, blob, signal, language = 'ja', prompt } = options;
  const form = new FormData();
  form.append('file', blob, `speech.${extensionFor(blob.type)}`);
  form.append('model', TRANSCRIBE_MODEL);
  form.append('language', language);
  form.append('response_format', 'json');
  form.append('temperature', '0');
  if (prompt) form.append('prompt', prompt);

  let res: Response;
  try {
    res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal,
    });
  } catch (err) {
    throw networkError(err);
  }

  if (!res.ok) {
    const detail = await readError(res);
    throw new GroqError(japaneseStatusMessage(res.status, detail), res.status);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}

/** 例外を UI にそのまま出せる日本語にする。 */
export function describeError(err: unknown): string {
  if (err instanceof GroqError) return err.message;
  if (err instanceof DOMException && err.name === 'AbortError') return '中断しました。';
  if (err instanceof Error) {
    if (/Failed to fetch|NetworkError|Load failed/i.test(err.message)) {
      return 'ネットワークに接続できませんでした。接続を確認してください。';
    }
    return err.message;
  }
  return '予期しないエラーが起きました。';
}
