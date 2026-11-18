import { useCallback, useEffect, useRef, useState } from 'react';
import { useMicrophone } from 'voice-ring';
import { AppHeader } from './components/AppHeader';
import { ChatThread } from './components/ChatThread';
import { Composer } from './components/Composer';
import { SettingsDialog } from './components/SettingsDialog';
import { StatusCard } from './components/StatusCard';
import { SuggestionGrid } from './components/SuggestionGrid';
import { VoiceStage } from './components/VoiceStage';
import { WelcomeScreen } from './components/WelcomeScreen';
import type { ApiKeySubmitResult } from './components/ApiKeyCard';
import { useMediaQuery, useTheme } from './hooks/useTheme';
import { useRecorder } from './hooks/useRecorder';
import { useSpeaker } from './hooks/useSpeaker';
import {
  describeError,
  streamChat,
  transcribeAudio,
  verifyApiKey,
  type ChatTurn,
} from './lib/groq';
import { isBusyPhase } from './lib/phase';
import {
  loadApiKey,
  loadMessages,
  loadSettings,
  saveApiKey,
  saveMessages,
  saveSettings,
} from './lib/storage';
import { uid } from './lib/util';
import { TRANSCRIBE_LANG, type ChatMessage, type Phase, type Settings } from './types';
import './styles.css';

const MAX_RECORDING_MS = 60_000;

function buildTurns(messages: ChatMessage[], systemPrompt: string, nextUser: string): ChatTurn[] {
  const turns: ChatTurn[] = [];
  if (systemPrompt.trim()) turns.push({ role: 'system', content: systemPrompt.trim() });
  const history = messages
    .filter((message) => !message.error && message.content.trim().length > 0)
    .slice(-20)
    .map<ChatTurn>((message) => ({ role: message.role, content: message.content }));
  turns.push(...history, { role: 'user', content: nextUser });
  return turns;
}

