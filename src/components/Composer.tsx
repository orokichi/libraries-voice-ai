import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { VoiceBeam } from 'voice-glow';
import { isBusyPhase } from '../lib/phase';
import { useMediaQuery } from '../hooks/useTheme';
import type { MutableRefObject } from 'react';
import type { Phase, Theme } from '../types';
import { MicIcon, SendIcon, SpeakerIcon, SpeakerOffIcon, StopIcon } from './Icons';

interface ComposerProps {
  theme: Theme;
  phase: Phase;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onToggleMic: () => void;
  onStop: () => void;
  micSupported: boolean;
  stream: MediaStream | null;
  levelRef: MutableRefObject<number>;
  ttsEnabled: boolean;
  ttsSupported: boolean;
  onToggleTts: () => void;
  disabled: boolean;
}

export function Composer({
  theme,
  phase,
  value,
  onChange,
  onSend,
  onToggleMic,
  onStop,
  micSupported,
  stream,
  levelRef,
  ttsEnabled,
  ttsSupported,
  onToggleTts,
  disabled,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const compact = useMediaQuery('(max-width: 640px)');

  const busy = isBusyPhase(phase);
  const listening = phase === 'listening';
  const canSend = !disabled && !busy && value.trim().length > 0;

  // 入力欄を内容に合わせて伸縮（最大5行）
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
  }, [value]);

  /**
   * VoiceBeam には `processing` プロパティが存在しないため、
   * 公式の `motion` ゲッターで「ひとつに集まったビーム」を毎フレーム返す。
   */
  const processingMotion = useCallback(() => {
    const t = performance.now() / 1000;
    return {
      gather: 1,
      offset: 0,
      stretch: 0.14,
      heldLevel: 0.32 + 0.24 * (0.5 + 0.5 * Math.sin(t * 2.2)),
      cornerFollow: 0.25,
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div className="composer-shell">
      <VoiceBeam
        theme={theme}
        type={compact ? 'mobile' : 'default'}
        stream={listening ? stream : null}
        level={() => levelRef.current}
        motion={busy ? processingMotion : null}
        active
        colorVariant="colorful"
        strength={1}
        borderRadius={24}
        className="composer-beam"
      >
        <div className={`composer${listening ? ' composer--listening' : ''}`}>
          <button
            type="button"
            className={`icon-button${listening ? ' icon-button--live' : ''}`}
            onClick={onToggleMic}
            disabled={!micSupported || disabled || (busy && !listening)}
            aria-pressed={listening}
            aria-label={listening ? '録音を終える' : '音声で話しかける'}
            title={listening ? '録音を終える' : '音声で話しかける'}
          >
            {listening ? <StopIcon width={18} height={18} /> : <MicIcon width={18} height={18} />}
          </button>

          <textarea
            ref={textareaRef}
            className="composer__input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? '聞いています… 話し終えたら停止を押してください' : 'メッセージを入力（音声でも話せます）'}
            rows={1}
            disabled={disabled}
            aria-label="メッセージ"
          />

          <button
            type="button"
            className="icon-button"
            onClick={onToggleTts}
            disabled={!ttsSupported}
            aria-pressed={ttsEnabled}
            aria-label={ttsEnabled ? '読み上げをオフにする' : '読み上げをオンにする'}
            title={ttsEnabled ? '読み上げ ON' : '読み上げ OFF'}
          >
            {ttsEnabled ? <SpeakerIcon width={18} height={18} /> : <SpeakerOffIcon width={18} height={18} />}
          </button>

          {busy ? (
            <button type="button" className="icon-button icon-button--stop" onClick={onStop} aria-label="生成を中止">
              <StopIcon width={18} height={18} />
            </button>
          ) : (
            <button
              type="button"
              className="send-button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="送信"
            >
              <SendIcon width={18} height={18} />
            </button>
          )}
        </div>
      </VoiceBeam>
      <p className="composer__meta">
        {busy ? '生成中… 停止ボタンで中断できます' : 'Enter で送信 / Shift + Enter で改行'}
        {!ttsSupported && ' ・このブラウザは読み上げ非対応'}
      </p>
    </div>
  );
}
