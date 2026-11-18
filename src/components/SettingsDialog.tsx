import { useEffect, useRef, useState } from 'react';
import { MODEL_OPTIONS, DEFAULT_SETTINGS, type Settings, type Theme } from '../types';
import { maskKey } from '../lib/util';
import { ApiKeyCard, type ApiKeySubmitResult } from './ApiKeyCard';
import { CloseIcon, TrashIcon } from './Icons';

interface SettingsDialogProps {
  open: boolean;
  theme: Theme;
  settings: Settings;
  apiKey: string;
  messageCount: number;
  onClose: () => void;
  onChange: (patch: Partial<Settings>) => void;
  onSaveKey: (key: string) => Promise<ApiKeySubmitResult>;
  onClearKey: () => void;
  onClearMessages: () => void;
}

export function SettingsDialog({
  open,
  theme,
  settings,
  apiKey,
  messageCount,
  onClose,
  onChange,
  onSaveKey,
  onClearKey,
  onClearMessages,
}: SettingsDialogProps) {
  const [changingKey, setChangingKey] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      setChangingKey(false);
      setCustomModel('');
      return;
    }
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const knownModel = MODEL_OPTIONS.some((option) => option.id === settings.model);

  return (
    <div className="modal" role="presentation" onClick={onClose}>
      <div
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__head">
          <h2 id="settings-title" className="modal__title">
            設定
          </h2>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="閉じる">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <section className="settings-section">
            <h3 className="settings-section__title">モデル</h3>
            <p className="hint">
              2026年8月に llama-3.3-70b / llama-3.1-8b は提供終了したため、現行のモデルを並べています。
            </p>
            <select
              className="select"
              value={knownModel ? settings.model : '__custom__'}
              onChange={(event) => {
                const value = event.target.value;
                if (value === '__custom__') {
                  setCustomModel(knownModel ? '' : settings.model);
                  return;
                }
                onChange({ model: value });
              }}
              aria-label="モデル"
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} — {option.note}
                </option>
              ))}
              <option value="__custom__">自由入力（モデルIDを直接指定）</option>
            </select>
            {(!knownModel || customModel) && (
              <div className="settings-inline">
                <input
                  className="input"
                  value={customModel || (knownModel ? '' : settings.model)}
                  onChange={(event) => setCustomModel(event.target.value)}
                  placeholder="例: openai/gpt-oss-120b"
                  spellCheck={false}
                  aria-label="カスタムモデルID"
                />
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    const next = customModel.trim();
                    if (next) onChange({ model: next });
                  }}
                >
                  適用
                </button>
              </div>
            )}
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">システムプロンプト</h3>
            <textarea
              className="textarea"
              value={settings.systemPrompt}
              onChange={(event) => onChange({ systemPrompt: event.target.value })}
              rows={6}
              aria-label="システムプロンプト"
            />
            <button
              type="button"
              className="btn btn--link btn--sm"
              onClick={() => onChange({ systemPrompt: DEFAULT_SETTINGS.systemPrompt })}
            >
              既定に戻す
            </button>
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">音声</h3>
            <label className="settings-row">
              <span>
                返答を読み上げる
                <span className="hint hint--block">Web Speech API（ja-JP）で読み上げます</span>
              </span>
              <span className={`toggle${settings.ttsEnabled ? ' toggle--on' : ''}`} aria-hidden="true">
                <span className="toggle__knob" />
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={settings.ttsEnabled}
                onChange={(event) => onChange({ ttsEnabled: event.target.checked })}
              />
            </label>
            <label className="settings-row settings-row--stack">
              <span>読み上げ速度（{settings.speechRate.toFixed(1)}×）</span>
              <input
                type="range"
                min={0.6}
                max={1.4}
                step={0.1}
                value={settings.speechRate}
                onChange={(event) => onChange({ speechRate: Number(event.target.value) })}
              />
            </label>
            <div className="settings-row settings-row--stack">
              <span>VoiceRing の見た目</span>
              <div className="segmented" role="group" aria-label="VoiceRing の見た目">
                <button
                  type="button"
                  className={`segmented__item${settings.ringType === 'ring' ? ' segmented__item--active' : ''}`}
                  onClick={() => onChange({ ringType: 'ring' })}
                >
                  リング（光）
                </button>
                <button
                  type="button"
                  className={`segmented__item${settings.ringType === 'mono' ? ' segmented__item--active' : ''}`}
                  onClick={() => onChange({ ringType: 'mono' })}
                >
                  モノ（線）
                </button>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">Groq APIキー</h3>
            <div className="settings-row">
              <span className="mono">{maskKey(apiKey)}</span>
              <div className="settings-row__actions">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setChangingKey((current) => !current)}
                >
                  {changingKey ? '閉じる' : 'キーを変更'}
                </button>
                <button type="button" className="btn btn--danger btn--sm" onClick={onClearKey}>
                  削除
                </button>
              </div>
            </div>
            {changingKey && (
              <ApiKeyCard
                theme={theme}
                emphasis={false}
                submitLabel="このキーに更新"
                onSubmit={async (key) => {
                  const result = await onSaveKey(key);
                  if (result.ok) setChangingKey(false);
                  return result;
                }}
                onCancel={() => setChangingKey(false)}
              />
            )}
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">会話</h3>
            <div className="settings-row">
              <span>保存中のメッセージ {messageCount} 件</span>
              <button type="button" className="btn btn--danger btn--sm" onClick={onClearMessages}>
                <TrashIcon width={14} height={14} /> 会話を消す
              </button>
            </div>
          </section>
        </div>

        <footer className="modal__foot">
          <p className="hint">
            キーと会話はこのブラウザにだけ保存されます。共有端末では「キーを削除」を実行してください。
          </p>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            閉じる
          </button>
        </footer>
      </div>
    </div>
  );
}
