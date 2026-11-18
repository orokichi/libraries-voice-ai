import { BorderBeam } from 'border-beam';
import type { BorderBeamColorVariant } from 'border-beam';
import type { Theme } from '../types';

interface Suggestion {
  tag: string;
  title: string;
  prompt: string;
  variant: BorderBeamColorVariant;
}

const SUGGESTIONS: Suggestion[] = [
  {
    tag: '整理',
    title: '今日のことを3つに絞る',
    prompt: '今日やることを3つに絞りたいです。優先順位の決め方を短く教えてください。',
    variant: 'ocean',
  },
  {
    tag: 'しくみ',
    title: 'Groq でできること',
    prompt: 'Groq API でできることを、音声アシスタントに使える順に3つ教えてください。',
    variant: 'colorful',
  },
  {
    tag: 'ことば',
    title: '英語を自然な日本語に',
    prompt: '英語の文章を自然な日本語に訳してほしいです。まず翻訳のコツを1つ教えてください。',
    variant: 'candy',
  },
  {
    tag: 'コード',
    title: 'エラーの切り分け方',
    prompt: 'TypeScript で型エラーが出たときの切り分け手順を、短く3ステップで教えてください。',
    variant: 'forest',
  },
];

interface SuggestionGridProps {
  theme: Theme;
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

export function SuggestionGrid({ theme, onPick, disabled = false }: SuggestionGridProps) {
  return (
    <div className="suggestions" aria-label="話しかけ方の例">
      {SUGGESTIONS.map((suggestion) => (
        <BorderBeam
          key={suggestion.title}
          theme={theme}
          size="md"
          colorVariant={suggestion.variant}
          strength={0.85}
          borderRadius={20}
          className="beam-suggestion"
        >
          <button
            type="button"
            className="suggestion"
            onClick={() => onPick(suggestion.prompt)}
            disabled={disabled}
          >
            <span className="suggestion__tag">{suggestion.tag}</span>
            <span className="suggestion__title">{suggestion.title}</span>
            <span className="suggestion__prompt">{suggestion.prompt}</span>
          </button>
        </BorderBeam>
      ))}
    </div>
  );
}
