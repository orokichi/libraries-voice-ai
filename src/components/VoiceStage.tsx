import { BorderBeam } from 'border-beam';
import { ThinkingOrb } from 'thinking-orbs';
import { VoiceRing, type MicrophoneState } from 'voice-ring';
import type { MutableRefObject } from 'react';
import { orbStateFor, phaseLabel, ringStateFor } from '../lib/phase';
import type { Phase, RingType, Theme } from '../types';
import { MicIcon, SpeakerIcon, StopIcon } from './Icons';

interface VoiceStageProps {
  theme: Theme;
  phase: Phase;
  ringType: RingType;
  ringSize: number;
  stream: MediaStream | null;
  levelRef: MutableRefObject<number>;
  micState: MicrophoneState;
  micSupported: boolean;
  speaking: boolean;
  onToggleMic: () => void;
  onStopSpeaking: () => void;
  onOpenSettings: () => void;
}

export function VoiceStage({
  theme,
  phase,
  ringType,
  ringSize,
  stream,
  levelRef,
  micState,
  micSupported,
  speaking,
  onToggleMic,
  onStopSpeaking,
  onOpenSettings,
}: VoiceStageProps) {
  const { title, hint } = phaseLabel(phase);
  const listening = phase === 'listening';

  return (
    <section className="stage" aria-label="音声ステージ">
      <div className="stage__ring">
        <VoiceRing
          theme={theme}
          type={ringType}
          state={ringStateFor(phase)}
          size={ringSize}
          stream={stream}
          level={() => levelRef.current}
          hoverBend={0.55}
          className="stage__canvas"
          aria-label={`音声リング（${title}）`}
        />
      </div>

      <div className="stage__status">
        <ThinkingOrb
          theme={theme}
          state={orbStateFor(phase)}
          size={64}
          className="stage__orb"
          aria-label={title}
        />
        <div className="stage__text">
          <p className="stage__title">
            <span className={`pulse-dot pulse-dot--${phase}`} aria-hidden="true" />
            {title}
          </p>
          <p className="stage__hint">{hint}</p>
        </div>
      </div>

      <div className="stage__actions">
        <BorderBeam
          theme={theme}
          size={listening ? 'pulse-inner' : 'line'}
          colorVariant={listening ? 'colorful' : 'ice'}
          strength={listening ? 1 : 0.7}
          borderRadius={22}
          className="beam-stage-btn"
        >
          <button
            type="button"
            className={`mic-button${listening ? ' mic-button--live' : ''}`}
            onClick={onToggleMic}
            disabled={!micSupported}
            aria-pressed={listening}
          >
            {listening ? <StopIcon width={20} height={20} /> : <MicIcon width={20} height={20} />}
            <span>{listening ? '録音を終える' : '話しかける'}</span>
          </button>
        </BorderBeam>

        {speaking ? (
          <button type="button" className="btn btn--ghost" onClick={onStopSpeaking}>
            <SpeakerIcon width={16} height={16} /> 読み上げを停止
          </button>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={onOpenSettings}>
            設定
          </button>
        )}
      </div>

      {micState === 'denied' && (
        <p className="notice notice--error stage__notice" role="alert">
          マイクの使用がブロックされています。ブラウザのアドレスバー横から、このサイトのマイクを許可してください。
        </p>
      )}
      {micState === 'unsupported' && (
        <p className="notice notice--warn stage__notice" role="status">
          このブラウザはマイク入力に対応していません。入力欄からテキストで話しかけてください。
        </p>
      )}
    </section>
  );
}
