import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * MediaRecorder でマイクの音を録り、停止時に Blob を返すフック。
 * ストリームは voice-ring の useMicrophone から受け取るので、
 * マイクの許可は 1 回で済む。
 */

export interface Recorder {
  recording: boolean;
  supported: boolean;
  start: (stream: MediaStream) => void;
  /** 停止して録音データを返す（データが無ければ null） */
  stop: () => Promise<Blob | null>;
  cancel: () => void;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

export function useRecorder(): Recorder {
  const supported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices;

  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  const settle = useCallback((blob: Blob | null) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(blob);
  }, []);

  const start = useCallback(
    (stream: MediaStream) => {
      if (!supported) return;
      // 前回が残っていたら片付ける
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          /* noop */
        }
      }
      const mimeType = pickMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 })
          : new MediaRecorder(stream);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      chunksRef.current = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = chunks.length ? new Blob(chunks, { type }) : null;
        recorderRef.current = null;
        setRecording(false);
        settle(blob && blob.size > 0 ? blob : null);
      };
      recorder.onerror = () => {
        recorderRef.current = null;
        setRecording(false);
        settle(null);
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
    },
    [settle, supported],
  );

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setRecording(false);
      return null;
    }
    return new Promise<Blob | null>((resolve) => {
      resolveRef.current = resolve;
      try {
        recorder.stop();
      } catch {
        settle(null);
      }
    });
  }, [settle]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* noop */
      }
    }
    chunksRef.current = [];
    setRecording(false);
    settle(null);
  }, [settle]);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  return { recording, supported, start, stop, cancel };
}
