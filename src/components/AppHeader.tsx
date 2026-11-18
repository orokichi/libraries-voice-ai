import type { Theme } from '../types';
import { GearIcon, MoonIcon, SunIcon } from './Icons';

interface AppHeaderProps {
  theme: Theme;
  hasKey: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export function AppHeader({ theme, hasKey, onToggleTheme, onOpenSettings }: AppHeaderProps) {
  return (
    <header className="header">
      <div className="header__inner">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="brand__text">
            <span className="brand__name">Libraries Voice</span>
            <span className="brand__sub">Groq 音声アシスタント</span>
          </span>
        </div>

        <div className="header__actions">
          <button
            type="button"
            className="icon-button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}
            title={theme === 'dark' ? 'ライトテーマ' : 'ダークテーマ'}
          >
            {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onOpenSettings}
            aria-label="設定を開く"
            title="設定"
            disabled={!hasKey}
          >
            <GearIcon width={18} height={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