export default function App() {
  const { theme, toggleTheme } = useTheme();

  const [apiKey, setApiKey] = useState<string>(() => loadApiKey());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages());
  const [phase, setPhase] = useState<Phase>('idle');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const phaseRef = useRef<Phase>('idle');
  const messagesRef = useRef<ChatMessage[]>(messages);
  const abortRef = useRef<AbortController | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const speakingTokenRef = useRef(0);
  const listeningRef = useRef(false);

  const narrow = useMediaQuery('(max-width: 420px)');
  const small = useMediaQuery('(max-width: 640px)');
  const wide = useMediaQuery('(min-width: 1024px)');
  const ringSize = narrow ? 184 : small ? 212 : wide ? 248 : 228;

  const mic = useMicrophone({
    constraints: {
      echoCancellation: false,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });
  const recorder = useRecorder();
  const speaker = useSpeaker(settings.speechRate);

  const busy = isBusyPhase(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    messagesRef.current = messages;
    // ストリーミング中は差分ごとに localStorage へ書かないよう、少しだけまとめる
    const timer = window.setTimeout(() => saveMessages(messages), 400);
    return () => window.clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    return () => {
      if (autoStopRef.current !== null) window.clearTimeout(autoStopRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const applySettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const handleSaveKey = useCallback(async (key: string): Promise<ApiKeySubmitResult> => {
    const result = await verifyApiKey(key);
    if (result.ok) {
      setApiKey(key);
      saveApiKey(key);
      setError(null);
    }
    return { ok: result.ok, message: result.message };
  }, []);

  const handleClearKey = useCallback(() => {
    setApiKey('');
    saveApiKey('');
    setSettingsOpen(false);
    setPhase('idle');
    speaker.cancel();
    mic.stop();
  }, [mic, speaker]);

  const handleClearMessages = useCallback(() => {
    setMessages([]);
    setStreamingId(null);
    setError(null);
    setPhase('idle');
    speaker.cancel();
  }, [speaker]);

  const stopSpeaking = useCallback(() => {
    speakingTokenRef.current += 1;
    speaker.cancel();
    if (phaseRef.current === 'speaking') setPhase('idle');
  }, [speaker]);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text) return;
      if (!apiKey) {
        setError('先に Groq の APIキーを設定してください。');
        return;
      }
      if (isBusyPhase(phaseRef.current)) return;

      speakingTokenRef.current += 1;
      speaker.cancel();
      setError(null);
      setInput('');

      const userMessage: ChatMessage = {
        id: uid('u'),
        role: 'user',
        content: text,
        createdAt: Date.now(),
      };
      const assistantId = uid('a');
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      };
      const history = buildTurns(messagesRef.current, settings.systemPrompt, text);

      setMessages((current) => [...current, userMessage, assistantMessage]);
      setStreamingId(assistantId);
      setPhase('thinking');

      const controller = new AbortController();
      abortRef.current = controller;
      let firstToken = false;

      try {
        const full = await streamChat({
          apiKey,
          model: settings.model,
          messages: history,
          signal: controller.signal,
          onDelta: (delta) => {
            if (!firstToken) {
              firstToken = true;
              setPhase('writing');
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + delta }
                  : message,
              ),
            );
          },
        });

        setStreamingId(null);

        if (!full.trim()) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: '（返答が空でした。もう一度お試しください）', error: true }
                : message,
            ),
          );
          setPhase('idle');
          return;
        }

        if (settings.ttsEnabled && speaker.supported) {
          const token = ++speakingTokenRef.current;
          setPhase('speaking');
          speaker.speak(full, () => {
            if (speakingTokenRef.current === token) setPhase('idle');
          });
        } else {
          setPhase('idle');
        }
      } catch (err) {
        setStreamingId(null);
        const aborted =
          controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
        const description = describeError(err);

        setMessages((current) =>
          current.map((message) => {
            if (message.id !== assistantId) return message;
            if (aborted) {
              return message.content
                ? message
                : { ...message, content: '（生成を中止しました）', error: false };
            }
            return message.content
              ? message
              : { ...message, content: description, error: true };
          }),
        );

        if (!aborted) setError(description);
        setPhase('idle');
      } finally {
        abortRef.current = null;
      }
    },
    [apiKey, input, settings.model, settings.systemPrompt, settings.ttsEnabled, speaker],
  );

  const finishListening = useCallback(async () => {
    listeningRef.current = false;
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const blob = await recorder.stop();
    mic.stop();

    if (!blob || blob.size < 1000) {
      setPhase('idle');
      setError('音声が短すぎました。もう少し長く話してみてください。');
      return;
    }

    setPhase('transcribing');
    try {
      const text = await transcribeAudio({ apiKey, blob, language: TRANSCRIBE_LANG });
      setPhase('idle');
      if (!text) {
        setError('音声を文字にできませんでした。静かな場所でもう一度お試しください。');
        return;
      }
      await send(text);
    } catch (err) {
      setPhase('idle');
      setError(describeError(err));
    }
  }, [apiKey, mic, recorder, send]);

  const beginListening = useCallback(async () => {
    if (listeningRef.current || isBusyPhase(phaseRef.current)) return;
    setError(null);
    speakingTokenRef.current += 1;
    speaker.cancel();
    listeningRef.current = true;
    setPhase('listening');

    const stream = await mic.start();
    if (!stream) {
      listeningRef.current = false;
      setPhase('idle');
      return;
    }
    // 許可待ちの間にユーザーが停止した場合、録音は始めずマイクだけ閉じる
    if (!listeningRef.current) {
      mic.stop();
      return;
    }
    recorder.start(stream);
    autoStopRef.current = window.setTimeout(() => {
      autoStopRef.current = null;
      void finishListening();
    }, MAX_RECORDING_MS);
  }, [finishListening, mic, recorder, speaker]);

  const toggleMic = useCallback(() => {
    if (listeningRef.current) {
      void finishListening();
      return;
    }
    void beginListening();
  }, [beginListening, finishListening]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const toggleTts = useCallback(() => {
    setSettings((current) => {
      const next = { ...current, ttsEnabled: !current.ttsEnabled };
      if (!next.ttsEnabled) {
        speakingTokenRef.current += 1;
        speaker.cancel();
        if (phaseRef.current === 'speaking') setPhase('idle');
      }
      return next;
    });
  }, [speaker]);

  const handleSuggestion = useCallback(
    (prompt: string) => {
      setInput(prompt);
      void send(prompt);
    },
    [send],
  );

  const canUseMic = mic.supported;
  const listening = phase === 'listening';

  return (
    <div className="app">
      <AppHeader
        theme={theme}
        hasKey={Boolean(apiKey)}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {!apiKey ? (
        <main className="main main--welcome">
          <WelcomeScreen theme={theme} onSaveKey={handleSaveKey} />
        </main>
      ) : (
        <main className="main">
          <div className="workspace">
            <div className="rail">
              <VoiceStage
                theme={theme}
                phase={phase}
                ringType={settings.ringType}
                ringSize={ringSize}
                stream={listening ? mic.stream : null}
                levelRef={speaker.levelRef}
                micState={mic.state}
                micSupported={canUseMic}
                speaking={speaker.speaking}
                onToggleMic={toggleMic}
                onStopSpeaking={stopSpeaking}
                onOpenSettings={() => setSettingsOpen(true)}
              />

              <StatusCard
                theme={theme}
                phase={phase}
                settings={settings}
                apiKey={apiKey}
                micState={mic.state}
                ttsSupported={speaker.supported}
                onOpenSettings={() => setSettingsOpen(true)}
                onToggleTts={toggleTts}
                onToggleRingType={() =>
                  applySettings({ ringType: settings.ringType === 'ring' ? 'mono' : 'ring' })
                }
              />
            </div>

            <section className="chat-panel" aria-label="会話">
              <div className="chat-panel__head">
                <h2 className="chat-panel__title">会話</h2>
                <div className="chat-panel__tools">
                  <span className="chip chip--muted">{messages.length} 件</span>
                  <button
                    type="button"
                    className="btn btn--link btn--sm"
                    onClick={handleClearMessages}
                    disabled={messages.length === 0}
                  >
                    消去
                  </button>
                </div>
              </div>

              {messages.length === 0 ? (
                <div className="chat-empty">
                  <p className="chat-empty__lead">
                    まだ会話はありません。下の例を押すか、マイクに向かって話しかけてください。
                  </p>
                  <SuggestionGrid theme={theme} onPick={handleSuggestion} disabled={busy} />
                </div>
              ) : (
                <ChatThread theme={theme} messages={messages} phase={phase} streamingId={streamingId} />
              )}

              {error && (
                <div className="notice notice--error notice--dismiss" role="alert">
                  <span>{error}</span>
                  <button type="button" className="notice__close" onClick={() => setError(null)} aria-label="閉じる">
                    ×
                  </button>
                </div>
              )}

              <Composer
                theme={theme}
                phase={phase}
                value={input}
                onChange={setInput}
                onSend={() => void send()}
                onToggleMic={toggleMic}
                onStop={stopGeneration}
                micSupported={canUseMic}
                stream={listening ? mic.stream : null}
                levelRef={speaker.levelRef}
                ttsEnabled={settings.ttsEnabled}
                ttsSupported={speaker.supported}
                onToggleTts={toggleTts}
                disabled={!apiKey || listening}
              />
            </section>
          </div>
        </main>
      )}

      <SettingsDialog
        open={settingsOpen && Boolean(apiKey)}
        theme={theme}
        settings={settings}
        apiKey={apiKey}
        messageCount={messages.length}
        onClose={() => setSettingsOpen(false)}
        onChange={applySettings}
        onSaveKey={handleSaveKey}
        onClearKey={handleClearKey}
        onClearMessages={handleClearMessages}
      />

      <p className="sr-only" aria-live="polite">
        {phase === 'listening' ? '録音中です' : phase === 'idle' ? '' : `状態: ${phase}`}
      </p>
    </div>
  );
}
