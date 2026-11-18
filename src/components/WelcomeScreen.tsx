import { ThinkingOrb } from 'thinking-orbs';
import type { Theme } from '../types';
import { ApiKeyCard, type ApiKeySubmitResult } from './ApiKeyCard';

interface WelcomeScreenProps {
  theme: Theme;
  onSaveKey: (key: string) => Promise<ApiKeySubmitResult>;
}

export function WelcomeScreen({ theme, onSaveKey }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <section className="welcome__hero">
        <div className="welcome__orb">
          <ThinkingOrb theme={theme} state="breathing" size={64} aria-hidden="true" />
        </div>
        <p className="welcome__eyebrow">Libraries.dev デザイン × Groq</p>
        <h1 className="welcome__title">
          話して、聞いて、
          <br />
          そのまま答えが返ってくる。
        </h1>
        <p className="welcome__lead">
          VoiceRing のリングに向かって話すと、Whisper が文字にして、Groq の LLM が答えます。
          返答はそのまま読み上げ。ThinkingOrb が考えている様子を、VoiceBeam が声に反応する光を担当します。
        </p>
        <ul className="welcome__features">
          <li>
            <strong>音声で会話</strong>
            録音 → Whisper で文字起こし → そのまま送信
          </li>
          <li>
            <strong>ストリーミング回答</strong>
            届いた順に画面へ、必要なら声で読み上げ
          </li>
          <li>
            <strong>キーは端末内だけ</strong>
            サーバーもデータベースも持ちません
          </li>
        </ul>
      </section>

      <section className="welcome__card">
        <ApiKeyCard theme={theme} onSubmit={onSaveKey} />
        <ol className="steps">
          <li>
            <span className="steps__num">1</span>
            <div>
              <strong>Groq Console でキーを作る</strong>
              <p>
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer noopener">
                  console.groq.com/keys
                </a>{' '}
                を開き、「Create API Key」で無料発行。表示は1回だけなのでコピーしてください。
              </p>
            </div>
          </li>
          <li>
            <span className="steps__num">2</span>
            <div>
              <strong>ここに貼り付けて保存</strong>
              <p>キーの確認は Groq の /models エンドポイントへの疎通テストで行います。</p>
            </div>
          </li>
          <li>
            <span className="steps__num">3</span>
            <div>
              <strong>マイクを押して話す</strong>
              <p>話し終えたらもう一度押すと、文字起こしして答えます。</p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
