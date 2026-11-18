import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web Speech API（speechSynthesis）での読み上げと、
 * VoiceRing / VoiceBeam を動かすための擬似エンベロープ。
 *
 * speechSynthesis は音量を公開しないので、発話中は
 * ゆっくりした swell と音節っぽいゆらぎを合成した 0–1 の値を
 * requestAnimationFrame で更新し、`level` ゲッターとして渡す。
 */

let voicesCache: SpeechSynthesisVoice[] = [];

function refreshVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    voicesCache = window.speechSynthesis.getVoices();
  } catch {
    voicesCache = [];
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  if (!voicesCache.length) refreshVoices();
  const japanese = voicesCache.filter((voice) => voice.lang?.toLowerCase().startsWith('ja'));
  if (!japanese.length) return null;
  // 端末に入っている自然な音声（Kyoko / Google 日本語 / Nanami など）を優先
  const preferred = japanese.find((voice) => /kyoko|google|nanami|o-ren|haruka/i.test(voice.name));
  return preferred ?? japanese[0] ?? null;
}

/** 読み上げ用に Markdown の飾りを落とし、句点で区切った平文にする。 */
export function toSpeechText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '。コードは省略します。')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\|/g, ' ')
    .replace(/\n{2,}/g, '。')
    .replace(/\n/g, '、')
    .replace(/。{2,}/g, '。')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 1200);
}

export interface Speaker {
  supported: boolean;
  speaking: boolean;
  /** VoiceRing / VoiceBeam に渡す 0–1 のゲッター（毎フレーム読まれる） */
  levelRef: React.MutableRefObject<number>;
  speak: (text: string, onEnd?: () => void) => void;
  cancel: () => void;
}

export function useSpeaker(rate: number): Speaker {
  const supported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function';

  const [speaking, setSpeaking] = useState(false);
  const levelRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const rateRef = useRef(rate);
  const endCallbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  const stopEnvelope = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    levelRef.current = 0;
  }, []);

  const startEnvelope = useCallback(() => {
    if (frameRef.current !== null) return;
    const started = performance.now();
    let smoothed = 0.15;
    const tick = (now: number) => {
      const t = (now - started) / 1000;
      const syllables = 0.52 + 0.22 * Math.sin(t * 8.3) + 0.13 * Math.sin(t * 19.7 + 1.4);
      const phrase = 0.78 + 0.22 * Math.sin(t * 1.15 + 0.6);
      const target = Math.min(1, Math.max(0, syllables * phrase));
      smoothed += (target - smoothed) * 0.24;
      levelRef.current = smoothed;
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const finish = useCallback(() => {
    stopEnvelope();
    utteranceRef.current = null;
    setSpeaking(false);
    const callback = endCallbackRef.current;
    endCallbackRef.current = null;
    callback?.();
  }, [stopEnvelope]);

  const cancel = useCallback(() => {
    endCallbackRef.current = null;
    if (supported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* 何も話していない */
      }
    }
    stopEnvelope();
    utteranceRef.current = null;
    setSpeaking(false);
  }, [supported, stopEnvelope]);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      const plain = toSpeechText(text);
      if (!supported || !plain) {
        onEnd?.();
        return;
      }
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }

      const utterance = new SpeechSynthesisUtterance(plain);
      utterance.lang = 'ja-JP';
      utterance.rate = Math.min(1.6, Math.max(0.5, rateRef.current));
      utterance.pitch = 1;
      utterance.volume = 1;
      const voice = pickJapaneseVoice();
      if (voice) utterance.voice = voice;

      endCallbackRef.current = onEnd ?? null;
      utteranceRef.current = utterance;

      utterance.onend = () => finish();
      utterance.onerror = () => finish();

      // Chrome では onstart が遅れる／来ないことがあるので、UI は即座に speaking にする
      setSpeaking(true);
      startEnvelope();
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    },
    [finish, startEnvelope, supported],
  );

  useEffect(() => {
    return () => {
      if (supported) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* noop */
        }
      }
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [supported]);

  return { supported, speaking, levelRef, speak, cancel };
}
