# Libraries Voice — Libraries.dev デザイン準拠 Groq 音声アシスタント

[Libraries.dev](https://libraries.dev) の 4 つのコンポーネントを全面統合した、日本語の音声 AI アシスタントです。
マイクに向かって話すと **Groq Whisper** が文字にし、**Groq Chat Completions** がストリーミングで答え、
必要なら **Web Speech API** が読み上げます。

- デザイン: [voice-ring](https://libraries.dev/voice-ring) / [thinking-orbs](https://libraries.dev/orbs) /
  [border-beam](https://libraries.dev/beam) / [voice-glow](https://libraries.dev/voice)
- スタック: Vite + React 18 + TypeScript (strict)
- ホスティング: Vercel（静的。サーバーも DB もなし）

## 4 つのコンポーネントの役割

| パッケージ | バージョン | 使っている場所 |
| --- | --- | --- |
| `voice-ring` | 0.2.0 | 中央の音声リング。`state` = `idle` / `listening` / `speaking` / `processing`、`stream={mic.stream}`、読み上げ中は `level` ゲッターで駆動。`type` は `ring` / `mono` を設定から切替 |
| `thinking-orbs` | 0.3.2 | ステージの状態表示に `size={64}`、チャット内の「考えています…」に `size={20}`。`listening` / `searching` / `connecting` / `composing` / `weaving` / `breathing` を状態に割当 |
| `border-beam` | 1.4.1 | APIキー設定カード（`pulse-outside`）、状態カード（`line`）、提案カード（`md`）。`size` / `colorVariant` / `strength` / `theme` を用途別に設定 |
| `voice-glow` | 0.3.0 | チャット入力欄をラップ。`stream={mic.stream}` でマイクに、`motion` ゲッターで AI 処理中のビームに反応 |

すべてライト／ダーク両対応で、ヘッダーのテーマ切替と連動します（`html[data-theme]` を共通の真実にしているため、
`thinking-orbs` の自動判定とも一致します）。

## 機能

- **APIキー管理** — `gsk_...` を入力すると `/models` への疎通テストを通してから `localStorage` に保存。
  表示／非表示、変更、削除に対応。キーが無ければ `BorderBeam` で強調した設定画面を表示。
- **テキストチャット** — `POST /openai/v1/chat/completions` を `stream: true` で叩き、SSE を 1 トークンずつ描画。
  途中で「停止」でき、会話履歴（直近20ターン）とシステムプロンプトを保持。
- **音声入力** — `MediaRecorder` → `POST /openai/v1/audio/transcriptions`
  （`whisper-large-v3-turbo`, `language: ja`）→ そのまま送信。マイクは 1 回の許可で録音とリング解析を共用。
  60 秒で自動停止。
- **読み上げ** — `speechSynthesis`（`ja-JP`）。読み上げ中は疑似エンベロープを毎フレーム生成して
  `VoiceRing` を `state="speaking"` で動かし、`VoiceBeam` も同じ値で反応。
- **レスポンシブ** — Pixel 9a などのスマホ幅では 1 カラムに積み、`VoiceRing` のサイズも JS 側で縮小。
- **永続化** — キー・設定・会話（直近60件）をこのブラウザにだけ保存。

## 開発

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 型チェック + 本番ビルド
npm run preview
```

`src/` の構成:

```
src/
  App.tsx                 状態機械（idle / listening / transcribing / thinking / writing / speaking）と Groq 呼び出し
  types.ts                設定・メッセージ型、現行モデル一覧
  lib/groq.ts             chat（SSE）/ whisper / models のクライアント
  lib/phase.ts            Phase → VoiceRing.state / ThinkingOrb.state の対応
  lib/storage.ts          localStorage の安全な読み書き
  lib/util.ts             id・時刻・キーのマスク
  hooks/useSpeaker.ts     speechSynthesis + 疑似エンベロープ
  hooks/useRecorder.ts    MediaRecorder
  hooks/useTheme.ts       テーマと matchMedia
  components/             AppHeader / WelcomeScreen / ApiKeyCard / VoiceStage / StatusCard /
                          ChatThread / SuggestionGrid / Composer / SettingsDialog
```

## Vercel へのデプロイ

1. GitHub にプッシュ
2. Vercel で **Add New → Project** → リポジトリを選択（Framework は `Vite` を自動検出）
3. 環境変数は不要。`npm run build` / 出力 `dist` は `vercel.json` に固定済み

## セキュリティと注意

- APIキーはブラウザの `localStorage` にだけ保存し、Groq（`api.groq.com`）以外へは送りません。
  静的サイトなので、キーを預かるサーバーは存在しません。
- ただし `localStorage` は XSS に弱い置き場所です。共有端末では使い終わったら「キーを削除」してください。
- 公開 URL を他人と共有する場合、その人のブラウザにはその人のキーが必要です（こちらのキーは渡りません）。

## 実 API との差異メモ

- `voice-glow` に `processing` プロパティは存在しないため、AI 応答中は公式の `motion` ゲッター
  （`{ gather: 1, heldLevel: ... }`）でビームを表現しています。
- `thinking-orbs` の `size` は `64 | 32 | 20` の 3 値のみです。
- Groq のモデルは 2026 年に整理され、`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`（2026-08-16 終了）と
  `qwen/qwen3-32b` / `meta-llama/llama-4-scout-17b-16e-instruct`（2026-07-17 終了）は使えません。
  本アプリは `openai/gpt-oss-120b`（既定）/ `openai/gpt-oss-20b` / `qwen/qwen3.8-27b` /
  `openai/gpt-oss-safeguard-20b` を用意し、設定から任意のモデル ID も入力できます。
