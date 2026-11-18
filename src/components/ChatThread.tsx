import { useEffect, useRef, useState } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import { inlineOrbStateFor } from '../lib/phase';
import { formatTime } from '../lib/util';
import type { ChatMessage, Phase, Theme } from '../types';
import { CheckIcon, CopyIcon } from './Icons';

interface ChatThreadProps {
  theme: Theme;
  messages: ChatMessage[];
  phase: Phase;
  /** ストリーミング中のメッセージ id */
  streamingId: string | null;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
      } catch {
        /* 失敗しても表示だけは続ける */
      }
      document.body.removeChild(area);
    }
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return { copied, copy };
}

function MessageRow({
  message,
  theme,
  isStreaming,
  phase,
}: {
  message: ChatMessage;
  theme: Theme;
  isStreaming: boolean;
  phase: Phase;
}) {
  const { copied, copy } = useCopy();
  const isUser = message.role === 'user';
  const waiting = !isUser && isStreaming && message.content.length === 0;

  if (isUser) {
    return (
      <div className="message message--user">
        <div className="message__bubble">
          <p className="message__text">{message.content}</p>
        </div>
        <span className="message__time">{formatTime(message.createdAt)}</span>
      </div>
    );
  }

  return (
    <div className={`message message--assistant${message.error ? ' message--error' : ''}`}>
      <div className="message__avatar" aria-hidden="true">
        <ThinkingOrb
          theme={theme}
          state={inlineOrbStateFor(waiting ? phase : 'writing')}
          size={20}
          paused={!isStreaming}
        />
      </div>
      <div className="message__body">
        <div className="message__meta">
          <span className="message__author">AI</span>
          <span className="message__time">{formatTime(message.createdAt)}</span>
          {message.content && (
            <button
              type="button"
              className="message__copy"
              onClick={() => void copy(message.content)}
              aria-label="この返答をコピー"
            >
              {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
              <span>{copied ? 'コピー済み' : 'コピー'}</span>
            </button>
          )}
        </div>
        {waiting ? (
          <p className="message__thinking">
            <ThinkingOrb theme={theme} state={inlineOrbStateFor(phase)} size={20} aria-hidden="true" />
            <span>考えています…</span>
          </p>
        ) : (
          <p className="message__text">
            {message.content}
            {isStreaming && <span className="caret" aria-hidden="true" />}
          </p>
        )}
      </div>
    </div>
  );
}

export function ChatThread({ theme, messages, phase, streamingId }: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      stickToBottomRef.current = distance < 96;
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !stickToBottomRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, phase]);

  return (
    <div className="chat-scroll" ref={scrollRef} aria-live="polite" aria-busy={phase !== 'idle'}>
      {messages.map((message) => (
        <MessageRow
          key={message.id}
          message={message}
          theme={theme}
          isStreaming={message.id === streamingId}
          phase={phase}
        />
      ))}
    </div>
  );
}
