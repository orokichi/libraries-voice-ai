import { BorderBeam } from 'border-beam';
import { isBusyPhase } from '../lib/phase';
import { maskKey } from '../lib/util';
import type { Phase, RingType, Settings, Theme } from '../types';

interface StatusCardProps {
  theme: Theme;
  phase: Phase;
  settings: Settings;
  apiKey: string;
  micState: string;
  ttsSupported: boolean;
  onOpenSettings: () => void;
  onToggleTts: () => void;
  onToggleRingType: () => void;
}

const MIC_LABEL: Record<string, string> = {
  idle: '待機',
  requesting: '許可を確認中',
  live: '入力中',
  denied: 'ブロック',
  unsupported: '非対応',
  error: 'エラー',
};

export function StatusCard({
  theme,
  phase,
  settings,
  apiKey,
  micState,
  ttsSupported,
  onOpenSettings,
  onToggleTts,
  onToggleRingType,
}: StatusCardProps) {
  const active = isBusyPhase(phase) || phase === 'listening' || phase === 'speaking';

  return (
    <BorderBeam
      theme={theme}
      size="line"
      colorVariant={active ? 'colorful' : 'mono'}
      strength={active ? 1 : 0.55}
      borderRadius={20}
      active
      className="beam-status"
    >
      <div className="status-card">
        <div className="status-card__head">
          <h2 className="status-card__title">接続状況</h2>
          <button type="button" className="btn btn--link btn--sm" onClick={onOpenSettings}>
            変更
          </button>
        </div>
        <dl className="status-card__list">
          <div className="status-card__row">
            <dt>モデル</dt>
            <dd className="mono">{settings.model}</dd>
          </div>
          <div className="status-card__row">
            <dt>APIキー</dt>
            <dd>
              <span className="chip chip--ok">設定済み</span>
              <span className="mono status-card__masked">{maskKey(apiKey)}</span>
            </dd>
          </div>
          <div className="status-card__row">
            <dt>マイク</dt>
            <dd>
              <span className={`chip${micState === 'live' ? ' chip--live' : ''}`}>
                {MIC_LABEL[micState] ?? micState}
              </span>
            </dd>
          </div>
          <div className="status-card__row">
            <dt>読み上げ</dt>
            <dd>
              {ttsSupported ? (
                <button
                  type="button"
                  className={`toggle${settings.ttsEnabled ? ' toggle--on' : ''}`}
                  role="switch"
                  aria-checked={settings.ttsEnabled}
                  onClick={onToggleTts}
                  aria-label={settings.ttsEnabled ? '読み上げをオフにする' : '読み上げをオンにする'}
                >
                  <span className="toggle__knob" aria-hidden="true" />
                  <span>{settings.ttsEnabled ? 'ON' : 'OFF'}</span>
                </button>
              ) : (
                <span className="chip">非対応</span>
              )}
            </dd>
          </div>
          <div className="status-card__row">
            <dt>リング</dt>
            <dd>
              <button type="button" className="segmented segmented--tiny" onClick={onToggleRingType}>
                {settings.ringType === 'ring' ? 'リング（光）' : 'モノ（線）'}
                <span className="segmented__hint">切り替え</span>
              </button>
            </dd>
          </div>
        </dl>
      </div>
    </BorderBeam>
  );
}

export function ringTypeLabel(type: RingType): string {
  return type === 'ring' ? 'リング（光）' : 'モノ（線）';
}
