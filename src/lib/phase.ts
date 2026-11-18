import type { OrbState } from 'thinking-orbs';
import type { Phase } from '../types';

/** VoiceRing の state（'idle' | 'listening' | 'speaking' | 'processing'） */
export type RingState = 'idle' | 'listening' | 'speaking' | 'processing';

export function ringStateFor(phase: Phase): RingState {
  switch (phase) {
    case 'listening':
      return 'listening';
    case 'speaking':
      return 'speaking';
    case 'transcribing':
    case 'thinking':
    case 'writing':
      return 'processing';
    case 'idle':
    default:
      return 'idle';
  }
}

/** メイン表示（size=64）の ThinkingOrb。状態に応じて9種のアニメーションを割り当てる */
export function orbStateFor(phase: Phase): OrbState {
  switch (phase) {
    case 'listening':
      return 'listening';
    case 'transcribing':
      return 'searching';
    case 'thinking':
      return 'connecting';
    case 'writing':
      return 'composing';
    case 'speaking':
      return 'weaving';
    case 'idle':
    default:
      return 'breathing';
  }
}

/** チャット内インライン表示（size=20）の ThinkingOrb */
export function inlineOrbStateFor(phase: Phase): OrbState {
  switch (phase) {
    case 'thinking':
      return 'solving';
    case 'writing':
      return 'composing';
    default:
      return 'working';
  }
}

export function phaseLabel(phase: Phase): { title: string; hint: string } {
  switch (phase) {
    case 'listening':
      return { title: '聞いています', hint: '話し終えたら、もう一度マイクを押してください' };
    case 'transcribing':
      return { title: '文字起こし中', hint: 'Whisper が音声をテキストにしています' };
    case 'thinking':
      return { title: '考えています', hint: 'Groq が返答を組み立てています' };
    case 'writing':
      return { title: '答えを書いています', hint: '届いたところから順に表示しています' };
    case 'speaking':
      return { title: '読み上げ中', hint: '止めるときは、下のスピーカーボタンを押してください' };
    case 'idle':
    default:
      return { title: '待機中', hint: 'マイクを押して話すか、下の入力欄に書いてください' };
  }
}

export function isBusyPhase(phase: Phase): boolean {
  return phase === 'thinking' || phase === 'writing' || phase === 'transcribing';
}
