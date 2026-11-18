import { useState, type FormEvent } from 'react';
import { BorderBeam } from 'border-beam';
import type { Theme } from '../types';
import { CheckIcon, ExternalIcon, KeyIcon } from './Icons';

export interface ApiKeySubmitResult {
  ok: boolean;
  message: string;
}

interface ApiKeyCardProps {
  theme: Theme;
  initialKey?: string;
  submitLabel?: string;
  /** 設定モーダル内では控えめな枠にする */
  emphasis?: boolean;
  onSubmit: (key: string) => Promise<ApiKeySubmitResult>;
  onCancel?: () => void;
}

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok'; message: string } | { kind: 'error'; message: string };

export function ApiKeyCard({
  theme,
  initialKey = '',
  submitLabel = 'キーを保存して始める',
  emphasis = true,
  onSubmit,
  onCancel,
}: ApiKeyCardProps) {
  const [value, setValue] = useState(initialKey);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const busy = status.kind === 'busy';
  const trimmed = value.trim();
  const looksValid = /^gsk_[A-Za-z0-9]{20,}$/.test(trimmed);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed || busy) return;
    setStatus({ kind: 'busy' });
    const result = await onSubmit(trimmed);
    setStatus(result.ok ? { kind: 'ok', message: result.message } : { kind: 'error', message: result.message });
  }

  const variant =
    status.kind === 'ok' ? 'forest' : status.kind === 'error' ? 'sunset' : emphasis ? 'colorful' : 'mono';

  return (
    <BorderBeam
      theme={theme}
      size={emphasis ? 'pulse-outside' : 'md'}
      colorVariant={variant}
      strength={emphasis ? 1 : 0.75}
      borderRadius={26}
      className="beam-card"
    >
      <form className="key-card" onSubmit={handleSubmit}>
        <div className="key-card__head">
          <span className="key-card__icon" aria-hidden="true">
            <KeyIcon width={18} height={18} />
          </span>
          <div>
            <h2 className="key-card__title">Groq APIキーを設定</h2>
            <p className="key-card__lead">
              キーはこの端末のブラウザ（localStorage）にだけ保存され、Groq 以外へは送られません。
            </p>
          </div>
        </div>

        <label className="field">
          <span className="field__label">APIキー</span>
          <div className="field__row">
            <input
              type={visible ? 'text' : 'password'}
              className="input"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (status.kind !== 'idle') setStatus({ kind: 'idle' });
              }}
              placeholder="gsk_..."
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              aria-describedby="api-key-help"
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setVisible((current) => !current)}
              aria-label={visible ? 'キーを隠す' : 'キーを表示'}
            >
              {visible ? '隠す' : '表示'}
            </button>
          </div>
        </label>

        <p className="hint" id="api-key-help">
          キーは{' '}
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer noopener">
            console.groq.com/keys
          </a>{' '}
          で無料で発行できます（Create API Key）。
          {trimmed && !looksValid ? ' 形式が gsk_ で始まっていないようです。' : ''}
        </p>

        {status.kind === 'ok' && (
          <p className="notice notice--ok" role="status">
            <CheckIcon width={16} height={16} /> {status.message}
          </p>
        )}
        {status.kind === 'error' && (
          <p className="notice notice--error" role="alert">
            {status.message}
          </p>
        )}

        <div className="key-card__actions">
          <button type="submit" className="btn btn--primary" disabled={!trimmed || busy}>
            {busy ? '確認中…' : submitLabel}
          </button>
          {onCancel && (
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
              キャンセル
            </button>
          )}
          <a
            className="btn btn--link"
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer noopener"
          >
            キーを発行 <ExternalIcon width={14} height={14} />
          </a>
        </div>
      </form>
    </BorderBeam>
  );
}
